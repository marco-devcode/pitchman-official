'use client';

/**
 * Chiamate AI dal client.
 *
 * PRIMA questo file era un server action (`'use server'`): i flussi Genkit
 * venivano invocati dal server, ma SENZA nessuna sequenza di controllo — niente
 * verifica della stagione, niente rate limit, niente tetto globale, e nel caso
 * del chatbot il contesto squadra arrivava costruito dal client.
 *
 * Ora il client chiama rotte `/api/...` che applicano, in quest'ordine:
 * requireAuth -> requireSeasonMember -> kill switch -> rate limit ->
 * validazione -> cache -> chiamata al modello -> log dell'utilizzo.
 *
 * IL CHATBOT NON PASSA DA QUI. `floating-assistant` chiama `/api/chatbot`
 * direttamente, perche' il contesto squadra lo legge il server dalla stagione
 * verificata: mandarlo dal client significava che il server non poteva sapere
 * se quei dati erano davvero di chi chiede.
 */
import { authHeaders } from '@/lib/api-client';
import type { ImportMatchesInput } from '@/ai/flows/import-matches-flow';
import type { ImportMatchesOutput } from '@/ai/flows/import-matches-flow';
import type { ImportPlayersInput, ImportPlayersOutput } from '@/ai/flows/import-players-flow';
import type { SuggestLineupInput, SuggestLineupOutput } from '@/ai/flows/suggest-lineup-flow';

/**
 * Esito dell'import: un disco, non un'eccezione.
 *
 * PERCHE'. In Next.js 15 un errore lanciato attraverso un server action in
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
 * Errore leggibile dalla risposta.
 *
 * La route risponde `{ error: { code, message } }`, con `message` in italiano
 * e gia' scritto per l'utente. La stringa `error` piatta resta supportata per
 * compatibilita': senza, un caller che fa `data.error` stamperebbe
 * "[object Object]" invece del messaggio.
 */
async function readError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  const e = data?.error;
  if (typeof e === 'string') return e;
  if (e && typeof e.message === 'string') return e.message;
  return fallback;
}

/**
 * Stagione attiva, letta dallo store.
 *
 * Va letta qui dentro e non passata dai componenti perche' `useSeasonsStore` e'
 * uno store di Zustand, usabile solo dentro un componente o dentro una funzione
 * che gira nel browser. Ogni rotta AI ha bisogno della stagione e nessuna deve
 * potersene dimenticare.
 */
async function activeSeasonId(): Promise<string | undefined> {
  const { useSeasonsStore } = await import('@/store/useSeasonsStore');
  return useSeasonsStore.getState().activeSeason?.id;
}

async function post(route: string, payload: Record<string, unknown>): Promise<Response> {
  return fetch(route, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(payload),
  });
}

/** Analizza una lista di giocatori da testo per importarli nella rosa. */
export async function importPlayers(input: ImportPlayersInput): Promise<ImportPlayersOutput> {
  const sid = await activeSeasonId();
  if (!sid) throw new Error('Nessuna stagione selezionata.');

  const res = await post('/api/ai/import', { operation: 'players', seasonId: sid, rawText: input.rawText });
  if (!res.ok) throw new Error(await readError(res, 'Errore durante l\'analisi della rosa.'));
  return (await res.json()) as ImportPlayersOutput;
}

/** Importa il calendario delle partite da testo grezzo (Copia-Incolla). */
export async function importMatches(input: ImportMatchesInput): Promise<ImportEsito> {
  try {
    const sid = await activeSeasonId();
    if (!sid) return { ok: false, error: 'Nessuna stagione selezionata.' };

    const res = await post('/api/ai/import', { operation: 'matches', seasonId: sid, ...input });
    if (!res.ok) {
      return { ok: false, error: await readError(res, 'Errore durante l\'analisi del calendario tramite AI.') };
    }
    return { ok: true, data: (await res.json()) as ImportMatchesOutput };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message || 'Errore durante l\'analisi del calendario tramite AI.' };
  }
}

/**
 * Suggerisce la formazione mappando nomi testuali agli ID del database.
 *
 * Il server rilettura `availablePlayers` contro la rosa della stagione
 * verificata: gli ID che non ci sono vengono tolti prima che arrivino al
 * modello.
 */
export async function suggestLineup(input: SuggestLineupInput): Promise<SuggestLineupOutput> {
  const sid = await activeSeasonId();
  if (!sid) throw new Error('Nessuna stagione selezionata.');

  const res = await post('/api/ai/import', { operation: 'lineup', seasonId: sid, ...input });
  if (!res.ok) throw new Error(await readError(res, 'Errore durante l\'analisi della formazione.'));
  return (await res.json()) as SuggestLineupOutput;
}