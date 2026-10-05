/**
 * Sposta gli osservati da `users/{uid}/scoutPlayers` a
 * `teams/{seasonId}/scouts`, e le categorie allo stesso modo.
 *
 * PERCHE' SERVE. I documenti al vecchio path sono invisibili all'app: il
 * client legge solo `teams/{seasonId}/scouts` (scout-repository.ts). Un
 * allenatore che aveva creato osservati prima dello spostamento li vede
 * spariti dal pannello, senza che nulla sia stato cancellato.
 *
 * Il percorso di questa migrazione e' citato in `season-collections.ts` da
 * prima che questo file esistesse: quello script non e' mai stato scritto.
 * Ecco.
 *
 * ── Come sceglie la stagione, e perche' e' la parte delicata ──────────────
 * I documenti legacy non portavano `seasonId`: prima gli osservati erano
 * personali, quindi non serviva dire di quale squadra fossero. Ogni utente
 * aveva UNA stagione. Quindi:
 *
 *   1. se il documento ha `seasonId`, si usa quello (e' il fatto, non la
 *      deduzione);
 *   2. altrimenti si usa `users/{uid}/settings/activeSeason`.
 *
 * Il passo 2 e' una SCELTA, non un fatto: se quell'utente ha piu' di una
 * stagione, la stagione attiva e' una preferenza. Per questo lo script
 * RIFIUTA di scrivere in quel caso e lo segnala, invece di indovinare.
 * Spostare 40 osservati nella squadra sbagliata e' peggio che lasciarli
 * dove sono: li vedresti, e potresti accorgertene.
 *
 * ── Idempotente ───────────────────────────────────────────────────────────
 * L'id del documento nuovo e' quello legacy. Rilanciarlo scrive sopra un
 * documento gia' identico e lo dice (`gia' presente`), invece di creare
 * duplicati. Si puo' rilanciare senza paura dopo un errore a meta'.
 *
 * ── NON cancella il vecchio path ───────────────────────────────────────────
 * Copia e basta. Il path legacy resta in `LEGACY_USER_SUBCOLLECTIONS` finche'
 * non hai verificato nell'app che i dati si vedono: e' quello che mantiene
 * "Elimina account" e l'export al completo nel frattempo.
 *
 *   npx tsx scripts/migrate-scout-to-season.ts            # dry-run: NON scrive
 *   npx tsx scripts/migrate-scout-to-season.ts --apply    # scrive
 *
 * Prima: `npx tsx scripts/inspect-legacy.ts` (sola lettura, mostra i numeri
 * e la stagione che ogni utente ha scelto).
 *
 * Credenziali Admin: scarica la chiave dalla console Firebase
 * (Impostazioni progetto → Account di servizio → Genera nuova chiave
 * privata) ed esporta il percorso:
 *
 *   export FIREBASE_SERVICE_ACCOUNT_FILE=~/firebase-admin.json
 *
 * Oppure il JSON su una riga: `export FIREBASE_SERVICE_ACCOUNT='{...}'`.
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

const APPLICA = process.argv.includes('--apply');

/* ── Credenziali ─────────────────────────────────────────────────────────── */

