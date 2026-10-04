import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth, requireSeasonMember } from '@/lib/server/auth';
import {
  DEFAULT_EXPIRES_IN_DAYS,
  DEFAULT_MAX_USES,
  generateInviteCode,
} from '@/lib/server/invite-codes';

export const runtime = 'nodejs';

const DAY_MS = 24 * 60 * 60 * 1000;

const createSchema = z.object({
  role: z.enum(['staff']).default('staff'),
  expiresInDays: z.number().int().min(1).max(30).optional(),
  maxUses: z.number().int().min(1).max(20).optional(),
});

/**
 * POST /api/seasons/[seasonId]/invites — il proprietario crea un codice.
 * GET  — elenca i codici attivi di quella stagione.
 *
 * Solo l'owner. Uno staff che puo' creare codici puo' far entrare chi vuole in
 * una squadra che non e' sua, e la revoca del singolo non ferma chi ne ha gia'
 * creati cinque.
 */
export async function POST(request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId } = await context.params;
  const member = await requireSeasonMember(auth.uid, seasonId, 'owner');
  if (!member.ok) return member.response;

  const parsed = createSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError(400, 'VALIDATION_ERROR', 'Parametri del codice non validi.');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + (parsed.data.expiresInDays ?? DEFAULT_EXPIRES_IN_DAYS) * DAY_MS);

  // Il codice e' l'ID del documento. Un tentativo genera un codice nuovo invece
  // di andare in conflitto: un doppio click sul pulsante deve creare due
  // codici, non far fallire il secondo.
  for (let tentativo = 0; tentativo < 5; tentativo++) {
    const code = generateInviteCode();
    const ref = adminDb.collection('invites').doc(code);
    const snap = await ref.get();
    if (snap.exists) continue;

    try {
      await ref.set({
        code,
        seasonId,
        role: parsed.data.role,
        createdBy: auth.uid,
        createdAt: now,
        expiresAt,
        maxUses: parsed.data.maxUses ?? DEFAULT_MAX_USES,
        usedCount: 0,
        usedBy: [],
        revoked: false,
      });
    } catch (error) {
      console.error('[api/invites] creazione fallita:', error instanceof Error ? error.message : error);
      return apiError(500, 'INVITE_CREATE_FAILED', 'Non riesco a creare il codice. Riprova.');
    }

    return NextResponse.json({
      code,
      seasonId,
      expiresAt: expiresAt.toISOString(),
      maxUses: parsed.data.maxUses ?? DEFAULT_MAX_USES,
    });
  }

  return apiError(500, 'INVITE_CODE_COLLISION', 'Non riesco a generare un codice. Riprova.');
}

/** GET — codici non revocati e non scaduti, con l'indicazione di quanti usi restano. */
export async function GET(request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId } = await context.params;
  const member = await requireSeasonMember(auth.uid, seasonId, 'owner');
  if (!member.ok) return member.response;

  const snap = await adminDb.collection('invites').where('seasonId', '==', seasonId).get();
  const now = Date.now();

  const invites = snap.docs
    .map((d) => {
      const data = d.data() as {
        code: string; role: string; expiresAt: { toMillis?: () => number } | string;
        maxUses: number; usedCount: number; revoked: boolean; legacy?: boolean;
        usedBy?: string[];
      };
      const expiresAtMs =
        typeof data.expiresAt === 'string'
          ? new Date(data.expiresAt).getTime()
          : (data.expiresAt?.toMillis?.() ?? 0);

      return {
        code: data.code,
        role: data.role,
        expiresAt: new Date(expiresAtMs).toISOString(),
        maxUses: data.maxUses,
        usedCount: data.usedCount,
        revoked: data.revoked,
        legacy: data.legacy ?? false,
        expired: expiresAtMs > 0 && expiresAtMs < now,
        remainingUses: Math.max(0, data.maxUses - data.usedCount),
      };
    })
    // Scaduti e revocati restano visibili per un po': il proprietario deve
    // vedere il codice che ha distribuito e capire che non funziona piu', non
    // vederlo sparire e pensare di non averlo creato.
    .filter((i) => !i.revoked)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

  return NextResponse.json({ invites });
}