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
import { authHeaders } from '@/lib/api-client';

export const seasonRepository = {
    /**
     * Le stagioni dell'utente, da `GET /api/seasons`.
     *
     * PRIMA faceva la query dal client: `where('ownerId','==',uid) OR
     * where('sharedWith','array-contains',uid)`. Con le regole v2 quella query
     * non e' piu' utilizzabile perche' le regole non possono valutare un OR su
     * due campi diverse per ogni documento, e perche' l'appartenenza si legge
     * ora anche da `members`/`memberUids`. Il server fa tre query e le unisce.
     *
     * Nota sul perimetro: il server restituisce anche le stagioni in cui
     * l'utente e' dentro tramite `sharedWith` (il percorso legacy). Sono
     * stagioni che l'utente VEDE gia' oggi nell'app: ometterle lo lascerebbe con
     * una stagione gia' aperta che sparisce dalla lista.
     */
    async getAll(userId: string) {
        if (!userId) return [];

        const res = await fetch('/api/seasons', { headers: await authHeaders() });
        if (!res.ok) {
            console.error('[seasonRepository.getAll] fallita:', res.status);
            return [];
        }

        const body = await res.json().catch(() => null);
        const stagioni = (body?.seasons ?? []) as Array<Record<string, unknown>>;

        return stagioni.map((raw) => {
            const data = { ...raw, id: raw.id };
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
        // NON usare `seasons.find(s => s.isActive)`: il campo isActive sui
        // documenti delle stagioni e' stantio (potenzialmente true su piu'
        // righe, perche' nessuno lo puliva piu') e darebbe un risultato
        // arbitrario. La sorgente vera e' il documento utente.
        const savedId = await activeSeasonRepository.get(userId);
        if (!savedId) return undefined;
        const seasons = await this.getAll(userId);
        return seasons.find(s => s.id === savedId);
    },

    /**
     * Crea una stagione via `POST /api/seasons`, non col client SDK.
     *
     * LA SCELTA E' OBBLIGATA, non una preferenza. Le Security Rules v2 hanno
     * `allow create: if false` su `teams/{seasonId}`, perche' il documento porta
     * `members`, `memberUids`, `plan` e `limits`: se il client potesse
     * scriverli, leggere le regole gli basterebbe per crearsi una stagione con
     * mille membri o il piano che preferisce. Con `create: false` l'unica via e'
     * il server.
     *
     * E' anche la via giusta per un secondo motivo: l'id della stagione lo
     * genera il server con `crypto.randomBytes`. Qui era `Math.random()`, che
     * e' un PRNG: il suo stato si ricava dai suoi output, e quell'id e' cioe'
     * la chiave che autorizza l'accesso ai dati di una squadra. Predicibile
     * vuol dire indovinabile.
     */
    async add(name: string, userId: string) {
        const res = await fetch('/api/seasons', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ name }),
        });
        const body = await res.json().catch(() => null);

        if (!res.ok) {
            throw Object.assign(
                new Error(body?.error?.message || 'Non riesco a creare la stagione.'),
                { userFacing: true },
            );
        }

        // Il documento appena creato viene riletto: restituirlo qui senza
        // rileggerlo lascerebbe fuori `members` e `limits`, che lo store e la
        // UI si aspettano di trovare.
        return (await this.getById(body.id)) as Season;
    },

    /**
     * Entra in una stagione con `POST /api/invites/redeem`.
     *
     * LA SCELTA E' OBBLIGATA. Il vecchio percorso scriveva `sharedWith` dal
     * client, e le regole v2 vietano a un non-proprietario di scrivere il
     * documento della stagione: solo l'owner puo' toccare i campi di profilo. Il
     * join quindi deve passare dal server, che verifica codice, scadenza, uso e
     * tetto membri dentro una transazione.
     *
     * E' anche piu' sicuro per l'utente: il server distingue "codice sbagliato"
     * da "stagione piena" da "gia' dentro", e controlla il tetto membri che il
     * client non poteva verificare.
     *
     * I CODICI ESISTENTI restano validi per 30 giorni dalla migrazione, quindi
     * chi li ha gia' passato continua a poterli usare.
     */
    async joinSeason(seasonId: string, userId: string) {
        const userError = (message: string) =>
            Object.assign(new Error(message), { userFacing: true });

        const res = await fetch('/api/invites/redeem', {
            method: 'POST',
            headers: await authHeaders(),
            body: JSON.stringify({ code: seasonId }),
        });
        const body = await res.json().catch(() => null);

        if (res.ok) return body.seasonId as string;

        const codice = body?.error?.code as string | undefined;
        const messaggio = body?.error?.message as string | undefined;

        switch (codice) {
            case 'ALREADY_MEMBER':
                throw userError('Hai gia\' partecipato a questa stagione.');
            case 'MEMBERS_FULL':
                throw userError(messaggio ?? 'Questa stagione ha gia\' tutto lo staff che puo\' avere.');
            case 'INVITE_INVALID':
                throw userError('Codice non valido o scaduto.');
            case 'UNAUTHORIZED':
                throw userError('Devi essere collegato per entrare in una stagione.');
            case 'RATE_LIMITED':
                throw userError(messaggio ?? 'Hai provato troppi codici. Riprova fra poco.');
            default:
                console.error('[join] riscatto fallito:', codice, messaggio);
                throw userError(messaggio ?? `Non riesco a entrare nella stagione "${seasonId}".`);
        }
    },

    async setActive(id: string, userId: string) {
        if (!userId || !id) return;
        // Scrive nel documento dell'utente, non su quello della stagione.
        // La versione precedente faceva batch.update(isActive) su TUTTE le
        // stagioni: su una stagione condivisa la scrittura viene negata dalle
        // regole (un ospite puo' toccare solo sharedWith e updatedAt) e,
        // quando va a buon fine, cambia la stagione attiva anche del
        // proprietario. Vedi active-season-repository.
        await activeSeasonRepository.set(userId, id);
    },

    /**
     * Elimina la stagione con `DELETE /api/seasons/[id]`.
     *
     * LE REGOLE v2 hanno `allow delete: if false`: la cancellazione passa dal
     * server. E serve, perche' la versione client era INCOMPLETA. Elencava a
     * mano cinque sottocollection — players, matches, sessions, events,
     * trainings — e non sapeva di `physicalTests`, di `aggregates`, ne' delle
     * sottocollection dentro `matches` (lineup, events, stats) e dentro
     * `sessions` (attendance). La cancellazione riusciva e lasciava metà dei
     * dati di squadra a terra: senza errore, senza avviso, e con quei documenti
     * che nessuno poteva piu' cancellare perche' la stagione non esisteva piu'.
     *
     * `recursiveDelete` con l'Admin SDK copre tutto per costruzione: non c'è un
     * elenco da tenere aggiornato, quindi non c'è un posto dove possa
     * dimenticarsi una collection.
     */
    async delete(id: string) {
        const res = await fetch(`/api/seasons/${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: await authHeaders(),
        });
        const body = await res.json().catch(() => null);

        if (!res.ok) {
            console.error('[seasonRepository.delete] fallita:', body?.error?.code);
            throw Object.assign(
                new Error(body?.error?.message || 'Non riesco a eliminare la stagione.'),
                { userFacing: true },
            );
        }
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
            //
            // getAll NON e' ordinato: restituisce i documenti nell'ordine in
            // cui il server li restituisce, quindi all[0] era arbitrario. Su
            // due stagioni poteva scegliere quella sbagliata, ed e' cosi' che
            // un utente entrava con il codice e si ritrovava su una stagione
            // vuota, con quella giusta in lista ma mai attiva.
            if (all.length > 0) {
                const target = [...all].sort(
                    (a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
                )[0];
                await activeSeasonRepository.set(userId, target.id);
                return target;
            }
        } catch (e) {
            console.error("[seasonRepository.ensureDefaultSeason] continuo senza stagione attiva:", e);
            return undefined;
        }

        // La stagione di primo accesso si crea dal server, per lo stesso
        // motivo delle altre: `allow create: if false`. L'id non e' piu' derivato
        // dall'uid — quello era prevedibile, e l'id e' la chiave che autorizza
        // l'accesso ai dati.
        try {
            return (await this.add('2025/26', userId)) as Season;
        } catch (e) {
            console.error('[ensureDefaultSeason] creazione fallita:', e);
            return undefined;
        }
    }
};
