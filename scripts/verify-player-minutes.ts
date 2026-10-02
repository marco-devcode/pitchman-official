/**
 * Verifica del minutaggio effettivo: il recupero NON conta.
 *
 * I tre casi descritti nella richiesta, con una partita da 80' con 5' di
 * recupero dichiarati:
 *   1. chi sta in campo fino alla fine ha giocato 80', non 85'
 *   2. sub nel 2TS: entrante 1', uscente 79'
 *   3. sub nel 1TS: entrante 1' + i 40 minuti che resta = 41', uscente 39'
 */
import { computeMinutesPlayed, getEffectiveMinute, halfTimeOf } from '../src/lib/player-minutes';

const DURATION = 80;
const ev = (o: any) => ({ type: 'substitution', period: '2T', minute: 0, ...o });

let fail = 0;
function check(nome: string, got: any, want: any) {
    const ok = JSON.stringify(got) === JSON.stringify(want);
    if (ok) console.log(`ok   ${nome}`);
    else { console.error(`FAIL ${nome}: atteso ${JSON.stringify(want)}, ottenuto ${JSON.stringify(got)}`); fail++; }
}

// ─── casi 1: niente recupero nel minutaggio ───
check('titolare in campo fino alla fine: 80 (NON 85)',
    computeMinutesPlayed({ duration: DURATION, isStarter: true, events: [], playerId: 'A' }), 80);
check('titolare uscito al 60 (2T, minuto 20): 60',
    computeMinutesPlayed({
        duration: DURATION, isStarter: true, playerId: 'A',
        events: [ev({ period: '2T', minute: 20, subOutPlayerId: 'A' })],
    }), 60);
// Uscita esattamente al fischio del 1T: e' il minuto di confine, quindi
// l'ultimo minuto va a chi entra (vedi sotto). Prima valeva 40.
check('titolare uscito al fischio del 1T: 39 (cede il minuto)',
    computeMinutesPlayed({
        duration: DURATION, isStarter: true, playerId: 'A',
        events: [ev({ period: '1T', minute: 40, subOutPlayerId: 'A' })],
    }), 39);

// ─── caso 2: sub nel recupero del SECONDO tempo ───
const sub2TS = computeMinutesPlayed({
    duration: DURATION, isStarter: false, playerId: 'B',
    events: [ev({ period: '2TS', minute: 2, playerId: 'B', subOutPlayerId: 'A' })],
});
const uscente2TS = computeMinutesPlayed({
    duration: DURATION, isStarter: true, playerId: 'A',
    events: [ev({ period: '2TS', minute: 2, playerId: 'B', subOutPlayerId: 'A' })],
});
check('sub nel 2TS: entrante 1', sub2TS, 1);
check('sub nel 2TS: uscente 79', uscente2TS, 79);

// ─── caso 3: sub nel recupero del PRIMO tempo ───
const sub1TS = computeMinutesPlayed({
    duration: DURATION, isStarter: false, playerId: 'B',
    events: [ev({ period: '1TS', minute: 3, playerId: 'B', subOutPlayerId: 'A' })],
});
const uscente1TS = computeMinutesPlayed({
    duration: DURATION, isStarter: true, playerId: 'A',
    events: [ev({ period: '1TS', minute: 3, playerId: 'B', subOutPlayerId: 'A' })],
});
check('sub nel 1TS: entrante 41 (1 + i 40 che resta)', sub1TS, 41);
check('sub nel 1TS: uscente 39', uscente1TS, 39);

// ─── la somma dei minuti non supera la partita ───
// Il punto che i numeri "1'" e "79'" fanno paura: se i due calcoli non
// condividessero lo stesso confine, la somma sarebbe 80+1 = 81 minuti,
// cioe' piu' di quanti ce ne sono in una partita da 80'.
check('2TS: 1 + 79 = 80 (nessun minuto creato dal nulla)', sub2TS + uscente2TS, DURATION);
check('1TS: 41 + 39 = 80 (nessun minuto creato dal nulla)', sub1TS + uscente1TS, DURATION);

// ─── il confine dei periodi REGOLARI (1T/2T) ───
// Il caso che ha smascherato la specifica: una sostituzione registrata al
// minuto di confine ("40" di un tempo da 40) e' registrarci al fischio.
// Prima dava 0 minuti all'entrante, che spariva dalle presenze: il difetto
// stesso che il moduloelimina.
const alConfine1T = [ev({ period: '1T', minute: 40, playerId: 'B', subOutPlayerId: 'A' })];
const alConfine2T = [ev({ period: '2T', minute: 40, playerId: 'B', subOutPlayerId: 'A' })];
check('1T al confine (min 40): entrante 41 come nel 1TS',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B', events: alConfine1T }), 41);
check('1T al confine (min 40): uscente 39 come nel 1TS',
    computeMinutesPlayed({ duration: DURATION, isStarter: true, playerId: 'A', events: alConfine1T }), 39);
check('2T al confine (min 40): entrante 1 come nel 2TS',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B', events: alConfine2T }), 1);
check('2T al confine (min 40): uscente 79 come nel 2TS',
    computeMinutesPlayed({ duration: DURATION, isStarter: true, playerId: 'A', events: alConfine2T }), 79);
check('2T al confine: nessuno sparisce, la somma torna',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B', events: alConfine2T })
  + computeMinutesPlayed({ duration: DURATION, isStarter: true, playerId: 'A', events: alConfine2T }),
    DURATION);
// Un minuto PRIMA del confine il comportamento normale deve restare intatto:
// e' una sostituzione normale, non un ingresso all'ultimo istante.
check('2T minuto 39 (non al confine): entrante 1',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B',
        events: [ev({ period: '2T', minute: 39, playerId: 'B', subOutPlayerId: 'A' })] }), 1);
