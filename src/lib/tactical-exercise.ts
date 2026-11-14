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
 * Durata massima di uno step, in secondi. Allineata al repair dell'AI, che
 * accetta startAt fino a 5s e durate fino a 8s: con un tetto piu' basso le
 * azioni lunghe venivano troncate e "scattavano" all'arrivo allo step dopo.
 */
export const MAX_DURATA_STEP = 13;

/** Durata di uno step senza azioni: il tempo per leggerne la descrizione. */
export const DURATA_STEP_VUOTO = 2;

type Posizioni = Map<string, { x: number; y: number }>;

/**
 * Tratto di movimento di UNA entita' dentro uno step, gia' pronto per
 * essere campionato nel tempo.
 *
 * E' l'unica fonte di verita' dell'animazione a azioni: il player la usa per
 * disegnare, `posizioniInizialiStep` per sapere dove finisce ogni step. Prima
 * le due cose erano calcolate in modi diversi (il player partiva dal `from`
 * salvato, la simulazione dalla posizione reale) e ogni differenza si vedeva
 * come uno scatto della pedina.
 */
export interface SegmentoMoto {
  /** Indice dell'azione nello step che ha generato il tratto. */
  indiceAzione: number;
  type: TacticalActionType;
  /** Partenza: dove l'entita' si trova DAVVERO quando il tratto inizia. */
  from: TacticalPoint;
  to: TacticalPoint;
  /** Inizio e fine in secondi dall'inizio dello step. */
  start: number;
  end: number;
  easing?: TacticalEasing;
  /** True quando la palla sta solo seguendo il dribble di un giocatore. */
  segue: boolean;
}

