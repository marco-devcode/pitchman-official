import { 
  getFirestore, 
  collection, 
  getDocs, 
  getDoc, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  writeBatch
} from 'firebase/firestore';
import type { Match } from '@/lib/types';
import { MatchSchema } from '@/lib/schemas';

/**
 * Utility per garantire che la data sia sempre una stringa ISO valida,
 * gestendo sia stringhe che oggetti Timestamp di Firestore.
 */
const ensureISODate = (date: any): string => {
  if (!date) return new Date().toISOString();
  if (typeof date === 'string') return date;
  if (date instanceof Date) return date.toISOString();
  if (date && typeof date.toDate === 'function') return date.toDate().toISOString();
  try {
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  } catch {
    return new Date().toISOString();
  }
};

export type MatchCreateData = Omit<Match, 'id' | 'result' | 'teamOwnerId' | 'teamId'> & { 
  teamOwnerId?: string;
  teamId?: string;
  status?: Match['status']; 
};

export const matchRepository = {
  async getAll(userId: string, seasonId: string) {
    if (!userId || !seasonId) return [];
    const db = getFirestore();
    const matchesRef = collection(db, 'teams', seasonId, 'matches');
    const q = query(matchesRef);
    const snapshot = await getDocs(q);
    const matches = snapshot.docs.map(doc => {
      const data = doc.data();
      const rawMatch = { 
        ...data, 
        id: doc.id,
        date: ensureISODate(data.date)
      };
      const parsed = MatchSchema.safeParse(rawMatch);
      if (!parsed.success) {
        console.error("Schema validation failed for Match:", parsed.error, rawMatch);
        return rawMatch as Match;
      }
      return parsed.data;
    });
    return matches.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  },
  
  async getById(id: string, seasonId: string) {
    if (!id || !seasonId) return undefined;
    const db = getFirestore();
    const docRef = doc(db, 'teams', seasonId, 'matches', id);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return undefined;
    const data = snapshot.data();
    return { 
      ...data, 
      id: snapshot.id,
      date: ensureISODate(data.date)
    } as Match;
  },

  async add(data: MatchCreateData) {
    const db = getFirestore();
    const shortRandom = Math.random().toString(36).substring(2, 7).toUpperCase();
    const id = `M-${shortRandom}`;
    
    const newMatch: Match = {
      ...data,
      id,
      status: data.status || 'scheduled',
      date: ensureISODate(data.date),
      teamOwnerId: data.userId,
      teamId: data.seasonId,
      seasonId: data.seasonId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await setDoc(doc(db, 'teams', data.seasonId, 'matches', id), newMatch);
    return newMatch;
  },

  async bulkAdd(matchesData: Omit<MatchCreateData, 'userId' | 'seasonId' | 'teamOwnerId' | 'teamId'>[], userId: string, seasonId: string) {
    const db = getFirestore();
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    
    const addedMatches: Match[] = matchesData.map(data => {
      const shortRandom = Math.random().toString(36).substring(2, 7).toUpperCase();
      const id = `M-${shortRandom}`;
      const match: Match = {
        ...data,
        id,
        userId,
        teamOwnerId: userId,
        teamId: seasonId,
        seasonId,
        status: data.status || 'scheduled',
        date: ensureISODate(data.date),
        createdAt: now,
        updatedAt: now
      };
      const docRef = doc(db, 'teams', seasonId, 'matches', id);
      batch.set(docRef, match);
      return match;
    });

    await batch.commit();
    return addedMatches;
  },

  async update(id: string, seasonId: string, updates: Partial<Omit<Match, 'id' | 'userId' | 'seasonId'>>) {
    const db = getFirestore();
    const docRef = doc(db, 'teams', seasonId, 'matches', id);
    
    const preparedUpdates = { ...updates };
    if (preparedUpdates.date) {
      preparedUpdates.date = ensureISODate(preparedUpdates.date);
    }
    
    const updatesWithTimestamp = { ...preparedUpdates, updatedAt: new Date().toISOString() };
    await updateDoc(docRef, updatesWithTimestamp);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? { ...snapshot.data(), id: snapshot.id, date: ensureISODate(snapshot.data().date) } as Match : undefined;
  },

  async delete(id: string, seasonId: string) {
    if (!id || !seasonId) return;
    const db = getFirestore();
    return await deleteDoc(doc(db, 'teams', seasonId, 'matches', id));
  },

  async deleteAll(userId: string, seasonId: string) {
    if (!userId || !seasonId) return;
    const db = getFirestore();
    const matchesRef = collection(db, 'teams', seasonId, 'matches');
    const q = query(matchesRef);
    const snapshot = await getDocs(q);
    
    if (snapshot.empty) return;
    
    const batch = writeBatch(db);
    snapshot.docs.forEach(d => {
        batch.delete(d.ref);
    });
    await batch.commit();
  }
};