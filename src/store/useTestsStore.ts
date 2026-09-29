'use client';

import { create } from 'zustand';
import { testRepository } from '@/lib/repositories/test-repository';
import type { PhysicalTest } from '@/lib/types';
import { useAuthStore } from './useAuthStore';
import { useSeasonsStore } from './useSeasonsStore';
import { collection, query, where, onSnapshot, getFirestore } from 'firebase/firestore';

interface TestsStore {
  tests: PhysicalTest[];
  setTests: (tests: PhysicalTest[]) => void;
  subscribe: (userId: string, seasonId: string) => () => void;
}

export const useTestsStore = create<TestsStore>()(
  (set) => ({
    tests: [],
    setTests: (tests) => set({ tests }),
    subscribe: (userId: string, seasonId: string) => {
      const db = getFirestore();
      // I test stanno sotto la stagione, non sotto l'utente: leggendo
      // users/{uid}/physicalTests un ospite vedeva zero test, perche' quella
      // collezione contiene solo quelli che ha creati lui. Vedi
      // test-repository.
      const testsRef = collection(db, 'teams', seasonId, 'physicalTests');
      // Nessun where: il percorso seleziona gia' la stagione.
      const q = query(testsRef);
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const tests = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
          })) as PhysicalTest[];
          set({ tests });
        },
        (error) => {
          console.error('\u274c Tests onSnapshot error:', error);
          console.error('  userId:', userId, 'seasonId:', seasonId);
          console.error('  code:', error.code, 'message:', error.message);
        }
      );
      return unsubscribe;
    },
  })
);

/**
 * Helper to create a test outside of React components.
 */
export async function createTest(
  data: Omit<PhysicalTest, 'id' | 'userId' | 'seasonId'>
): Promise<string | undefined> {
  const user = useAuthStore.getState().user;
  const activeSeason = useSeasonsStore.getState().activeSeason;
  if (!user || !activeSeason) return undefined;
  return testRepository.create(user.id, activeSeason.id, data);
}
