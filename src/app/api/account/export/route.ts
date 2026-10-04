import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { apiError, requireAuth, roleOf } from '@/lib/server/auth';
import { SEASON_COLLECTIONS, USER_SUBCOLLECTIONS, USER_TOP_LEVEL_COLLECTIONS } from '@/lib/season-collections';
import { rateLimit } from '@/lib/server/rate-limit';

export const runtime = 'nodejs';

/**
 * POST /api/account/export — scarica i tuoi dati.
 *
 * Per le stagioni di cui l'utente e' OWNER vanno tutte le collection del
 * registro. Per le stagioni in cui e' solo staff vanno SOLO nome e ruolo: sono
 * i dati di una squadra che non e' sua, e il GDPR non distingue "l'ho scaricato
 * per cortesia" da "non avevo il diritto".
 *
 * La differenza e' applicata qui, sul server, e non trusting sui campi del
 * client: se il filtro stesse nel client, un export di qualcun altro sarebbe
 * una questione di non mandare un campo.
 */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;
  if (!adminDb) return apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.');

  const rl = await rateLimit('exportAccount', { uid: auth.uid });
  if (!rl.ok) {
    return apiError(429, 'RATE_LIMITED', 'Hai scaricato i tuoi dati piu\' volte oggi. Riprova domani.', {
      retryAfter: rl.retryAfter,
    });
  }

  const uid = auth.uid;
  const exportVersion = 1;

  try {
    const [userSnap, ownerSeasons, memberSeasons, legacySeasons] = await Promise.all([
      adminDb.collection('users').doc(uid).get(),
      adminDb.collection('teams').where('ownerId', '==', uid).get(),
      adminDb.collection('teams').where('memberUids', 'array-contains', uid).get(),
      adminDb.collection('teams').where('sharedWith', 'array-contains', uid).get(),
    ]);

    const profile: Record<string, unknown> = userSnap.exists ? (userSnap.data() as Record<string, unknown>) : {};
    // Il documento utente puo' contenere campi che non sono dati personali ma
    // interni (ruoli, flag di sviluppo). Non si filtrano perche' sono utili
    // all'utente per capire come l'app lo tratta.
    delete profile.password;

    const seasons: Record<string, unknown>[] = [];
    const seen = new Set<string>();

    const addSeason = async (snap: FirebaseFirestore.QueryDocumentSnapshot, full: boolean) => {
      if (seen.has(snap.id)) return;
      seen.add(snap.id);
      const data = snap.data() as Record<string, unknown>;

      if (!full) {
        seasons.push({ id: snap.id, name: data.name ?? null, role: roleOf({ ...data, id: snap.id }, uid) });
        return;
      }

      const data_out: Record<string, unknown> = {
        id: snap.id,
        name: data.name ?? null,
        role: 'owner',
        createdAt: data.createdAt ?? null,
      };

      for (const coll of SEASON_COLLECTIONS) {
        const subSnap = await snap.ref.collection(coll.path).get();
        const docs = subSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (coll.subcollections?.length) {
          // Sottocollection annidate: si appiattiscono sotto il documento
          // padre, perche' nell'export non possono stare altrove e perdere il
          // legame con la partita a cui appartengono.
          for (const sub of coll.subcollections) {
            for (const d of docs) {
              const nested = await snap.ref.collection(coll.path).doc(d.id).collection(sub).get();
              (d as Record<string, unknown>)[sub] = nested.docs.map((n) => ({ id: n.id, ...n.data() }));
            }
          }
        }

        data_out[coll.path] = docs;
      }

      seasons.push(data_out);
    };

    for (const s of ownerSeasons.docs) await addSeason(s, true);
    for (const s of memberSeasons.docs) await addSeason(s, false);
    for (const s of legacySeasons.docs) await addSeason(s, false);

    const personal: Record<string, unknown> = {};
    for (const sub of USER_SUBCOLLECTIONS) {
      const snap = await adminDb.collection('users').doc(uid).collection(sub).get();
      if (!snap.empty) personal[sub] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    const topLevel: Record<string, unknown> = {};
    for (const name of USER_TOP_LEVEL_COLLECTIONS) {
      const snap = await adminDb.collection(name).where('userId', '==', uid).get();
      if (!snap.empty) topLevel[name] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    }

    const payload = {
      exportVersion,
      exportedAt: new Date().toISOString(),
      profile,
      seasons,
      ...(Object.keys(personal).length ? { personal } : {}),
      ...(Object.keys(topLevel).length ? { topLevel } : {}),
    };

    const stamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="pitchman-dati-${stamp}.json"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/account/export] fallito:', error instanceof Error ? error.message : error);
    return apiError(500, 'EXPORT_FAILED', 'Non riesco a preparare il file. Riprova.');
  }
}