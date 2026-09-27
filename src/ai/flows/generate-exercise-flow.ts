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

REGOLA FONDAMENTALE — GLI INGRESSI:
6. initialEntities contiene TUTTI i giocatori che appariranno in QUALSIASI momento
   dell'esercizio, compresi quelli che entrano DOPO. Un giocatore citato in uno
   step ma assente da initialEntities non puo' essere animato e semplicemente non
   si vedra': e' il modo piu' frequente in cui l'esercizio risulta "lontano" da
   quello chiesto.
   - Se l'esercizio dice "entrano due giocatori", quei due vanno in
     initialEntities, con la squadra giusta e la posizione da cui entrano.
   - Le loro azioni devono partire da quel punto di ingresso, cosi' l'animazione
     mostra il subentro e non un giocatore che appare dal nulla.
   - Chi esce si puo' fermare sul posto: non serve animare chi lascia il campo.
7. playersShown e' il numero TOTALE di giocatori che si vedono, non quelli
   presenti solo all'inizio.

REGOLE SUL SEQUENZE:
8. Massimo ${MAX_STEPS} step, in ordine logico e comprensibile.
9. Ogni step ha una description in italiano che spieghi cosa succede, e anche il PERCHE'
   tattico quando e' rilevante (apertura, ampiezza, densita', uscita dalla pressione).
10. Le azioni dentro uno step devono essere coerenti fra loro: un passaggio ha senso solo se
    il pallone e' vicino al giocatore che lo riceve.
11. Rispetta la realta' calcistica: movimenti possibili, niente sovrapposizioni impossibili
    e niente teletrasporti.
12. La posizione iniziale di ogni giocatore DEVE coincidere con il punto di partenza (from)
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

ESEMPIO CHIAVE — 2vs2 con porticine, quando una squadra SUBISCE GOL entrano
altri due della stessa squadra. Nota come i due nuovi (r3, r4) siano gia' in
initialEntities, e come le loro azioni partano dal punto di ingresso:
{
  "title": "2vs2 con porticine: risposta al gol subito",
  "description": "Dopo il gol subito entrano due giocatori della squadra in difesa: si passa da 2 a 4 in campo.",
  "playersShown": 6,
  "initialEntities": [
    { "id": "gk1", "type": "player", "team": "gk", "label": "GK", "x": 8, "y": 50 },
    { "id": "b1", "type": "player", "team": "blue", "label": "1", "x": 40, "y": 30 },
    { "id": "b2", "type": "player", "team": "blue", "label": "2", "x": 40, "y": 70 },
    { "id": "r1", "type": "player", "team": "red", "label": "3", "x": 62, "y": 35 },
    { "id": "r2", "type": "player", "team": "red", "label": "4", "x": 62, "y": 65 },
    { "id": "r3", "type": "player", "team": "red", "label": "5", "x": 88, "y": 45 },
    { "id": "r4", "type": "player", "team": "red", "label": "6", "x": 88, "y": 55 },
    { "id": "ball", "type": "ball", "x": 40, "y": 30 }
  ],
  "steps": [
    { "stepNumber": 1, "description": "Blu 1 passa a Blu 2 in appoggio.", "actions": [
      { "entityId": "b1", "type": "pass", "from": { "x": 40, "y": 30 }, "to": { "x": 40, "y": 70 }, "duration": 1.5 },
      { "entityId": "ball", "type": "pass", "from": { "x": 40, "y": 30 }, "to": { "x": 40, "y": 70 }, "duration": 1.5 }
    ]},
    { "stepNumber": 2, "description": "Blu 2 segna nella porticina.", "actions": [
      { "entityId": "b2", "type": "shoot", "from": { "x": 40, "y": 70 }, "to": { "x": 72, "y": 70 }, "duration": 1.2 }
    ]},
    { "stepNumber": 3, "description": "Rosso 1 e Rosso 2 escono dopo il gol subito.", "actions": [
      { "entityId": "r1", "type": "run", "from": { "x": 62, "y": 35 }, "to": { "x": 78, "y": 30 }, "duration": 1.5 },
      { "entityId": "r2", "type": "run", "from": { "x": 62, "y": 65 }, "to": { "x": 78, "y": 70 }, "duration": 1.5 }
    ]},
    { "stepNumber": 4, "description": "Entrano Rosso 3 e Rosso 4, che riorganizzano il 2vs2.", "actions": [
      { "entityId": "r3", "type": "run", "from": { "x": 88, "y": 45 }, "to": { "x": 62, "y": 40 }, "duration": 1.5 },
      { "entityId": "r4", "type": "run", "from": { "x": 88, "y": 55 }, "to": { "x": 62, "y": 60 }, "duration": 1.5 }
    ]}
  ]
}
NB: i due nuovi entrano dal BORDO del campo (x=88, vicino alla porta avversaria da
cui si entra) e si muovono verso il centro. Se li mettessi gia' al centro, non si
vedrebbe che sono entrati.

