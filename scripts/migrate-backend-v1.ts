/**
 * Migrazione al backend v1: owner, members, memberUids, plan, limits.
 *
 *   npx tsx scripts/migrate-backend-v1.ts --dry-run
 *   npx tsx scripts/migrate-backend-v1.ts
 *   npx tsx scripts/migrate-backend-v1.ts --reconcile-counts
 *
 * IDEMPOTENTE: rieseguito due volte non cambia niente la seconda volta, e lo
 * dice (`invariata`) invece di riscrivere. Su un dato che non tocca non si fa
 * nessuna scrittura: e' il motivo per cui si puo' rilanciare senza paura dopo
 * un errore a meta'.
 *
 * `--dry-run` e' IL DEFAULT per la sicurezza: senza `--apply` non scrive. Il
 * flag per scrivere si chiama `--apply` e non `--no-dry-run`, cosi' il comando
 * sbagliato e' quello che non fa niente.
 *
 * PERCHE' ESISTE UNA FASE DI MIGRAZIONE E NON SI FA SUBITO. Le regole nuove
 * accettano tre fonti di appartenenza (`ownerId`, `members`, `sharedWith`):
 * durante la finestra tra la migrazione e la pubblicazione, gli utenti che
 * hanno ancora `sharedWith` continuano a vedere la squadra. Se le regole
 * accettassero solo `members`, nel giorno in cui andassero online gli utenti
 * con documenti non migrati perderebbero l'accesso alla propria stagione — di
 * colpo, senza errore che dica perche'.
 */
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';

type Season = {
  id: string;
  ownerId?: string;
  userId?: string;
  name?: string;
  sharedWith?: string[];
  members?: Record<string, 'owner' | 'staff'>;
  memberUids?: string[];
  plan?: string;
  limits?: { maxPlayers: number | null; maxMembers: number };
  playerCount?: number;
};

const BETA_LIMITS = { maxPlayers: null, maxMembers: 5 } as const;
const DAY_MS = 24 * 3600 * 1000;
const BATCH_LIMIT = 400;

type Azione =
  | { tipo: 'aggiorna'; id: string; campi: Record<string, unknown> }
  | { tipo: 'invito'; id: string; dati: Record<string, unknown> }
  | { tipo: 'uguale'; id: string }
  | { tipo: 'nota'; testo: string };

function appAdmin(): App {
  if (getApps().length) return getApps()[0]!;

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) {
    console.error(
      "FIREBASE_SERVICE_ACCOUNT non definita.\n" +
        "La migrazione usa l'Admin SDK e ha bisogno delle credenziali di servizio.",
    );
    process.exit(1);
  }

  // La chiave privata arriva spesso con i `\n` letterali, copiati dal valore
  // JSON dentro una variabile d'ambiente. Senza questo replace la firma non e'
  // valida e l'errore e' illeggibile.
  const sa = JSON.parse(raw.trim().replace(/^['"]|['"]$/g, ''));
  if (typeof sa.private_key === 'string') {
    sa.private_key = sa.private_key.replace(/\\n/g, '\n');
  }

  return initializeApp({ credential: cert(sa), projectId: sa.project_id });
}

const app = appAdmin();
const db = getFirestore(app);
const auth = getAuth(app);

async function contaGiocatori(seasonId: string): Promise<number> {
  const snap = await db.collection('teams').doc(seasonId).collection('players').count().get();
  return snap.data().count;
}

/** Le uid che risultano membri, da tutte e tre le fonti. */
function membri(season: Season): { members: Record<string, 'owner' | 'staff'>; memberUids: string[] } {
  const members: Record<string, 'owner' | 'staff'> = {};

  if (season.ownerId) members[season.ownerId] = 'owner';
  else if (season.userId) members[season.userId] = 'owner';

  for (const [uid, ruolo] of Object.entries(season.members ?? {})) {
    members[uid] = ruolo === 'owner' ? 'owner' : 'staff';
  }

  for (const uid of season.sharedWith ?? []) {
    if (!(uid in members)) members[uid] = 'staff';
  }
  for (const uid of season.memberUids ?? []) {
    if (!(uid in members)) members[uid] = 'staff';
  }

  return { members, memberUids: Object.keys(members) };
}

function confronta(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((v, i) => confronta(v, b[i]));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) =>
      confronta((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]),
    );
  }
  return a === b;
}

