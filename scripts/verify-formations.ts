/**
 * Dopo il refactor i RUOLI hanno una sola copia, quindi non c'e' piu' niente da
 * confrontare: `FORMATION_ROLES` in types e' lo stesso oggetto di
 * `FORMATION_SLOT_ROLES`. Il confronto serve adesso come guardia contro un
 * futuro REINTRODUZIONE della copia — se qualcuno reintroduce una tabella
 * letterale in types, questa verifica lo dice.
 *
 * Le COORDINATE restano due tabelle distinte e devono restarlo:
 *
 *   RUOLI
 *     lineup-mapping.FORMATION_POSITIONS  -> string[]
 *     types.FORMATION_ROLES              -> PlayerRole[]
 *
 *   COORDINATE
 *     lineup-mapping.FORMATION_COORDINATES -> {top, left} numerici
 *     types.FORMATION_POSITIONS            -> {top,left} stringhe "90%"
 *
 * Questo script dice se sono davvero uguali, e in quale dei due moduli e'
 * sbagliato il primo che differisce. Non assume: verifica, con l'output.
 */
import { FORMATION_SLOT_ROLES, FORMATION_COORDINATES as COORD_LM } from '../src/lib/lineup-mapping';
import { FORMATION_ROLES, FORMATION_SLOT_COORDS as COORD_TYPES } from '../src/lib/types';
import { MATCH_FORMATIONS } from '../src/lib/formation-modules';

let problemi = 0;

/** Confronta i due array di ruoli, modulo il fatto che i tipi sono stringhe. */
console.log('=== RUOLI: una sola copia, non due tavole');
for (const f of MATCH_FORMATIONS) {
  const a: string[] | undefined = FORMATION_SLOT_ROLES[f];
  const b: string[] | undefined = FORMATION_ROLES[f];
  if (!a || !b) {
    console.log(`  ${f}: manca in ${!a ? 'lineup-mapping' : 'types'}`);
    problemi++;
    continue;
  }
  if (a.length !== b.length) {
    console.log(`  ${f}: LUNGHEZZE DIVERSE ${a.length} vs ${b.length}`);
    console.log(`     lineup-mapping: ${JSON.stringify(a)}`);
    console.log(`     types:         ${JSON.stringify(b)}`);
    problemi++;
    continue;
  }
  const diff = a.findIndex((r, i) => r !== b[i]);
  if (diff >= 0) {
    console.log(`  ${f}: DIVERSO all'indice ${diff}: "${a[diff]}" contro "${b[diff]}"`);
    problemi++;
  }
}
if (problemi === 0) console.log('  tutti i ruoli coincidono, voce per voce');

/** Le coordinate sono le stesse ma in unita' diverse: numero contro "90%". */
console.log('\n=== COORDINATE: lineup-mapping.FORMATION_COORDINATES vs types.FORMATION_POSITIONS');
const parsePct = (s: string): number => parseFloat(s.replace('%', '').trim());
let coordOk = 0;
for (const f of MATCH_FORMATIONS) {
  const a = COORD_LM[f];
  const b = COORD_TYPES[f];
  if (!a || !b) {
    console.log(`  ${f}: manca in ${!a ? 'lineup-mapping' : 'types'}`);
    problemi++;
    continue;
  }
  if (a.length !== b.length) {
    console.log(`  ${f}: LUNGHEZZE DIVERSE ${a.length} vs ${b.length}`);
    problemi++;
    continue;
  }
  const diff = a.findIndex((c, i) => {
    const d = b[i];
    return Math.abs(c.top - parsePct(d.top)) > 0.01 || Math.abs(c.left - parsePct(d.left)) > 0.01;
  });
  if (diff >= 0) {
    console.log(`  ${f}: DIVERSO all'indice ${diff}: ${JSON.stringify(a[diff])} contro ${JSON.stringify(b[diff])}`);
    problemi++;
  } else {
    coordOk++;
  }
}
console.log(`  ${coordOk}/${MATCH_FORMATIONS.length} formazioni hanno le stesse coordinate`);

console.log(`\n${problemi === 0 ? 'NESSUNA DIVERGENZA' : problemi + ' DIVERGENZE'}`);