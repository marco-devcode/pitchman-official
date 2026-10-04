import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth, requireSeasonMember } from '@/lib/server/auth';

export const runtime = 'nodejs';

/**
 * DELETE /api/seasons/[seasonId]/invites/[code] — revoca un codice.
 *
 * Revocare NON toglie l'accesso a chi ha gia' riscattato il codice: toglie la
 * possibilita' a chi non e' ancora entrato. Chi e' dentro si rimuove con la
 * rotta sui membri. Sono due cose diverse e mescolarle darebbe l'illusione di
 * aver revocato qualcosa che invece resta.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ seasonId: string; code: string }> },
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId, code } = await context.params;
  const member = await requireSeasonMember(auth.uid, seasonId, 'owner');
  if (!member.ok) return member.response;

  const ref = adminDb.collection('invites').doc(code);
  const snap = await ref.get();

  // 404 e non 403 quando il codice non esiste o non e' di questa stagione:
  // altrimenti si puo' dedurre quali codici esistono nel sistema. Per il
  // proprietario della stagione il rischio e' nullo, per la forma dell'errore
  // no.
  if (!snap.exists || snap.data()?.seasonId !== seasonId) {
    return apiError(404, 'INVITE_NOT_FOUND', 'Codice non trovato.');
  }

  await ref.update({ revoked: true, revokedAt: new Date() });
  return NextResponse.json({ ok: true });
}