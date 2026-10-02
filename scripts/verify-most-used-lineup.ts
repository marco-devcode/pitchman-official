/**
 * Verifica che la formazione tipo non ripeta mai lo stesso giocatore.
 * Eseguito a mano (tsx), non jest: il progetto non ha un runner ts affidabile
 * su questo host.
 */
import { computeMostUsedLineup } from '../src/lib/most-used-lineup';

type M = any;

const match = (id: string, formation: string, starters: string[]): M => ({ id, formation, starters });

// Caso 1: lo stesso DC e' il piu' presente in DUE slot centrali.
// Il 4-4-2 ha due DC legittimi (slot 2 e 3): se lo stesso giocatore e' il
// piu' presente in entrambi, deve finire in uno solo e l'altro slot prende il
// secondo classificato.
const casoDC: M[] = [
    match('m1', '4-4-2', ['POR1', 'TS1', 'DCX', 'DCX', 'TD1', 'AS1', 'CS1', 'CD1', 'AD1', 'AT1', 'AT2']),
    match('m2', '4-4-2', ['POR1', 'TS1', 'DCX', 'DCX', 'TD1', 'AS1', 'CS1', 'CD1', 'AD1', 'AT1', 'AT2']),
    match('m3', '4-4-2', ['POR1', 'TS1', 'DCX', 'DCX', 'TD1', 'AS1', 'CS1', 'CD1', 'AD1', 'AT1', 'AT2']),
    // DCY ha giocato piu' volte nello slot 3 che nello slot 2: unico caso in cui
    // il greedy deve scambiare i due centrali.
    match('m4', '4-4-2', ['POR1', 'TS1', 'DCX', 'DCY', 'TD1', 'AS1', 'CS1', 'CD1', 'AD1', 'AT1', 'AT2']),
];

// Caso 2: un giocatore che ha coperto piu' ruoli (DC e TS)
const casoRuoli: M[] = [
    match('m1', '3-5-2', ['POR1', 'TSX', 'DC1', 'DC2', 'DC3', 'ASA1', 'CS1', 'CDC1', 'CD1', 'ADA1', 'ATT1', 'ATT2']),
    match('m2', '3-5-2', ['POR1', 'TSX', 'DC1', 'DCX', 'DC3', 'ASA1', 'CS1', 'CDC1', 'CD1', 'ADA1', 'ATT1', 'ATT2']),
];

const nomi: Record<string, string> = Object.fromEntries(
    ['POR1', 'TS1', 'TSX', 'DCX', 'DCY', 'DC1', 'DC2', 'DC3', 'TD1', 'AS1', 'CS1', 'CD1', 'AD1', 'AT1', 'AT2',
        'ASA1', 'CDC1', 'ADA1', 'ATT1', 'ATT2'].map((n) => [n, n]),
);

let fail = 0;
function check(nome: string, cond: boolean, dettaglio: string) {
    if (cond) console.log(`ok   ${nome}`);
    else { console.error(`FAIL ${nome}: ${dettaglio}`); fail++; }
}

for (const [nome, matches] of [['DC in due slot', casoDC], ['ruoli multipli', casoRuoli]] as const) {
    const res = computeMostUsedLineup(matches as any, (m: any) => ({ matchId: m.id, formation: m.formation, starters: m.starters, substitutes: [] }), (pid: string) => nomi[pid]);
    if (!res) { console.error(`FAIL ${nome}: risultato null`); fail++; continue; }
    const ids = res.starters.map((s) => s.playerId).filter(Boolean);
    const dup = ids.filter((id, i) => ids.indexOf(id) !== i);
    check(`${nome}: nessun giocatore duplicato`, dup.length === 0, `duplicati: ${dup.join(', ')}`);
    check(`${nome}: 11 slot`, res.starters.length === 11, `slot: ${res.starters.length}`);
    console.log(`     ${nome} -> ${res.formation} [${res.starters.map((s) => s.name).join(' | ')}] apps=${res.apps}`);
}

// Il caso specifico: DCX doveva stare in UN solo slot, l'altro preso da DCY
const res1 = computeMostUsedLineup(casoDC as any, (m: any) => ({ matchId: m.id, formation: m.formation, starters: m.starters, substitutes: [] }), (pid: string) => nomi[pid]);
const count = (id: string) => res1!.starters.filter((s) => s.playerId === id).length;
check('DCX una volta sola', count('DCX') === 1, `DCX compare ${count('DCX')} volte`);
check('DCY presente nello slot libero', count('DCY') === 1, `DCY compare ${count('DCY')} volte`);

// Nessuna formazione registrata
check('nessuna lineup -> null', computeMostUsedLineup([] as any, () => undefined, () => undefined) === null, 'doveva essere null');

console.log(fail === 0 ? 'FORMAZIONE: TUTTI I CASI PASSANO' : `FORMAZIONE: ${fail} FALLITI`);