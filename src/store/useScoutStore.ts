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
  seasonId: string | null;
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
      seasonId: null,
      loading: true,
      error: null,

      fetchAll: async (seasonId) => {
        const user = useAuthStore.getState().user;
        if (!user) return;

        const targetSeasonId = seasonId || useSeasonsStore.getState().activeSeason?.id;

        if (!targetSeasonId) {
          set({ scouts: [], categories: [], seasonId: null, loading: false, error: null });
          return;
        }

        if (get().seasonId !== targetSeasonId) {
          set({ scouts: [], categories: [], seasonId: targetSeasonId, loading: true, error: null });
        } else if (get().scouts.length === 0) {
          set({ loading: true, error: null });
        }

        try {
          const [scouts, categories] = await Promise.all([
            scoutRepository.list(targetSeasonId),
            scoutRepository.listCategories(targetSeasonId),
          ]);
          set({
            scouts: scouts.sort((a, b) => a.name.localeCompare(b.name)),
            categories: categories.sort((a, b) => a.name.localeCompare(b.name)),
            seasonId: targetSeasonId,
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
        if (id) {
          set((s) => ({
            scouts: [...s.scouts.filter((p) => p.id !== id), { ...data, id } as ScoutPlayer].sort((a, b) =>
              a.name.localeCompare(b.name)
            ),
            seasonId: activeSeason.id,
            loading: false,
            error: null,
          }));
        }
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
        set((s) => ({
          scouts: s.scouts
            .map((p) => (p.id === id ? { ...p, ...updates, id } : p))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));
      },

      remove: async (id) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return;

        await scoutRepository.remove(activeSeason.id, id);
        set((s) => ({ scouts: s.scouts.filter((p) => p.id !== id) }));
      },

      addCategory: async (data) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return undefined;

        const id = await scoutRepository.createCategory(activeSeason.id, data);
        if (id) {
          set((s) => ({
            categories: [
              ...s.categories.filter((c) => c.id !== id),
              { ...data, id } as ScoutCategory,
            ].sort((a, b) => a.name.localeCompare(b.name)),
            seasonId: activeSeason.id,
          }));
        }
        return id;
      },

      updateCategory: async (id, data) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return;

        await scoutRepository.updateCategory(activeSeason.id, id, data);
        set((s) => ({
          categories: s.categories
            .map((c) => (c.id === id ? { ...c, ...data, id } : c))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }));
      },

      removeCategory: async (id) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!activeSeason || !user) return;

        await scoutRepository.removeCategory(activeSeason.id, id);
        set((s) => ({ categories: s.categories.filter((c) => c.id !== id) }));
      },

      subscribe: (userId: string, seasonId: string) => {
        if (get().seasonId !== seasonId) {
          set({ scouts: [], categories: [], seasonId, loading: true, error: null });
        }
        const unsubScouts = onSnapshot(
          query(scoutRepository.ref(seasonId)),
          (snapshot) => {
            const scouts = snapshot.docs
              .map((doc) => parseScoutDoc(doc.id, doc.data()))
              .sort((a, b) => a.name.localeCompare(b.name));
            set({ scouts, seasonId, loading: false, error: null });
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
            set({ categories, seasonId });
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

