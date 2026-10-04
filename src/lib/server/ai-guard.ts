import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  apiError,
  requireAuth,
  requireSeasonMember,
  type SeasonDoc,
} from '@/lib/server/auth';
import { clientIp, globalDailyLimit, isRateLimitConfigured, rateLimit, type RateLimitKey } from '@/lib/server/rate-limit';

export type Guard = { ok: true; uid: string; seasonId: string; season: SeasonDoc } | { ok: false; response: NextResponse };

/**
 * La sequenza fissa di una route AI:
 *
 *   requireAuth -> requireSeasonMember -> kill switch -> rate limit -> validazione
 *
 * L'ordine non e' decorativo. Il kill switch sta DOPO l'autenticazione e
 * prima del rate limit perche' con l'app spenta non si consumano contatori:
 * un'ondata di richieste mentre l'app e' giusta', e il budget di richieste di
 * un utente non si esaurisce per colpa di un'interruzione di servizio. La
 * validazione sta per ultima perche' il lavoro di zod e' buttato se poi si
 * risponde 401, e buttare lavoro che finisce in un errore costa tempo CPU che
 * si paga a ogni richiesta.
 */

/** L'app AI e' spenta? */
export function isAiEnabled(): boolean {
  return (process.env.AI_ENABLED ?? 'true').toLowerCase() !== 'false';
}

const aiDisabled = () =>
  apiError(503, 'AI_DISABLED', "L'assistente e' temporaneamente non disponibile. Riprova piu' tardi.");

/**
 * Controlli comuni a tutte le route AI.
 *
 * `seasonId` arriva dal body o dalla query: non viene creduto. Serve solo a
 * scegliere QUALE stagione verificare, e la verifica la fa
 * `requireSeasonMember` con l'uid del token.
 */
export async function aiGuard(
  request: Request,
  options: { seasonId: string | null; limit: RateLimitKey; extraDailyLimit?: RateLimitKey; minRole?: 'staff' | 'owner' },
): Promise<Guard> {
  const auth = await requireAuth(request);
  if (!auth.ok) return { ok: false, response: auth.response };
  if (!options.seasonId) {
    return { ok: false, response: apiError(400, 'SEASON_REQUIRED', 'Stagione non indicata.') };
  }

  const member = await requireSeasonMember(auth.uid, options.seasonId, options.minRole ?? 'staff');
  if (!member.ok) return { ok: false, response: member.response };

  if (!isAiEnabled()) return { ok: false, response: aiDisabled() };

  // FAIL OPEN, per scelta. Senza Upstash il limiter non esiste e la route
  // risponderebbe comunque: chiudere significa un 503 all'utente perche' una
  // variabile d'ambiente manca, e cioe' togliere l'assistente a tutti gli
  // utenti beta per una dimenticanza. Il tetto globale e il kill switch
  // restano: quelli proteggono il costo anche senza Upstash.
  //
  // Il prezzo di questa scelta e' noto: se Upstash cade, le route AI non hanno
  // limite per utente per la durata del guasto. Il tetto globale giornaliero
  // continua a valere e fissa il danno. Per rimettere il limite senza toccare
  // il codice basta impostare le due variabili.
  warnIfNoRateLimit();

  const ip = clientIp(request);
  const rl = await rateLimit(options.limit, { uid: auth.uid, ip: ip ?? undefined });
  if (!rl.ok) {
    return {
      ok: false,
      response: apiError(
        429,
        'RATE_LIMITED',
        `Hai raggiunto il limite di richieste. Riprova tra ${Math.ceil(rl.retryAfter / 60)} minuti.`,
        { retryAfter: rl.retryAfter },
      ),
    };
  }

  if (options.extraDailyLimit) {
    const daily = await rateLimit(options.extraDailyLimit, { uid: auth.uid });
    if (!daily.ok) {
      return {
        ok: false,
        response: apiError(
          429,
          'RATE_LIMITED_DAILY',
          `Hai raggiunto il limite giornaliero. Riprova domani.`,
          { retryAfter: daily.retryAfter },
        ),
      };
    }
  }

  const global = await globalDailyLimit();
  if (!global.ok) {
    return {
      ok: false,
      response: apiError(503, 'AI_BUSY', 'Il servizio e\' molto richiesto in questo momento. Riprova fra poco.'),
    };
  }

  return { ok: true, uid: auth.uid, seasonId: options.seasonId, season: member.season };
}

/**
 * Guard + validazione, nell'ordine in cui le richieste le devono vedere.
 *
 * `aiGuard` da solo validava PRIMA di autenticare, perche' il guard ha bisogno
 * del `seasonId` per sapere che cosa verificare. Risultato: una richiesta senza
 * token riceveva 400 "seasonId mancante" invece di 401. Non e' solo un codice
 * sbagliato — dice a chi non e' autenticato quali campi la rotta pretende, e fa
 * sembrare che il controllo di accesso sia una questione di corpo della
 * richiesta.
 *
 * Qui l'ordine e' come nella specifica:
 *
 *   requireAuth -> validazione -> requireSeasonMember -> kill switch -> rate limit
 *
 * L'autenticazione torna prima perche' e' l'unica informazione che non si puo'
 * ricavare dal corpo, e senza di essa non c'e' niente da validare: `uid`
 * arriva dal token, non da un campo.
 */
