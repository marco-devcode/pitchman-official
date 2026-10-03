import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * GET /api/admin/users — elenco degli account con il loro ruolo.
 *
 * Esiste perche' `api/admin/set-role` esisteva ma nessuno la chiamava: senza
 * un elenco non c'e' un posto da cui assegnare un ruolo, quindi il primo
 * `developer` andava promosso a mano dalla console Firebase.
 *
 * La lista viene dall'Admin SDK (`adminAuth.listUsers`) e non da Firestore:
 * un account appena registrato potrebbe non avere ancora il documento
 * `users/{uid}`, e in quel caso deve comparire lo stesso con il ruolo dai
 * custom claims. Firestore darebbe solo chi e' gia' stato sincronizzato.
 */
export async function GET(request: Request) {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1]);

    // Solo uno sviluppatore. Il ruolo viene dai custom claims perche' e' l'unico
    // posto in cui `set-role` lo scrive in modo che `init-user` lo propaghi al
    // documento Firestore.
    if (decodedToken.role !== 'developer') {
      return NextResponse.json(
        { error: 'Forbidden. Solo i developer possono vedere gli account.' },
        { status: 403 },
      );
    }

    // I documenti Firestore hanno il ruolo aggiornato; i claim possono essere
    // piu' recenti (l'Admin SDK li scrive subito, Firestore al login
    // successivo). La riga del pannello mostra i due, e segnala la divergenza.
    const profili = new Map<string, { role?: string; email?: string }>();
    const snap = await adminDb.collection('users').get();
    snap.forEach((doc) => {
      const data = doc.data();
      profili.set(doc.id, { role: data.role, email: data.email });
    });

    const utenti: {
      uid: string;
      email: string;
      displayName: string;
      claimRole: string | null;
      profiloRole: string | null;
      sincronizzato: boolean;
      createdAt: string;
      lastSignedInAt: string | null;
    }[] = [];

    let page = adminAuth.listUsers(1000);
    for (;;) {
      const batch = await page;
      for (const user of batch.users) {
        const profilo = profili.get(user.uid);
        const claimRole = user.customClaims?.role ?? null;
        const profiloRole = profilo?.role ?? null;
        utenti.push({
          uid: user.uid,
          email: user.email ?? profilo?.email ?? '',
          displayName: user.displayName ?? '',
          claimRole,
          profiloRole,
          // Divergono quando i due non coincidono: il claim e' la fonte che
          // Firestore rules e `setAuth` leggono, il profilo quella che mostra
          // l'app. Se non coincidono l'utente vede un ruolo e ne applica
          // un altro.
          sincronizzato: claimRole === profiloRole,
          createdAt: user.metadata.creationTime,
          lastSignedInAt: user.metadata.lastSignInTime ?? null,
        });
      }
      if (!batch.pageToken) break;
      page = adminAuth.listUsers(1000, batch.pageToken);
    }

    utenti.sort((a, b) => (a.lastSignedInAt ?? '').localeCompare(b.lastSignedInAt ?? ''));
    return NextResponse.json({ users: utenti });
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}
