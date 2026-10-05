import 'server-only';
import { NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import { limitsForPlan, type PlanId } from '@/lib/plans';

/**
 * Risposta d'errore uniforme.
 *
 *   { error: { code, message } }
 *
 * Il `message` e' in italiano e scritto per l'utente: viene mostrato così com'è.
 * Il `code` e' stabile e per il codice, non per la persona. Le route vecchie
 * rispondevano `{ error: "stringa" }` e i client lo leggono ancora: la funzione
 * mette `message` anche in `error` per non romperli.
 */
export function apiError(
  status: number,
  code: string,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  const headers: Record<string, string> = {};
  // 429 senza Retry-After e' un 429 che il client non puo' rispettare: puo'
  // solo indovinare quando riprovare.
  const retryAfter = typeof extra?.retryAfter === 'number' ? extra.retryAfter : undefined;
  if (status === 429 && retryAfter !== undefined) headers['Retry-After'] = String(retryAfter);

  const { retryAfter: _ignored, ...rest } = extra ?? {};

  return NextResponse.json({ error: { code, message }, ...rest }, { status, headers });
}

/** 401 quando manca o non e' valido l'ID token. */
export function unauthorized(message = 'Accedi di nuovo per continuare.') {
  return apiError(401, 'UNAUTHORIZED', message);
}

/** 403 quando l'utente c'e' ma non ha il permesso. */
export function forbidden(message = 'Non hai i permessi per questa operazione.') {
  return apiError(403, 'FORBIDDEN', message);
}

export interface AuthUser {
  uid: string;
  /** `auth_time` del token: serve per chiedere un accesso recente prima di cancellare l'account */
  authTime: number;
  email?: string;
  displayName?: string;
}

export type AuthResult =
  | { ok: true; uid: string; authTime: number; email?: string; displayName?: string }
  | { ok: false; response: NextResponse };

/**
 * Verifica l'ID token Firebase dall'header `Authorization: Bearer <token>`.
 *
 * Il `uid` viene SEMPRE da qui. Un `userId` o `seasonId` che arriva nel body
 * non viene mai creduto: con l'Admin SDK, credere un uid dal body significa
 * che chiunque puo' scrivere come qualcun altro.
 */
export async function requireAuth(request: Request): Promise<AuthResult> {
  if (!adminAuth || !adminDb) {
    return {
      ok: false,
      response: apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.'),
    };
  }

  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: unauthorized('Devi essere collegato.') };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(authHeader.slice('Bearer '.length));
    return {
      ok: true,
      uid: decoded.uid,
      authTime: Number(decoded.auth_time ?? 0),
      email: typeof decoded.email === 'string' ? decoded.email : undefined,
      displayName: typeof decoded.name === 'string' ? decoded.name : undefined,
    };
  } catch {
    return { ok: false, response: unauthorized('La sessione non e\' valida. Accedi di nuovo.') };
  }
}

/**
 * Forma del documento stagione LATO SERVER.
 *
 * Tutti i campi del documento sono opzionali perche' una stagione non migrata
 * non li ha: `roleOf` deve poter dire "non e' membro" anche davanti a un
 * documento che ha solo `ownerId` e `sharedWith`. Per questo non e' un tipo
 * che pretende di descrivere Firestore, ma quello che i guard riescono a
 * gestire senza schiantarsi su un dato incompleto — che e' esattamente la
 * situazione durante la migrazione.
 */
export interface SeasonDoc {
  id?: string;
  ownerId?: string;
  name?: string;
  plan?: PlanId;
  /**
   * `maxPlayers` puo' essere `null`: e' come Firestore rappresenta "nessun
   * tetto". Il tipo lo ammette perche' il documento lo contiene davvero.
   */
  limits?: { maxPlayers: number | null; maxMembers: number };
  members?: Record<string, 'owner' | 'staff'>;
  memberUids?: string[];
  playerCount?: number;
  sharedWith?: string[];
  /**
   * Direttori sportivi che hanno riscattato un invito per questa stagione.
   *
   * Lista SEPARATA da `sharedWith` di proposito: `sharedWith` e' chi puo'
   * scrivere (eventi, presenze, test), e il direttore non deve poterlo. Sta
   * qui perche' le rules possono leggerlo con una sola `get()` sul documento
   * della stagione, senza query su un'altra collection.
   *
   * Assente sulle stagioni vecchie: `isSeasonDirector` nelle rules controlla
   * `'directorUids' in season` per questo.
   */
  directorUids?: string[];
  [key: string]: unknown;
}

