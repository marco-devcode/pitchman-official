import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { aiGuardWithBody, readJson } from '@/lib/server/ai-guard';
import { cacheGet, cacheSet, hashKey, logUsage, normalizeForCache } from '@/lib/server/ai-log';
import { apiError } from '@/lib/server/auth';
import { importMatchesFromText } from '@/ai/flows/import-matches-flow';
import { importPlayersFromText } from '@/ai/flows/import-players-flow';
import { suggestLineup as suggestLineupFlow } from '@/ai/flows/suggest-lineup-flow';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/ai/import — import da testo (rosa o calendario).
 *
 * Le tre funzionalita' AI che restavano nelle server action
 * (`importPlayers`, `importMatches`, `suggestLineup`) sono qui dentro una
 * rotta sola, perche' hanno lo stesso perimetro: leggono testo libero e
 * tirano fuori dati strutturati. Una rotta unica significa una sequenza di
 * guard unica, e la sequenza che si puo' dimenticare di applicare e' quella
 * che non esiste.
 *
 * Sono tutte e tre in cache: il testo di una rosa o di un calendario e' lo
 * stesso fra un allenatore e l'altro che lo incolla lo stesso giorno, e la
 * risposta non dipende dallo stato della stagione. Il chatbot no, perche' la
 * sua risposta dipende dai dati correnti.
 */

const playersSchema = z.object({
  operation: z.literal('players'),
  seasonId: z.string().min(1).max(120),
  rawText: z.string().min(1).max(20_000),
});

const matchesSchema = z.object({
  operation: z.literal('matches'),
  seasonId: z.string().min(1).max(120),
  rawContent: z.string().min(1).max(50_000).optional(),
  fileDataUrl: z.string().max(8 * 1024 * 1024).optional(),
  teamName: z.string().max(80).optional(),
});

const lineupSchema = z.object({
  operation: z.literal('lineup'),
  seasonId: z.string().min(1).max(120),
  rawList: z.string().min(1).max(4000),
  // La formazione e' una lista di ID di giocatori: il client la manda gia'
  // filtrata per la stagione che dichiara. Il server la rilettura: se un ID
  // non e' nella rosa di QUELLA stagione, viene tolto, altrimenti il modello
  // finirebbe col nominare un giocatore di un'altra squadra come titolare.
  availablePlayers: z
    .array(z.object({ id: z.string().max(120), name: z.string().max(120) }))
    .max(60)
    .optional(),
  formation: z.string().max(40).optional(),
});

const unionSchema = z.discriminatedUnion('operation', [playersSchema, matchesSchema, lineupSchema]);

export async function POST(request: Request) {
  const json = await readJson(request);
  if (!json.ok) return json.response;

  // La richiesta "import" e' trattata come AI: chiama un modello e consuma
  // crediti. Il tetto e' quello dell'import da immagine, perche' e' il caso in
  // cui l'utente puo' inviare piu' volte di fila sbagliando la selezione del
  // file. Come nelle altre route AI, 401 senza token arriva prima del 400.
  const guard = await aiGuardWithBody(request, unionSchema, json.body, {
    limit: 'importImage',
  });
  if (!guard.ok) return guard.response;

  const body = guard.data;

  const started = Date.now();

  // Chiave di cache: il testo normalizzato piu' l'uid. Il testo dentro la
  // chiave finisce in un documento Firestore, e i testi che gli allenatori
  // incollano contengono i nomi dei giocatori: prima si calcola l'hash, e
  // l'hash e' l'unica cosa che viene scritta.
  const raw =
    body.operation === 'players' ? body.rawText
    : body.operation === 'matches' ? (body.rawContent ?? body.fileDataUrl ?? '')
    : `${body.rawList}|${body.formation ?? ''}`;
  const cacheKey = hashKey('import', body.operation, guard.uid, normalizeForCache(raw));

  const cached = await cacheGet<unknown>(cacheKey);
  if (cached.hit) {
    await logUsage({
      uid: guard.uid,
      seasonId: guard.seasonId,
      route: `import_${body.operation}`,
      model: 'gemini',
      inputTokens: 0,
      outputTokens: 0,
      cached: true,
      durationMs: Date.now() - started,
    });
    return NextResponse.json({ ...(cached.value as Record<string, unknown>), cacheHit: true });
  }

  try {
    let result: unknown;

    if (body.operation === 'players') {
      result = await importPlayersFromText({ rawText: body.rawText });
    } else if (body.operation === 'matches') {
      result = await importMatchesFromText({
        rawContent: body.rawContent,
        fileDataUrl: body.fileDataUrl,
        teamName: body.teamName,
      });
    } else {
      const players = await filterPlayersOfSeason(body.seasonId, body.availablePlayers ?? []);
      result = await suggestLineupFlow({
        rawList: body.rawList,
        availablePlayers: players,
        formation: body.formation,
      });
    }

    await logUsage({
      uid: guard.uid,
      seasonId: guard.seasonId,
      route: `import_${body.operation}`,
      model: 'gemini',
      inputTokens: 0,
      outputTokens: 0,
      cached: false,
      durationMs: Date.now() - started,
    });

    await cacheSet(cacheKey, result);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[api/ai/import] errore:', error?.message || error);
    await logUsage({
      uid: guard.uid,
      seasonId: guard.seasonId,
      route: `import_${body.operation}`,
      model: 'unknown',
      inputTokens: 0,
      outputTokens: 0,
      cached: false,
      durationMs: Date.now() - started,
    });
    // 502 e non 500: il fallimento e' del servizio AI. Il messaggio per
    // l'utente e' generico perche' la stringa dell'errore del provider puo'
    // contenere il testo del prompt, cioe' i dati della squadra.
    return apiError(502, 'AI_FAILED', "L'analisi non e' riuscita. Riprova fra poco.");
  }
}

/**
 * Tiene solo i giocatori che esistono davvero nella stagione dichiarata.
 *
 * Un client modificato puo' mandare ID di giocatori di un'altra squadra: non
 * riuscirebbe a leggerne i dati, ma farebbe passare al modello dei nomi che
 * non sono della squadradiscussa, e il risultato sarebbe una formazione con
 * nomi inventati da un'altra parte.
 */
async function filterPlayersOfSeason(
  seasonId: string,
  players: Array<{ id: string; name: string }>,
): Promise<Array<{ id: string; name: string }>> {
  if (!adminDb || players.length === 0) return [];
  const snap = await adminDb.collection('teams').doc(seasonId).collection('players').get();
  const validIds = new Set(snap.docs.map((d) => d.id));
  return players.filter((p) => validIds.has(p.id));
}