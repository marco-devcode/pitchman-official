"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  scoutRepository,
  parseScoutDoc,
  parseScoutCategoryDoc,
} from '@/lib/repositories/scout-repository';
import type { ScoutPlayer, ScoutCategory } from '@/lib/types';
import { useSeasonsStore } from './useSeasonsStore';
import { useAuthStore } from './useAuthStore';
import { getErrorMessage } from '@/lib/error-utils';
import { enqueueMutation, isOffline } from '@/lib/sync-queue';
import { onSnapshot, query } from 'firebase/firestore';

type CrossTeamScoutPlayer = ScoutPlayer & { seasonId: string; seasonName: string };

interface ScoutState {
  scouts: ScoutPlayer[];
  allTeamsScouts: CrossTeamScoutPlayer[];
  categories: ScoutCategory[];
  loading: boolean;
  error: string | null;
  fetchAll: (seasonId?: string) => Promise<void>;
  fetchAllTeamsScouts: () => Promise<void>;
  add: (data: Omit<ScoutPlayer, 'id'>) => Promise<string | undefined>;
  update: (id: string, updates: Omit<ScoutPlayer, 'id'>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  addCategory: (data: Omit<ScoutCategory, 'id'>) => Promise<string | undefined>;
  updateCategory: (id: string, data: Omit<ScoutCategory, 'id'>) => Promise<void>;
  removeCategory: (id: string) => Promise<void>;
  subscribe: (userId: string, seasonId: string) => () => void;
}

export const useScoutStore = create<ScoutState>()(
  persist(
    (set, get) => ({
      scouts: [],
      allTeamsScouts: [],
      categories: [],
      loading: true,
      error: null,

      fetchAll: async (seasonId) => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        if (get().scouts.length === 0) set({ loading: true, error: null });
        const targetSeasonId = seasonId || useSeasonsStore.getState().activeSeason?.id;

        if (!targetSeasonId) {
          set({ scouts: [], categories: [], loading: false, error: null });
          return;
        }

        try {
          const [scouts, categories] = await Promise.all([
            scoutRepository.list(targetSeasonId),
            scoutRepository.listCategories(targetSeasonId),
          ]);
          set({
            scouts: scouts.sort((a, b) => a.name.localeCompare(b.name)),
            categories: categories.sort((a, b) => a.name.localeCompare(b.name)),
            loading: false,
            error: null,
          });
        } catch (e) {
          console.error('Fetch scouts error:', e);
          set({ loading: false, error: getErrorMessage(e) });
        }
      },

      fetchAllTeamsScouts: async () => {
        const user = useAuthStore.getState().user;
        const seasons = useSeasonsStore.getState().seasons;
        if (!user || seasons.length === 0) {
          set({ allTeamsScouts: [] });
          return;
        }

        try {
          const all = await scoutRepository.listAcrossSeasons(
            seasons.map((s) => ({ id: s.id, name: s.name }))
          );
          set({
            allTeamsScouts: all.sort((a, b) => a.name.localeCompare(b.name)),
          });
        } catch (e) {
          console.error('Fetch cross-team scouts error:', e);
        }
      },

      add: async (data) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return undefined;

        const id = await scoutRepository.create(user.id, activeSeason.id, data);
        await get().fetchAll(activeSeason.id);
        return id;
      },

      update: async (id, updates) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return;

        if (isOffline()) {
          await enqueueMutation({
            collection: 'scouts',
            docId: id,
            action: 'update',
            seasonId: activeSeason.id,
            payload: updates,
          });
          set((s) => ({
            scouts: s.scouts.map((p) => (p.id === id ? { ...p, ...updates, id } : p)),
          }));
          return;
        }

        await scoutRepository.update(user.id, activeSeason.id, id, updates);
        await get().fetchAll(activeSeason.id);
      },

      remove: async (id) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return;

        await scoutRepository.remove(activeSeason.id, id);
        await get().fetchAll(activeSeason.id);
      },

      addCategory: async (data) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return undefined;

        const id = await scoutRepository.createCategory(activeSeason.id, data);
        await get().fetchAll(activeSeason.id);
        return id;
      },

      updateCategory: async (id, data) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return;

        await scoutRepository.updateCategory(activeSeason.id, id, data);
        await get().fetchAll(activeSeason.id);
      },

      removeCategory: async (id) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return;

        await scoutRepository.removeCategory(activeSeason.id, id);
        await get().fetchAll(activeSeason.id);
      },

      subscribe: (userId: string, seasonId: string) => {
        const unsubScouts = onSnapshot(
          query(scoutRepository.ref(seasonId)),
          (snapshot) => {
            const scouts = snapshot.docs
              .map((doc) => parseScoutDoc(doc.id, doc.data()))
              .sort((a, b) => a.name.localeCompare(b.name));
            set({ scouts, loading: false, error: null });
          },
          (err) => {
            console.error('Scouts onSnapshot error:', err);
            set({ loading: false, error: getErrorMessage(err) });
          }
        );

        const unsubCategories = onSnapshot(
          query(scoutRepository.categoriesRef(seasonId)),
          (snapshot) => {
            const categories = snapshot.docs
              .map((doc) => parseScoutCategoryDoc(doc.id, doc.data()))
              .sort((a, b) => a.name.localeCompare(b.name));
            set({ categories });
          },
          (err) => {
            console.error('ScoutCategories onSnapshot error:', err);
          }
        );

        return () => {
          unsubScouts();
          unsubCategories();
        };
      },
    }),
    {
      name: 'pitchman-scouts',
    }
  )
);

