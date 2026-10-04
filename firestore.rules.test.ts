/**
 * @jest-environment node
 *
 * Test delle Firestore Security Rules con l'emulatore.
 *
 * NON sono opzionali: le regole sono l'unica cosa che separa la squadra di un
 * allenatore da quella di un altro. Un test che gira senza emulatore passerebbe
 * anche con le regole sbagliate, perche' l'SDK client con le regole vere non
 * gira in locale.
 *
 * Si esegue con:
 *   npx firebase emulators:exec --only firestore "npx jest firestore.rules.test"
 *
 * Se l'emulatore non e' attivo la suite SKIPPA, non passa: `describe.skip`
 * quando manca `FIRESTORE_EMULATOR_HOST`. Il motivo e' che un test che si
 * salta da solo sembra verde, e un test di sicurezza che sembra verde e'
 * peggio di uno che non esiste.
 */
import {
  initializeTestEnvironment,
  type RulesTestEnvironment,
  type RulesTestContext,
} from '@firebase/rules-unit-testing';
import { readFileSync, existsSync } from 'node:fs';
import {
  doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, addDoc,
  getFirestore, writeBatch,
} from 'firebase/firestore';
import { join } from 'node:path';

const HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
const PROJECT = 'demo-pitchman-rules';

// Il file delle regole e' quello in prova. `firestore.rules.v2` viene usato
// quando esiste, cosi' le regole nuove si possono provare SENZO pubblicarle: il
// punto dell'ordine di rilascio e' esattamente questo.
const RULES_PATH = existsSync(join(process.cwd(), 'firestore.rules.v2'))
  ? 'firestore.rules.v2'
  : 'firestore.rules';

let env: RulesTestEnvironment | undefined;

beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) return;
  env = await initializeTestEnvironment({
    projectId: PROJECT,
    firestore: { rules: readFileSync(RULES_PATH, 'utf8') },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env?.clearFirestore();
});

/**
 * Scrive DIRETTAMENTE, senza passare dalle regole.
 *
 * Il seed non puo' usare il contesto del test: le regole vietano `create` su
 * `teams/{seasonId}` (solo il server puo' creare una stagione), quindi il
 * documento di prova non si riuscirebbe a scrivere. Si scrive con
 * `withSecurityRulesDisabled`, che scavalca le regole solo per questo
 * percorso: e' l'equivalente test dell'Admin SDK, non un buco.
 */
async function seedDoc(path: string, data: Record<string, unknown>): Promise<void> {
  await env!.withSecurityRulesDisabled(async (ctx) => {
    await ctx.firestore().doc(path).set(data);
  });
}

/**
 * Contesto Firestore per un utente.
 *
 * `null` significa "nessun utente": `authenticatedContext` accetta solo una
 * stringa, quindi il caso anonimo passa da `unauthenticatedContext`, che e' la
 * differenza che i test del caso non-autenticato devono poter fare.
 */
type Firestore = ReturnType<typeof getFirestore>;

const ctx = (uid: string | null, claims: Record<string, unknown> = {}): Firestore =>
  // `firestore()` restituisce il tipo ADMIN di @firebase/rules-unit-testing,
  // che non e' assegnabile a quello client: `doc(ref)` pretende i metodi
  // `update`/`isEqual` del client SDK. Il cast e' corretto perche' all'emulatore
  // si parla con lo stesso protocollo gRPC, e serve solo a far combaciare i
  // tipi delle due librerie.
  (uid === null
    ? env!.unauthenticatedContext()
    : env!.authenticatedContext(uid, claims)
  ).firestore() as unknown as Firestore;

/** Stagione pronta: migrata, con contatore e limiti. */
async function seedMigratedSeason(
  uid: string,
  over: Record<string, unknown> = {},
): Promise<{ db: TestDb; id: string }> {
  const db = ctx(uid);
  const id = 'S-AAA111';
  await seedDoc(`teams/${id}`, {
    id,
    userId: uid,
    ownerId: uid,
    name: '2025/26',
    isActive: false,
    sharedWith: [],
    members: { [uid]: 'owner', staff1: 'staff' },
    memberUids: [uid, 'staff1'],
    plan: 'beta',
    limits: { maxPlayers: 2, maxMembers: 2 },
    playerCount: 0,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...over,
  });
  return { db, id };
}

/** Stagione vecchia: solo `ownerId` e `sharedWith`, nessun `members`. */
async function seedLegacySeason(
  uid: string,
  id = 'S-LEGACY',
  sharedWith: string[] = [],
): Promise<{ db: TestDb; id: string }> {
  const db = ctx(uid);
  await seedDoc(`teams/${id}`, {
    id,
    userId: uid,
    ownerId: uid,
    name: 'legacy',
    isActive: false,
    sharedWith,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  });
  return { db, id };
}

type TestDb = ReturnType<typeof ctx>;


const expectDenied = async (p: Promise<unknown>) => await expect(p).rejects.toThrow();

/**
 * Senza l'emulatore la suite salta, e NON passa.
 *
 * `describe.skip` e non un test che torna subito: un test di sicurezza che
 * sembra verde e' peggio di un test che non esiste, perche' fa credere che le
 * regole siano verificate.
 */
