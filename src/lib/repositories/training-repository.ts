
"use client";

import { 
  getFirestore, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where,
  writeBatch,
  getDoc
} from 'firebase/firestore';
import type { TrainingSession, TrainingAttendance, TrainingStatus } from '@/lib/types';
import { TrainingSessionSchema } from '@/lib/schemas';

export const trainingRepository = {
  async getAll(seasonId: string) {
    if (!seasonId) return [];
    const db = getFirestore();
    const sessionsRef = collection(db, 'teams', seasonId, 'sessions');
    // Nessun where: il percorso teams/{seasonId}/sessions e' gia' la
    // selezione, e isSeasonAuthorization autorizza chi e' nella stagione.
    const snapshot = await getDocs(sessionsRef);
    return snapshot.docs.map(doc => {
      const data = { ...doc.data(), id: doc.id };
      const parsed = TrainingSessionSchema.safeParse(data);
      if (!parsed.success) {
        console.error("Schema validation failed for TrainingSession:", parsed.error);
        return data as TrainingSession; // Fallback to raw data
      }
      return parsed.data as TrainingSession;
    });
  },

  async getById(seasonId: string, sessionId: string) {
    if (!seasonId) return undefined;
    const db = getFirestore();
    const docRef = doc(db, 'teams', seasonId, 'sessions', sessionId);
    const snapshot = await getDoc(docRef);
    if (!snapshot.exists()) return undefined;
    const data = { ...snapshot.data(), id: snapshot.id };
    const parsed = TrainingSessionSchema.safeParse(data);
    if (!parsed.success) {
      console.error("Schema validation failed for TrainingSession:", parsed.error);
      return data as TrainingSession;
    }
    return parsed.data as TrainingSession;
  },

  async bulkAdd(sessions: Omit<TrainingSession, 'id'>[], seasonId: string) {
    if (!seasonId || sessions.length === 0) return;
    const db = getFirestore();
    const batch = writeBatch(db);
    
    sessions.forEach(s => {
      const id = `TR-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      const docRef = doc(db, 'teams', seasonId, 'sessions', id);
      batch.set(docRef, { ...s, id });
      
      // Scrive le sub-collezioni attendance in blocco se presenti
      if (s.attendances && s.attendances.length > 0) {
        s.attendances.forEach(att => {
          const attRef = doc(db, 'teams', seasonId, 'sessions', id, 'attendance', att.playerId);
          batch.set(attRef, { playerId: att.playerId, status: att.status });
        });
      }
    });

    await batch.commit();
  },

  async update(seasonId: string, sessionId: string, updates: Partial<TrainingSession>) {
    if (!seasonId) return;
    const db = getFirestore();
    const docRef = doc(db, 'teams', seasonId, 'sessions', sessionId);
    await updateDoc(docRef, updates);
  },

  async delete(seasonId: string, sessionId: string) {
    if (!seasonId) return undefined;
    const db = getFirestore();
    const docRef = doc(db, 'teams', seasonId, 'sessions', sessionId);
    await deleteDoc(docRef);
  },

  async deleteMany(seasonId: string, sessionIds: string[]) {
    if (!seasonId) return undefined;
    const db = getFirestore();
    const batch = writeBatch(db);
    sessionIds.forEach(id => {
      const docRef = doc(db, 'teams', seasonId, 'sessions', id);
      batch.delete(docRef);
    });
    await batch.commit();
  },

  async getAttendance(seasonId: string, sessionId: string) {
    if (!seasonId) return [];
    const db = getFirestore();
    const attRef = collection(db, 'teams', seasonId, 'sessions', sessionId, 'attendance');
    const snapshot = await getDocs(attRef);
    return snapshot.docs.map(doc => ({ ...doc.data(), playerId: doc.id } as TrainingAttendance));
  },

  async getAllAttendanceForSeason(seasonId: string, sessionIds: string[]) {
    if (!seasonId) return [];
    const db = getFirestore();
    const allAttendance: { sessionId: string, attendance: TrainingAttendance[] }[] = [];
    
    // Per un numero limitato di sessioni carichiamo in parallelo
    await Promise.all(sessionIds.map(async (sid) => {
      const att = await this.getAttendance(seasonId, sid);
      allAttendance.push({ sessionId: sid, attendance: att });
    }));
    
    return allAttendance;
  },

  async setAttendance(seasonId: string, sessionId: string, playerId: string, status: TrainingStatus) {
    if (!seasonId) return;
    const db = getFirestore();
    const docRef = doc(db, 'teams', seasonId, 'sessions', sessionId, 'attendance', playerId);
    await setDoc(docRef, { playerId, status });

    // Aggiorniamo anche il documento principale della sessione per avere i count rapidi (denormalizzazione)
    const sessionRef = doc(db, 'teams', seasonId, 'sessions', sessionId);
    
    // Rileggiamo tutti gli 'attendance' aggiornati per questa sessione
    const attRef = collection(db, 'teams', seasonId, 'sessions', sessionId, 'attendance');
    const snapshot = await getDocs(attRef);
    const allAtt = snapshot.docs.map(doc => ({ ...doc.data(), playerId: doc.id }));
    
    await updateDoc(sessionRef, { attendances: allAtt });
  }
};
