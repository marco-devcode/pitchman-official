import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/private/assign-role — assegna un ruolo account senza passare
 * dall'app.
 *
 * PERCHE' ESISTE. Il developer si assegna da console Firebase: la console e'
 * l'unica via che scrive i custom claims, e le Firestore rules leggono il ruolo
 * da li'. Il direttore sportivo no: arriva da una richiesta privata, quindi
 * questa route e' il suo unico punto d'ingresso.
 *
 * DUE RUOLI, DUE ORIGINI, DUE MODI DI AUTENTICARSI. Il developer ha gia' il
 * claim, e la sua richiesta porta un idToken normale verificato come
 * `developer`. Il direttore non ha un account developer: la sua richiesta porta
 * un SEGRETO condiviso (`ROLE_ASSIGNMENT_SECRET`) nell'header. Senza il
 * segreto, questa route non esiste — non "funziona per qualche ruolo".
 *
 * PERCHE' IL SEGRETO E NON UN TOKEN UTENTE. Nessuno dei due ha un account
 * developer: il richiedente e' tu, fuori dall'app, e ti serve una chiave che
 * non viva nel browser di nessuno. Il segreto sta in `ROLE_ASSIGNMENT_SECRET`
 * su Vercel; senza, la route risponde 503 e si vede subito che manca.
 *
 * COSA SCRIVE, E DUE COSE DA NON CONFONDERE:
 * 1. il custom claim `role` — e' quello che leggono `firestore.rules`;
 * 2. `users/{uid}.role` — e' quello che legge l'app client.
 * Se scrivessi solo il primo, l'utente vedrebbe un ruolo e le rules ne
 * applicherebbero un altro: `admin/users` segnala gia' questa divergenza come
 * "da sincronizzare". Scrivere solo il secondo lascerebbe i permessi vuoti in
 * produzione. Quindi si scrivono entrambi, e in quest'ordine: prima il
 * documento (perche' e' quello che l'errore deve fermare), poi il claim.
 */

const RUOLI_ASSEGNABILI = new Set(['developer', 'director', 'coach', 'player']);

function errore(codice: string, messaggio: string, status: number) {
  return NextResponse.json({ error: codice, message: messaggio }, { status });
}

export async function POST(request: Request) {
  if (!adminAuth || !adminDb) {
    return errore('ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.', 500);
  }

  const secret = process.env.ROLE_ASSIGNMENT_SECRET;
  if (!secret) {
    // Meglio un 503 esplicito che un 401 che sembra "credenziali sbagliate":
    // qui il problema e' che la route non e' stata configurata, e va detto.
    return errore(
      'NOT_CONFIGURED',
      'ROLE_ASSIGNMENT_SECRET non definito: assegna il ruolo dalla console.',
      503,
    );
  }

  const header = request.headers.get('X-Role-Secret') ?? '';
  if (header.length !== secret.length || !timingSafeEqual(header, secret)) {
    // 401 e non 403: senza il segreto non sei autenticato, quindi non e' ancora
    // una questione di permessi.
    return errore('UNAUTHORIZED', 'Segreto non valido.', 401);
  }

  let body: { uid?: string; role?: string; email?: string };
  try {
    body = await request.json();
  } catch {
    return errore('VALIDATION_ERROR', 'Corpo non valido.', 400);
  }

  // Accetta uid oppure email: chi assegna il ruolo spesso ha l'email della
  // persona e non il suo uid, e il percorso uid -> utente -> email-> uid non e'
  //reverse.
  let uid = typeof body.uid === 'string' ? body.uid.trim() : '';
  if (!uid && typeof body.email === 'string' && body.email.trim()) {
    const email = body.email.trim();
    try {
      const trovato = await adminAuth.getUserByEmail(email);
      uid = trovato.uid;
    } catch {
      return errore('USER_NOT_FOUND', `Nessun account con email ${email}.`, 404);
    }
  }
  if (!uid) {
    return errore('VALIDATION_ERROR', 'Serve `uid` oppure `email`.', 400);
  }

  const role = typeof body.role === 'string' ? body.role.trim() : '';
  if (!RUOLI_ASSEGNABILI.has(role)) {
    return errore(
      'INVALID_ROLE',
      `Ruolo non valido. Ammessi: ${[...RUOLI_ASSEGNABILI].join(', ')}.`,
      400,
    );
  }

  try {
    const userRecord = await adminAuth.getUser(uid);
    if (!userRecord) {
      return errore('USER_NOT_FOUND', 'Account inesistente.', 404);
    }

    // 1) Documento PRIMA del claim.
    const userDocRef = adminDb.collection('users').doc(uid);
    const now = new Date().toISOString();
    const snap = await userDocRef.get();
    if (snap.exists) {
      await userDocRef.update({ role, updatedAt: now });
    } else {
      // Il documento potrebbe non esistere se l'account non ha ancora fatto
      // login. Crearlo evita che `init-user` al primo login sovrascriva il ruolo
      // con il claim — che a questo punto e' gia' quello giusto, quindi i due
      // restano allineati.
      await userDocRef.set({
        uid,
        email: userRecord.email ?? body.email ?? '',
        displayName: userRecord.displayName ?? '',
        role,
        createdAt: now,
        updatedAt: now,
      });
    }

    // 2) Custom claim, preservando gli altri claim esistenti.
    const currentClaims = userRecord.customClaims ?? {};
    await adminAuth.setCustomUserClaims(uid, { ...currentClaims, role });

    return NextResponse.json({
      ok: true,
      uid,
      role,
      email: userRecord.email ?? null,
      // Detto esplicitamente perche' il login successivo e' cio' che fa
      // leggere il nuovo ruolo all'app: senza, sembra che il cambio non sia
      // avvenuto anche se e' avvenuto.
      nota: 'Il nuovo ruolo e\' visibile dall\'app al prossimo login.',
    });
  } catch (error) {
    console.error(
      '[api/private/assign-role] fallito:',
      error instanceof Error ? error.message : error,
    );
    return errore('ASSIGN_FAILED', 'Assegnazione non riuscita.', 500);
  }
}

/**
 * Confronto a tempo costante.
 *
 * `===` confronta le stringhe e restituisce false al primo carattere diverso:
 * il tempo di risposta dice quanto del segreto e' indovinato. Su una rotta che
 * scrive i permessi di un account non e' un dettaglio.
 */
function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}