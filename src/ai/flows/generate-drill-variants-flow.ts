import 'server-only';
/**
 * Generazione di esercizi tattici animati con Gemini 3.x tramite Genkit.
 *
 * Modello stile FootballGPT: genera subito UN singolo esercizio animato ad
 * alta precisione (`mode: 'base'`) e consente di richiedere on-demand le
 * progressioni (`mode: 'easier' | 'harder'`) a partire dall'esercizio base.
 *
 * Condivide la catena di modelli 3.x e il runner resiliente con il flusso
 * Vision (`generate-drill-from-image-flow.ts`).
 */

import { z } from 'genkit';
import { ai } from '@/ai/genkit';
import type { Drill } from '@/lib/drill';
import { DEMO_DRILL } from '@/lib/demo-drill';

// --- Schema Zod per output strutturato Gemini (senza $ref riusati né z.tuple) ---
const PointTo = z.object({
  x: z.number().describe('Coordinata X di arrivo, 0-100.'),
  y: z.number().describe('Coordinata Y di arrivo, 0-100.'),
});

const ObjectSchema = z.object({
  id: z.string().describe(
    "ID univoco e stabile: 'ball' per la palla, poi 'gk', 'dc1', 'p2', 'c1', 'g1', 'z1'.",
  ),
  kind: z
    .enum(['player', 'ball', 'cone', 'goal', 'zone'])
    .describe(
      "'player', 'ball', 'cone', 'goal' (porta o porticina), 'zone'.",
    ),
  x: z
    .number()
    .describe(
      'Coordinata X iniziale sul campo da 5 a 95 (5=bordo sinistro, 50=centro, 95=bordo destro). OBBLIGATORIO.',
    ),
  y: z
    .number()
    .describe(
      'Coordinata Y iniziale sul campo da 5 a 95 (5=alto, 50=centro, 95=basso). OBBLIGATORIO.',
    ),
  team: z
    .enum(['red', 'blue', 'yellow', 'black', 'neutral'])
    .optional()
    .describe("Solo per kind 'player'. 'neutral' per jolly/sponde senza squadra."),
  label: z.string().optional().describe('Etichetta breve dentro la pedina, 1-3 caratteri: "GK", "DC", "9", "J".'),
  number: z.string().optional().describe('Numero di maglia, se diverso dalla label.'),
  hasBall: z
    .boolean()
    .optional()
    .describe('TRUE solo per l\'UNICO giocatore che parte con la palla tra i piedi.'),
  width: z.number().optional().describe("Larghezza (5-90), per kind 'zone' o 'goal'."),
  height: z.number().optional().describe("Altezza (5-90), per kind 'zone' o 'goal'."),
});

