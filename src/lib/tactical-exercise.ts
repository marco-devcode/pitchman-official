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
  /** Solo per i giocatori. 'gk' e' il portiere, 'neutral' un senza squadra. */
  team?: 'blue' | 'red' | 'yellow' | 'gk' | 'neutral';
  /** Etichetta corta mostrata dentro il pallino. */
  label?: string;
  x: number;
  y: number;
  /** Solo per type 'zone'. */
  width?: number;
  height?: number;
}

export type TacticalActionType = 'pass' | 'run' | 'dribble' | 'shoot';

/**
 * Andamento del movimento. Riguarda COME si arriva al punto di arrivo, non
 * dove: linear e' rettilineo, easeIn parte piano e accelera, easeOut parte
 * veloce e frena (il modo giusto per una palla che arriva e si ferma),
 * easeInOut accelera e poi decelera (il modo giusto per una corsa).
 */
export type TacticalEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

/**
 * Punto sul campo, coordinate normalizzate 0-100.
 *
 * Oggetto e non tupla `[x, y]`: uno schema con array annidati genera un campo
 * "items" che l'API Gemini rifiuta con 400 "Proto field is not repeating", e il
 * modello producendo {"x":..,"y":..} e' piu' leggibile di [12, 34].
 */
export interface TacticalPoint {
  x: number;
  y: number;
}

export interface TacticalAction {
  entityId: string;
  type: TacticalActionType;
  /** Punto di partenza. */
  from: TacticalPoint;
  /** Punto di arrivo. */
  to: TacticalPoint;
  /** Durata in secondi. */
  duration: number;
  /** Ritardo in secondi dall'inizio dello step: e' cio' che evita che tutte le
   * azioni partano insieme e l'animazione risulti illeggibile. */
  startAt?: number;
  /** Come evolve il movimento. */
  easing?: TacticalEasing;
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
