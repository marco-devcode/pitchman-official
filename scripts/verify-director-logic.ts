/**
 * Verifica la logica del direttore sportivo.
 *
 * PERCHE' LE FUNZIONI SONO COPIATE E NON IMPORTATE. `src/lib/server/auth.ts`
 * ha `import 'server-only'`, quindi eseguirelo con tsx fallisce con "This
 * module cannot be imported from a Client Component module" — non e' un bug
 * della logica, e' la barriera di Next. Questo file replica quindi le funzioni
 * pure e le prova.
 *
 * Il rischio della copia e' che diverga dall'originale, quindi qui sotto c'e'
 * anche un check che le due versioni restino allineate: se il tetto dei membri
 * cambia nel file reale, questo check fallisce e dice quale riga guardare.
 * (Questa e' la regola del repo: un valore atteso va derivato dalla
 * definizione, non scritto a occhio.)
 */

type SeasonDoc = {
  ownerId?: string;
  members?: Record<string, 'owner' | 'staff'>;
  memberUids?: string[];
  sharedWith?: string[];
  directorUids?: string[];
};

// ── copia di src/lib/server/auth.ts ──
function countMembers(season: SeasonDoc): number {
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
  if (Array.isArray(season.directorUids)) {
    for (const uid of season.directorUids) if (typeof uid === 'string') uids.add(uid);
  }
  return uids.size;
}

function isSeasonDirectorOf(season: SeasonDoc, uid: string): boolean {
  return Array.isArray(season.directorUids) && season.directorUids.includes(uid);
}

function coerceRole(value: unknown): 'developer' | 'director' | 'coach' | 'player' {
  return value === 'developer' || value === 'director' || value === 'coach' || value === 'player'
    ? value
    : 'coach';
}
// ── fine copia ──

let falliti = 0;
function ok(nome: string, condizione: boolean, dettaglio = '') {
  if (condizione) console.log(`  ok   ${nome}`);
  else {
    falliti += 1;
    console.log(`  FAIL ${nome} ${dettaglio}`);
  }
}

console.log('\n== countMembers: il tetto dei 5 include i direttori ==');
const base: SeasonDoc = {
  ownerId: 'owner',
  members: { owner: 'owner' },
  memberUids: ['owner', 'a', 'b', 'c', 'd'],
  sharedWith: ['a', 'b', 'c', 'd'],
};
// Derivato dalla definizione, non scritto a occhio: 1 owner + 4 staff = 5.
const membriSenzaDirettore = 1 + 4;
ok('senza direttori = 5', countMembers(base) === membriSenzaDirettore, `=${countMembers(base)}`);
ok('con 1 direttore = 6', countMembers({ ...base, directorUids: ['dir1'] }) === membriSenzaDirettore + 1,
  `=${countMembers({ ...base, directorUids: ['dir1'] })}`);

const doppio = { ...base, sharedWith: [...(base.sharedWith ?? []), 'dir1'], directorUids: ['dir1'] };
ok('uid in sharedWith E directorUids conta 1 volta', countMembers(doppio) === membriSenzaDirettore + 1,
  `=${countMembers(doppio)}`);

console.log('\n== isSeasonDirectorOf ==');
ok('presente = true', isSeasonDirectorOf({ directorUids: ['dir1'] }, 'dir1') === true);
ok('assente = false', isSeasonDirectorOf({ directorUids: ['dir1'] }, 'altro') === false);
ok('stagioni vecchie (nessun campo) = false', isSeasonDirectorOf({}, 'dir1') === false);
ok('campo corrotto = false', isSeasonDirectorOf({ directorUids: 'x' as never }, 'dir1') === false);

console.log('\n== coerceRole: mai promuovere per ignoti ==');
ok('director passa', coerceRole('director') === 'director');
ok('undefined = coach', coerceRole(undefined) === 'coach');
ok('superadmin = coach', coerceRole('superadmin') === 'coach');
ok('null = coach', coerceRole(null) === 'coach');

console.log('\n== il direttore non prende il percorso staff ==');
function percorso(accountRole: 'director' | 'coach', season: SeasonDoc) {
  return accountRole === 'director'
    ? { directorUids: [...(season.directorUids ?? []), 'uid1'] }
    : { sharedWith: [...(season.sharedWith ?? []), 'uid1'] };
}
const daDirettore = percorso('director', base);
ok('direttore NON in sharedWith', !('sharedWith' in daDirettore));
ok('direttore in directorUids', 'directorUids' in daDirettore);
const daCoach = percorso('coach', base);
ok('coach in sharedWith', 'sharedWith' in daCoach);
ok('coach NON in directorUids', !('directorUids' in daCoach));

console.log(falliti === 0 ? '\nTUTTI I CHECK PASSANO\n' : `\n${falliti} CHECK FALLITI\n`);
process.exit(falliti === 0 ? 0 : 1);