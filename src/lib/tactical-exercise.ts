/**
 * Dati tattici di un esercizio animato.
 *
 * Sistema di coordinate NORMALIZZATO 0-100 su entrambi gli assi, cosi' lo
 * stesso esercizio si adatta a qualsiasi dimensione di campo senza
 * ricalcolare nulla:
 *   X: 0 = porta propria, 100 = porta avversaria
 *   Y: 0 = fallo laterale sinistro, 100 = fallo laterale destro
 *
 * Sistema diverso da lineup-mapping.ts, che usa percentuali con l'asse Y
 * invertito (0 = alto, cioe' porta avversaria): non vanno mescolati.
 */

export interface TacticalEntity {
  id: string;
  type: 'player' | 'ball' | 'cone' | 'zone';
  /** Solo per i giocatori. 'gk' e' il portiere. */
  team?: 'blue' | 'red' | 'yellow' | 'gk';
  /** Etichetta corta mostrata dentro il pallino. */
  label?: string;
  x: number;
  y: number;
  /** Solo per type 'zone'. */
  width?: number;
  height?: number;
}

export type TacticalActionType = 'pass' | 'run' | 'dribble' | 'shoot';

export interface TacticalAction {
  entityId: string;
  type: TacticalActionType;
  /** Coordinata normalizzata di partenza. */
  from: [number, number];
  /** Coordinata normalizzata di arrivo. */
  to: [number, number];
  /** Durata in secondi. */
  duration: number;
}

export interface TacticalStep {
  stepNumber: number;
  description: string;
  actions: TacticalAction[];
}

export interface TacticalExercise {
  title: string;
  description: string;
  playersShown: number;
  initialEntities: TacticalEntity[];
  steps: TacticalStep[];
}

/** Limite di sicurezza: 6 step, come da specifica della guida. */
export const MAX_STEPS = 6;

/**
 * Il modello NON garantisce che i dati siano coerenti: coordinate fuori
 * 0-100, azioni che puntano a entita' inesistenti, NaN. Il player deve
 * poter mostrare quello che arriva senza crashare, e i controlli devono
 * limitarsi a what's visualizzabile.
 */
export function clampCoord(v: number): number {
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, v));
}
