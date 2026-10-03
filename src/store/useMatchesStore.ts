"use client";

import { create } from 'zustand';
import { matchRepository } from '@/lib/repositories/match-repository';
import type { Match } from '@/lib/types';
import type { MatchCreateData } from '@/lib/repositories/match-repository';
import { useSeasonsStore } from './useSeasonsStore';
import { useAuthStore } from './useAuthStore';
import { useStatsStore } from './useStatsStore';
import { getErrorMessage } from '@/lib/error-utils';
import { enqueueMutation, isOffline } from '@/lib/sync-queue';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';
import { MatchSchema } from '@/lib/schemas';

interface MatchState {
    matches: Match[];
    loading: boolean;
    error: string | null;
    fetchAll: (seasonId?: string) => Promise<void>;
    add: (data: Omit<MatchCreateData, 'seasonId' | 'userId' | 'teamOwnerId' | 'teamId'>) => Promise<Match | undefined>;
    bulkAdd: (matchesData: Omit<MatchCreateData, 'userId' | 'seasonId' | 'teamOwnerId' | 'teamId'>[]) => Promise<void>;
    update: (id: string, updates: Partial<Omit<Match, 'id' | 'userId'>>) => Promise<void>;
    remove: (id: string) => Promise<void>;
    removeAll: () => Promise<void>;
    subscribe: (userId: string, seasonId: string) => () => void;
}

export const useMatchesStore = create<MatchState>((set, get) => ({
    matches: [],
    loading: true,
    error: null,
    fetchAll: async (seasonId) => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        if (get().matches.length === 0) set({ loading: true, error: null });
        const targetSeasonId = seasonId || useSeasonsStore.getState().activeSeason?.id;

        if (!targetSeasonId) {
            set({ matches: [], loading: false, error: null });
            return;
        }

        try {
            const matches = await matchRepository.getAll(user.id, targetSeasonId);
            set({ matches, loading: false, error: null });
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

        await get().fetchAll(activeSeason.id);
        return newMatch;
    },
    bulkAdd: async (matchesData) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return;

        // Una partita aggiunta, rimossa o aggiornata cambia record e
        // leaderboard: la dashboard li deve rivedere al ritorno.
        useStatsStore.getState().markStatsDirty();

        await matchRepository.bulkAdd(matchesData, user.id, activeSeason.id);
        await get().fetchAll(activeSeason.id);
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
            await get().fetchAll(activeSeason.id);
        }
    },
    remove: async (id) => {
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason) return;

        // Una partita aggiunta, rimossa o aggiornata cambia record e
        // leaderboard: la dashboard li deve rivedere al ritorno.
        useStatsStore.getState().markStatsDirty();

        await matchRepository.delete(id, activeSeason.id);
        await get().fetchAll(activeSeason.id);
    },
    removeAll: async () => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return;

        // Una partita aggiunta, rimossa o aggiornata cambia record e
        // leaderboard: la dashboard li deve rivedere al ritorno.
        useStatsStore.getState().markStatsDirty();

        await matchRepository.deleteAll(user.id, activeSeason.id);
        await get().fetchAll(activeSeason.id);
    },
    subscribe: (userId: string, seasonId: string) => {
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
            set({ matches, loading: false, error: null });
        }, (err) => {
            console.error("Matches onSnapshot error:", err);
            set({ loading: false, error: getErrorMessage(err) });
        });
        return unsubscribe;
    },
}));