const ActionSchema = z.object({
  id: z.string().describe("ID univoco dell'azione, es. 's1-a1'."),
  type: z
    .enum(['run', 'move', 'pass', 'shoot', 'dribble', 'wait'])
    .describe(
      "'pass' o 'shoot' sulla palla; 'dribble' per conduzione palla del possessore; 'run'/'move' per smarcamento o pressione senza palla.",
    ),
  subject: z
    .string()
    .describe(
      "ID dell'oggetto che agisce. Per 'pass' e 'shoot' e' SEMPRE 'ball'. Per 'run'/'move'/'dribble' e' l'ID del giocatore.",
    ),
  to: PointTo.optional().describe(
    "Punto {x, y} di arrivo (5..95). Obbligatorio per 'run', 'move', 'dribble', e per passaggi nello spazio/tiri in porta.",
  ),
  target: z
    .string()
    .optional()
    .describe(
      "ID del giocatore ricevente o della porta (es. 'a1', 'g1'). Usa 'target' per passaggi a compagno o tiri verso una porta.",
    ),
  duration: z
    .number()
    .describe('Durata in MILLISECONDI, fra 400 e 4000. Un passaggio rapido sta fra 600 e 1100.'),
  startAt: z
    .number()
    .optional()
    .describe(
      'Ritardo in MILLISECONDI dall\'inizio dello step (0..3000) per sfasare passaggi e movimenti coordinati.',
    ),
  easing: z
    .enum(['linear', 'easeIn', 'easeOut', 'easeInOut'])
    .optional()
    .describe("'easeOut' per passaggi/tiri, 'easeInOut' per corse e conduzioni."),
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

export const TIMEOUT_PER_MODELLO_MS = 18_000;
const TENTATIVI_PER_MODELLO = 2;
const ATTESA_TENTATIVI_MS = [0, 2500];
const BUDGET_TOTALE_MS = 45_000;

export type DrillGenerationMode = 'base' | 'easier' | 'harder';

export interface GenerateDrillOptions {
  mode?: DrillGenerationMode;
  baseDrill?: Drill;
}

export interface GenerateResult {
  drills: Drill[];
  /** Modello che ha effettivamente risposto. */
  model: string;
  /** Se ha risposto un modello diverso dal primario. */
  fallbackUsed: boolean;
  /** 'gemini' quando ha risposto un modello reale, 'demo' come riserva. */
  source: 'gemini' | 'demo';
  /** Provenienza per ogni scheda, allineata a `drills`. */
  sources: ('gemini' | 'demo')[];
  /** Token consumati dalle chiamate reali al modello. */
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Catena modelli Gemini 3.x: primari full per ragionamento spaziale 2D e
 * Vision, seguiti dai 3.x lite veloci in fallback automatico.
 */
export function catenaModelli(): string[] {
  const candidates = [
    process.env.GEMINI_MODEL || 'googleai/gemini-3.5-flash',
    process.env.GEMINI_FALLBACK_MODEL || 'googleai/gemini-3-flash-preview',
    'googleai/gemini-3.1-flash-lite',
    'googleai/gemini-3.5-flash-lite',
    'googleai/gemini-flash-lite-latest',
  ];
  return candidates.filter((m, i, a) => Boolean(m) && a.indexOf(m) === i);
}

export function hasGeminiApiKey(): boolean {
  return !!(
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENAI_API_KEY ||
    process.env.GOOGLE_API_KEY
  );
}

/** Errori non recuperabili con retry sullo stesso modello (429 quota o 404). */
function shouldSkipRetriesOnError(message: string): boolean {
  return /\[429\s*\]|quota|\[404\s*\]|not found|not supported for generateContent/i.test(
    message,
  );
}

export const DRILL_SYSTEM_PROMPT = `Sei un allenatore di calcio professionista UEFA Pro e un progettista di lavagne tattiche animate (stile FootballGPT).

Restituisci SOLO il JSON strutturato richiesto dallo schema.
Le coordinate sono percentuali da 0 a 100 con origine in ALTO a SINISTRA: x cresce verso destra (5..95), y cresce verso il basso (5..95). Tieni tutto ben spaziato dentro il campo (minimo 10-12 unita' di distanza tra i giocatori, mai sovrapposti). Descrizioni in italiano, chiare e concrete.

REGOLE OBBLIGATORIE:
1. Ogni oggetto in "objects" DEVE avere sempre "x" e "y" numeriche (fra 8 e 92).
2. Esiste esattamente un oggetto con kind "ball" e id "ball", posizionato esattamente alle stesse coordinate del giocatore con hasBall=true.
3. Un giocatore non diventa e non sostituisce la palla.
4. Le azioni "pass" e "shoot" hanno SEMPRE subject = "ball", con target (id del giocatore ricevente o della porta) oppure to = {x, y}.
5. Un giocatore CON la palla che si muove usa type = "dribble" con subject = id del giocatore e to = {x, y}.
6. Un giocatore SENZA palla che si muove usa type = "run" (corsa/smarcamento) o "move" con subject = id del giocatore e to = {x, y}.
7. Il possesso deve restare coerente di step in step: chi riceve un passaggio diventa il possessore nello step successivo.
8. Usa coni ("cone") o zone ("zone") per delimitare chiaramente quadrati, corridoi o aree di gioco, e porte ("goal") se ci sono porte o porticine.
9. Crea una sequenza animata fluida e leggibile di 3-5 step in "sequence", sfasando le azioni nello stesso step tramite "startAt" (0..2200ms) cosi' passaggi, ricezioni, smarcamenti e sovrapposizioni risultino sincronizzati.
10. Un giocatore vicino a un cono sta ACCANTO al cono (scarto di 5 unita'), mai sopra.

Esempio di step ricco e coerente (passaggio + smarcamento senza palla):
{
  "id": "s1",
  "description": "Il centrale apre sul terzino mentre la mezzala attacca lo spazio tra le linee.",
  "duration": 2600,
  "actions": [
    { "id": "s1-a1", "type": "pass", "subject": "ball", "target": "td", "duration": 800, "startAt": 0, "easing": "easeOut" },
    { "id": "s1-a2", "type": "run", "subject": "cc", "to": { "x": 62, "y": 34 }, "duration": 1400, "startAt": 300, "easing": "easeInOut" },
    { "id": "s1-a3", "type": "move", "subject": "pv1", "to": { "x": 42, "y": 26 }, "duration": 1200, "startAt": 400, "easing": "easeInOut" }
  ]
}`;

export interface DrillChainResult {
  drill: Drill;
  model: string;
  fallbackUsed: boolean;
  source: 'gemini' | 'demo';
  usage?: { inputTokens: number; outputTokens: number };
}

/**
 * Esegue la generazione di un singolo Drill percorrendo la catena di modelli
 * Gemini 3.x con timeout, retry mirati su 503 e fallback demo se tutto fallisce.
 */
export async function executeDrillModelChain(params: {
  roleId: string;
  logPrefix: string;
  invoke: (model: string) => Promise<{
    output: unknown;
    usage?: { inputTokens?: number; outputTokens?: number };
  }>;
}): Promise<DrillChainResult> {
  if (!hasGeminiApiKey()) {
    console.warn(`[${params.logPrefix}] nessuna GEMINI_API_KEY: rispondo con demo.`);
    return {
      drill: DEMO_DRILL,
      model: 'demo',
      fallbackUsed: false,
      source: 'demo',
    };
  }

  const catena = catenaModelli();
  const inizio = Date.now();

  for (let i = 0; i < catena.length; i++) {
    const modello = catena[i];

    for (let tentativo = 0; tentativo < TENTATIVI_PER_MODELLO; tentativo++) {
      const attesa = ATTESA_TENTATIVI_MS[tentativo] ?? 0;

      if (Date.now() - inizio + attesa >= BUDGET_TOTALE_MS) {
        console.warn(
          `[${params.logPrefix}] ${params.roleId}: budget di ${BUDGET_TOTALE_MS}ms esaurito, uso demo`,
        );
        break;
      }
      if (attesa > 0) await new Promise((r) => setTimeout(r, attesa));

      try {
        const timeoutMs = Math.max(
          3000,
          Math.min(TIMEOUT_PER_MODELLO_MS, BUDGET_TOTALE_MS - (Date.now() - inizio)),
        );
        const { output, usage } = await withTimeout(
          params.invoke(modello),
          timeoutMs,
          `${modello}/${params.roleId}`,
        );

        const drill = output as unknown as Drill | undefined;
        const hasPlayers =
          drill &&
          Array.isArray(drill.objects) &&
          drill.objects.some((o) => o.kind === 'player');
        const hasSteps = drill && Array.isArray(drill.sequence) && drill.sequence.length > 0;

        if (hasPlayers && hasSteps) {
          if (i > 0 || tentativo > 0) {
            console.warn(
              `[${params.logPrefix}] ${params.roleId} da ${modello} (tentativo ${tentativo + 1}${i > 0 ? ', fallback' : ''})`,
            );
          }
          return {
            drill: { ...drill, id: drill.id || params.roleId },
            model: modello,
            fallbackUsed: i > 0,
            source: 'gemini',
            usage: {
              inputTokens: Number(usage?.inputTokens ?? 0),
              outputTokens: Number(usage?.outputTokens ?? 0),
            },
          };
        }

        console.warn(`[${params.logPrefix}] ${params.roleId}: ${modello} risposta incompleta.`);
      } catch (e: unknown) {
        const testoErrore = String(e instanceof Error ? e.message : e);
        console.warn(
          `[${params.logPrefix}] ${params.roleId} ${modello} tentativo ${tentativo + 1}/${TENTATIVI_PER_MODELLO}: ${testoErrore.slice(0, 140)}`,
        );

        if (/\[400\s*\]/.test(testoErrore)) {
          throw new Error(
            'Il generatore ha un problema tecnico nel formato dei dati. Riprova fra poco.',
          );
        }

        if (shouldSkipRetriesOnError(testoErrore)) {
          console.warn(
            `[${params.logPrefix}] ${params.roleId}: ${modello} non disponibile/quota, passo al successivo`,
          );
          break;
        }
      }
    }
  }

  return {
    drill: { ...DEMO_DRILL, id: `${params.roleId}-demo` },
    model: 'demo',
    fallbackUsed: true,
    source: 'demo',
  };
}

function summarizeBaseDrill(drill: Drill): string {
  const compact = {
    name: drill.name,
    description: drill.description,
    category: drill.category,
    ageGroup: drill.ageGroup,
    pitch: drill.pitch,
    objects: drill.objects.map((o) => ({
      id: o.id,
      kind: o.kind,
      team: o.team,
      label: o.label,
      x: Math.round(o.x),
      y: Math.round(o.y),
      hasBall: o.hasBall,
    })),
    sequence: drill.sequence.map((s) => ({
      id: s.id,
      description: s.description,
      actions: s.actions,
    })),
  };
  return JSON.stringify(compact);
}

function buildUserPrompt(brief: string, mode: DrillGenerationMode, baseDrill?: Drill): string {
  const baseSummary = baseDrill ? summarizeBaseDrill(baseDrill) : null;

  if (mode === 'easier') {
    return [
      `RICHIESTA ALLENATORE:\n${brief || baseDrill?.name || 'Esercizio tattico'}`,
      baseSummary ? `ESERCIZIO BASE DI RIFERIMENTO (JSON):\n${baseSummary}` : '',
      `OBIETTIVO: Crea una progressione PIU' SEMPLICE dello stesso esercizio.`,
      `Scegli UNA leva didattica chiara (es. un difensore in meno che pressa o pressione solo passiva, spazio piu' ampio, un jolly di appoggio in piu', o tocco libero anziche' vincolato) e rigenera l'esercizio completo e animabile con le nuove coordinate e azioni coerenti.`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  if (mode === 'harder') {
    return [
      `RICHIESTA ALLENATORE:\n${brief || baseDrill?.name || 'Esercizio tattico'}`,
      baseSummary ? `ESERCIZIO BASE DI RIFERIMENTO (JSON):\n${baseSummary}` : '',
      `OBIETTIVO: Crea una progressione PIU' DIFFICILE dello stesso esercizio.`,
      `Scegli UNA leva tattica allenante (es. pressing attivo immediato, spazio ridotto, vincolo massimo 2 tocchi, oppure aggiunta di un difensore/transizione su porticina) e rigenera l'esercizio completo e animabile con le nuove coordinate e azioni coerenti.`,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  return [
    `RICHIESTA ALLENATORE:\n${brief}`,
    `Genera l'esercizio ESATTAMENTE come richiesto sopra, con disposizione spaziale realistica su tutto il campo (8..92) e 3-5 step di animazione fluidi e dettagliati.`,
  ].join('\n\n');
}

/**
 * Genera UN esercizio animato (`base`, oppure la progressione `easier`/`harder`
 * richiesta su domanda a partire dall'esercizio base).
 */
export async function generateDrillVariants(
  prompt: string,
  options: GenerateDrillOptions = {},
): Promise<GenerateResult> {
  const testo = prompt.trim();
  const mode: DrillGenerationMode = options.mode ?? 'base';
  const roleId = mode === 'base' ? 'variante-base' : `variante-${mode}`;
  const avvio = Date.now();

  const userPrompt = buildUserPrompt(testo, mode, options.baseDrill);

  const esito = await executeDrillModelChain({
    roleId,
    logPrefix: 'drill',
    invoke: (modello) =>
      ai.generate({
        model: modello,
        system: DRILL_SYSTEM_PROMPT,
        prompt: userPrompt,
        output: { schema: DrillSchema },
        config: { temperature: 0.35 },
      }),
  });

  console.log(
    `[drill] mode=${mode} source=${esito.source} model=${esito.model} in ${Date.now() - avvio}ms`,
  );

  return {
    drills: [esito.drill],
    model: esito.model,
    fallbackUsed: esito.fallbackUsed,
    source: esito.source,
    sources: [esito.source],
    usage: esito.usage,
  };
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  etichetta: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${etichetta}: timeout dopo ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}
