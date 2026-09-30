'use server';

import { chatbotFlow, type ChatInput, type ChatOutput } from "@/ai/flows/chatbot-flow";
import { importMatchesFromText, type ImportMatchesInput, type ImportMatchesOutput } from "@/ai/flows/import-matches-flow";
import { importPlayersFromText, type ImportPlayersInput, type ImportPlayersOutput } from "@/ai/flows/import-players-flow";
import { suggestLineup as suggestLineupFlow, type SuggestLineupInput, type SuggestLineupOutput } from "@/ai/flows/suggest-lineup-flow";

/**
 * Service Layer per le funzionalità AI dell'applicazione.
 * 
 * Questo layer astrae le chiamate dirette ai flussi Genkit, permettendo:
 * 1. Mocking facile per i test unitari.
 * 2. Codice DRY (non ripetiamo la logica di chiamata in ogni componente).
 * 3. Punto unico per aggiungere logica trasversale (telemetria, logging extra, etc).
 */

/**
 * Avvia una conversazione con l'assistente tattico.
 */
export async function chatbot(input: ChatInput): Promise<ChatOutput> {
  try {
    return await chatbotFlow(input);
  } catch (error) {
    console.error("[AIService] Error in chatbot:", error);
    throw error;
  }
}

/**
 * Esito dell'import: un disco, non un'eccezione.
 *
 * PERCHE'. In Next.js 15 un errore lanciato da una server action in
 * produzione viene sostituito dal messaggio generico "An error occurred in the
 * Server Components render": l'utente vede quello e non la causa vera, quindi
 * preme di nuovo lo stesso pulsante e ottiene lo stesso errore. Restituendo
 * `{ ok: false, error }` il messaggio reale attraversa il confine come dato
 * normale e arriva al `AsyncFeedback`, che lo mostra.
 */
export type ImportEsito =
  | { ok: true; data: ImportMatchesOutput }
  | { ok: false; error: string };

/**
 * Importa il calendario delle partite da testo grezzo (Copia-Incolla).
 */
export async function importMatches(input: ImportMatchesInput): Promise<ImportEsito> {
  try {
    const data = await importMatchesFromText(input);
    return { ok: true, data };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[AIService] Error in importMatches:', message);
    // Le server action non possono rilanciare: il messaggio verrebbe
    // sostituito da quello generico di Next.
    return { ok: false, error: message || 'Errore durante l\'analisi del calendario tramite AI.' };
  }
}

/**
 * Analizza una lista di giocatori da testo per importarli nella rosa.
 */
export async function importPlayers(input: ImportPlayersInput): Promise<ImportPlayersOutput> {
  try {
    return await importPlayersFromText(input);
  } catch (error) {
    console.error("[AIService] Error in importPlayers:", error);
    throw error;
  }
}

/**
 * Suggerisce la formazione mappando nomi testuali agli ID del database.
 */
export async function suggestLineup(input: SuggestLineupInput): Promise<SuggestLineupOutput> {
  try {
    return await suggestLineupFlow(input);
  } catch (error) {
    console.error("[AIService] Error in suggestLineup:", error);
    throw error;
  }
}
