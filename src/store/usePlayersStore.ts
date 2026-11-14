
"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { playerRepository, parsePlayerDoc } from '@/lib/repositories/player-repository';
import type { Player, Role, PlayerRole } from '@/lib/types';
import type { PlayerCreateData } from '@/lib/repositories/player-repository';
import { useStatsStore } from './useStatsStore';
import { useSeasonsStore } from './useSeasonsStore';
import { useAuthStore } from './useAuthStore';
import { getErrorMessage } from '@/lib/error-utils';
import { enqueueMutation, isOffline } from '@/lib/sync-queue';
import { collection, query, onSnapshot, getFirestore } from 'firebase/firestore';

interface PlayerState {
    players: Player[];
    seasonId: string | null;
    loading: boolean;
    error: string | null;
    fetchAll: (seasonId?: string) => Promise<void>;
    add: (data: Omit<PlayerCreateData, 'seasonId' | 'userId'>) => Promise<Player | undefined>;
    bulkAdd: (data: PlayerCreateData[]) => Promise<void>;
    update: (id: string, updates: Partial<Omit<Player, 'id' | 'userId' | 'seasonId' | 'teamId' | 'teamOwnerId'>>) => Promise<void>;
    remove: (id: string) => Promise<void>;
    removeAll: () => Promise<void>;
    subscribe: (userId: string, seasonId: string) => () => void;
}

export const usePlayersStore = create<PlayerState>()(
  persist(
    (set, get) => ({
      players: [],
      seasonId: null,
      loading: true,
      error: null,
      fetchAll: async (seasonId) => {
          const user = useAuthStore.getState().user;
          if (!user) return;

          const targetSeasonId = seasonId || useSeasonsStore.getState().activeSeason?.id;
          
          if (!targetSeasonId) {
              set({ players: [], seasonId: null, loading: false, error: null });
              return;
          }

          if (get().seasonId !== targetSeasonId) {
              set({ players: [], seasonId: targetSeasonId, loading: true, error: null });
          } else if (get().players.length === 0) {
              set({ loading: true, error: null });
          }

          try {
            const players = await playerRepository.getAll(user.id, targetSeasonId);
            set({ players, seasonId: targetSeasonId, loading: false, error: null });
          } catch (e) {
            console.error("Fetch players error:", e);
            set({ loading: false, error: getErrorMessage(e) });
          }
      },
      add: async (data) => {
          const user = useAuthStore.getState().user;
          const activeSeason = useSeasonsStore.getState().activeSeason;
          if (!activeSeason || !user) {
               return undefined;
          }

          const newPlayer = await playerRepository.add({ 
              ...data, 
              userId: user.id,
              seasonId: activeSeason.id 
          });
          
          set((s) => ({
            players: [...s.players.filter((p) => p.id !== newPlayer.id), newPlayer].sort((a, b) =>
              a.lastName.localeCompare(b.lastName)
            ),
            seasonId: activeSeason.id,
            loading: false,
            error: null,
          }));
          useStatsStore.getState().markStatsDirty();
          return newPlayer;
      },
      bulkAdd: async (playersData) => {
          const user = useAuthStore.getState().user;
          const activeSeason = useSeasonsStore.getState().activeSeason;
          if (!activeSeason || !user) return;

          const repoData: PlayerCreateData[] = playersData.map(p => ({
            name: p.name || '',
            firstName: p.firstName || p.name?.split(' ')[0] || p.name || '',
            lastName: p.lastName || p.name?.split(' ').slice(1).join(' ') || '',
            roles: p.roles && p.roles.length > 0 ? p.roles : undefined,
            seasonId: activeSeason.id,
            userId: user.id,
          }));
          const added = await playerRepository.bulkAdd(repoData, user.id, activeSeason.id);
          
          set((s) => {
            const addedIds = new Set(added.map((p) => p.id));
            return {
              players: [...s.players.filter((p) => !addedIds.has(p.id)), ...added].sort((a, b) =>
                a.lastName.localeCompare(b.lastName)
              ),
              seasonId: activeSeason.id,
              loading: false,
              error: null,
            };
          });
          useStatsStore.getState().markStatsDirty();
      },
      update: async (id, updates) => {
          const user = useAuthStore.getState().user;
          const activeSeason = useSeasonsStore.getState().activeSeason;
          if (!activeSeason || !user) return;

          if (isOffline()) {
            await enqueueMutation({ collection: 'players', docId: id, action: 'update', seasonId: activeSeason.id, payload: updates });
            set(s => ({ players: s.players.map(p => p.id === id ? { ...p, ...updates } : p) }));
            useStatsStore.getState().markStatsDirty();
            return;
          }

          const updatedPlayer = await playerRepository.update(id, activeSeason.id, updates);
          if (updatedPlayer) {
              set((s) => ({
                players: s.players
                  .map((p) => (p.id === id ? { ...p, ...updatedPlayer } : p))
                  .sort((a, b) => a.lastName.localeCompare(b.lastName)),
              }));
              useStatsStore.getState().markStatsDirty();
          }
      },
      remove: async (id) => {
          const user = useAuthStore.getState().user;
          const activeSeason = useSeasonsStore.getState().activeSeason;
          if (!activeSeason || !user) return;
          
          await playerRepository.delete(id, activeSeason.id);
          set((s) => ({ players: s.players.filter((p) => p.id !== id) }));
          useStatsStore.getState().markStatsDirty();
      },
      removeAll: async () => {
          const user = useAuthStore.getState().user;
          const activeSeason = useSeasonsStore.getState().activeSeason;
          if (!activeSeason || !user) return;
          
          await playerRepository.deleteAll(user.id, activeSeason.id);
          set({ players: [] });
          useStatsStore.getState().markStatsDirty();
      },
      subscribe: (userId: string, seasonId: string) => {
        if (get().seasonId !== seasonId) {
          set({ players: [], seasonId, loading: true, error: null });
        }
        const db = getFirestore();
        const playersRef = collection(db, 'teams', seasonId, 'players');
        const q = query(playersRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const players = snapshot.docs.map(doc => parsePlayerDoc(doc.id, doc.data()));
          set({
            players: players.sort((a, b) => a.lastName.localeCompare(b.lastName)),
            seasonId,
            loading: false,
            error: null,
          });
        }, (err) => {
          console.error("Players onSnapshot error:", err);
          set({ loading: false, error: getErrorMessage(err) });
        });
        return unsubscribe;
      },
    }),
    {
      name: 'pitchman-players',
    }
  )
);