export type SeasonRole = 'owner' | 'staff';

export type MembershipResult =
  | { ok: true; season: SeasonDoc; role: SeasonRole }
  | { ok: false; response: NextResponse };

/**
 * Verifica che l'utente sia membro della stagione, e con quale ruolo.
 *
 * ACCETTA DUE FORME del documento, perche' la migrazione scrive `members` +
 * `memberUids` ma le stagioni vecchie hanno solo `sharedWith`. Il codice non
 * deve rompersi fra le due: e' il prezzo di non poter migrare tutto in un colpo
 * solo senza fermare l'app. Dopo la migrazione `members` e' la fonte vera e
 * `sharedWith` resta solo come campo legacy.
 *
 * Nota sul ruolo: esistono due sistemi di ruolo nell'app e vanno tenuti
 * distinti. Quello dei TOKEN (`coach`/`director`/`developer`, in
 * `users/{uid}.role`) e' un permesso applicativo e riguarda il pannello
 * admin. Quello della STAGIONE (`owner`/`staff`) e' chi puo' vedere i dati di
 * quella squadra. Confonderli faceva pensare che "coach" equivalesse a
 * proprietario della stagione: non e' vero.
 */
export async function requireSeasonMember(
  uid: string,
  seasonId: string,
  minRole: SeasonRole = 'staff',
): Promise<MembershipResult> {
  if (!adminDb) {
    return {
      ok: false,
      response: apiError(500, 'ADMIN_NOT_CONFIGURED', 'Configurazione del server incompleta.'),
    };
  }
  if (!seasonId) {
    return { ok: false, response: apiError(400, 'SEASON_REQUIRED', 'Stagione non indicata.') };
  }

  let snap;
  try {
    snap = await adminDb.collection('teams').doc(seasonId).get();
  } catch {
    return { ok: false, response: apiError(500, 'SEASON_READ_FAILED', 'Non riesco a leggere la stagione.') };
  }

  if (!snap.exists) {
    return { ok: false, response: apiError(404, 'SEASON_NOT_FOUND', 'Stagione non trovata.') };
  }

  const season = { ...(snap.data() as Record<string, unknown>), id: snap.id } as SeasonDoc;

  const role = roleOf(season, uid);
  if (!role) {
    return {
      ok: false,
      response: forbidden('Non partecipi a questa stagione.'),
    };
  }

  if (minRole === 'owner' && role !== 'owner') {
    return { ok: false, response: forbidden('Solo il proprietario della stagione puo\' fare questo.') };
  }

  return { ok: true, season, role };
}

/** Ruolo dell'utente nella stagione, o null se non e' membro. */
export function roleOf(season: Partial<SeasonDoc>, uid: string): SeasonRole | null {
  const members = season.members;
  if (members && typeof members === 'object' && members[uid]) {
    return members[uid] === 'owner' ? 'owner' : 'staff';
  }
  if (season.ownerId === uid) return 'owner';
  if (Array.isArray(season.sharedWith) && season.sharedWith.includes(uid)) return 'staff';
  return null;
}

/**
 * C'e' un tetto di giocatori su questa stagione?
 *
 * Risponde "no" durante la beta, e la risposta va data in modo esplicito
 * invece di dedurla da un confronto numerico: `Infinity` e' un numero, quindi
 * `count >= Infinity` e' sempre falso e sembrerebbe un tetto che passa
 * sempre. Il perche' del tetto assente e' in `plans.ts`.
 */
export function hasPlayerLimit(season: SeasonDoc): boolean {
  return Number.isFinite(playerLimit(season));
}

/**
 * Numero di MEMBRI DISTINTI della stagione.
 *
 * Si contano le uid uniche su tutte le fonti (owner, members, memberUids,
 * sharedWith) e non la somma: una stagione non ancora migrata ha l'owner anche
 * in `sharedWith` per la compatibilita' delle rules, e sommando verrebbe
 * contato due volte. Il tetto membri cosi' risulterebbe gia' superato e
 * l'invito successivo fallirebbe per un utente che non ha mai aperto la
 * stagione.
 */