export async function aiGuardWithBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
  body: unknown,
  options: {
    limit: RateLimitKey;
    extraDailyLimit?: RateLimitKey;
    minRole?: 'staff' | 'owner';
  },
): Promise<
  | { ok: true; uid: string; seasonId: string; season: SeasonDoc; data: z.infer<T> }
  | { ok: false; response: NextResponse }
> {
  const auth = await requireAuth(request);
  if (!auth.ok) return { ok: false, response: auth.response };

  const parsed = validate(schema, body);
  if (!parsed.ok) return { ok: false, response: parsed.response };

  const seasonId = (parsed.data as { seasonId: string }).seasonId;
  const guard = await aiGuard(request, {
    seasonId,
    limit: options.limit,
    extraDailyLimit: options.extraDailyLimit,
    minRole: options.minRole,
  });
  if (!guard.ok) return { ok: false, response: guard.response };

  return { ok: true, uid: guard.uid, seasonId, season: guard.season, data: parsed.data };
}

/**
 * Guard NON-AI (inviti, export, feedback): autenticazione, e basta.
 *
 * Le route che non chiamano un modello non hanno bisogno del kill switch ne'
 * del tetto globale: spegnere l'AI non deve spegnere l'export dei dati, che e'
 * un diritto, non una funzione.
 */
export async function apiGuard(request: Request): Promise<
  { ok: true; uid: string; authTime: number } | { ok: false; response: NextResponse }
> {
  const auth = await requireAuth(request);
  if (!auth.ok) return { ok: false, response: auth.response };
  return { ok: true, uid: auth.uid, authTime: auth.authTime };
}

// ─── Validazione input ────────────────────────────────────────────────────────

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(4000),
});

export const chatbotInputSchema = z.object({
  seasonId: z.string().min(1).max(120),
  message: z.string().min(1).max(2000),
  history: z.array(chatMessageSchema).max(10).optional().default([]),
  formation: z.string().max(120).optional(),
});

export const generateInputSchema = z.object({
  seasonId: z.string().min(1).max(120),
  prompt: z.string().min(1).max(2000),
});

export const importImageSchema = z.object({
  seasonId: z.string().min(1).max(120),
  image: z.string().min(1).max(7 * 1024 * 1024), // base64 piu' overhead: ~5 MB
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
});

export const feedbackInputSchema = z.object({
  type: z.enum(['bug', 'idea', 'altro']),
  message: z.string().min(1).max(2000),
  route: z.string().max(200).optional(),
  appVersion: z.string().max(40).optional(),
  seasonId: z.string().max(120).optional(),
});

export type SeasonInput = z.infer<typeof generateInputSchema>;

/**
 * Mappa la cronologia del client ai ruoli che Gemini accetta.
 *
 * Il client puo' mandare solo `user` e `assistant`, e diventano `user` e
 * `model`. Senza questo, un client che invia `role: 'system'` con istruzioni
 * proprie inietterebbe un falso messaggio di sistema nel contesto del modello.
 */
export function toGeminiHistory(
  history: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> {
  return history.map((m) => ({
    role: m.role === 'user' ? ('user' as const) : ('model' as const),
    parts: [{ text: m.content }],
  }));
}

/** Body JSON non valido: 400 con il messaggio giusto, non 500. */
export async function readJson(request: Request): Promise<
  { ok: true; body: unknown } | { ok: false; response: NextResponse }
> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false, response: apiError(400, 'BAD_JSON', 'Il corpo della richiesta non e\' JSON valido.') };
  }
}

/** Valida un body gia' letto, e risponde 400 con i dettagli del campo. */
export function validate<T extends z.ZodTypeAny>(schema: T, body: unknown):
  | { ok: true; data: z.infer<T> }
  | { ok: false; response: NextResponse } {
  const parsed = schema.safeParse(body);
  if (parsed.success) return { ok: true, data: parsed.data };

  const first = parsed.error.issues[0];
  const campo = first?.path?.join('.');
  const message = campo
    ? `${campo}: ${first?.message ?? 'valore non valido'}`
    : (first?.message ?? 'Richiesta non valida.');

  return {
    ok: false,
    response: apiError(400, 'VALIDATION_ERROR', `Controlla ${message}.`, {
      field: campo ?? null,
    }),
  };
}

/**
 * Avviso una tantum se Upstash non e' configurato in sviluppo.
 *
 * In produzione la cosa e' diversa: li le funzioni chiudono (vedi
 * `aiGuard`), perche' un limiter assente non e' un dettaglio, e' la ragione per
 * cui il rate limit esiste.
 */
let warned = false;
export function warnIfNoRateLimit(): void {
  if (warned || process.env.NODE_ENV === 'production') return;
  if (isRateLimitConfigured()) return;
  warned = true;
  console.warn(
    '[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN assenti: limiter saltato. ' +
      'In produzione le route AI rispondono 503 finche\' non sono configurate.',
  );
}