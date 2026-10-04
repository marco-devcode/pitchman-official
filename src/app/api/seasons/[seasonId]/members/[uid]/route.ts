import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth, requireSeasonMember, countMembers, roleOf } from '@/lib/server/auth';

export const runtime = 'nodejs';

/**
 * DELETE /api/seasons/[seasonId]/members/[uid] — rimuove un membro.
 *
 * L'owner puo' rimuovere chiunque tranne se stesso. Uno staff puo' rimuovere
 * solo se stesso: e' l'uscita dalla stagione, e serve perche' l'owner non deve
 * dover accorgersi di un utente che ha lasciato il gruppo.
 *
 * L'owner non puo' essere rimosso, nemmeno da se stesso. La stagione ha un solo
 * proprietario e senza proprietario nessuno puo' nominare staff, creare
 * codici o cancellare: una stagione senza owner e' abbandonata ma piena di
 * dati di minorenni. Il trasferimento di proprieta' e' fuori scope (vedi
 * report), quindi la porta resta chiusa e il pulsante non viene mostrato.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ seasonId: string; uid: string }> },
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId, uid } = await context.params;

  const isSelf = uid === auth.uid;
  const member = await requireSeasonMember(auth.uid, seasonId, isSelf ? 'staff' : 'owner');
  if (!member.ok) return member.response;

  if (!isSelf && member.role !== 'owner') {
    return apiError(403, 'FORBIDDEN', 'Solo il proprietario puo\' rimuovere un membro.');
  }

  const target = roleOf(member.season, uid);
  if (!target) return apiError(404, 'MEMBER_NOT_FOUND', 'Questa persona non partecipa alla stagione.');

  if (target === 'owner') {
    return apiError(
      403,
      'OWNER_REMOVABLE',
      'Il proprietario non puo\' essere rimosso. Trasferisci prima la proprieta\' della stagione.',
    );
  }

  const seasonRef = adminDb.collection('teams').doc(seasonId);

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(seasonRef);
    if (!snap.exists) return;
    const season = snap.data() as {
      members?: Record<string, string>;
      memberUids?: string[];
      sharedWith?: string[];
    };

    const { [uid]: _rimosso, ...members } = season.members ?? {};
    tx.update(seasonRef, {
      members,
      memberUids: (season.memberUids ?? Object.keys(season.members ?? {})).filter((u) => u !== uid),
      // Anche `sharedWith`: se resta, l'utente continua a passare
      // `isSeasonAuthorized` nelle rules e a leggere i dati con le regole
      // vecchie. Rimuoverlo da `members` senza rimuoverlo da qui sembrerebbe
      // una revoca riuscita.
      sharedWith: (season.sharedWith ?? []).filter((u) => u !== uid),
      updatedAt: new Date().toISOString(),
    });
  });

  const fresh = await seasonRef.get();
  const remaining = fresh.exists ? countMembers({ ...(fresh.data() as object), id: seasonId }) : 0;

  return NextResponse.json({ ok: true, membersRemaining: remaining });
}
