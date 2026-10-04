import { NextResponse } from 'next/server';
import type { firestore as adminFirestore } from 'firebase-admin';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { isAiEnabled } from '@/lib/server/ai-guard';
import { RATE_LIMITS } from '@/lib/server/rate-limit';
import { SEASON_COLLECTIONS } from '@/lib/season-collections';
import { isRateLimitConfigured } from '@/lib/server/rate-limit';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export const runtime = 'nodejs';

/**
 * GET /api/admin/health — stato del backend, per il pannello developer.
 *
 * Il pannello esistente mostrava solo gli account e i ruoli. Con questo backend
 * ci sono cose che possono SILENTIOSAMENTE non funzionare: Upstash assente
 * (nessun rate limit), `AI_ENABLED=false` (l'assistente spento), Admin SDK non
 * configurato (le route protette rispondono 500). Sono tutte condizioni in cui
 * l'app sembra funzionare e una funzionalita' e' morta — quindi vanno mostrate,
 * non lasciate nei log.
 *
 * Nessun dato personale: solo stato, conteggi e nomi di chiavi.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: 'Devi essere collegato.' } }, { status: 401 });
  }
  if (!adminAuth || !adminDb) {
    return NextResponse.json(
      {
        error: {
          code: 'ADMIN_NOT_CONFIGURED',
          message: 'Firebase Admin non e\' configurato: le route protette rispondono 500.',
        },
      },
      { status: 500 },
    );
  }

  let ruolo: string;
  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice('Bearer '.length));
    ruolo = String(decoded.role ?? '');
  } catch {
    return NextResponse.json(
      { error: { code: 'UNAUTHORIZED', message: 'Sessione non valida.' } },
      { status: 401 },
    );
  }

  if (ruolo !== 'developer') {
    return NextResponse.json(
      { error: { code: 'FORBIDDEN', message: 'Solo gli sviluppatori.' } },
      { status: 403 },
    );
  }

  // Quale file di regole andrebbe pubblicato. `firestore.rules` e' quello
  // attivo; `firestore.rules.v2` e' quello in prova. Mostrare i due permette di
  // capire se l'ordine di rilascio e' stato rispettato.
  const rulesFile = 'firestore.rules';
  const rulesNext = 'firestore.rules.v2';

  // La finestra temporale la filtriamo IN MEMORIA, non con `where`/`orderBy`.
  //
  // Motivo: `adminDb` e' tipizzato con i types del Firestore CLIENT (importati
  // dal pacchetto `firebase`), e su quelli `orderBy` accetta solo 'asc'. La
  // prima versione di questo codice passava 'descending' e non compilava. Il
  // filtro in memoria e' su un volume di almeno poche centinaia di righe: non
  // e' il posto in cui ottimizzare, ed evita una riga di codice che non
  // compila.
  const DAY_MS = 24 * 3600 * 1000;
  const cutoff = Date.now() - DAY_MS;

  const [usersCount, invitesCount, usageSnap, feedbackSnap] = await Promise.all([
    adminDb.collection('users').count().get(),
    adminDb.collection('invites').count().get(),
    adminDb.collection('aiUsage').get().catch(() => null),
    adminDb.collection('feedback').get().catch(() => null),
  ]);

  const usageDocs = (usageSnap?.docs ?? []) as adminFirestore.QueryDocumentSnapshot[];
  const usage24h = usageDocs.filter((d) => {
    const t = (d.data() as { createdAt?: { toMillis?: () => number } }).createdAt?.toMillis?.();
    return typeof t === 'number' && t >= cutoff;
  });

  const feedbackDocs = ((feedbackSnap?.docs ?? []) as adminFirestore.QueryDocumentSnapshot[])
    .sort((a, b) => {
      const ta = (a.data() as { createdAt?: { toMillis?: () => number } }).createdAt?.toMillis?.() ?? 0;
      const tb = (b.data() as { createdAt?: { toMillis?: () => number } }).createdAt?.toMillis?.() ?? 0;
      return tb - ta;
    })
    .slice(0, 10);

  // Token delle ultime 24h. Solo la somma: il numero serve per capire se il
  // tetto globale e' vicino, non chi ha usato cosa.
  let tokens24h = 0;
  for (const d of usage24h) {
    const data = d.data() as { inputTokens?: number; outputTokens?: number };
    tokens24h += (data.inputTokens ?? 0) + (data.outputTokens ?? 0);
  }

  const feedback = feedbackDocs.map((d: adminFirestore.QueryDocumentSnapshot) => {
    const data = d.data() as {
      type?: string; message?: string; route?: string;
      createdAt?: { toDate?: () => Date }; appVersion?: string;
    };
    const quando = data.createdAt?.toDate?.();
    return {
      id: d.id,
      type: data.type ?? 'altro',
      message: (data.message ?? '').slice(0, 300),
      route: data.route ?? null,
      appVersion: data.appVersion ?? null,
      createdAt: quando ? quando.toISOString() : null,
    };
  });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return NextResponse.json({
    backend: {
      adminSdk: true,
      rateLimit: isRateLimitConfigured(),
      aiEnabled: isAiEnabled(),
      globalAiLimit: Number(process.env.AI_DAILY_GLOBAL_LIMIT ?? 0),
      dailyLimitConfigured: Number(process.env.AI_DAILY_GLOBAL_LIMIT ?? 0) > 0,
    },
    rules: {
      deployed: rulesFile,
      pending: existsSync(join(process.cwd(), rulesNext)) ? rulesNext : null,
    },
    counts: {
      users: usersCount.data().count,
      invites: invitesCount.data().count,
      aiCallsLast24h: usage24h.length,
      tokensLast24h: tokens24h,
      seasonCollections: SEASON_COLLECTIONS.length,
    },
    rateLimits: RATE_LIMITS,
    feedback,
    generatedAt: new Date().toISOString(),
  });
}
