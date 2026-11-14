"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { matchRepository } from '@/lib/repositories/match-repository';
import type { Match } from '@/lib/types';
import type { MatchCreateData } from '@/lib/repositories/match-repository';
import { useSeasonsStore } from './useSeasonsStore';
import { useAuthStore } from './useAuthStore';
import { useStatsStore } from './useStatsStore';
import { getErrorMessage } from '@/lib/error-utils';
import { enqueueMutation, isOffline } from '@/lib/sync-queue';
import { collection, query, onSnapshot, getFirestore } from 'firebase/firestore';
import { MatchSchema } from '@/lib/schemas';

interface MatchState {
    matches: Match[];
    seasonId: string | null;
    loading: boolean;
    error: string | null;
    fetchAll: (seasonId?: string) => Promise<void>;
    add: (data: Omit<MatchCreateData, 'seasonId' | 'userId' | 'teamOwnerId' | 'teamId'>) => Promise<Match | undefined>;
    bulkAdd: (matchesData: Omit<MatchCreateData, 'userId' | 'seasonId' | 'teamOwnerId' | 'teamId'>[], seasonId?: string) => Promise<void>;
    update: (id: string, updates: Partial<Omit<Match, 'id' | 'userId'>>) => Promise<void>;
    remove: (id: string) => Promise<void>;
    removeAll: () => Promise<void>;
    subscribe: (userId: string, seasonId: string) => () => void;
}

const sortMatchesByDate = (list: Match[]) =>
  [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

export const useMatchesStore = create<MatchState>()(
  persist(
    (set, get) => ({
    matches: [],
    seasonId: null,
    loading: true,
    error: null,
    fetchAll: async (seasonId) => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        const targetSeasonId = seasonId || useSeasonsStore.getState().activeSeason?.id;

        if (!targetSeasonId) {
            set({ matches: [], seasonId: null, loading: false, error: null });
            return;
        }

        if (get().seasonId !== targetSeasonId) {
            set({ matches: [], seasonId: targetSeasonId, loading: true, error: null });
        } else if (get().matches.length === 0) {
            set({ loading: true, error: null });
        }

        try {
            const matches = await matchRepository.getAll(user.id, targetSeasonId);
            set({ matches, seasonId: targetSeasonId, loading: false, error: null });
        } catch (err) {
            console.error("Error fetching matches:", err);
            set({ loading: false, error: getErrorMessage(err) });
        }
    },
    add: async (data) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) {
            return undefined;
        }

        // Una partita aggiunta, rimossa o aggiornata cambia record e
        // leaderboard: la dashboard li deve rivedere al ritorno.
        useStatsStore.getState().markStatsDirty();

        const newMatch = await matchRepository.add({
            ...data,
            userId: user.id,
            seasonId: activeSeason.id
        } as MatchCreateData);

        set((s) => ({
          matches: sortMatchesByDate([...s.matches.filter((m) => m.id !== newMatch.id), newMatch]),
          seasonId: activeSeason.id,
          loading: false,
          error: null,
        }));
        return newMatch;
    },
    bulkAdd: async (
        matchesData: Omit<MatchCreateData, 'userId' | 'seasonId' | 'teamOwnerId' | 'teamId'>[],
        seasonId?: string,
    ) => {
        const user = useAuthStore.getState().user;
        const targetSeasonId = seasonId ?? useSeasonsStore.getState().activeSeason?.id;
        if (!targetSeasonId || !user) {
            set({ error: 'Nessuna stagione attiva. Seleziona una stagione prima di importare le partite.', loading: false });
            return;
        }

        // Una partita aggiunta, rimossa o aggiornata cambia record e
        // leaderboard: la dashboard li deve rivedere al ritorno.
        useStatsStore.getState().markStatsDirty();

        const added = await matchRepository.bulkAdd(matchesData, user.id, targetSeasonId);
        set((s) => {
          const addedIds = new Set(added.map((m) => m.id));
          return {
            matches: sortMatchesByDate([...s.matches.filter((m) => !addedIds.has(m.id)), ...added]),
            seasonId: targetSeasonId,
            loading: false,
            error: null,
          };
        });
    },
    update: async (id, updates) => {
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason) return;

        // Una partita aggiunta, rimossa o aggiornata cambia record e
        // leaderboard: la dashboard li deve rivedere al ritorno.
        useStatsStore.getState().markStatsDirty();

        if (isOffline()) {
          await enqueueMutation({ collection: 'matches', docId: id, action: 'update', seasonId: activeSeason.id, payload: updates });
          set(s => ({ matches: s.matches.map(m => m.id === id ? { ...m, ...updates } : m) }));
          return;
        }

        const updatedMatch = await matchRepository.update(id, activeSeason.id, updates);
        if (updatedMatch) {
            set((s) => ({
              matches: sortMatchesByDate(s.matches.map((m) => (m.id === id ? updatedMatch : m))),
            }));
        }
    },
    remove: async (id) => {
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason) return;

        // Una partita aggiunta, rimossa o aggiornata cambia record e
        // leaderboard: la dashboard li deve rivedere al ritorno.
        useStatsStore.getState().markStatsDirty();

        await matchRepository.delete(id, activeSeason.id);
        set((s) => ({ matches: s.matches.filter((m) => m.id !== id) }));
    },
    removeAll: async () => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return;

        // Una partita aggiunta, rimossa o aggiornata cambia record e
        // leaderboard: la dashboard li deve rivedere al ritorno.
        useStatsStore.getState().markStatsDirty();

        await matchRepository.deleteAll(user.id, activeSeason.id);
        set({ matches: [] });
    },
    subscribe: (userId: string, seasonId: string) => {
        if (get().seasonId !== seasonId) {
          set({ matches: [], seasonId, loading: true, error: null });
        }
        const db = getFirestore();
        const matchesRef = collection(db, 'teams', seasonId, 'matches');
        const q = query(matchesRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const matches = snapshot.docs.map(doc => {
                const data = { ...doc.data(), id: doc.id };
                const parsed = MatchSchema.safeParse(data);
                if (!parsed.success) {
                    console.error("Schema validation failed for Match:", parsed.error);
                    return data as Match;
                }
                return parsed.data;
            });
            set({ matches: sortMatchesByDate(matches), seasonId, loading: false, error: null });
        }, (err) => {
            console.error("Matches onSnapshot error:", err);
            set({ loading: false, error: getErrorMessage(err) });
        });
        return unsubscribe;
    },
}),
    {
      name: 'pitchman-matches',
    }
  )
);