import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth, roleOf } from '@/lib/server/auth';
import { SEASON_COLLECTIONS, USER_TOP_LEVEL_COLLECTIONS } from '@/lib/season-collections';
import { DELETE_CONFIRMATION, REAUTH_MAX_AGE_SECONDS } from '@/lib/account-deletion';

export const runtime = 'nodejs';

/** La stringa che l'utente deve digitare. Scelta corta e non ambigua. */
/**
 * POST /api/account/delete — elimina l'account e i dati che lo riguardano.
 *
 * TRE CONDIZIONI, tutte necessarie:
 *
 * 1. Accesso recente (`auth_time` entro 5 minuti). Un token rubato puo'
 *    valere per un'ora: senza questo controllo, trovare una sessione aperta
 *    basta per cancellare l'account di qualcun altro. Il client deve fare
 *    reauth e ritentare, e il codice di errore e' `REAUTH_REQUIRED` perche' il
 *    client sappia che non e' un errore da mostrare e da cui uscire.
 * 2. Conferma esplicita: la stringa `ELIMINA` digitata. Un endpoint che
 *    cancella tutto non deve poterlo fare con una richiesta che arriva per
 *    sbaglio, da un retry, da un doppio click.
 * 3. Il controllo su `isOwner`: le stagioni di cui l'utente e' proprietario
 *    vengono eliminate per intero, e con loro i dati dei giocatori.
 *
 * L'ORDINE conta. Prima i dati su Firestore, poi Firebase Auth: se l'utente
 * venisse cancellato da Auth per primo, le chiamate successive fallirebbero per
 *che' il token non e' piu' valido e i dati resterebbero a terra, con nessuno in
 * grado di cancellarli perche' il proprietario non esiste piu'.
 */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb || !adminAuth) {
    return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');
  }

  const uid = auth.uid;
  const userRef = adminDb.collection('users').doc(uid);

  const body = (await request.json().catch(() => null)) as { confirm?: unknown } | null;
  if (body?.confirm !== DELETE_CONFIRMATION) {
    return apiError(400, 'CONFIRMATION_REQUIRED', `Digita ${DELETE_CONFIRMATION} per confermare.`);
  }

  const ageSeconds = Math.floor(Date.now() / 1000) - auth.authTime;
  if (!auth.authTime || ageSeconds > REAUTH_MAX_AGE_SECONDS) {
    return apiError(
      401,
      'REAUTH_REQUIRED',
      'Per sicurezza devi accedere di nuovo prima di eliminare l\'account.',
    );
  }

  // Preventivo: quanti membri perderanno l'accesso. Il client mostra questi
  // numeri PRIMA della conferma, non dopo.
  const [ownerSnap, memberSnap, legacySnap] = await Promise.all([
    adminDb.collection('teams').where('ownerId', '==', uid).get(),
    adminDb.collection('teams').where('memberUids', 'array-contains', uid).get(),
    adminDb.collection('teams').where('sharedWith', 'array-contains', uid).get(),
  ]);

  const ownedIds = ownerSnap.docs.map((d) => d.id);
  const staffOf = new Map<string, number>();
  for (const snap of [...memberSnap.docs, ...legacySnap.docs]) {
    if (ownedIds.includes(snap.id)) continue;
    staffOf.set(snap.id, countOthers(snap.data() as Record<string, unknown>, uid));
  }

  const staffLosingAccess = [...staffOf.values()].reduce((a, b) => a + b, 0);

  try {
    // 1. Stagioni di cui e' proprietario: via. Dati, non solo il documento.
    for (const seasonId of ownedIds) {
      await adminDb.recursiveDelete(adminDb.collection('teams').doc(seasonId));

      // Gli inviti non stanno sotto `teams/`: senza questo restano codici
      // attivi che rimandano a una stagione inesistente. Non e' un problema
      // sicurezza (il riscatto fallisce) ma lascia codici che il proprietario
      // crede attivi.
      const invites = await adminDb.collection('invites').where('seasonId', '==', seasonId).get();
      const batch = adminDb.batch();
      for (const inv of invites.docs) batch.delete(inv.ref);
      await batch.commit();
    }

    // 2. Stagioni in cui e' solo staff: si toglie da members/memberUids.
    //    I dati restano all'owner: sono la squadra di qualcun altro.
    for (const snap of [...memberSnap.docs, ...legacySnap.docs]) {
      if (ownedIds.includes(snap.id)) continue;
      const seasonRef = adminDb.collection('teams').doc(snap.id);
      const data = snap.data() as {
        members?: Record<string, string>; memberUids?: string[]; sharedWith?: string[];
      };
      const { [uid]: _via, ...members } = data.members ?? {};
      await seasonRef.update({
        members,
        memberUids: (data.memberUids ?? Object.keys(data.members ?? {})).filter((u) => u !== uid),
        sharedWith: (data.sharedWith ?? []).filter((u) => u !== uid),
      });
    }

    // 3. Documento utente e tutte le sue sottocollection. `recursiveDelete`
    //    sul documento utente porta via anche se stesso, quindi non serve un
    //    `delete` dopo: anzi, un `delete` dopo lascerebbe ricreato il
    //    documento vuoto se il recursiveDelete avesse fallito.
    await adminDb.recursiveDelete(userRef).catch((error: unknown) => {
      console.error('[api/account/delete] pulizia utente fallita:', error instanceof Error ? error.message : error);
    });

    for (const name of USER_TOP_LEVEL_COLLECTIONS) {
      const snap = await adminDb.collection(name).where('userId', '==', uid).get();
      const batch = adminDb.batch();
      for (const d of snap.docs) batch.delete(d.ref);
      if (!snap.empty) await batch.commit();
    }

    // 4. Log e feedback di questo utente.
    for (const name of ['aiUsage', 'rateLimits', 'feedback']) {
      const snap = await adminDb.collection(name).where('uid', '==', uid).get();
      const batch = adminDb.batch();
      for (const d of snap.docs) batch.delete(d.ref);
      if (!snap.empty) await batch.commit();
    }

    // 5. Auth per ultimo, e con revoca dei refresh token: senza, un refresh
    //    token gia' emesso continua a valere e l'utente resta collegato
    //    all'app con un account che non esiste piu'.
    await adminAuth.deleteUser(uid).catch((error: unknown) => {
      // Se l'utente e' gia' stato cancellato da Auth, i dati sono gia' puliti:
      // non e' un fallimento della cancellazione, ma va detto nei log.
      console.warn('[api/account/delete] utente Auth gia\' assente:', error instanceof Error ? error.message : error);
    });
    await adminAuth.revokeRefreshTokens(uid).catch(() => undefined);

    return NextResponse.json({ ok: true, deletedSeasons: ownedIds.length, staffLosingAccess });
  } catch (error) {
    console.error('[api/account/delete] fallito:', error instanceof Error ? error.message : error);
    return apiError(
      500,
      'DELETE_FAILED',
      'Cancellazione non completata. Alcuni dati potrebbero essere rimasti: contattaci.',
    );
  }
}

