import { doc, getDoc, setDoc, getFirestore } from 'firebase/firestore';
import type { FilterType } from '@/lib/aggregators/filter';

export interface UserSettings {
  defaultDuration: number;
  sessionsPerWeek: number;
  trainingDays: number[];
  autoSetPresenceOnGenerate: boolean;
  teamName: string;
  matchNotificationEnabled?: boolean;
  matchNotificationTime?: string;
  trainingNotificationEnabled?: boolean;
  trainingNotificationTime?: string;
  /** Tab statistica predefinita: 'all' | 'Campionato' | 'Torneo' | 'Amichevole' */
  statsDefaultFilter?: FilterType;
}

export const settingsRepository = {
  async getSettings(userId: string): Promise<UserSettings | null> {
    if (!userId) return null;
    const db = getFirestore();
    const docRef = doc(db, 'settings', userId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as UserSettings;
    }
    return null;
  },

  async saveSettings(userId: string, settings: UserSettings): Promise<void> {
    if (!userId) return;
    const db = getFirestore();
    const docRef = doc(db, 'settings', userId);
    await setDoc(docRef, settings, { merge: true });
  }
};