function serviceAccount(): { project_id: string } {
  if (getApps().length) return getApps()[0]!.options.credential as never;

  const daFile = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  const raw = daFile ? readFileSync(daFile, 'utf8') : process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    console.error(
      'Nessuna credenziale Admin.\n' +
        '  Firebase console → Impostazioni progetto → Account di servizio → Genera nuova chiave privata\n' +
        '  export FIREBASE_SERVICE_ACCOUNT_FILE=~/firebase-admin.json',
    );
    process.exit(1);
  }
  try {
    return JSON.parse(raw.trim().replace(/^['"]|['"]$/g, ''));
  } catch {
    console.error('FIREBASE_SERVICE_ACCOUNT non e\' JSON valido.');
    process.exit(1);
  }
}

/**
 * Top-level await non funziona qui: il progetto e' CJS (package.json senza
 * "type": "module"), e `tsx` compila in cjs dove l'await al livello del modulo
 * non e' supportato. Stessa forma di `migrate-backend-v1.ts`: una `main()` e un
 * `.catch()` che esce con codice 1.
 */
async function main(): Promise<void> {
  const sa = serviceAccount();
  initializeApp({ credential: cert(sa as never) });
  const db = getFirestore();

  /* ── Quale stagione per questo utente ────────────────────────────────────── */

  type Doc = FirebaseFirestore.DocumentData;
  type TeamData = { ownerId?: string; members?: Record<string, string>; sharedWith?: string[] };

  type Scelta =
    | { ok: true; seasonId: string; perche: string }
    | { ok: false; motivo: string };

  /**
   * La stagione di destinazione per un utente, con il motivo della scelta.
   *
   * Il caso "piu' di una stagione e nessuna attiva" o "piu' di una stagione
   * con una attiva" sono DIVERSI: il primo e' un blocco, il secondo e' una
   * deduzione esplicita che va detta ad alta voce.
   */
  async function scegliStagione(uid: string, teams: FirebaseFirestore.QueryDocumentSnapshot[]): Promise<Scelta> {
    const attiva = await db.doc(`users/${uid}/settings/activeSeason`).get();
    const attivaId = attiva.exists ? String(attiva.data()?.seasonId ?? '') : '';

    const mie = teams.filter((t) => {
      const d = t.data() as TeamData;
      const members = d.members ?? {};
      return d.ownerId === uid || !!members[uid] || (d.sharedWith ?? []).includes(uid);
    });
    const ids = mie.map((t) => t.id);

    if (attivaId && ids.includes(attivaId)) {
      return {
        ok: true,
        seasonId: attivaId,
        perche:
          ids.length > 1
            ? `stagione attiva salvata (una delle ${ids.length})`
            : 'unica stagione dell\'utente',
      };
    }
    if (attivaId && !ids.includes(attivaId)) {
      return {
        ok: false,
        motivo: `la stagione attiva (${attivaId}) non e\' fra quelle dell'utente: potrebbe essere una stagione cancellata`,
      };
    }
    if (ids.length === 1) return { ok: true, seasonId: ids[0], perche: 'unica stagione dell\'utente' };
    if (ids.length === 0) {
      return { ok: false, motivo: 'nessuna stagione: l\'utente non e\' owner ne\' membro di nessuna squadra' };
    }
    return {
      ok: false,
      motivo: `${ids.length} stagioni (${ids.join(', ')}) e nessuna attiva salvata: non si sceglie per te`,
    };
  }

  /* ── Copia ───────────────────────────────────────────────────────────────── */

  type Esito = 'copiato' | 'gia-presente' | 'saltato';

  async function copia(
    da: FirebaseFirestore.CollectionReference,
    a: FirebaseFirestore.CollectionReference,
    dati: Doc,
    seasonId: string,
    uid: string,
  ): Promise<Esito> {
    const esistente = await a.doc(da.id).get();
    const daScrivere: Doc = {
      ...dati,
      id: da.id,
      // Scritti dal server, non dall'utente. `teamOwnerId` e' quello che le
      // rules confrontano con request.auth.uid per autorizzare la creazione di
      // nuovi osservati su questa stagione; `seasonId` serve a "Elimina
      // account". Senza, il documento spostato sarebbe mezzo orfano.
      teamOwnerId: (dati.teamOwnerId as string) ?? uid,
      seasonId,
    };
    delete daScrivere.userId; // campo legacy: la sua funzione era "di chi e\'", ora e\' teamOwnerId

    if (esistente.exists) {
      // Merge solo dei campi che mancano: non sovrascrivere un documento che
      // qualcuno ha gia' modificato nell'app.
      const mancanti: Doc = {};
      for (const [k, v] of Object.entries(daScrivere)) {
        if (!(k in esistente.data()!)) mancanti[k] = v;
      }
      if (Object.keys(mancanti).length === 0) return 'gia-presente';
      if (APPLICA) await esistente.ref.set(mancanti, { merge: true });
      return 'copiato';
    }

    if (APPLICA) await a.doc(da.id).set(daScrivere);
    return 'copiato';
  }

  /* ── Esecuzione ──────────────────────────────────────────────────────────── */

  console.log(
    `\nMigrazione osservati ${APPLICA ? '— SCRIVO SUL DATABASE' : '— DRY-RUN, non scrivo'}\nProgetto: ${sa.project_id}\n`,
  );

  const usersSnap = await db.collection('users').get();
  const teamsSnap = await db.collection('teams').get();
  const teams = teamsSnap.docs;

  const conto: Record<Esito, number> = { copiato: 0, 'gia-presente': 0, saltato: 0 };
  const bloccati: string[] = [];
  let righe = 0;

  for (const u of usersSnap.docs) {
    const players = await u.ref.collection('scoutPlayers').get();
    const cats = await u.ref.collection('scoutCategories').get();
    if (players.empty && cats.empty) continue;

    const scelta = await scegliStagione(u.id, teams);
    console.log(`\n  ${u.id}  (${players.size} osservati, ${cats.size} categorie)`);

    if (!scelta.ok) {
      conto.saltato += players.size + cats.size;
      bloccati.push(`${u.id}: ${scelta.motivo}`);
      console.log(`    BLOCCATO — ${scelta.motivo}`);
      console.log(`    Fai prima: accedi all'app con questo account e scegli la stagione, poi rilancia.`);
      continue;
    }

    console.log(`    destinazione: teams/${scelta.seasonId}  (${scelta.perche})`);

    // ATTENZIONE, e' un errore gia' fatto: l'Admin SDK ha `collection()` che
    // prende UN argomento, il path intero. La firma a tre argomenti
    // (`collection(db, 'teams', id, 'scouts')`) e' del CLIENT SDK: compila con
    // i tipi del client e a runtime lancia. Per questo `scripts/` e' escluso da
    // `tsc --noEmit` e va type-checkato con `tsconfig.scripts.json`.
    const percorso = (c: string) => db.collection(`teams/${scelta.seasonId}/${c}`);

    for (const d of players.docs) {
      const esito = await copia(
        u.ref.collection('scoutPlayers'),
        percorso('scouts'),
        d.data(),
        scelta.seasonId,
        u.id,
      );
      conto[esito]++;
      righe++;
      if (esito === 'copiato') console.log(`      ${esito.padEnd(12)} ${d.id}`);
    }

    for (const d of cats.docs) {
      const esito = await copia(
        u.ref.collection('scoutCategories'),
        percorso('scoutCategories'),
        d.data(),
        scelta.seasonId,
        u.id,
      );
      conto[esito]++;
      righe++;
      if (esito === 'copiato') console.log(`      ${esito.padEnd(12)} ${d.id}`);
    }
  }

  console.log(`\n─── riepilogo ───`);
  console.log(`  copiati:        ${conto.copiato}`);
  console.log(`  gia' presenti:  ${conto['gia-presente']}`);
  console.log(`  saltati:        ${conto.saltato}`);
  console.log(`  documenti letti: ${righe}`);

  if (bloccati.length) {
    console.log(`\n  ${bloccati.length} utente/i bloccati:`);
    for (const b of bloccati) console.log(`    - ${b}`);
  }

  if (!APPLICA) {
    console.log('\n  Questo era un dry-run: NESSUNA scrittura. Rilancia con --apply per scrivere.\n');
  } else {
    console.log('\n  Scritto. NON ho cancellato niente al vecchio path.');
    console.log('  Apri l\'app e controlla gli osservati PRIMA di toccare LEGACY_USER_SUBCOLLECTIONS.\n');
  }
}

main().catch((error) => {
  console.error('Migrazione fallita:', error);
  process.exit(1);
});
