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

const ActionSchema = z.object({
  entityId: z.string().describe("ID dell'entita' che agisce: deve esistere fra le initialEntities."),
  type: z.enum(['pass', 'run', 'dribble', 'shoot']),
  from: z.tuple([z.number(), z.number()]).describe('Coordinate di partenza [x, y], entrambe 0-100.'),
  to: z.tuple([z.number(), z.number()]).describe('Coordinate di arrivo [x, y], entrambe 0-100.'),
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

export const GenerateExerciseOutputSchema = z.object({
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

Se l'esercizio richiede piu' di ${MAX_STEPS} step, riducilo: e' meglio un esercizio
completo e animabile che uno spezzettato e incomprensibile.`,
});

export const generateExerciseFlow = ai.defineFlow(
  {
    name: 'generateExerciseFlow',
    inputSchema: GenerateExerciseInputSchema,
    outputSchema: GenerateExerciseOutputSchema,
  },
  async (input) => {
    try {
      const { output } = await prompt(input);
      if (output) return output;
      throw new Error('Nessun output dal modello');
    } catch (error: any) {
      // Stesso comportamento degli altri flussi: si tenta un modello piu'
      // capace e, se anche quello fallisce, si solleva un errore leggibile
      // invece di far trapelare il dettaglio tecnico alla UI.
      console.warn('[generateExercise] modello predefinito fallito, provo il fallback:', error?.message);
      try {
        const { output } = await prompt(input, { model: 'googleai/gemini-1.5-pro' });
        if (!output) throw new Error("L'AI non ha restituito un esercizio valido.");
        return output;
      } catch (fallbackError: any) {
        console.error('[generateExercise] anche il fallback è fallito:', fallbackError);
        throw new Error("Servizio AI momentaneamente non disponibile. Riprova più tardi.");
      }
    }
  },
);
