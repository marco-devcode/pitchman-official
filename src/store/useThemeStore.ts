"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '@/lib/theme-engine';

interface ThemeState {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  setTheme: (theme: 'light' | 'dark') => void;

  /**
   * I due colori scelti dall'utente, GREZZI. Non sono mai usati direttamente:
   * passano da buildTheme(), che li corregge per il contrasto e ne ricava
   * tutte le variabili. Conservare il grezzo serve perche' il selettore
   * mostri all'utente il colore che ha scelto, non quello corretto.
   */
  accentA: string;
  accentB: string;
  setAccents: (a: string, b: string) => void;
}

/** Il verde neon del brand: il default, non un tema. */
export const DEFAULT_ACCENT_A = '#4eeb00';
export const DEFAULT_ACCENT_B = '#00d9ff';

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setTheme: (theme) => set({ theme }),

      accentA: DEFAULT_ACCENT_A,
      accentB: DEFAULT_ACCENT_B,
      setAccents: (accentA, accentB) => set({ accentA, accentB }),
    }),
    {
      name: 'pitchman-theme',
    }
  )
);

/** Il modo corrente, per chi non vuole dipendere dallo store. */
export function themeModeOf(theme: 'light' | 'dark'): ThemeMode {
  return theme === 'light' ? 'light' : 'dark';
}