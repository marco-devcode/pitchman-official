import { 
  collection, 
  query, 
  where, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  arrayUnion, 
  writeBatch, 
  getFirestore, 
  or 
} from 'firebase/firestore';
import type { Season } from '@/lib/types';
import { SeasonSchema } from '@/lib/schemas';
import { activeSeasonRepository } from '@/lib/repositories/active-season-repository';

export const seasonRepository = {
    async getAll(userId: string) {
        if (!userId) return [];
        const db = getFirestore();
        const seasonsRef = collection(db, 'teams');
        
        // Fetch seasons where user is owner OR where user is in sharedWith array
        const q = query(
          seasonsRef, 
          or(
            where('ownerId', '==', userId),
            where('sharedWith', 'array-contains', userId)
          )
        );
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => {
          const data = { ...doc.data(), id: doc.id };
          const parsed = SeasonSchema.safeParse(data);
          if (!parsed.success) {
            console.error("Schema validation failed for Season:", parsed.error);
            return data as Season;
          }
          return parsed.data as Season;
        });
    },

    async getById(id: string) {
        if (!id) return undefined;
        const db = getFirestore();
        const docRef = doc(db, 'teams', id);
        const snapshot = await getDoc(docRef);
        return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id } as Season : undefined;
    },

    async getActive(userId: string) {
        if (!userId) return undefined;
        const seasons = await this.getAll(userId);
        return seasons.find(s => s.isActive);
    },

    async add(name: string, userId: string) {
        const db = getFirestore();
        const shortRandom = Math.random().toString(36).substring(2, 7).toUpperCase();
        const id = `S-${shortRandom}`;
        
        const newSeason: Season = { 
            id, 
            userId, 
            ownerId: userId, 
            name, 
            isActive: false,
            sharedWith: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'teams', id), newSeason);
        return newSeason;
    },

    async joinSeason(seasonId: string, userId: string) {
        const db = getFirestore();
        const seasonRef = doc(db, 'teams', seasonId);
        // Errori con testo gia' scritto per l'utente: parseError li lascia
        // passare invece di sostituirli con "errore imprevisto".
        const userError = (message: string) =>
            Object.assign(new Error(message), { userFacing: true });

        // PASSO 1: verificare che il codice corrisponda a una stagione.
        // Questa lettura veniva negata dalle regole (si puo' leggere solo la
        // propria stagione o quelle in cui si e' gia' dentro), quindi il join
        // falliva subito qui con "Missing or insufficient permissions".
        let seasonSnap;
        try {
            seasonSnap = await getDoc(seasonRef);
        } catch (e: any) {
            console.error("[join] lettura stagione fallita:", e);
            throw userError(
                `Non riesco a leggere la stagione con il codice "${seasonId}". ` +
                `Se l'hai creata su un altro account o le regole non sono ancora state pubblicate, ` +
                `quello che vedi è un problema di permessi, non un codice sbagliato.`
            );
        }

        if (!seasonSnap.exists()) {
            throw userError("Stagione non trovata. Controlla il codice d'invito.");
        }

        const seasonData = seasonSnap.data() as Season;
        if (seasonData.ownerId === userId) {
            throw userError("Sei già il proprietario di questa stagione.");
        }

        if (seasonData.sharedWith?.includes(userId)) {
            throw userError("Hai già partecipato a questa stagione.");
        }

        // PASSO 2: aggiungersi. Scrive solo sharedWith e updatedAt, e la
        // regola permette a un non-proprietario esattamente questa forma.
        try {
            await updateDoc(seasonRef, {
                sharedWith: arrayUnion(userId),
                updatedAt: new Date().toISOString()
            });
        } catch (e: any) {
            console.error("[join] iscrizione fallita:", e);
            const negato = e?.code === 'permission-denied' ||
                /insufficient permissions/i.test(e?.message ?? '');
            throw userError(negato
                ? `Accesso negato: le regole del database non permettono ancora di entrare con il codice. ` +
                  `Le regole Firestore vanno pubblicate (firebase deploy --only firestore:rules).`
                : `Non riesco a entrare nella stagione "${seasonId}". Riprova.`
            );
        }

        return seasonSnap.id;
    },

    async setActive(id: string, userId: string) {
        if (!userId) return;
        const db = getFirestore();
        const batch = writeBatch(db);
        
        // Fetch all seasons the user has access to (needed to deactivate others)
        const seasons = await this.getAll(userId);
        
        // Deactivate all that are currently active
        seasons.forEach(season => {
            if (season.isActive && season.id !== id) {
                batch.update(doc(db, 'teams', season.id), { isActive: false, updatedAt: new Date().toISOString() });
            }
        });
        
        // Activate target season
        batch.update(doc(db, 'teams', id), { isActive: true, updatedAt: new Date().toISOString() });
        
        await batch.commit();
    },

    async delete(id: string) {
        const db = getFirestore();
        
        // Delete all subcollections in parallel
        const subcollections = ['players', 'matches', 'sessions', 'events', 'trainings'];
        
        await Promise.all(subcollections.map(async (sub) => {
            try {
                const subRef = collection(db, 'teams', id, sub);
                const subSnap = await getDocs(subRef);
                if (subSnap.empty) return;
                
                let batch = writeBatch(db);
                let count = 0;
                
                for (const d of subSnap.docs) {
                    batch.delete(d.ref);
                    count++;
                    if (count >= 499) {
                        await batch.commit();
                        batch = writeBatch(db);
                        count = 0;
                    }
                }
                
                if (count > 0) {
                    await batch.commit();
                }
            } catch (err: any) {
                console.error(`[seasonRepository.delete] ${sub}: FAILED -`, err?.code, err?.message);
                throw err;
            }
        }));
        
        // Delete the season document itself
        await deleteDoc(doc(db, 'teams', id));
    },

    async rename(id: string, newName: string) {
        const db = getFirestore();
        const docRef = doc(db, 'teams', id);
        return await updateDoc(docRef, { 
            name: newName, 
            updatedAt: new Date().toISOString() 
        });
    },

    async ensureDefaultSeason(userId: string) {
        if (!userId) return undefined;

        // Nulla di tutto questo puo' far fallire il caricamento delle stagioni.
        //
        // ensureDefaultSeason sta PRIMA di getAll in fetchAll: se solleva,
        // l'errore risale fino a fetchAll, che lo intercetta e lascia la lista
        // VUOTA. E' successo: un percorso del documento sbagliato faceva
        // fallire la scrittura della preferenza, e il sintomo era "nessuno
        // vede piu' le stagioni" per tutti gli utenti. La scelta della
        // stagione attiva e' una preferenza: se non si puo' salvare o leggere,
        // l'app deve comunque funzionare.
        try {
            const all = await this.getAll(userId);

            // La stagione attiva e' una scelta PERSONALE: si legge dal documento
            // dell'utente, non dal documento della stagione (che e' condiviso e
            // porterebbe a due allenatori con la stessa stagione attiva).
            const savedId = await activeSeasonRepository.get(userId);
            const saved = savedId ? all.find(s => s.id === savedId) : undefined;

            if (saved) return saved;

            // Nessuna scelta salvata, o scelta che non e' piu' raggiungibile
            // (stagione cancellata, o revocata la condivisione): si sceglie la
            // piu' recente e la si salva per questo utente.
            if (all.length > 0) {
                const target = all[0];
                await activeSeasonRepository.set(userId, target.id);
                return target;
            }
        } catch (e) {
            console.error("[seasonRepository.ensureDefaultSeason] continuo senza stagione attiva:", e);
            return undefined;
        }

        const defaultId = `S-DEFAULT-${userId.substring(0, 6).toUpperCase()}`;
        const db = getFirestore();
        
        const initialSeason: Season = { 
            id: defaultId, 
            userId, 
            ownerId: userId, 
            name: '2025/26', 
            isActive: true,
            sharedWith: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, 'teams', defaultId), initialSeason);
        return initialSeason;
    }
};
