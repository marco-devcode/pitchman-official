import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth, requireSeasonMember } from '@/lib/server/auth';

export const runtime = 'nodejs';

/**
 * DELETE /api/seasons/[seasonId] — il proprietario elimina la stagione.
 *
 * Vive qui e non nel client perche' la cancellazione ricorsiva con l'Admin SDK
 * e' l'unica che copre tutte le sottocollection: nel client dipenderebbe dal
 * registro `SEASON_COLLECTIONS` e quindi da quello che il client ricorda di
 * esistere. Il pulsante "Elimina stagione" esiste gia' e chiama questa rotta.
 *
 * Nota sul percorso: `DELETE /api/seasons` con il seasonId nel body sembrava
 * piu' comoda, ma con lo stesso path del `GET` che ritorna l'elenco si
 * finisce con una rotta che ha due forme incompatibili dello stesso parametro.
 * Il parametro di rotta e' l'unico senza ambiguità.
 */
export async function DELETE(request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId } = await context.params;
  const member = await requireSeasonMember(auth.uid, seasonId, 'owner');
  if (!member.ok) return member.response;

  try {
    await adminDb.recursiveDelete(adminDb.collection('teams').doc(seasonId));

    // Gli inviti di quella stagione non sono sotto `teams/`: senza questo
    // restano codici attivi che portano a una stagione cancellata.
    const invites = await adminDb.collection('invites').where('seasonId', '==', seasonId).get();
    const batch = adminDb.batch();
    for (const inv of invites.docs) batch.delete(inv.ref);
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[api/seasons/[seasonId]] cancellazione fallita:', error instanceof Error ? error.message : error);
    return apiError(500, 'SEASON_DELETE_FAILED', 'Non riesco a eliminare la stagione. Riprova.');
  }
}