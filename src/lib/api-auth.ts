import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

/**
 * Verifica che la richiesta arrivi da un utente autenticato, e restituisce il
 * suo ruolo. Risponde 401/403/500 e restituisce `null` quando va respinta.
 *
 *   const auth = await requireAuth(request, ['developer']);
 *   if (!auth) return;   // gia' risposto
 *   ... auth.uid, auth.role
 *
 * PERCHE'. `api/admin/set-role` faceva questa verifica a mano, ma le route di
 * import (`import-rosa`, `import-calendario`) e quella di generazione AI
 * (`generate`) non la facevano: erano raggiungibili senza token e senza
 * controllare il ruolo, quindi chiunque poteva far scrivere una rosa, un
 * calendario, o far consumare crediti Gemini. Il controllo esisteva in un posto
 * solo, quindi non era un controllo.
 *
 * IL RUOLO VIENE DA FIRESTORE, NON DAI CUSTOM CLAIMS. `api/admin/set-role`
 * scriveva il ruolo nei custom claims, e in teoria era il posto giusto: ma
 * richiede `adminAuth`, e `FIREBASE_SERVICE_ACCOUNT` non e' definita in nessun
 * ambiente Vercel (verificato in produzione: `POST /api/auth/init-user`
 * risponde "Firebase Admin not configured"), quindi quei claim non vengono
 * mai scritti e `decodedToken.role` e' sempre `undefined`. Leggendo i claim,
 * `requireAuth` avrebbe negato l'accesso a tutti, o risposto 500 come fanno
 * gia' oggi quelle route.
 *
 * La fonte che l'app usa davvero e' il documento `users/{uid}`: e' da li' che
 * `useUserRole` prende il ruolo, ed e' la sola tenuta allineata.
 */
export async function requireAuth(
  request: Request,
  allowedRoles?: string[],
): Promise<{ uid: string; role: string } | null> {
  if (!adminAuth || !adminDb) {
    NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    return null;
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return null;
  }

  let uid: string;
  try {
    uid = (await adminAuth.verifyIdToken(authHeader.split('Bearer ')[1])).uid;
  } catch {
    NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return null;
  }

  let role = '';
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (snap.exists) role = String(snap.data()?.role ?? '');
  } catch {
    // Se il ruolo non e' verificabile si nega: meglio un 403 che lasciare
    // passare una richiesta di cui non si conosce il permesso.
    NextResponse.json({ error: 'Forbidden. Ruolo non verificabile.' }, { status: 403 });
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    NextResponse.json(
      { error: `Forbidden. Servono i ruoli: ${allowedRoles.join(', ')}.` },
      { status: 403 },
    );
    return null;
  }

  return { uid, role };
}
