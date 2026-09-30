/**
 * Contratto canonico dell'esercizio generato dall'AI.
 *
 * Questo e' il formato che VIAGGIA (dal modello, dall'endpoint, nella
 * risposta HTTP). Non e' quello che il player Konva disegna: il player usa
 * `TacticalExercise` (durate in secondi, `entityId`, coordinate normalizzate
 * 0-100). La traduzione e' in drill-to-tactical.ts, e sta tutta li' apposta:
 * tenere i due formati separati evita di dover toccare il player ogni volta
 * che il contratto AI cambia, e viceversa.
 *
 * Differenze rispetto a TacticalExercise, e perche':
 *
 *  - millisecondi, non secondi. Il modello ragiona in ms ("un passaggio dura
 *    700ms") e scrive numeri tipo 1500: in secondi quello sarebbe un passaggio
 *    di 25 minuti. Mettere l'unita' nel contratto elimina l'ambiguita' alla
 *    fonte invece di correggerla a valle ogni volta.
 *
 *  - `subject` + `target` invece di `entityId` + from/to espliciti. Con
 *    `subject`/`target` il modello non puo' sbagliare a mettere il passaggio
 *    sul giocatore invece che sulla palla, perche' il campo dice gia' "chi
 *    agisce" e il repair puo' correggerlo leggendo un solo valore. Con
 *    `entityId` sbagliava entrambi i lati e non si capiva quale dei due fosse
 *    quello falso.
 *
 * Sistema di coordinate: normalizzato 0-100 su entrambi gli assi, origine in
 * ALTO a SINISTRA. Diverso da lineup-mapping.ts (Y invertito): non mescolarli.
 */

export type DrillTeam = 'red' | 'blue' | 'yellow' | 'black' | 'neutral';

export type DrillObjectKind = 'player' | 'ball' | 'cone' | 'goal' | 'zone';

export type DrillActionType =
  | 'run'
  | 'move'
  | 'pass'
  | 'shoot'
  | 'dribble'
  | 'wait';

export type DrillEasing = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

export interface DrillPoint {
  x: number;
  y: number;
}

export interface DrillObject extends DrillPoint {
  id: string;
  kind: DrillObjectKind;
  /** Solo per kind 'player'. */
  team?: DrillTeam;
  /** Etichetta breve dentro il pallino: "GK", "DC", un numero. */
  label?: string;
  /** Numero di maglia, quando diverso dalla label. */
  number?: string;
  /** Il possessore iniziale. Uno solo per esercizio. */
  hasBall?: boolean;
  /** Colore libero per i casi in cui il team non basta. */
  color?: string;
  /** Solo per kind 'zone'. */
  width?: number;
  height?: number;
}

export interface DrillAction {
  id: string;
  type: DrillActionType;
  /** Id dell'oggetto che agisce. Per pass/shoot e' sempre "ball". */
  subject: string;
  /** Destinazione: id di un oggetto, oppure un punto sul campo. */
  to?: DrillPoint | string;
  /**
   * Alias AI-friendly di `to`: il modello ragiona meglio con "passo a cb1"
   * che con un punto. Il server lo normalizza in `to`. Se entrambi ci sono,
   * vince `to`.
   */
  target?: string;
  /** Durata in MILLISECONDI. */
  duration: number;
  /** Ritardo in millisecondi dall'inizio dello step. */
  startAt?: number;
  easing?: DrillEasing;
}

export interface DrillStep {
  id: string;
  /** Spiegazione in italiano di cosa succede, e perche' tatticamente. */
  description: string;
  /** Durata dello step in millisecondi. */
  duration: number;
  actions: DrillAction[];
}

export interface DrillPitch {
  shape: 'full-pitch' | 'half-pitch' | 'rectangle';
  /** Misura informativa in metri: NON e' la scala di rendering. */
  width: number;
  height: number;
}

export interface Drill {
  id: string;
  name: string;
  description: string;
  category: string;
  ageGroup: string;
  pitch: DrillPitch;
  objects: DrillObject[];
  sequence: DrillStep[];
  /** Quante volte la sequenza va ripetuta. */
  cycles: number;
}

/**
 * Risposta del modello: l'esercizio richiesto piu' due progressioni
 * didattiche complete. Non patch: ogni variante ha i propri oggetti e la
 * propria sequenza, perche' l'allenatore deve poter salvare una progressione
 * senza l'esercizio base da cui dipende.
 */
export interface DrillVariants {
  variants: Drill[];
}

/** Limite di sicurezza sul numero di step, come da specifica. */
export const MAX_STEPS = 6;

/**
 * Intervallo utile per le coordinate. 3..97 e non 0..100 perche' un oggetto a
 * 0 o 100 e' meta' fuori dal campo: si vede tagliato dal bordo. Il repair
 * clampa qui dentro, quindi anche il modello puo' sbagliare i bordi senza
 * rompere niente.
 */
export const MIN_COORD = 3;
export const MAX_COORD = 97;

/** Clamp di una coordinata nell'intervallo utile 3..97. */
export function clampDrillCoord(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 50;
  return Math.max(MIN_COORD, Math.min(MAX_COORD, n));
}

/** Distanza euclidea fra due punti normalizzati. Serve al repair. */
export function dist(a: DrillPoint, b: DrillPoint): number {
  const dx = clampDrillCoord(a.x) - clampDrillCoord(b.x);
  const dy = clampDrillCoord(a.y) - clampDrillCoord(b.y);
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Se `to` e' un id di oggetto, restituisce l'id; se e' un punto, restituisce
 * `undefined`. Serve a distinguere "passo al ricevente" da "passo in questo
 * punto" senza che il chiamante debba rifare il typeof.
 */
export function resolveActionTarget(
  action: DrillAction,
  objects: DrillObject[],
): DrillObject | undefined {
  const ref = typeof action.to === 'string' ? action.to : action.target;
  if (typeof ref !== 'string') return undefined;
  return objects.find((o) => o.id === ref);
}

/** Indica se l'azione e' un passaggio o un tiro: in entrambi la palla agisce. */
export function isBallAction(action: DrillAction): boolean {
  return action.type === 'pass' || action.type === 'shoot';
}