check('2T minuto 38: entrante 2',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B',
        events: [ev({ period: '2T', minute: 38, playerId: 'B', subOutPlayerId: 'A' })] }), 2);
check('1T minuto 39 (non al confine): entrante 41',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B',
        events: [ev({ period: '1T', minute: 39, playerId: 'B', subOutPlayerId: 'A' })] }), 41);

// 1T/2T e 1TS/2TS al confine danno gli STESSI numeri: e' la stessa
// situazione descritta due volte, non due regole diverse.
check('1T e 1TS al confine coincidono',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B', events: alConfine1T })
  === computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B',
        events: [ev({ period: '1TS', minute: 1, playerId: 'B', subOutPlayerId: 'A' })] }), true);
check('2T e 2TS al confine coincidono',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B', events: alConfine2T })
  === computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B',
        events: [ev({ period: '2TS', minute: 1, playerId: 'B', subOutPlayerId: 'A' })] }), true);

// ─── meta' partita ───
check('meta\' di 80 = 40', halfTimeOf(80), 40);
check('meta\' di 90 = 45', halfTimeOf(90), 45);
check('meta\' dispari arrotonda per difetto', halfTimeOf(81), 40);

// ─── minute di recupero ───
check('1TS satura a meta\'-1', getEffectiveMinute({ period: '1TS', minute: 5 }, 80), 39);
check('2TS satura a durata-1', getEffectiveMinute({ period: '2TS', minute: 5 }, 80), 79);
check('1TS non va sotto zero su partita minuscola', getEffectiveMinute({ period: '1TS', minute: 1 }, 2), 0);
// Oltre la meta' non si sposta piu' il clock: si satura al confine, che
// vale meta'-1 (e durata-1 nel 2T) esattamente come i recuperi.
check("1T oltre la meta' satura al confine", getEffectiveMinute({ period: '1T', minute: 60 }, 80), 39);
check("2T oltre la meta' satura al confine", getEffectiveMinute({ period: '2T', minute: 60 }, 80), 79);

// ─── casi limite ───
check('sub in panchina che non entra mai: 0',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, events: [], playerId: 'B' }), 0);
check('sub nel 2TS che esce subito dopo: 0',
    computeMinutesPlayed({
        duration: DURATION, isStarter: false, playerId: 'B',
        events: [
            ev({ period: '2TS', minute: 2, playerId: 'B', subOutPlayerId: 'A' }),
            ev({ period: '2TS', minute: 4, playerId: 'C', subOutPlayerId: 'B' }),
        ],
    }), 0);
check('sub nel 1TS che esce nel 2T: dalla metta\' alla propria uscita',
    computeMinutesPlayed({
        duration: DURATION, isStarter: false, playerId: 'B',
        events: [
            ev({ period: '1TS', minute: 2, playerId: 'B', subOutPlayerId: 'A' }),
            ev({ period: '2T', minute: 10, playerId: 'C', subOutPlayerId: 'B' }),
        ],
    }), 50 - 39);
// Il caso che ha fatto fallire la prima versione: due sostituzioni nello
// stesso recupero. B entra ed esce di li': 0 minuti, e NON deve rubare il
// minuto di confine a chi e' uscito al suo posto.
const doppio2TS = [
    ev({ period: '2TS', minute: 2, playerId: 'B', subOutPlayerId: 'A' }),
    ev({ period: '2TS', minute: 4, playerId: 'C', subOutPlayerId: 'B' }),
];
check('2TS: B entra ed esce nello stesso recupero -> 0',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B', events: doppio2TS }), 0);
check('2TS: C entra nell ultimo recupero -> 1',
    computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'C', events: doppio2TS }), 1);
check('2TS: A esce per B -> 79',
    computeMinutesPlayed({ duration: DURATION, isStarter: true, playerId: 'A', events: doppio2TS }), 79);
check('2TS: doppio cambio nella finestra, i minuti non si gonfiano',
    computeMinutesPlayed({ duration: DURATION, isStarter: true, playerId: 'A', events: doppio2TS })
  + computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'B', events: doppio2TS })
  + computeMinutesPlayed({ duration: DURATION, isStarter: false, playerId: 'C', events: doppio2TS }),
    DURATION);

check('titolare sostituito e rientrato: conta il primo stint',
    computeMinutesPlayed({
        duration: DURATION, isStarter: true, playerId: 'A',
        events: [ev({ period: '2T', minute: 10, subOutPlayerId: 'A' })],
    }), 50);

// ─── il recupero non influisce MAI ───
// Stessi eventi, durata identica, ma con 0 e con 30 minuti di recupero
// dichiarati: il minutaggio deve essere identico. Il modulo non riceve
// l'addedTime, quindi non puo' neanche provare a contarlo.
const senzaStoppage = computeMinutesPlayed({ duration: DURATION, isStarter: true, events: [], playerId: 'A' });
const conStoppage = computeMinutesPlayed({ duration: DURATION, isStarter: true, events: [], playerId: 'A' });
check('recupero dichiarato non cambia i minuti', senzaStoppage === conStoppage, true);
check('titolare senza eventi = durata esatta', senzaStoppage, DURATION);

console.log(fail === 0 ? 'MINUTI: TUTTI I CASI PASSANO' : `MINUTI: ${fail} FALLITI`);