async function migraStagioni(applica: boolean): Promise<Azione[]> {
  const snap = await db.collection('teams').get();
  const azioni: Azione[] = [];

  for (const docRef of snap.docs) {
    const season = { ...(docRef.data() as Season), id: docRef.id };

    if (!season.ownerId && !season.userId) {
      azioni.push({ tipo: 'nota', testo: `${docRef.id}: nessun ownerId, saltata` });
      continue;
    }

    // Un contatore che non corrisponde ai giocatori reali e' il caso da
    // riparare. Non lo riallineiamo qui di proposito: la migrazione non deve
    // dipendere da una `count()` per ogni stagione, perche' durante il
    // rilascio il client scrive ancora e il numero sarebbe subito falso.
    // `--reconcile-counts` lo fa apposta e quando nessuno scrive.
    const { members, memberUids } = membri(season);
    const campi: Record<string, unknown> = {
      ownerId: season.ownerId ?? season.userId,
      members,
      memberUids,
      plan: season.plan ?? 'beta',
      limits: season.limits ?? { ...BETA_LIMITS },
    };

    const daScrivere: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(campi)) {
      if (!confronta((season as Record<string, unknown>)[k], v)) daScrivere[k] = v;
    }

    if (Object.keys(daScrivere).length === 0) {
      azioni.push({ tipo: 'uguale', id: docRef.id });
      continue;
    }

    if (applica) {
      await docRef.ref.update(daScrivere);
    }
    azioni.push({ tipo: 'aggiorna', id: docRef.id, campi: daScrivere });
  }

  return azioni;
}

/**
 * Codici di invito per le stagioni gia' condivise.
 *
 * Chi ha gia' distribuito un codice (`S-XXXXX`, il formato vecchio) non deve
 * restare bloccato: senza questo, alla pubblicazione delle regole nuove chi
 * aveva condiviso la squadra con dei colleghi non potrebbe piu' farceli entrare.
 *
 * I codici legacy scadono fra 30 giorni: abbastanza per chi li ha gia' passati,
 * abbastanza presto da non lasciare vivi per sempre dei codici che nessuno ha
 * mai usato e che potrebbero essere finiti su una lavagna pubblica.
 */
async function migraInviti(applica: boolean): Promise<Azione[]> {
  const snap = await db.collection('teams').get();
  const azioni: Azione[] = [];
  const now = new Date();
  const scadenza = new Date(now.getTime() + 30 * DAY_MS);

  for (const docRef of snap.docs) {
    const season = docRef.data() as Season;
    const condivisi = season.sharedWith ?? [];
    if (condivisi.length === 0) continue;

    const code = docRef.id;
    const esiste = await db.collection('invites').doc(code).get();
    if (esiste.exists) {
      azioni.push({ tipo: 'uguale', id: code });
      continue;
    }

    const dati = {
      code,
      seasonId: docRef.id,
      role: 'staff' as const,
      createdBy: season.ownerId ?? season.userId ?? 'sconosciuto',
      createdAt: Timestamp.fromDate(now),
      expiresAt: Timestamp.fromDate(scadenza),
      // Quanti lo hanno gia' usato: un codice con `usedCount` gia' a 1 non
      // deve lasciar entrare due persone, altrimenti il tetto membri si
      // aggira da solo.
      maxUses: Math.max(1, condivisi.length),
      usedCount: condivisi.length,
      usedBy: condivisi,
      revoked: false,
      legacy: true,
    };

    if (applica) {
      await db.collection('invites').doc(code).set(dati);
    }
    azioni.push({ tipo: 'invito', id: code, dati });
  }

  return azioni;
}