Se l'esercizio richiede piu' di ${MAX_STEPS} step, riducilo: e' meglio un esercizio
completo e animabile che uno spezzettato e incomprensibile.`,
});

// NON esportare questo come const. In un file 'use server' si possono
// esportare solo funzioni async: un export di tipo valore (l'oggetto restituito
// da defineFlow) fa fallire il render dei Server Components con "An error
// occurred in the Server Components render", che e' l'errore che si vedeva
// premendo Genera. Il flusso resta quindi privato, come in
// suggest-lineup-flow e import-players-flow, e sotto si esporta solo la
// funzione wrapper.

/**
 * Catena di modelli per la generazione dell'esercizio.
 *
 * Scelta verificata con chiamate reali, usando lo schema esatto del flusso
 * (niente tuple, niente riuso) e il prompt "2vs2 con porticine, quando una
 * squadra subisce gol entrano altri due della stessa squadra".
 *
 * IN CATENA:
 *   gemini-3.8-flash -> 200 con schema valido, il piu' capace. Va in 429 quando
 *                       la quota del progetto finisce.
 *   gemini-3.6-flash -> 503 frequenti ma risponde: 6-8 giocatori e 4-5 step,
 *                       esattamente la richiesta dell'allenatore.
 *
 * ESCLUSI, con la ragione verificata:
 *   gemini-3.7-flash      risponde 200 ma IGNORA la richiesta: due prove su due
 *                         hanno prodotto "Costruzione dal basso 3vs2" e "uscita
 *                         con terzo uomo", senza mai nominare 2vs2 ne porticine.
 *   gemini-3.5-flash-lite peggiora: 1 solo giocatore e 1 solo step, contro i
 *                         6 e 5 del 3.6 sullo stesso prompt.
 *   gemini-2.5-flash-lite 404, "no longer available to new users".
 *   gemini-flash-latest    alias deprecato per questo progetto: 429 a quota
 *                         esaurita. Era il fallback di suggest-lineup, quindi
 *                         anche quel flusso ha la catena morta.
 *
 * Nota: un modello che risponde e sbaglia e' PEGGIO di uno che fallisce,
 * perche' l'allenatore non ha modo di accorgersene. Meglio un errore esplicito
 * che una lavagna vuota o fuori topic. E' il motivo per cui la catena e' corta
 * e non "tutti i modelli disponibili".
 */
const CATENA_MODELLI = [
  'googleai/gemini-3.8-flash',
  'googleai/gemini-3.6-flash',
] as const;

const generateExerciseFlow = ai.defineFlow(
  {
    name: 'generateExerciseFlow',
    inputSchema: GenerateExerciseInputSchema,
    outputSchema: GenerateExerciseOutputSchema,
  },
  async (input) => {
    // I 503 "high demand" sono spike temporanei e colpiscono i modelli uno alla
    // volta: mentre il 3.8 era in quota, il 3.6 rispondeva. Per questo la
    // catena avanza invece di insistere sullo stesso modello.
    //
    // Un errore di schema (400) pero' non si risolve cambiando modello: si
    // risolve correggendo lo schema. Distinguerlo evita di mascherare un bug
    // dietro quattro tentativi inutili.
    let ultimoErrore: any = null;

    for (let i = 0; i < CATENA_MODELLI.length; i++) {
      const modello = CATENA_MODELLI[i];
      // Tre tentativi per modello: il 503 dura pochi secondi, non minuti.
      for (let tentativo = 0; tentativo < 3; tentativo++) {
        if (tentativo > 0) {
          const attesa = tentativo === 1 ? 3000 : 8000;
          console.warn(
            `[generateExercise] ${modello} tentativo ${tentativo} fallito, riprovo fra ${attesa}ms`,
          );
          await new Promise((r) => setTimeout(r, attesa));
        }
        try {
          const { output } = await prompt(input, { model: modello });
          if (output) {
            if (i > 0 || tentativo > 0) {
              console.warn(`[generateExercise] riuscito con ${modello}`);
            }
            return output;
          }
          ultimoErrore = new Error(`Nessun output da ${modello}`);
        } catch (error: any) {
          ultimoErrore = error;
          const testo = String(error?.message || error);

          // 400 = schema non accettato dal modello. Non ha senso provare gli
          // altri: fallirebbero uguale, e mascherebbe un bug dietro tentativi
          // inutili.
          //
          // Match preciso: "[400 ]" e' il separatore che usa l'errore di fetch.
          // Cercare la sequenza "400" nuda e' un falso positivo — la stringa
          // del 429 contiene ".../gemini-api/docs/rate-limits", e "400" ci
          // finisce dentro per caso. Cosi' la catena moriva sul primo 429
          // invece di passare al modello successivo.
          const e400 = /\[400\s*\]/.test(testo) || testo.includes('Invalid JSON payload');
          if (e400) {
            console.error(
              `[generateExercise] ${modello} ha rifiutato lo schema:`,
              testo.slice(0, 300),
            );
            throw new Error("Il generatore ha un problema tecnico. Riprova fra poco.");
          }

          console.warn(
            `[generateExercise] ${modello} fallito (${tentativo + 1}/3):`,
            testo.slice(0, 120),
          );
        }
      }
      // Prossimo modello della catena.
      await new Promise((r) => setTimeout(r, 2000));
    }

    const quota = String(ultimoErrore?.message || '').includes('429');
    console.error('[generateExercise] catena esaurita, ultimo errore:', ultimoErrore);
    throw new Error(
      quota
        ? "Quota del servizio AI esaurita. Ripristinala dalla console Google per generare esercizi."
        : "Il servizio AI è molto richiesto in questo momento. Riprova fra qualche secondo.",
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
