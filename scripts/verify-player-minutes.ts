/**
 * Verifica del minutaggio: i tempi supplementari durano 15 minuti, si SOMMANO
 * in coda ai tempi regolamentari, e NON sono sempre presenti.
 *
 * Timeline con supplementari attivi, partita da 80' (meta' = 40):
 *   1T 0-40 | 2T 40-80 | 1TS 80-95 | 2TS 95-110 | fine 110'
 * Timeline senza: 1T 0-40 | 2T 40-80 | fine 80'
 */
import {
    computeMinutesPlayed, getAbsoluteMinute, halfTimeOf, matchEndAbsolute,
    periodEnd, periodStart, stoppagePeriodsActive,
} from '../src/lib/player-minutes';

const D = 80;
const END = 110;
const ev = (o: any) => ({ type: 'substitution', period: '2T', minute: 0, ...o });

let fail = 0;
function check(nome: string, got: any, want: any) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) console.log(`ok   ${nome}`);
    else { console.error(`FAIL ${nome}: atteso ${JSON.stringify(want)}, ottenuto ${JSON.stringify(got)}`); fail++; }
}

// ─── attivazione: quando esistono i tempi supplementari? ───
check('torneo con 1TS dichiarato: attivi',
    stoppagePeriodsActive({ type: 'Torneo', addedTime: { '1TS': 5 } }), true);
check('torneo con 2TS dichiarato: attivi',
    stoppagePeriodsActive({ type: 'Torneo', addedTime: { '2TS': 3 } }), true);
check('torneo senza dichiarazione: NON attivi',
    stoppagePeriodsActive({ type: 'Torneo', addedTime: undefined }), false);
check('torneo con addedTime vuoto: NON attivi',
    stoppagePeriodsActive({ type: 'Torneo', addedTime: {} }), false);
check('torneo con valore 0: NON attivi',
    stoppagePeriodsActive({ type: 'Torneo', addedTime: { '1TS': 0 } }), false);
check('campionato con 1TS dichiarato: NON attivi',
    stoppagePeriodsActive({ type: 'Campionato', addedTime: { '1TS': 5 } }), false);
check('amichevole con 1TS dichiarato: NON attivi',
    stoppagePeriodsActive({ type: 'Amichevole', addedTime: { '1TS': 5 } }), false);
check('match nullo: NON attivi', stoppagePeriodsActive(null), false);
check('match indefinito: NON attivi', stoppagePeriodsActive(undefined), false);
// Quanto dichiarato non cambia la durata del blocco: e' fissa a 15.
check('dichiarare 3 minuti non accorcia il blocco',
    matchEndAbsolute(D, stoppagePeriodsActive({ type: 'Torneo', addedTime: { '1TS': 3 } })), END);
check('dichiarare 30 minuti non allunga il blocco',
    matchEndAbsolute(D, stoppagePeriodsActive({ type: 'Torneo', addedTime: { '1TS': 30 } })), END);

// ─── fine partita nei due casi ───
check('senza supplementari: fine = durata regolamentare', matchEndAbsolute(D, false), D);
check('con supplementari: fine = durata + 15 + 15', matchEndAbsolute(D, true), END);
check('meta di 80 = 40', halfTimeOf(80), 40);
check('meta di 90 = 45', halfTimeOf(90), 45);

// ─── la timeline con supplementari ───
check('1TS parte a 80 (dopo i tempi regolamentari)', periodStart('1TS', D, true), 80);
check('2TS parte a 95', periodStart('2TS', D, true), 95);
check('2T parte dalla meta, non meta+15', periodStart('2T', D, true), 40);
check('1TS finisce a 95', periodEnd('1TS', D, true), 95);
check('2TS finisce a 110', periodEnd('2TS', D, true), END);

// ─── la timeline SENZA supplementari: i blocchi collassano ───
check('senza supplementari 1TS finisce a 80', periodEnd('1TS', D, false), 80);
check('senza supplementari 2TS finisce a 80', periodEnd('2TS', D, false), 80);
check('evento in 1TS senza supplementari non vale piu\' della partita',
    getAbsoluteMinute({ period: '1TS', minute: 10 }, D, false), 80);

// ─── i blocchi non si sovrappongono ───
check("3' del 1TS = assoluto 83", getAbsoluteMinute({ period: '1TS', minute: 3 }, D, true), 83);
check("3' del 2T = assoluto 43", getAbsoluteMinute({ period: '2T', minute: 3 }, D, true), 43);

// ─── minutaggio con supplementari attivi ───
const base = { duration: D, stoppageActive: true };
check('titolare in campo dal primo all\'ultimo fischio: 110',
    computeMinutesPlayed({ ...base, isStarter: true, events: [], playerId: 'A' }), END);
check('titolare uscito al 60 (2T minuto 20): 60',
    computeMinutesPlayed({ ...base, isStarter: true, playerId: 'A',
        events: [ev({ period: '2T', minute: 20, subOutPlayerId: 'A' })] }), 60);
