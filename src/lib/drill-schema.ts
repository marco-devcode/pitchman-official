/**
 * Schema del contratto Drill, in Zod per Genkit.
 *
 * Due regole non negoziabili, entrambe imparate con chiamate reali a Gemini
 * sul generatore di esercizi:
 *
 *  1. Niente `z.tuple`. Il serializzatore emette un campo "items" annidato e
 *     l'API risponde 400 "Proto field is not repeating, cannot start list".
 *     Ogni punto e' quindi un `z.object({x, y})`.
 *
 *  2. Niente riuso della stessa istanza di schema in due punti. Il
 *     serializzatore la emette come "$ref" e l'API risponde 400 "Unknown name
 *     $ref: Cannot find field". Quindi due oggetti identici ma SEPARATI: e'
 *     rumore, ma e' cio' che fa funzionare la chiamata.
 *
 * Tutto il resto (opzionale, default, descrizioni) e' qui perche' e' la leva
 * che riduce gli errori a valle: piu' il modello ha cose facoltative da
 * compilare, piu' inventa roba per riempirle.
 */

import { z } from 'genkit';

// --- punti: due istanze separate per la regola 2 ---

/** Punto sul campo, normalizzato 0-100. */
const PointXY = z.object({
  x: z.number().describe('Coordinata X normalizzata 0-100, origine in alto a sinistra.'),
  y: z.number().describe('Coordinata Y normalizzata 0-100, origine in alto a sinistra.'),
});

/** Punto di arrivo: identico a PointXY ma istanza separata (vedi regola 2). */
const PointTo = z.object({
  x: z.number().describe('Coordinata X di arrivo, 0-100.'),
  y: z.number().describe('Coordinata Y di arrivo, 0-100.'),
});

const ObjectSchema = z.object({
  id: z.string().describe(
    "ID univoco e stabile: 'ball' per la palla, poi 'gk', 'dc1', 'p2', 'c1', 'z1'. Non cambiare mai un id fra una variante e l'altra.",
  ),
  kind: z
    .enum(['player', 'ball', 'cone', 'goal', 'zone'])
    .describe(
      "'player', 'ball', 'cone', 'goal' (porta, compresa quella delle porticine), 'zone'.",
    ),
  team: z
    .enum(['red', 'blue', 'yellow', 'black', 'neutral'])
    .optional()
    .describe("Solo per kind 'player'. 'neutral' per chi non difende una squadra."),
  label: z.string().optional().describe('Etichetta breve, 1-3 caratteri: "GK", "DC", "8".'),
  number: z.string().optional().describe('Numero di maglia, se diverso dalla label.'),
  hasBall: z
    .boolean()
    .optional()
    .describe('TRUE solo per l\'UNICO giocatore che ha la palla all\'inizio. Tutti gli altri false o assente.'),
  width: z.number().optional().describe("Larghezza, solo per kind 'zone'."),
  height: z.number().optional().describe("Altezza, solo per kind 'zone'."),
});

const ActionSchema = z.object({
  id: z.string().describe("ID univoco dell'azione, es. 's1-a1'."),
  type: z.enum(['run', 'move', 'pass', 'shoot', 'dribble', 'wait']).describe('Cosa fa il soggetto.'),
  subject: z
    .string()
    .describe(
      "ID dell'oggetto che agisce. Per 'pass' e 'shoot' e' SEMPRE 'ball': la palla e' l'unica che passa o tira.",
    ),
  to: PointTo.optional().describe(
    'Dove arriva. Preferisci il campo `target` con un id di giocatore; `to` con un punto e\' il fallback.',
  ),
  target: z
    .string()
    .optional()
    .describe(
      "ID del giocatore ricevente, es. 'dc1'. Solo per pass e shoot. NON e' il cono, NON e' una zona.",
    ),
  duration: z
    .number()
    .describe('Durata in MILLISECONDI. Fra 300 e 4000. Un passaggio rapido sta fra 500 e 1200.'),
  startAt: z
    .number()
    .optional()
    .describe(
      'Ritardo in MILLISECONDI dall\'inizio dello step, fra 0 e 3000. Serve a sfasare i movimenti: senza, tutto parte insieme.',
    ),
  easing: z
    .enum(['linear', 'easeIn', 'easeOut', 'easeInOut'])
    .optional()
    .describe("'easeOut' per i passaggi (arriva e si ferma), 'easeInOut' per le corse."),
});

const StepSchema = z.object({
  id: z.string().describe("ID dello step, es. 's1'."),
  description: z
    .string()
    .describe(
      'In italiano: cosa succede in questo step e PERCHE\' tatticamente. Due-tre frasi.',
    ),
  duration: z.number().describe('Durata dello step in MILLISECONDI.'),
  actions: z.array(ActionSchema).describe('Cosa avviene dentro questo step.'),
});

const PitchSchema = z.object({
  shape: z.enum(['full-pitch', 'half-pitch', 'rectangle']).describe('Forma del campo.'),
  width: z.number().describe('Larghezza indicativa in METRI. Non e\' la scala di rendering.'),
  height: z.number().describe('Altezza indicativa in METRI. Non e\' la scala di rendering.'),
});

export const DrillSchema = z.object({
  id: z.string().describe("ID univoco della variante, es. 'variante-1'."),
  name: z.string().describe("Titolo dell'esercizio, max 60 caratteri."),
  description: z.string().describe("Descrizione in italiano, 2-4 frasi: obiettivo e come si esegue."),
  category: z.string().describe('Categoria: costruzione, finalizzazione, pressing, transizione, possesso.'),
  ageGroup: z.string().describe("Fascia d'eta': U8, U10, U12, U14, U16, Senior."),
  pitch: PitchSchema,
  objects: z.array(ObjectSchema).describe("TUTTI gli oggetti del campo, compresi quelli che entrano dopo."),
  sequence: z.array(StepSchema).describe('I passi dell\'esercizio, in ordine.'),
  cycles: z.number().describe('Quante volte si ripete la sequenza. 1 se non serve ripetere.'),
});

export const VariantsSchema = z.object({
  variants: z.array(DrillSchema).describe(
    'Esattamente TRE varianti: [0] l\'esercizio richiesto esattamente come descritto, [1] e [2] due progressioni didattiche complete e autonome.',
  ),
});

export type DrillSchemaType = z.infer<typeof DrillSchema>;
export type VariantsSchemaType = z.infer<typeof VariantsSchema>;