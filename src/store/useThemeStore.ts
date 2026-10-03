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

/**
 * I colori di BASE dell'app, in esadecimale.
 *
 * Sono la conversione ESATTA dei token che globals.css aveva prima, e non un
 * colore simile: `--brand-green: 74 96% 46%` e' `#b1e605`. Il default del
 * tema deve riprodurre i token di prima, altrimenti il verde di base cambia
 * anche quando l'utente non ha scelto niente — che e' successo con
 * `#4eeb00`, un verde diverso (tonalita' 100 invece di 74).
 *
 * `--brand-cyan: 192 100% 22%` e' `#005a70`.
 *
 * Nota: i token originali erano tre (yellow, green, cyan) e il gradiente li
 * usava tutti e tre. Un tema a due colori non puo' riprodurre tre estremi, e
 * qui il secondo finisce dove finiva il cyan. Il verde di base, che e' quello
 * che si vede ovunque, e' esatto.
 */
export const DEFAULT_ACCENT_A = '#b1e605';
export const DEFAULT_ACCENT_B = '#005a70';

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