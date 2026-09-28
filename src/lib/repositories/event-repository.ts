
import { 
  getFirestore, 
  collection, 
  getDocs, 
  addDoc, 
  deleteDoc, 
  updateDoc,
  doc, 
  query,
} from 'firebase/firestore';
import type { MatchEvent } from '@/lib/types';

const periodOrder: Record<string, number> = {
    '1T': 1,
    '2T': 2,
    '1TS': 3,
    '2TS': 4
};

export const eventRepository = {
    async getForMatch(matchId: string, seasonId: string, userId: string) {
        if (!matchId || !seasonId || !userId) return [];
        const db = getFirestore();
        const eventsRef = collection(db, 'teams', seasonId, 'matches', matchId, 'events');
        
        const q = query(eventsRef);
        
        const snapshot = await getDocs(q);
        const events = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as MatchEvent));
        
        return events.sort((a, b) => {
            const pA = periodOrder[a.period] || 0;
            const pB = periodOrder[b.period] || 0;
            if (pA !== pB) {
                return pA - pB;
            }
            return (a.minute ?? 0) - (b.minute ?? 0);
        });
    },

    async add(event: Omit<MatchEvent, 'id'>, seasonId: string, userId: string) {
        const db = getFirestore();
        const eventsRef = collection(db, 'teams', seasonId, 'matches', event.matchId, 'events');
        
        // Firestore non accetta 'undefined'. Rimuoviamo i campi nulli o indefiniti.
        const cleanedEvent = Object.fromEntries(
            Object.entries(event).filter(([_, v]) => v !== undefined && v !== null)
        );

        const eventWithAuth = {
            ...cleanedEvent,
            teamOwnerId: userId,
            createdAt: new Date().toISOString()
        };
        const docRef = await addDoc(eventsRef, eventWithAuth);
        return { ...event, id: docRef.id, teamOwnerId: userId } as MatchEvent;
    },

    async delete(id: string, matchId: string, seasonId: string) {
        const db = getFirestore();
        const docRef = doc(db, 'teams', seasonId, 'matches', matchId, 'events', id);
        return await deleteDoc(docRef);
    },

    async update(id: string, matchId: string, seasonId: string, data: Partial<Omit<MatchEvent, 'id'>>) {
        const db = getFirestore();
        const docRef = doc(db, 'teams', seasonId, 'matches', matchId, 'events', id);
        
        const cleanedData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => v !== undefined)
        );

        return await updateDoc(docRef, cleanedData);
    }
};