/** Applica l'andamento richiesto al parametro 0..1. */
export function applicaEasing(t: number, kind?: TacticalEasing): number {
  switch (kind) {
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return t * (2 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    default:
      return t;
  }
}

function intervalloAzione(a: TacticalAction): { start: number; end: number } {
  const start = typeof a.startAt === 'number' && Number.isFinite(a.startAt) ? Math.max(0, a.startAt) : 0;
  const durata = typeof a.duration === 'number' && Number.isFinite(a.duration) ? Math.max(0.1, a.duration) : 1;
  return { start, end: start + durata };
}

/**
 * Costruisce i tratti di movimento di ogni entita' in uno step.
 *
 * Regole che garantiscono la continuita':
 *  - il primo tratto parte dalla posizione reale dell'entita' a inizio step
 *    (`partenze`), mai dal `from` salvato nell'azione;
 *  - ogni tratto successivo parte dall'arrivo del precedente;
 *  - se un'azione inizia prima che la precedente della stessa entita' sia
 *    finita, aspetta la sua fine (senza questo la pedina salterebbe a meta'
 *    della seconda azione);
 *  - durante un dribble la palla segue il conduttore, salvo negli intervalli
 *    in cui ha un'azione propria (passaggio/tiro).
 */
export function segmentiStep(
  step: TacticalStep | undefined,
  partenze: Posizioni,
  idPalle: string[],
): Map<string, SegmentoMoto[]> {
  const risultato = new Map<string, SegmentoMoto[]>();
  if (!step || step.frame) return risultato;

  const azioni = (step.actions ?? [])
    .map((a, indice) => ({ a, indice, ...intervalloAzione(a) }))
    .filter(({ a }) => Boolean(a?.to) && typeof a.entityId === 'string')
    .sort((x, y) => x.start - y.start || x.indice - y.indice);

  type Grezzo = {
    indice: number;
    type: TacticalActionType;
    to: TacticalPoint;
    start: number;
    end: number;
    easing?: TacticalEasing;
    segue: boolean;
  };
  const grezzi = new Map<string, Grezzo[]>();
  const aggiungi = (id: string, g: Grezzo) => {
    const lista = grezzi.get(id);
    if (lista) lista.push(g);
    else grezzi.set(id, [g]);
  };

  for (const { a, indice, start, end } of azioni) {
    aggiungi(a.entityId, { indice, type: a.type, to: a.to, start, end, easing: a.easing, segue: false });
  }

  // La palla che segue chi conduce. Con piu' palloni segue quello piu' vicino
  // al conduttore a inizio step.
  const pallaDi = (conduttore: string): string | undefined => {
    if (idPalle.length <= 1) return idPalle[0];
    const p = partenze.get(conduttore);
    if (!p) return idPalle[0];
    let migliore: string | undefined;
    let distanza = Infinity;
    for (const id of idPalle) {
      const b = partenze.get(id);
      if (!b) continue;
      const d = Math.hypot(b.x - p.x, b.y - p.y);
      if (d < distanza) {
        distanza = d;
        migliore = id;
      }
    }
    return migliore;
  };

  for (const { a, indice, start, end } of azioni) {
    if (a.type !== 'dribble' || idPalle.includes(a.entityId)) continue;
    const palla = pallaDi(a.entityId);
    if (!palla) continue;
    const sovrapposta = azioni.some(
      (o) => o.a.entityId === palla && start < o.end && o.start < end,
    );
    if (sovrapposta) continue;
    aggiungi(palla, { indice, type: a.type, to: a.to, start, end, easing: a.easing, segue: true });
  }

  for (const [id, lista] of grezzi) {
    const iniziale = partenze.get(id);
    // Azione su un'entita' che non esiste in scena: non c'e' niente da muovere.
    if (!iniziale) continue;
    lista.sort((x, y) => x.start - y.start || x.indice - y.indice);

    let cursore: TacticalPoint = { x: iniziale.x, y: iniziale.y };
    let finePrecedente = 0;
    const segmenti: SegmentoMoto[] = [];
    for (const g of lista) {
      const start = Math.max(g.start, finePrecedente);
      const end = Math.max(g.end, start + 0.1);
      const to = { x: clampCoord(g.to.x), y: clampCoord(g.to.y) };
      segmenti.push({
        indiceAzione: g.indice,
        type: g.type,
        from: cursore,
        to,
        start,
        end,
        easing: g.easing,
        segue: g.segue,
      });
      cursore = to;
      finePrecedente = end;
    }
    risultato.set(id, segmenti);
  }

  return risultato;
}

/** Posizione di un'entita' al tempo `t` (secondi dall'inizio dello step). */
export function posizioneAlTempo(
  segmenti: SegmentoMoto[] | undefined,
  partenza: { x: number; y: number },
  t: number,
): { x: number; y: number } {
  if (!segmenti || segmenti.length === 0) return partenza;
  for (const s of segmenti) {
    if (t < s.start) return s.from;
    if (t <= s.end) {
      const locale = s.end > s.start ? (t - s.start) / (s.end - s.start) : 1;
      const k = applicaEasing(Math.max(0, Math.min(1, locale)), s.easing);
      return {
        x: s.from.x + (s.to.x - s.from.x) * k,
        y: s.from.y + (s.to.y - s.from.y) * k,
      };
    }
  }
  return segmenti[segmenti.length - 1].to;
}

/** Durata dello step, in secondi, calcolata sui tratti effettivi. */
export function durataSegmenti(segmenti: Map<string, SegmentoMoto[]>): number {
  let fine = 0;
  for (const lista of segmenti.values()) {
    for (const s of lista) fine = Math.max(fine, s.end);
  }
  if (fine === 0) return DURATA_STEP_VUOTO;
  return Math.max(0.5, Math.min(MAX_DURATA_STEP, fine));
}

/** Posizioni a fine step: l'arrivo dell'ultimo tratto di ogni entita'. */
function applicaSegmenti(partenze: Posizioni, segmenti: Map<string, SegmentoMoto[]>): Posizioni {
  const fine = new Map(partenze);
  for (const [id, lista] of segmenti) {
    const ultimo = lista[lista.length - 1];
    if (ultimo) fine.set(id, { x: ultimo.to.x, y: ultimo.to.y });
  }
  return fine;
}

function idPalleDi(entities: TacticalEntity[]): string[] {
  return entities.filter((e) => e.type === 'ball').map((e) => e.id);
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

  const idPalle = idPalleDi(entities);
  let correnti: Posizioni = posizioni;
  for (let i = 0; i < indiceStep; i++) {
    correnti = applicaSegmenti(correnti, segmentiStep(steps[i], correnti, idPalle));
  }
  return correnti;
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

  return applicaSegmenti(inizio, segmentiStep(step, inizio, idPalleDi(entities)));
}
