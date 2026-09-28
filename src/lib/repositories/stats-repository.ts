
import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc,
  query,
} from 'firebase/firestore';
import type { PlayerMatchStats } from '@/lib/types';

export type PlayerStatsUpdateData = Omit<PlayerMatchStats, 'matchId' | 'playerId'>;

export const statsRepository = {
    async getForMatch(matchId: string, seasonId: string, userId: string) {
        if (!matchId || !seasonId || !userId) return [];
        const db = getFirestore();
        const statsRef = collection(db, 'teams', seasonId, 'matches', matchId, 'stats');
        
        // Obbligatorio il filtro teamOwnerId per le Security Rules
        const q = query(statsRef);
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(doc => ({ ...doc.data(), playerId: doc.id } as PlayerMatchStats));
    },

    async upsert(matchId: string, seasonId: string, playerId: string, stats: PlayerStatsUpdateData, userId: string) {
        const db = getFirestore();
        const docRef = doc(db, 'teams', seasonId, 'matches', matchId, 'stats', playerId);
        const fullStats: PlayerMatchStats = { 
            matchId, 
            playerId, 
            ...stats,
            teamOwnerId: userId
        };
        await setDoc(docRef, fullStats);
        return fullStats;
    }
};
