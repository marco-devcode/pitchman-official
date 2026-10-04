import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth } from '@/lib/server/auth';
import { rateLimit } from '@/lib/server/rate-limit';
import { feedbackInputSchema, readJson, validate } from '@/lib/server/ai-guard';

export const runtime = 'nodejs';

/**
 * POST /api/feedback — segnalazione dell'utente.
 *
 * NESSUN dato di giocatori viene allegato. Non per scelta discrezionale: il
 * testo di un feedback e' libero e l'app non ha modo di sapere che contiene un
 * nome, quindi l'unica garanzia possibile e' non aggiungerci niente. Lo
 * `userAgent` e la `route` vanno bene per capire dove si e' rotto.
 */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const rl = await rateLimit('feedback', { uid: auth.uid });
  if (!rl.ok) {
    return apiError(429, 'RATE_LIMITED', 'Hai inviato troppi messaggi oggi. Riprova domani.', {
      retryAfter: rl.retryAfter,
    });
  }

  const json = await readJson(request);
  if (!json.ok) return json.response;

  const parsed = validate(feedbackInputSchema, json.body);
  if (!parsed.ok) return parsed.response;

  const now = new Date();
  try {
    await adminDb.collection('feedback').add({
      uid: auth.uid,
      type: parsed.data.type,
      message: parsed.data.message,
      route: parsed.data.route ?? null,
      appVersion: parsed.data.appVersion ?? null,
      userAgent: request.headers.get('user-agent')?.slice(0, 300) ?? null,
      seasonId: parsed.data.seasonId ?? null,
      createdAt: now,
    });
  } catch (error) {
    console.error('[api/feedback] scrittura fallita:', error instanceof Error ? error.message : error);
    return apiError(500, 'FEEDBACK_FAILED', 'Non riesco a salvare il messaggio. Riprova.');
  }

  return NextResponse.json({ ok: true });
}