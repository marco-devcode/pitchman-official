import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth, requireSeasonMember } from '@/lib/server/auth';
import type { TeamPoll } from '@/lib/types';

export const runtime = 'nodejs';

const updatePollSchema = z.object({
  status: z.enum(['open', 'closed']),
});

/**
 * PATCH /api/seasons/[seasonId]/polls/[pollId]
 * Apre o chiude un sondaggio esistente della stagione.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ seasonId: string; pollId: string }> },
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId, pollId } = await context.params;
  const member = await requireSeasonMember(auth.uid, seasonId, 'staff');
  if (!member.ok) return member.response;

  const parsed = updatePollSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, 'VALIDATION_ERROR', 'Stato del sondaggio non valido.');
  }

  try {
    const ref = adminDb.collection('polls').doc(pollId);
    const snap = await ref.get();
    if (!snap.exists) {
      return apiError(404, 'POLL_NOT_FOUND', 'Sondaggio non trovato.');
    }

    const existing = snap.data() as Omit<TeamPoll, 'id'>;
    if (existing.seasonId !== seasonId) {
      return apiError(403, 'FORBIDDEN', 'Questo sondaggio appartiene a un\'altra stagione.');
    }

    const updatedAt = new Date().toISOString();
    await ref.update({
      status: parsed.data.status,
      updatedAt,
    });

    const poll: TeamPoll = {
      ...existing,
      id: snap.id,
      status: parsed.data.status,
      updatedAt,
    };
    return NextResponse.json({ poll });
  } catch (error) {
    console.error('[api/polls PATCH] Errore aggiornamento sondaggio:', error instanceof Error ? error.message : error);
    return apiError(500, 'POLL_UPDATE_FAILED', 'Non riesco ad aggiornare il sondaggio.');
  }
}

/**
 * DELETE /api/seasons/[seasonId]/polls/[pollId]
 * Elimina definitivamente un sondaggio della stagione.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ seasonId: string; pollId: string }> },
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId, pollId } = await context.params;
  const member = await requireSeasonMember(auth.uid, seasonId, 'staff');
  if (!member.ok) return member.response;

  try {
    const ref = adminDb.collection('polls').doc(pollId);
    const snap = await ref.get();
    if (!snap.exists) {
      return apiError(404, 'POLL_NOT_FOUND', 'Sondaggio non trovato.');
    }

    const existing = snap.data() as Omit<TeamPoll, 'id'>;
    if (existing.seasonId !== seasonId) {
      return apiError(403, 'FORBIDDEN', 'Questo sondaggio appartiene a un\'altra stagione.');
    }

    await ref.delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/polls DELETE] Errore eliminazione sondaggio:', error instanceof Error ? error.message : error);
    return apiError(500, 'POLL_DELETE_FAILED', 'Non riesco a eliminare il sondaggio.');
  }
}