const suite = process.env.FIRESTORE_EMULATOR_HOST ? describe : describe.skip;

suite('firestore.rules — accesso di base', () => {
  it('non autenticato: nega tutto', async () => {
    const seed = await seedMigratedSeason('owner');
    const anon = ctx(null);

    await expectDenied(getDoc(doc(anon, 'teams', seed.id)));
    await expectDenied(getDocs(collection(anon, 'teams')));
    await expectDenied(setDoc(doc(anon, 'teams', 'S-NUOVA'), { ownerId: 'x' }));
  });

  it('autenticato non membro: nega lettura e scrittura di una stagione altrui', async () => {
    const seed = await seedMigratedSeason('owner');
    const altro = ctx('estraneo');

    await expectDenied(getDoc(doc(altro, 'teams', seed.id)));
    await expectDenied(getDocs(collection(altro, 'teams', seed.id, 'players')));
    await expectDenied(setDoc(doc(altro, 'teams', seed.id, 'players', 'p1'), { name: 'X' }));
    await expectDenied(updateDoc(doc(altro, 'teams', seed.id), { name: 'Rubata' }));
    await expectDenied(deleteDoc(doc(altro, 'teams', seed.id, 'players', 'p1')));
  });

  it('staff: legge e scrive i dati di stagione, anche a tre livelli', async () => {
    const { db, id } = await seedMigratedSeason('owner');
    const staff = ctx('staff1');

    await setDoc(doc(staff, 'teams', id, 'players', 'p1'), { name: 'Rossi' });
    await setDoc(doc(staff, 'teams', id, 'matches', 'm1'), { opponent: 'X' });
    // Il gol appena segnato: senza la regola a tre livelli la dashboard si
    // aggiornerebbe ma il salvataggio dell'evento fallirebbe.
    await setDoc(doc(staff, 'teams', id, 'matches', 'm1', 'events', 'e1'), { type: 'goal' });
    await setDoc(doc(staff, 'teams', id, 'sessions', 's1', 'attendance', 'p1'), { present: true });
    await setDoc(doc(staff, 'teams', id, 'matches', 'm1', 'stats', 'p1'), { goals: 1 });
    await expect(getDocs(collection(staff, 'teams', id, 'players'))).resolves.toBeDefined();
  });

  it('membro di una stagione LEGACY (solo sharedWith) conserva l\'accesso', async () => {
    const { id } = await seedLegacySeason('owner', 'S-LEGACY', ['vecchiostaff']);
    const db = ctx('vecchiostaff');
    await expect(getDoc(doc(db, 'teams', id))).resolves.toBeDefined();
  });

  it('owner: può rinominare la stagione', async () => {
    const { db, id } = await seedMigratedSeason('owner');
    await updateDoc(doc(db, 'teams', id), { name: '2026/27', updatedAt: 'x' });
    expect((await getDoc(doc(db, 'teams', id))).data()?.name).toBe('2026/27');
  });

  it('owner: NON può cambiare members, plan, limits, ownerId, sharedWith', async () => {
    const { db, id } = await seedMigratedSeason('owner');

    await expectDenied(updateDoc(doc(db, 'teams', id), { plan: 'staff' }));
    await expectDenied(updateDoc(doc(db, 'teams', id), { limits: { maxPlayers: 999, maxMembers: 99 } }));
    await expectDenied(updateDoc(doc(db, 'teams', id), { ownerId: 'staff1' }));
    await expectDenied(updateDoc(doc(db, 'teams', id), { members: { owner: 'owner' } }));
    await expectDenied(updateDoc(doc(db, 'teams', id), { sharedWith: ['staff1'] }));
  });

  it('rinominare non cancella i campi omessi (hasAll)', async () => {
    const { db, id } = await seedMigratedSeason('owner');
    // updateDoc fa merge, quindi qui si verifica l'altra forma: setDoc
    // riscriverebbe tutto, e senza `hasAll` un set senza `name` passerebbe e
    // cancellerebbe il nome.
    await expectDenied(setDoc(doc(db, 'teams', id), { ownerId: 'owner' }));
  });

  it('staff: NON può cambiare nome, plan, limits, members', async () => {
    const { id } = await seedMigratedSeason('owner');
    const staff = ctx('staff1');
    await expectDenied(updateDoc(doc(staff, 'teams', id), { name: 'Rinominata da staff' }));
    await expectDenied(updateDoc(doc(staff, 'teams', id), { plan: 'coach' }));
    await expectDenied(updateDoc(doc(staff, 'teams', id), { members: { staff1: 'owner' } }));
  });

  it('nessuno crea o cancella una stagione dal client', async () => {
    const db = ctx('owner');
    await expectDenied(setDoc(doc(db, 'teams', 'S-NUOVA'), { ownerId: 'owner' }));
    await expectDenied(addDoc(collection(db, 'teams'), { ownerId: 'owner' }));
  });

  it('nessuno cancella una stagione esistente dal client', async () => {
    const { db, id } = await seedMigratedSeason('owner');
    await expectDenied(deleteDoc(doc(db, 'teams', id)));
  });

  it('nessuno cambia il proprio ruolo applicativo', async () => {
    const db = ctx('giovane');
    await seedDoc('users/giovane', { displayName: 'G', role: 'player' });
    await expectDenied(updateDoc(doc(db, 'users', 'giovane'), { role: 'developer' }));
  });

  it('un utente non legge n�� scrive il documento di un altro', async () => {
    await seedDoc('users/a', { displayName: 'A' });
    const b = ctx('b');
    await expectDenied(getDoc(doc(b, 'users', 'a')));
    await expectDenied(updateDoc(doc(b, 'users', 'a'), { displayName: 'B' }));
  });

  it('un admin (custom claim) legge e cancella utenti', async () => {
    await seedDoc('users/a', { displayName: 'A' });
    const admin = ctx('root', { admin: true });
    await expect(getDoc(doc(admin, 'users', 'a'))).resolves.toBeDefined();
    await expect(deleteDoc(doc(admin, 'users', 'a'))).resolves.toBeUndefined();
  });
});

