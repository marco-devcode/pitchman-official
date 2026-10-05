/**
 * Ispezione dei dati legacy, SOLO LETTURA.
 *
 * Risponde a due domande in un comando, e le due hanno risposte diverse:
 *
 *   1. Gli osservati sono ancora sotto `users/{uid}/scoutPlayers`? Il client
 *      non li legge piu' da quel path, quindi se ci sono documenti li l'app
 *      non li mostra: e' la causa dei "osservati spariti".
 *   2. `migrate-backend-v1.ts` e' stato eseguito? Si vede dai campi che
 *      scrive: un documento `teams/{id}` con `members`, `memberUids`, `plan` e
 *      `limits` e' stato migrato (o e' nato dopo la migrazione); senza quei
 *      campi il documento e' ancora nella forma vecchia.
 *
 * NON SCRIVE NULLA. Non ha bisogno di conferma perche' non modifica niente, e
 * va eseguito per primo: il dry-run della migrazione usa questi numeri.
 *
 *   npx tsx scripts/inspect-legacy.ts
 *
 * Per le credenziali vedi `migrate-scout-to-season.ts`: accetta
 * `FIREBASE_SERVICE_ACCOUNT` (JSON su una riga) o `FIREBASE_SERVICE_ACCOUNT_FILE`
 * (percorso del file scaricato dalla console Firebase).
 */

import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';

/* ── Credenziali ─────────────────────────────────────────────────────────── */

function serviceAccount(): { project_id: string; [k: string]: string } {
  if (getApps().length) return getApps()[0]!.options.credential as never;

  const daFile = process.env.FIREBASE_SERVICE_ACCOUNT_FILE;
  const raw = daFile
    ? readFileSync(daFile, 'utf8')
    : process.env.FIREBASE_SERVICE_ACCOUNT;

  if (!raw) {
    console.error(
      'Nessuna credenziale Admin.\n' +
        '  Scarica la chiave: Firebase console → Impostazioni progetto → Account di servizio → Genera nuova chiave privata.\n' +
        '  Poi:  export FIREBASE_SERVICE_ACCOUNT_FILE=~/firebase-admin.json',
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

  /* ── Leggiamo tutto quello che ci serve, e lo teniamo in memoria ─────────── */

  const usersSnap = await db.collection('users').get();
  const teamsSnap = await db.collection('teams').get();

  console.log(`\nProgetto: ${sa.project_id}`);
  console.log(`Utenti: ${usersSnap.size} · Stagioni: ${teamsSnap.size}\n`);

  /* ── 1. Osservati legacy ─────────────────────────────────────────────────── */

  console.log('═══ 1. OSSERVATI SOTTO users/{uid} (il path che il client non legge) ═══');

  let legacyScouts = 0;
  let legacyCategories = 0;

  for (const u of usersSnap.docs) {
    legacyScouts += (await u.ref.collection('scoutPlayers').get()).size;
    legacyCategories += (await u.ref.collection('scoutCategories').get()).size;
  }

  console.log(`\n  scoutPlayers     legacy: ${legacyScouts}`);
  console.log(`  scoutCategories  legacy: ${legacyCategories}\n`);

  if (legacyScouts === 0 && legacyCategories === 0) {
    console.log('  → Niente da migrare su questo path.\n');
  } else {
    // Per utente: quale stagione ha scelto. E' la domanda che decide dove
    // finisce ogni documento, quindi va mostrata PRIMA di scrivere.
    console.log('  Per utente (quanti documenti, e in quale stagione andrebbero):\n');
    for (const u of usersSnap.docs) {
      const players = await u.ref.collection('scoutPlayers').get();
      const cats = await u.ref.collection('scoutCategories').get();
      if (players.empty && cats.empty) continue;

      const attiva = await u.ref.collection('settings').doc('activeSeason').get();
      const seasonId = attiva.exists ? String(attiva.data()?.seasonId ?? '') : '';

      // Quante stagioni possiede o vede questo utente: se piu' di una, la
      // stagione attiva e' una SCELTA, non un fatto, e va detto.
      const owner = teamsSnap.docs.filter(
        (t) => (t.data() as { ownerId?: string }).ownerId === u.id,
      );
      const condivise = teamsSnap.docs.filter(
        (t) => ((t.data() as { sharedWith?: string[] }).sharedWith ?? []).includes(u.id),
      );

      console.log(`    ${u.id}`);
      console.log(`      osservati: ${players.size} · categorie: ${cats.size}`);
      console.log(`      stagione attiva salvata: ${seasonId || '(NESSUNA)'}`);
      console.log(
        `      stagioni: owner=${owner.length} condivise=${condivise.length}` +
          (owner.length + condivise.length > 1 ? '   ← piu\' di una: controlla' : ''),
      );
      const senzaSeason = [...players.docs, ...cats.docs].filter(
        (d) => !(d.data() as { seasonId?: string }).seasonId,
      ).length;
      if (senzaSeason) {
        console.log(`      documenti SENZA seasonId: ${senzaSeason} → useranno la stagione attiva`);
      }
      console.log('');
    }
  }

  /* ── 2. Stato di migrate-backend-v1 ──────────────────────────────────────── */

  console.log('═══ 2. migrate-backend-v1: E\' STATO ESEGUITO? ═══\n');

  type TeamData = {
    ownerId?: string;
    userId?: string;
    members?: Record<string, string>;
    memberUids?: string[];
    plan?: string;
    limits?: { maxPlayers: number | null; maxMembers: number };
    sharedWith?: string[];
  };

  let migrati = 0;
  let daMigrare = 0;

  for (const t of teamsSnap.docs) {
    const d = t.data() as TeamData;
    const haTutto =
      !!d.ownerId &&
      !!d.members &&
      Array.isArray(d.memberUids) &&
      typeof d.plan === 'string' &&
      !!d.limits;
    const manca: string[] = [];
    if (!d.ownerId) manca.push('ownerId');
    if (!d.members) manca.push('members');
    if (!Array.isArray(d.memberUids)) manca.push('memberUids');
    if (typeof d.plan !== 'string') manca.push('plan');
    if (!d.limits) manca.push('limits');

    if (haTutto) {
      migrati++;
      console.log(
        `  ✓ ${t.id}  plan=${d.plan} limits.maxMembers=${d.limits!.maxMembers}` +
          ` membri=${Object.keys(d.members!).length}`,
      );
    } else {
      daMigrare++;
      console.log(`  ✗ ${t.id}  manca: ${manca.join(', ')}  (piano attuale ricade su "free")`);
    }
  }

  console.log(`\n  Migrate: ${migrati} · Da migrare: ${daMigrare}\n`);

  if (daMigrare > 0) {
    console.log('  → Per migrare: npx tsx scripts/migrate-backend-v1.ts --apply');
    console.log('    (senza --apply non scrive: il dry-run e\' il default)\n');
  }
  if (migrati > 0 && daMigrare === 0) {
    console.log('  → Tutte le stagioni hanno i campi. migrate-backend-v1 ha fatto il suo lavoro.\n');
  }

  /* ── 3. Cosa c\'e\' gia\' sul path nuovo ───────────────────────────────────── */

  console.log('═══ 3. OSSERVATI GIA\' SU teams/{seasonId}/scouts ═══\n');
  for (const t of teamsSnap.docs) {
    const p = await t.ref.collection('scouts').get();
    const c = await t.ref.collection('scoutCategories').get();
    if (p.empty && c.empty) continue;
    console.log(`  ${t.id}: ${p.size} osservati, ${c.size} categorie`);
  }
  console.log('');
}

main().catch((error) => {
  console.error('Migrazione fallita:', error);
  process.exit(1);
});