check('titolare uscito al fischio del 2T: 80',
    computeMinutesPlayed({ ...base, isStarter: true, playerId: 'A',
        events: [ev({ period: '2T', minute: 40, subOutPlayerId: 'A' })] }), 80);

const sub1TS = computeMinutesPlayed({ ...base, isStarter: false, playerId: 'B',
    events: [ev({ period: '1TS', minute: 3, playerId: 'B', subOutPlayerId: 'A' })] });
const usc1TS = computeMinutesPlayed({ ...base, isStarter: true, playerId: 'A',
    events: [ev({ period: '1TS', minute: 3, playerId: 'B', subOutPlayerId: 'A' })] });
check("sub al 3' del 1TS prende 110 - 83 = 27", sub1TS, 27);
check('uscente per quel sub: 83', usc1TS, 83);
check('la somma torna alla fine partita', sub1TS + usc1TS, END);
check("sub al 3' del 2TS prende 110 - 98 = 12",
    computeMinutesPlayed({ ...base, isStarter: false, playerId: 'B',
        events: [ev({ period: '2TS', minute: 3, playerId: 'B', subOutPlayerId: 'A' })] }), 12);
// Il blocco 2TS dura 15 minuti (95-110): il suo 15' minuto coincide con la
// fine partita, quindi un ingresso li' vale 0. L'ultimo minuto GIOCABILE e'
// il 14, e li' vale 1: e' il caso sotto. Non e' piu' il "minuto forzato a
// 1" del modello vecchio, e' semplicemente la fine dell'orologio.
check("sub al 15' del 2TS (ultimo minuto, = fine partita): 0",
    computeMinutesPlayed({ ...base, isStarter: false, playerId: 'B',
        events: [ev({ period: '2TS', minute: 15, playerId: 'B', subOutPlayerId: 'A' })] }), 0);
check("sub al 14' del 2TS (ultimo minuto giocabile): 1",
    computeMinutesPlayed({ ...base, isStarter: false, playerId: 'B',
        events: [ev({ period: '2TS', minute: 14, playerId: 'B', subOutPlayerId: 'A' })] }), 1);

// ─── minutaggio senza supplementari: torna alla durata regolamentare ───
const noSupp = { duration: D, stoppageActive: false };
check('titolare in campo fino alla fine: 80 (nessun supplementare)',
    computeMinutesPlayed({ ...noSupp, isStarter: true, events: [], playerId: 'A' }), D);
check('sub al 3\' del 1TS senza supplementari: finisce alla partita',
    computeMinutesPlayed({ ...noSupp, isStarter: false, playerId: 'B',
        events: [ev({ period: '1TS', minute: 3, playerId: 'B', subOutPlayerId: 'A' })] }), 0);
check('stessa partita, attivazione diversa, minuti diversi',
    computeMinutesPlayed({ ...base, isStarter: true, events: [], playerId: 'A' })
  !== computeMinutesPlayed({ ...noSupp, isStarter: true, events: [], playerId: 'A' }), true);

// ─── casi limite ───
check('sub in panchina che non entra mai: 0',
    computeMinutesPlayed({ ...base, isStarter: false, events: [], playerId: 'B' }), 0);
// Due sostituzioni dentro lo stesso blocco supplementare: B entra al 2' del
// 1TS (assoluto 82) ed esce quando C entra al 4' (assoluto 84), quindi ha
// giocato 2 minuti. Nel modello vecchio, dove il recupero collassava sul
// confine, erano 0 perche' i due eventi finivano sullo stesso minuto.
check('sub entrato ed uscito dentro il 1TS: 84 - 82 = 2',
    computeMinutesPlayed({ ...base, isStarter: false, playerId: 'B',
        events: [
            ev({ period: '1TS', minute: 2, playerId: 'B', subOutPlayerId: 'A' }),
            ev({ period: '1TS', minute: 4, playerId: 'C', subOutPlayerId: 'B' }),
        ] }), 2);
check('il titolare sostituito al suo posto prende 82',
    computeMinutesPlayed({ ...base, isStarter: true, playerId: 'A',
        events: [
            ev({ period: '1TS', minute: 2, playerId: 'B', subOutPlayerId: 'A' }),
            ev({ period: '1TS', minute: 4, playerId: 'C', subOutPlayerId: 'B' }),
        ] }), 82);

// ─── la guardia: nessun minuto inventato ───
const doppio = [
    ev({ period: '2TS', minute: 2, playerId: 'B', subOutPlayerId: 'A' }),
    ev({ period: '2TS', minute: 4, playerId: 'C', subOutPlayerId: 'B' }),
];
const sommaDoppio = ['A', 'B', 'C'].reduce((tot, pid) => tot + computeMinutesPlayed({
    ...base, isStarter: pid === 'A', playerId: pid, events: doppio,
}), 0);
check('doppio cambio nel 2TS: i minuti non si gonfiano', sommaDoppio, END);

console.log(fail === 0 ? 'MINUTI: TUTTI I CASI PASSANO' : `MINUTI: ${fail} FALLITI`);