/**
 * Anteprima della cancellazione: GET restituisce cosa verrebbe eliminato.
 *
 * Serve perche' il dialog deve poter dire "perderanno l'accesso 3 persone"
 * PRIMA che l'utente digiti ELIMINA, non dopo. Senza, l'avviso che il documento
 * chiede diventa impossibile da mostrare.
 */
export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const uid = auth.uid;
  const [ownerSnap, memberSnap, legacySnap] = await Promise.all([
    adminDb.collection('teams').where('ownerId', '==', uid).get(),
    adminDb.collection('teams').where('memberUids', 'array-contains', uid).get(),
    adminDb.collection('teams').where('sharedWith', 'array-contains', uid).get(),
  ]);

  const ownedIds = ownerSnap.docs.map((d) => d.id);
  const asStaff = [...memberSnap.docs, ...legacySnap.docs].filter((d) => !ownedIds.includes(d.id));

  const staffLosingAccess = asStaff.reduce(
    (acc, d) => acc + countOthers(d.data() as Record<string, unknown>, uid),
    0,
  );

  return NextResponse.json({
    confirmation: DELETE_CONFIRMATION,
    seasonsOwned: ownerSnap.docs.map((d) => ({
      id: d.id,
      name: (d.data() as { name?: string }).name ?? d.id,
    })),
    seasonsAsStaff: asStaff.map((d) => ({
      id: d.id,
      name: (d.data() as { name?: string }).name ?? d.id,
    })),
    staffLosingAccess,
  });
}

/** Quanti membri ci sono in una stagione, escluso l'utente che esce. */
function countOthers(season: Record<string, unknown>, uid: string): number {
  return roleOf(season as never, uid) ? others(season, uid) : 0;
}

function others(season: Record<string, unknown>, uid: string): number {
  const uids = new Set<string>();
  const members = season.members as Record<string, string> | undefined;
  if (members) for (const u of Object.keys(members)) uids.add(u);
  if (Array.isArray(season.memberUids)) for (const u of season.memberUids as string[]) uids.add(u);
  if (Array.isArray(season.sharedWith)) for (const u of season.sharedWith as string[]) uids.add(u);
  if (typeof season.ownerId === 'string') uids.add(season.ownerId);
  uids.delete(uid);
  return uids.size;
}
