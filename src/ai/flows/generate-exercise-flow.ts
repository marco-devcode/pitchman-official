'use server';
/**
 * @fileOverview Flusso AI che trasforma la descrizione di un esercizio di
 * calcio in dati strutturati per un'animazione 2D.
 *
 * Usa Genkit come gli altri flussi AI del progetto (chatbot, import,
 * suggerisci formazione): un solo modo di chiamare Gemini, stesso modello,
 * stessa chiave, stesso fallback.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { MAX_STEPS } from '@/lib/tactical-exercise';

const EntitySchema = z.object({
  id: z.string().describe("ID univoco e stabile, es. 'p1', 'p2', 'ball', 'c1'."),
  type: z.enum(['player', 'ball', 'cone', 'zone']),
  team: z.enum(['blue', 'red', 'yellow', 'gk']).optional().describe("Solo per type 'player'. 'gk' = portiere."),
  label: z.string().optional().describe('Etichetta breve, 1-3 caratteri, es. "GK", "1", "DC".'),
  x: z.number().describe('Coordinata X normalizzata 0-100. 0 = porta propria, 100 = porta avversaria.'),
  y: z.number().describe('Coordinata Y normalizzata 0-100. 0 = fallo laterale sinistro, 100 = destro.'),
  width: z.number().optional().describe("Larghezza della zona, solo per type 'zone'."),
  height: z.number().optional().describe("Altezza della zona, solo per type 'zone'."),
});

// Niente z.tuple e Niente riuso dello stesso schema qui. Sono due errori distinti
// di Gemini, entrambi verificati con una chiamata reale:
//
//  1. z.tuple -> il serializzatore emette un campo "items" annidato, e Gemini
//     risponde 400 "Proto field is not repeating, cannot start list".
//  2. riuso della stessa istanza (from e to che puntano allo stesso PointSchema)
//     -> il serializzatore la emette come "$ref", e Gemini risponde 400
//     "Unknown name $ref: Cannot find field".
//
// Quindi due oggetti identici ma SEPARATI: nessun annidamento, nessun riuso.
// Il player accetta {x, y}, che e' anche piu' leggibile per il modello.
const ActionSchema = z.object({
  entityId: z.string().describe("ID dell'entita' che agisce: deve esistere fra le initialEntities."),
  type: z.enum(['pass', 'run', 'dribble', 'shoot']),
  from: z.object({
    x: z.number().describe('Coordinata X di partenza, 0-100.'),
    y: z.number().describe('Coordinata Y di partenza, 0-100.'),
  }).describe('Coordinate di partenza.'),
  to: z.object({
    x: z.number().describe('Coordinata X di arrivo, 0-100.'),
    y: z.number().describe('Coordinata Y di arrivo, 0-100.'),
  }).describe('Coordinate di arrivo.'),
  duration: z.number().describe('Durata in secondi, fra 0.5 e 8.'),
});

const StepSchema = z.object({
  stepNumber: z.number().describe('Numero dello step, parte da 1.'),
  description: z.string().describe("Spiegazione in italiano, una o due frasi, di cosa succede in questo step (e perche' tatticamente)."),
  actions: z.array(ActionSchema).describe('Azioni che avvengono dentro questo step.'),
});

const GenerateExerciseInputSchema = z.object({
  prompt: z.string().describe("La descrizione in testo libero dell'esercizio, scritta dall'allenatore."),
});

// Privato: vedi la nota sul defineFlow. In 'use server' si esportano solo
// funzioni async, e questo schema non serve al client (il tipo e' gia' in
// GenerateExerciseOutput).
const GenerateExerciseOutputSchema = z.object({
  title: z.string().describe("Titolo breve e parlante dell'esercizio, max 60 caratteri."),
  description: z.string().describe("Descrizione dell'esercizio in italiano, 2-4 frasi."),
  playersShown: z.number().describe('Numero di giocatori mostrati, portieri inclusi.'),
  initialEntities: z.array(EntitySchema).describe("Tutte le entita' del campo con le posizioni di partenza."),
  steps: z.array(StepSchema).describe(`I passi dell'esercizio, al massimo ${MAX_STEPS}.`),
});

export type GenerateExerciseInput = z.infer<typeof GenerateExerciseInputSchema>;
export type GenerateExerciseOutput = z.infer<typeof GenerateExerciseOutputSchema>;

const prompt = ai.definePrompt({
  name: 'generateExercisePrompt',
  input: { schema: GenerateExerciseInputSchema },
  output: { schema: GenerateExerciseOutputSchema },
  prompt: `Sei un allenatore di calcio professionista ed esperto di lavagne tattiche 2D.
Converti la descrizione di un esercizio, scritta in linguaggio naturale, in dati strutturati per un'animazione su campo.

REGOLE SPAZIALI (fundamentalmente importanti):
1. Il campo usa coordinate NORMALIZZATE 0-100:
   - X: 0 = porta propria (dove attacca la squadra "blue"), 100 = porta avversaria.
   - Y: 0 = fallo laterale sinistro, 100 = fallo laterale destro.
   Tutte le coordinate, iniziali e di azione, devono stare fra 0 e 100.
2. I giocatori della squadra che attacca sono "blue", quelli che difendono "red".
   I portieri sono "gk".
3. Le entita' sono: giocatori (player), pallone (ball), coni (cone), zone (zone).
4. Ogni entita' ha un ID univoco e stabile. Le azioni devono riferirsi a ID esistenti.
5. Il pallone esiste SEMPRE: se l'esercizio non lo menziona, aggiungilo in una posizione sensata.

REGOLE SUL SEQUENZE:
6. Massimo ${MAX_STEPS} step, in ordine logico e comprensibile.
7. Ogni step ha una description in italiano che spieghi cosa succede, e anche il PERCHE'
   tattico quando e' rilevante (apertura, ampiezza, densita', uscita dalla pressione).
8. Le azioni dentro uno step devono essere coerenti fra loro: un passaggio ha senso solo se
   il pallone e' vicino al giocatore che lo riceve.
9. Rispetta la realta' calcistica: movimenti possibili, niente sovrapposizioni impossibili
   e niente teletrasporti.
10. La posizione iniziale di ogni giocatore DEVE coincidere con il punto di partenza (from)
    della sua prima azione: altrimenti l'animazione lo sposta a scatti.

FORMATO DELLE COORDINATE (rispettalo alla lettera):
   from e to sono oggetti con due proprietà: {"x": numero, "y": numero}.
   Non sono liste fra parentesi quadre.

DISEGNA IL PRIMO STEP COME FOSSE GIA' FINITO:
   Prima di rispondere, posiziona mentalmente i giocatori sul campo e usa quelle
   coordinate come from delle loro prime azioni. Il primo step deve gia' essere
   una posizione plausibile, non un punto di partenza vuoto da cui far partire
   tutto: un allenatore guarda l'animazione e deve riconoscere subito la
   situazione iniziale.

ESEMPIO DEL FORMATTO (2 vs 2 con due porticine, 4 giocatori + pallone):
{
  "title": "2 vs 2 su due porticine",
  "playersShown": 5,
  "initialEntities": [
    { "id": "gk1", "type": "player", "team": "gk", "label": "GK", "x": 8, "y": 50 },
    { "id": "a1", "type": "player", "team": "blue", "label": "1", "x": 40, "y": 30 },
    { "id": "a2", "type": "player", "team": "blue", "label": "2", "x": 40, "y": 70 },
    { "id": "b1", "type": "player", "team": "red", "label": "3", "x": 60, "y": 35 },
    { "id": "b2", "type": "player", "team": "red", "label": "4", "x": 60, "y": 65 },
    { "id": "ball", "type": "ball", "x": 40, "y": 30 }
  ],
  "steps": [
    {
      "stepNumber": 1,
      "description": "1 passa al 2 in appoggio, togliendo il tempo al pressing.",
      "actions": [
        { "entityId": "a1", "type": "pass", "from": { "x": 40, "y": 30 }, "to": { "x": 40, "y": 70 }, "duration": 1.5 },
        { "entityId": "ball", "type": "pass", "from": { "x": 40, "y": 30 }, "to": { "x": 40, "y": 70 }, "duration": 1.5 }
      ]
    }
  ]
}
NB: in un passaggio si muovono SIA il giocatore che il pallone, con la stessa
durata. Se muovi il pallone e non il giocatore che lo riceve, l'animazione e'
incoerente.

Se l'esercizio richiede piu' di ${MAX_STEPS} step, riducilo: e' meglio un esercizio
completo e animabile che uno spezzettato e incomprensibile.`,
});

// NON esportare questo come const. In un file 'use server' si possono
// esportare solo funzioni async: un export di tipo valore (l'oggetto restituito
// da defineFlow) fa fallire il render dei Server Components con "An error
// occurred in the Server Components render", che e' l'errore che si vedeva
// premendo Genera.
//
// Il flusso resta quindi privato, come in suggest-lineup-flow e
// import-players-flow, e sotto si esporta solo la funzione wrapper.
const generateExerciseFlow = ai.defineFlow(
  {
    name: 'generateExerciseFlow',
    inputSchema: GenerateExerciseInputSchema,
    outputSchema: GenerateExerciseOutputSchema,
  },
  async (input) => {
    // I 503 "high demand" sono spike temporanei, non un errore di
    // configurazione: verificati 8 fallimenti consecutivi e, subito dopo,
    // una chiamata riuscita con lo stesso schema. Senza attesa il flusso
    // fallisce immediatamente e l'allenatore vede "Servizio AI non
    // disponibile" mentre il servizio era solo saturo per qualche secondo.
    const attendeMs = [0, 3000, 8000];

    for (let tentativo = 0; tentativo < attendeMs.length; tentativo++) {
      if (attendeMs[tentativo] > 0) {
        console.warn(
          `[generateExercise] tentativo ${tentativo + 1} fallito, riprovo fra ${attendeMs[tentativo]}ms`,
        );
        await new Promise((r) => setTimeout(r, attendeMs[tentativo]));
      }
      try {
        const { output } = await prompt(input);
        if (output) return output;
        throw new Error('Nessun output dal modello');
      } catch (error: any) {
        console.warn(
          `[generateExercise] modello predefinito fallito (${tentativo + 1}/${attendeMs.length}):`,
          error?.message,
        );
      }
    }

    // Modello di riserva, con lo stesso tentativo: se il 3.8 e' saturo, il
    // flash-latest spesso risponde lo stesso.
    for (let tentativo = 0; tentativo < 2; tentativo++) {
      try {
        const { output } = await prompt(input, { model: 'googleai/gemini-flash-latest' });
        if (output) return output;
      } catch (fallbackError: any) {
        console.error('[generateExercise] anche il fallback è fallito:', fallbackError);
      }
      await new Promise((r) => setTimeout(r, 4000));
    }

    throw new Error(
      "Il servizio AI è molto richiesto in questo momento. Riprova fra qualche secondo.",
    );
  },
);

/**
 * Punto d'ingresso per il client.
 *
 * E' l'unico export del file, ed e' una funzione: il requisito di 'use server'.
 * Non chiamare mai generateExerciseFlow direttamente dal client.
 */
export async function generateExercise(
  input: GenerateExerciseInput,
): Promise<GenerateExerciseOutput> {
  return await generateExerciseFlow(input);
}
