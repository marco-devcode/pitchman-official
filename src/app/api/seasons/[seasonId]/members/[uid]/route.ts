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

/** GET — elenco dei membri, per il pannello Staff. */
export async function GET(request: Request, context: { params: Promise<{ seasonId: string }> }) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const { seasonId } = await context.params;
  const member = await requireSeasonMember(auth.uid, seasonId);
  if (!member.ok) return member.response;

  const uids = new Set<string>();
  if (member.season.ownerId) uids.add(member.season.ownerId);
  for (const u of Object.keys(member.season.members ?? {})) uids.add(u);
  for (const u of member.season.memberUids ?? []) uids.add(u);
  for (const u of member.season.sharedWith ?? []) uids.add(u);

  // I nomi si prendono dai documenti utente, che solo il proprietario puo'
  // leggere con le regole: con l'Admin SDK si legge per uid. Nessun dato della
  // squadra passa di qui, quindi non c'e' motivo di restituire altro.
  const members = await Promise.all(
    [...uids].map(async (uid) => {
      let displayName: string | undefined;
      let email: string | undefined;
      try {
        const snap = await adminDb!.collection('users').doc(uid).get();
        displayName = snap.data()?.displayName ?? snap.data()?.username ?? undefined;
        email = snap.data()?.email ?? undefined;
      } catch {
        // Un utente senza documento profilo e' comunque membro: si mostra
        // l'uid, non si nasconde.
      }
      return { uid, role: roleOf(member.season, uid) ?? 'staff', displayName, email };
    }),
  );

  // `mioUid` serve al pannello Staff per il bottone "Esci dalla stagione":
  // senza, il client dovrebbe indovinare quale membro e' lui guardando la lista,
  // e potrebbe sbagliare. Viene dal token, quindi non puo' essere contraffatto.
  return NextResponse.json({ members, myRole: member.role, mioUid: auth.uid });
}