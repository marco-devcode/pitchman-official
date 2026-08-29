'use client';

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
  where,
} from 'firebase/firestore';
import type { PhysicalTest, TestResult } from '@/lib/types';
import { PhysicalTestSchema } from '@/lib/schemas';

export const testRepository = {
  ref(userId: string) {
    const db = getFirestore();
    return collection(db, 'users', userId, 'physicalTests');
  },

  async create(userId: string, seasonId: string, test: Omit<PhysicalTest, 'id' | 'userId' | 'seasonId'>): Promise<string> {
    const newDocRef = doc(this.ref(userId));
    const data = { ...test, id: newDocRef.id, userId, seasonId };
    const parsed = PhysicalTestSchema.parse(data);
    console.log('📝 testRepository.create:', { userId, seasonId, docId: newDocRef.id, data: parsed });
    await setDoc(newDocRef, parsed);
    console.log('✅ testRepository.create done:', newDocRef.id);
    return newDocRef.id;
  },

  async updateResults(testId: string, userId: string, results: TestResult[]): Promise<void> {
    const db = getFirestore();
    const docRef = doc(db, 'users', userId, 'physicalTests', testId);
    await updateDoc(docRef, { results });
  },

  async getTestsBySeason(userId: string, seasonId: string): Promise<PhysicalTest[]> {
    const q = query(this.ref(userId), where('seasonId', '==', seasonId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => {
      const data = { ...d.data(), id: d.id };
      const parsed = PhysicalTestSchema.safeParse(data);
      if (!parsed.success) {
        console.error("Schema validation failed for PhysicalTest:", parsed.error);
        return data as PhysicalTest;
      }
      return parsed.data;
    });
  },

  async getTestById(userId: string, testId: string): Promise<PhysicalTest | undefined> {
    const db = getFirestore();
    const docRef = doc(db, 'users', userId, 'physicalTests', testId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return undefined;
    const data = { ...snapshot.data(), id: snapshot.id };
    const parsed = PhysicalTestSchema.safeParse(data);
    if (!parsed.success) {
      console.error("Schema validation failed for PhysicalTest:", parsed.error);
      return data as PhysicalTest;
    }
    return parsed.data;
  },

  async getTestsByPlayer(userId: string, seasonId: string, playerId: string): Promise<PhysicalTest[]> {
    const tests = await this.getTestsBySeason(userId, seasonId);
    return tests
      .filter(t => t.results.some(r => r.playerId === playerId))
      .sort((a, b) => a.date.localeCompare(b.date));
  },

  async deleteTest(testId: string, userId: string): Promise<void> {
    const db = getFirestore();
    const docRef = doc(db, 'users', userId, 'physicalTests', testId);
    await deleteDoc(docRef);
  },

  async renameTest(testId: string, userId: string, name: string): Promise<void> {
    const db = getFirestore();
    const docRef = doc(db, 'users', userId, 'physicalTests', testId);
    await updateDoc(docRef, { name });
  },

  async updateTest(testId: string, userId: string, data: Partial<Pick<PhysicalTest, 'name' | 'type' | 'unit' | 'date' | 'results'>>): Promise<void> {
    const db = getFirestore();
    const docRef = doc(db, 'users', userId, 'physicalTests', testId);
    await updateDoc(docRef, data);
  },
};