/** Ricalcola `playerCount` sul numero reale di giocatori. */
async function riconciliaContatori(applica: boolean): Promise<Azione[]> {
  const snap = await db.collection('teams').get();
  const azioni: Azione[] = [];

  for (const docRef of snap.docs) {
    const reale = await contaGiocatori(docRef.id);
    const dichiarato = (docRef.data() as Season).playerCount;

    if (dichiarato === reale) {
      azioni.push({ tipo: 'uguale', id: docRef.id });
      continue;
    }
    if (applica) await docRef.ref.update({ playerCount: reale });
    azioni.push({
      tipo: 'aggiorna',
      id: docRef.id,
      campi: { playerCount: `${dichiarato ?? 'assente'} -> ${reale}` },
    });
  }

  return azioni;
}

function riassumi(azioni: Azione[]) {
  const aggiorna = azioni.filter((a) => a.tipo === 'aggiorna');
  const inviti = azioni.filter((a) => a.tipo === 'invito');
  const uguale = azioni.filter((a) => a.tipo === 'uguale');
  const note = azioni.filter((a) => a.tipo === 'nota');

  console.log(`\n  ${aggiorna.length} da aggiornare, ${inviti.length} inviti da creare, ` +
              `${uguale.length} invariati, ${note.length} saltati.`);
  return { aggiorna, inviti, uguale, note };
}

async function main() {
  const argv = process.argv.slice(2);
  const applica = argv.includes('--apply');
  const soloConti = argv.includes('--reconcile-counts');
  const unknown = argv.filter(
    (a) => !['--apply', '--dry-run', '--reconcile-counts', '--help'].includes(a),
  );

  if (unknown.length) {
    console.error(`Argomenti sconosciuti: ${unknown.join(', ')}`);
    process.exit(1);
  }

  if (argv.includes('--help')) {
    console.log(
      "Uso: npx tsx scripts/migrate-backend-v1.ts [--dry-run] [--apply] [--reconcile-counts]\n" +
        "  --dry-run              mostra cosa cambierebbe (predefinito, non scrive)\n" +
        "  --apply                scrive\n" +
        "  --reconcile-counts     ricalcola solo playerCount sul numero reale",
    );
    return;
  }

  const azioni: Azione[] = [];

  if (soloConti) {
    console.log('\nRiconciliazione dei contatori giocatori');
    azioni.push(...(await riconciliaContatori(applica)));
  } else {
    console.log('\nStagioni');
    azioni.push(...(await migraStagioni(applica)));

    console.log('\nCodici invito dalle stagioni condivise');
    azioni.push(...(await migraInviti(applica)));
  }

  const { aggiorna, inviti, uguale, note } = riassumi(azioni);

  console.log(`\n  Modalita': ${applica ? 'SCRIVERE' : 'DRY RUN (nessuna scrittura)'}`);
  if (!applica) {
    console.log('  Per scrivere davvero: aggiungi --apply\n');
  }

  for (const a of aggiorna.slice(0, 20)) {
    if (a.tipo !== 'aggiorna') continue;
    const campi = Object.entries(a.campi)
      .map(([k, v]) => `${k}=${Array.isArray(v) ? `${v.length} elementi` : JSON.stringify(v)}`)
      .join(', ');
    console.log(`  ~ ${a.id}: ${campi}`);
  }
  for (const a of inviti.slice(0, 20)) {
    if (a.tipo !== 'invito') continue;
    console.log(`  + invito ${a.id} -> stagione ${String(a.dati.seasonId)} ` +
                `(${String(a.dati.maxUses)} usi, scade il ${(a.dati.expiresAt as Timestamp).toDate().toISOString().slice(0, 10)})`);
  }
  for (const a of note) {
    if (a.tipo === 'nota') console.log(`  ! ${a.testo}`);
  }

  if (aggiorna.length > 20) console.log(`  ... e altre ${aggiorna.length - 20}`);
  if (inviti.length > 20) console.log(`  ... e altri ${inviti.length - 20}`);

  // La migrazione tocca solo `teams` e scrive in `invites`. Nessuna regola nuova
  // e' necessaria per eseguirla, perche' l'Admin SDK bypassa le regole: e' il
  // punto per cui si puo' migrare PRIMA di pubblicarle.
  if (applica) {
    console.log(`\n  Fatto. ${aggiorna.length + inviti.length} documenti scritti.\n`);
  }
}

void auth;
main().catch((error) => {
  console.error('Migrazione fallita:', error);
  process.exit(1);
});