export function countMembers(season: Partial<SeasonDoc>): number {
  const uids = new Set<string>();
  if (season.ownerId) uids.add(season.ownerId);
  if (season.members && typeof season.members === 'object') {
    for (const uid of Object.keys(season.members)) uids.add(uid);
  }
  if (Array.isArray(season.memberUids)) {
    for (const uid of season.memberUids) if (typeof uid === 'string') uids.add(uid);
  }
  if (Array.isArray(season.sharedWith)) {
    for (const uid of season.sharedWith) if (typeof uid === 'string') uids.add(uid);
  }
  // Il direttore conta nel tetto dei 5 membri: decisione dell'utente, perche' un
  // club con 5 allenatori non deve poter condividere col proprio direttore, e
  // perche' il posto che lui occupa e' comunque un posto che il club non puo'
  // riempire.
  //
  // Nota il doppio conteggio possibile: se un uid fosse in `sharedWith` E in
  // `directorUids` verrebbe contato una volta sola, perche' `uids` e' un Set.
  // Questo e' il comportamento voluto: non e' che il direttore "vale due".
  if (Array.isArray(season.directorUids)) {
    for (const uid of season.directorUids) if (typeof uid === 'string') uids.add(uid);
  }
  return uids.size;
}

/**
 * Il ruolo DIRETTORE per questa stagione, o null.
 *
 * Diverso da `roleOf`, che restituisce 'owner' | 'staff': il direttore non e'
 * staff e non deve passare per uno, altrimenti il codice che chiede
 * `roleOf(...) === 'staff'` per autorizzare una scrittura gli darebbe il
 * permesso. Sono due domande diverse e hanno due risposte diverse.
 */
export function isSeasonDirectorOf(season: Partial<SeasonDoc>, uid: string): boolean {
  return Array.isArray(season.directorUids) && season.directorUids.includes(uid);
}

/**
 * Il ruolo ACCOUNT di un utente, letto da `users/{uid}.role`.
 *
 * NON dai custom claims, perche' i due ruoli hanno due origini diverse:
 * il developer si assegna da console (che scrive il claim) e il direttore
 * arriva da un endpoint privato che scrive il documento. Se qui si leggesse il
 * claim, il ruolo del direttore risulterebbe `coach` — il fallback di
 * `useAuthStore` — e un direttore che riscatta un invito diventerebbe
 * allenatore con pieni permessi di scrittura.
 *
 * `coerceRole` con fallback a `coach`: un documento assente o corrotto NON deve
 * promuovere nessuno. Il caso peggiore (ruolo non riconosciuto) deve essere
 * "nessun permesso in piu'", mai "tutti i permessi".
 */
export function coerceRole(value: unknown): 'developer' | 'director' | 'coach' | 'player' {
  return value === 'developer' || value === 'director' || value === 'coach' || value === 'player'
    ? value
    : 'coach';
}

/** Ruolo ACCOUNT letto da Firestore, con fallback a `coach`. */
export async function accountRoleOf(uid: string): Promise<'developer' | 'director' | 'coach' | 'player'> {
  if (!adminDb) return 'coach';
  try {
    const snap = await adminDb.collection('users').doc(uid).get();
    if (!snap.exists) return 'coach';
    return coerceRole(snap.data()?.role);
  } catch {
    // Una lettura fallita non deve far entrare nessuno con permessi: il
    // fallback 'coach' e' la scelta che non concede nulla.
    return 'coach';
  }
}

/** Il tetto membri della stagione, con fallback sui limiti del piano. */
export function memberLimit(season: Partial<SeasonDoc>): number {
  return season.limits?.maxMembers ?? limitsForPlan(season.plan).maxMembers;
}

/** Il tetto giocatori della stagione, con fallback sui limiti del piano. */
export function playerLimit(season: Partial<SeasonDoc>): number {
  return season.limits?.maxPlayers ?? limitsForPlan(season.plan).maxPlayers;
}