suite('firestore.rules — giocatori senza tetto', () => {
  // Il tetto e' stato tolto di proposito. Qui si verifica il comportamento
  // REALE: quanti giocatori si possono mettere, senza limite.
  it('su una stagione migrata si creano giocatori liberamente', async () => {
    const { db, id } = await seedMigratedSeason('owner');

    for (let n = 1; n <= 12; n++) {
      await expect(setDoc(doc(db, 'teams', id, 'players', `p${n}`), { name: `G${n}` }))
        .resolves.toBeUndefined();
    }
    // `getDocs` ritorna un QuerySnapshot: il numero di documenti e' `.size`.
    // `toHaveLength` su quello avrebbe fallito anche con tutti e 12 presenti.
    await expect(getDocs(collection(db, 'teams', id, 'players')).then((s) => s.size))
      .resolves.toBe(12);
  });

  it('su una stagione legacy i giocatori si creano senza toccare contatori', async () => {
    const { id } = await seedLegacySeason('owner', 'S-NOLIM');
    const db = ctx('owner');
    await expect(setDoc(doc(db, 'teams', id, 'players', 'p1'), { name: 'Primo' })).resolves.toBeUndefined();
  });

  it('nessuno scrive playerCount dal client', async () => {
    const { db, id } = await seedMigratedSeason('owner');
    await expectDenied(updateDoc(doc(db, 'teams', id), { playerCount: 5 }));
  });

  it('ma il proprietario continua a poter cancellare un giocatore', async () => {
    const { db, id } = await seedMigratedSeason('owner');
    await setDoc(doc(db, 'teams', id, 'players', 'p1'), { name: 'Primo' });
    await expect(deleteDoc(doc(db, 'teams', id, 'players', 'p1'))).resolves.toBeUndefined();
  });
});

suite('firestore.rules — collection solo-server', () => {
  const onlyServer = ['invites', 'rateLimits', 'aiUsage', 'aiCache', 'feedback'];

  for (const nome of onlyServer) {
    it(`${nome}: nega sempre, anche all'admin`, async () => {
      const admin = ctx('root', { admin: true });
      await expectDenied(setDoc(doc(admin, nome, 'x'), { a: 1 }));
      await expectDenied(getDocs(collection(admin, nome)));
      await expectDenied(updateDoc(doc(admin, nome, 'x'), { a: 2 }));
      await expectDenied(deleteDoc(doc(admin, nome, 'x')));
    });
  }

  it('una collection sconosciuta è negata (catch-all)', async () => {
    const db = ctx('owner');
    await expectDenied(setDoc(doc(db, 'nuovaCollection', 'x'), { a: 1 }));
    await expectDenied(getDoc(doc(db, 'nuovaCollection', 'x')));
  });
});

suite('firestore.rules — presence', () => {
  it('un membro scrive il proprio documento di presenza', async () => {
    const { id } = await seedMigratedSeason('owner');
    const staff = ctx('staff1');
    await expect(
      setDoc(doc(staff, 'teams', id, 'presence', 'staff1'), { lastSeen: 1 }),
    ).resolves.toBeUndefined();
  });

  it('un membro NON scrive la presenza di un altro', async () => {
    const { id } = await seedMigratedSeason('owner');
    const staff = ctx('staff1');
    await expectDenied(setDoc(doc(staff, 'teams', id, 'presence', 'owner'), { lastSeen: 1 }));
  });

  it('non si nasconde altro dentro presence', async () => {
    const { id } = await seedMigratedSeason('owner');
    const staff = ctx('staff1');
    await expectDenied(
      setDoc(doc(staff, 'teams', id, 'presence', 'staff1'), { lastSeen: 1, payload: 'segreto' }),
    );
  });

  it('un estraneo non legge la presence della stagione', async () => {
    const { id } = await seedMigratedSeason('owner');
    const altro = ctx('estraneo');
    await expectDenied(getDocs(collection(altro, 'teams', id, 'presence')));
  });
});
