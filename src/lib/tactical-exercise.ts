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
  type: 'player' | 'ball' | 'cone' | 'zone' | 'goal';
  /** Solo per i giocatori. 'gk' e' il portiere, 'neutral' un senza squadra. */
  team?: 'blue' | 'red' | 'yellow' | 'gk' | 'neutral';
  /** Etichetta corta mostrata dentro il pallino. */
  label?: string;
  x: number;
  y: number;
  /** Solo per type 'zone' o 'goal'. */
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
  /**
   * Azioni esplicite (modello AI). Ogni azione muove UN'entità da `from` a
   * `to`. Usato dal generatore AI e dagli esercizi salvati prima del
   * passaggio al modello a frame.
   */
  actions: TacticalAction[];
  /**
   * Fotografia COMPLETA del campo a fine step (modello Tactical Pad).
   *
   * Quando presente, il player interpola tra la posizione di ogni entità
   * nello step precedente e la sua posizione in `frame`. È il modello
   * corretto per la lavagna manuale: l'allenatore trascina i giocatori e
   * l'animazione li muove tutti insieme, in modo coerente, senza dover
   * gestire `from`/`to` per singola entità.
   *
   * Quando assente, si usa `actions` (retrocompatibilità con l'AI).
   */
  frame?: TacticalEntity[];
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

/**
 * Posizione di ogni entita' all'INIZIO di uno step.
 * Restituisce una Map entityId -> {x, y}.
 */
export function posizioniInizialiStep(
  entities: TacticalEntity[],
  steps: TacticalStep[],
  indiceStep: number,
): Map<string, { x: number; y: number }> {
  const posizioni = new Map<string, { x: number; y: number }>();
  for (const e of entities) posizioni.set(e.id, { x: e.x, y: e.y });

  const usaFrame = steps.some((s) => s.frame);
  if (usaFrame) {
    for (let i = indiceStep - 1; i >= 0; i--) {
      const frame = steps[i]?.frame;
      if (!frame) continue;
      for (const e of frame) {
        posizioni.set(e.id, { x: e.x, y: e.y });
      }
      break;
    }
    return posizioni;
  }

  for (let i = 0; i < indiceStep; i++) {
    for (const a of steps[i]?.actions ?? []) {
      if (!a.to) continue;
      posizioni.set(a.entityId, { x: a.to.x, y: a.to.y });
      if (a.type === 'dribble' && a.entityId !== 'ball') {
        posizioni.set('ball', { x: a.to.x, y: a.to.y });
      }
    }
  }
  return posizioni;
}

/**
 * Posizione di OGNI entità alla FINE dello step richiesto.
 */
export function posizioniFineStep(
  entities: TacticalEntity[],
  steps: TacticalStep[],
  indiceStep: number,
): Map<string, { x: number; y: number }> {
  const inizio = posizioniInizialiStep(entities, steps, indiceStep);
  const step = steps[indiceStep];
  if (!step) return inizio;

  if (step.frame) {
    const fine = new Map(inizio);
    for (const e of step.frame) {
      fine.set(e.id, { x: e.x, y: e.y });
    }
    return fine;
  }

  const fine = new Map(inizio);
  for (const a of step.actions ?? []) {
    if (!a.to) continue;
    fine.set(a.entityId, { x: a.to.x, y: a.to.y });
    if (a.type === 'dribble' && a.entityId !== 'ball') {
      fine.set('ball', { x: a.to.x, y: a.to.y });
    }
  }
  return fine;
}
