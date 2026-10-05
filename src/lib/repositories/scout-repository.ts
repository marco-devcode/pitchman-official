'use client';

/**
 * Osservati e categorie: ora un dato di SQUADRA, non personale.
 *
 * PRIMA stavano in `users/{uid}/scoutPlayers` e `users/{uid}/scoutCategories`:
 * quattro file hardcodavano quel path e le rules li rendevano leggibili solo
 * al proprietario. Il direttore sportivo non poteva quindi vedere chi era
 * osservato, che e' esattamente il suo mestiere.
 *
 * ADESSO stanno in `teams/{seasonId}/scouts` e
 * `teams/{seasonId}/scoutCategories`, quindi sono condivisi come tutti gli altri
 * dati di squadra, e `isSeasonAuthorized` li apre a chi e' nella stagione.
 *
 * `this.ref(seasonId)` e' l'UNICO posto dove il path e' scritto. I quattro
 * chiamanti che avevano ognuno la propria stringa ora passano di qui: quattro
 * copie del path sono quattro punti in cui il prossimo refactor ne lascia tre.
 */
import {
  getFirestore,
  collection,
  getDocs,
  getDoc,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import type { ScoutPlayer, ScoutCategory } from '@/lib/types';
import { ScoutPlayerSchema, ScoutCategorySchema } from '@/lib/schemas';

export const scoutRepository = {
  /** Osservati della stagione. */
  ref(seasonId: string) {
    return collection(getFirestore(), 'teams', seasonId, 'scouts');
  },

  /** Categorie degli osservati della stagione. */
  categoriesRef(seasonId: string) {
    return collection(getFirestore(), 'teams', seasonId, 'scoutCategories');
  },

  async create(userId: string, seasonId: string, player: Omit<ScoutPlayer, 'id'>): Promise<string> {
    const newDocRef = doc(this.ref(seasonId));
    // `teamOwnerId` e `seasonId` servono alle rules: `incomingIsAuthorized`
    // legge `teamOwnerId` per autorizzare la scrittura, e il documento senza
    // `seasonId` non puo' essere ripulito da "Elimina account".
    const data = { ...player, id: newDocRef.id, teamOwnerId: userId, seasonId };
    await setDoc(newDocRef, ScoutPlayerSchema.parse(data));
    return newDocRef.id;
  },

  async update(userId: string, seasonId: string, id: string, player: Omit<ScoutPlayer, 'id'>): Promise<void> {
    await updateDoc(doc(this.ref(seasonId), id), {
      ...player,
      teamOwnerId: userId,
      updatedAt: new Date().toISOString(),
    });
  },

  async remove(seasonId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.ref(seasonId), id));
  },

  async list(seasonId: string): Promise<ScoutPlayer[]> {
    const snapshot = await getDocs(this.ref(seasonId));
    return snapshot.docs.map(d => {
      const parsed = ScoutPlayerSchema.safeParse({ ...d.data(), id: d.id });
      return parsed.success ? parsed.data : ({ ...d.data(), id: d.id } as ScoutPlayer);
    });
  },

  async get(seasonId: string, id: string): Promise<ScoutPlayer | null> {
    const snapshot = await getDoc(doc(this.ref(seasonId), id));
    if (!snapshot.exists()) return null;
    const parsed = ScoutPlayerSchema.safeParse({ ...snapshot.data(), id });
    return parsed.success ? parsed.data : (snapshot.data() as ScoutPlayer);
  },

  // ── Categorie ────────────────────────────────────────────

  async createCategory(seasonId: string, category: Omit<ScoutCategory, 'id'>): Promise<string> {
    const newDocRef = doc(this.categoriesRef(seasonId));
    await setDoc(newDocRef, ScoutCategorySchema.parse({ ...category, id: newDocRef.id }));
    return newDocRef.id;
  },

  async updateCategory(seasonId: string, id: string, category: Omit<ScoutCategory, 'id'>): Promise<void> {
    await updateDoc(doc(this.categoriesRef(seasonId), id), category);
  },

  async removeCategory(seasonId: string, id: string): Promise<void> {
    await deleteDoc(doc(this.categoriesRef(seasonId), id));
  },

  async listCategories(seasonId: string): Promise<ScoutCategory[]> {
    const snapshot = await getDocs(this.categoriesRef(seasonId));
    return snapshot.docs.map(d => {
      const parsed = ScoutCategorySchema.safeParse({ ...d.data(), id: d.id });
      return parsed.success ? parsed.data : ({ ...d.data(), id: d.id } as ScoutCategory);
    });
  },
};