
"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { trainingRepository } from '@/lib/repositories/training-repository';
import type { TrainingSession, TrainingAttendance, TrainingStatus } from '@/lib/types';
import { useAuthStore } from './useAuthStore';
import { useSeasonsStore } from './useSeasonsStore';
import { useSettingsStore } from './useSettingsStore';
import { startOfWeek, addDays, format, startOfDay } from 'date-fns';
import { getErrorMessage } from '@/lib/error-utils';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { getFirestore } from 'firebase/firestore';

interface TrainingState {
  sessions: TrainingSession[];
  loading: boolean;
  error: string | null;
  fetchAll: () => Promise<void>;
  generateSessions: (startDate: Date, endDate: Date, sessionsPerWeek: number) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  deleteSessions: (ids: string[]) => Promise<void>;
  clearAllSessions: () => Promise<void>;
  updateSessionLocally: (id: string, updates: Partial<TrainingSession>) => void;
  subscribe: (userId: string, seasonId: string) => () => void;
}

export const useTrainingStore = create<TrainingState>()(
  persist(
    (set, get) => ({
      sessions: [],
      loading: false,
      error: null,

      fetchAll: async () => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!user || !activeSeason) return;

        if (get().sessions.length === 0) set({ loading: true, error: null });
        try {
          const sessions = await trainingRepository.getAll(activeSeason.id);
          set({ 
            sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)), 
            loading: false,
            error: null,
          });
        } catch (e) {
          console.error("Fetch all sessions error:", e);
          set({ loading: false, error: getErrorMessage(e) });
        }
      },

      generateSessions: async (startDate, endDate, sessionsPerWeek) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        
        if (!user || !activeSeason) {
          console.error("Missing user or active season for generation");
          return;
        }

        const seasonId = activeSeason.id;
        set({ loading: true });
        
        try {
          const newSessions: Omit<TrainingSession, 'id'>[] = [];
          const start = startOfDay(startDate);
          const end = startOfDay(endDate);
          
          const autoSetPresence = useSettingsStore.getState().autoSetPresenceOnGenerate;
          // We need dynamically loaded players to populate attendance
          let currentPlayers: any[] = [];
          if (autoSetPresence) {
            const { usePlayersStore } = await import('./usePlayersStore');
            currentPlayers = usePlayersStore.getState().players;
          }
          
          let currentWeekIter = startOfWeek(start, { weekStartsOn: 1 });
          let sessionCount = get().sessions.length;

          const trainingDays = useSettingsStore.getState().trainingDays;
          const offsets = trainingDays.length > 0 ? trainingDays.map(d => (d === 0 ? 6 : d - 1)) : [0, 2, 4];

          while (currentWeekIter <= end) {
            for (const offset of offsets) {
              const sessionDate = addDays(currentWeekIter, offset);
              if (sessionDate >= start && sessionDate <= end) {
                sessionCount++;
                newSessions.push({
                  userId: user.id,
                  seasonId,
                  date: format(sessionDate, "yyyy-MM-dd"),
                  index: sessionCount,
                  notes: "",
                  focus: "",
                  attendances: autoSetPresence 
                    ? currentPlayers.map(p => ({ playerId: p.id, status: 'presente' as const })) 
                    : []
                });
              }
            }
            currentWeekIter = addDays(currentWeekIter, 7);
          }

          if (newSessions.length > 0) {
            await trainingRepository.bulkAdd(newSessions, activeSeason.id);
          }
          await get().fetchAll();
        } catch (e) {
          console.error("Errore generazione allenamenti:", e);
        } finally {
          set({ loading: false });
        }
      },

      deleteSession: async (id) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!user || !activeSeason) return;

        try {
          await trainingRepository.delete(activeSeason.id, id);
          
          // Re-indexing logic
          const allSessions = await trainingRepository.getAll(activeSeason.id);
          const sorted = [...allSessions].sort((a, b) => a.date.localeCompare(b.date));
          
          const { getFirestore, doc, writeBatch } = await import('firebase/firestore');
          const db = getFirestore();
          const batch = writeBatch(db);
          
          sorted.forEach((session, idx) => {
            const docRef = doc(db, 'teams', activeSeason.id, 'sessions', session.id);
            batch.update(docRef, { index: idx + 1 });
          });
          
          await batch.commit();
          await get().fetchAll();
        } catch (e) {
          console.error("Delete session error:", e);
        }
      },

      deleteSessions: async (ids) => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!user || !activeSeason || ids.length === 0) return;

        try {
          await trainingRepository.deleteMany(activeSeason.id, ids);
          
          // Re-indexing logic
          const allSessions = await trainingRepository.getAll(activeSeason.id);
          const sorted = [...allSessions].sort((a, b) => a.date.localeCompare(b.date));
          
          const { getFirestore, doc, writeBatch } = await import('firebase/firestore');
          const db = getFirestore();
          const batch = writeBatch(db);
          
          sorted.forEach((session, idx) => {
            const docRef = doc(db, 'teams', activeSeason.id, 'sessions', session.id);
            batch.update(docRef, { index: idx + 1 });
          });
          
          await batch.commit();
          await get().fetchAll();
        } catch (e) {
          console.error("Delete sessions error:", e);
        }
      },

      clearAllSessions: async () => {
        const user = useAuthStore.getState().user;
        const activeSeason = useSeasonsStore.getState().activeSeason;
        if (!user || !activeSeason) return;
        
        set({ loading: true });
        try {
          const ids = get().sessions.map(s => s.id);
          if (ids.length > 0) {
            await trainingRepository.deleteMany(activeSeason.id, ids);
          }
          set({ sessions: [], loading: false });
        } catch (e) {
          console.error("Clear all sessions error:", e);
          set({ loading: false });
        }
      },

      updateSessionLocally: (id: string, updates: Partial<TrainingSession>) => {
        set(state => ({
          sessions: state.sessions.map(s => s.id === id ? { ...s, ...updates } : s)
        }));
      },
      subscribe: (userId: string, seasonId: string) => {
        const db = getFirestore();
        const sessionsRef = collection(db, 'teams', seasonId, 'sessions');
        // Nessun where: il percorso seleziona gia' la stagione, e il filtro per
        // seasonId aggiungeva niente. Stessa scelta di players e matches.
        const q = query(sessionsRef);
        const unsubscribe = onSnapshot(q, (snapshot) => {
          const sessions = snapshot.docs.map(doc => {
            const data = { ...doc.data(), id: doc.id } as TrainingSession;
            return data;
          });
          set({
            sessions: sessions.sort((a, b) => a.date.localeCompare(b.date)),
            loading: false,
            error: null,
          });
        }, (err) => {
          console.error("Training onSnapshot error:", err);
          set({ loading: false, error: getErrorMessage(err) });
        });
        return unsubscribe;
      },
    }),
    {
      name: 'pitchman-training',
    }
  )
);
