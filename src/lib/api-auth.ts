import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * Verifica che la richiesta arrivi da un utente autenticato con un ruolo
 * ammesso.
 *
 * Restituisce `null` quando passa, e RESTITUISCE LA RISPOSTA (401/403/500)
 * quando non passa.
 *
 *   const denied = await requireAuth(request, ['developer']);
 *   if (denied) return denied;
 *
 * PERCHE' DEVE RESTITUIRE LA RISPOSTA. La prima versione faceva
 * `NextResponse.json({error}, {status}); return null;`: costruiva la risposta e
 * la buttava, e la route faceva `if (!auth) return;` restituendo `undefined`.
 * Next rispondeva allora:
 *   "No response is returned from route handler"
 * cioe' le tre route protette — import-rosa, import-calendario, generate —
 * erano rotte al 100%: non rispondevano a nessuna richiesta, nemmeno a quelle
 * legittime. Il rifiuto "funzionava" perche' non rispondeva, ma ogni
 * richiesta valida falliva e il prodotto era morto. Verificato sui log Vercel,
 * non ipotizzato.
 *
 * IL RUOLO VIENE DA FIRESTORE, non dai custom claims. `api/admin/set-role`
 * scrive i claims, e in teoria era il posto giusto: ma richiede `adminAuth`, e
 * senza `FIREBASE_SERVICE_ACCOUNT` quei claim non venivano mai scritti, quindi
 * `decodedToken.role` era sempre `undefined` e l'accesso sarebbe stato negato
 * a tutti. La fonte tenuta allineata e' il documento `users/{uid}`, ed e' da
 * li' che `useUserRole` prende il ruolo anche lato client.
 */
export async function requireAuth(
  request: Request,
  allowedRoles?: string[],
): Promise<NextResponse | null> {
  if (!adminAuth || !adminDb) {
    return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1])).uid;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let role = '';
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (snap.exists) role = String(snap.data()?.role ?? '');
  } catch {
    // Se il ruolo non e' verificabile si nega: meglio un 403 che lasciare
    // passare una richiesta di cui non si conosce il permesso.
    return NextResponse.json({ error: 'Forbidden. Ruolo non verificabile.' }, { status: 403 });
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return NextResponse.json(
      { error: `Forbidden. Servono i ruoli: ${allowedRoles.join(', ')}.` },
      { status: 403 },
    );
  }

  return null;
}

/**
 * Come `requireAuth` ma in forma che non si puo' confondere: ritorna un
 * oggetto con due campi distinti.
 *
 *   const auth = requireAuthOr(request, ['developer']);
 *   if (!auth.ok) return auth.response;
 *   ... auth.uid, auth.role
 *
 * Serve perche' con `requireAuth` + `if (!auth) return` "rifiutata" e "risposta
 * da mandare" erano lo stesso valore, e il `return` secco mandava `undefined`.
 * Qui i due campi non si confonderono.
 */
export async function requireAuthOr(
  request: Request,
  allowedRoles?: string[],
): Promise<{ ok: true; uid: string; role: string } | { ok: false; response: NextResponse }> {
  const denied = await requireAuth(request, allowedRoles);
  if (denied) return { ok: false, response: denied };

  const authHeader = request.headers.get('Authorization') ?? '';
  const decoded = await adminAuth!.verifyIdToken(authHeader.split('Bearer ')[1]);
  const snap = await adminDb!.collection('users').doc(decoded.uid).get();
  const role = snap.exists ? String(snap.data()?.role ?? '') : '';

  return { ok: true, uid: decoded.uid, role };
}
