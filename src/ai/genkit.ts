import 'server-only';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import dotenv from 'dotenv';

// Carica variabili d'ambiente per contesti fuori da Next.js (es. Genkit CLI)
dotenv.config({ path: '.env.local' });

/**
 * Pulisce la chiave API rimuovendo eventuali virgolette o spazi aggiunti accidentalmente dall'utente.
 */
const cleanKey = (key?: string) => key?.replace(/['"]/g, '').trim();

const apiKey = cleanKey(process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY || process.env.GOOGLE_API_KEY);

if (process.env.NODE_ENV !== 'production') {
  console.log('[Genkit] API Key found:', !!apiKey, 'Prefix:', apiKey?.substring(0, 7) + '...');
}

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: apiKey,
      apiVersion: 'v1beta'
    })
  ],
  // gemini-2.5-flash non e' piu' disponibile per nuovi account: l'endpoint
  // risponde 404 con "This model is no longer available to new users".
  // Verificato con una chiamata diretta: gemini-3.8-flash risponde 200 anche
  // con responseSchema (output JSON strutturato), che e' quello che usano i
  // flussi con output:{schema}.
  //
  // NOTA: gemini-3.8-flash restituisce talvolta 503 "high demand". Sono
  // spike temporanei (verificati: 2 chiamate su 3 fallite, poi 2 su 2 ok), non
  // un problema di configurazione. Per questo i flussi hanno gia' un retry
  // verso un modello di riserva.
  model: 'googleai/gemini-3.8-flash',
});
