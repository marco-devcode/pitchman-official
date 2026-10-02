/**
 * Verifica della nuova definizione di presenza/usaggio su casi reali.
 * Non e' un test automatico: e' lo script che ho eseguito per controllare
 * che panchina / subentrato / non convocato escano dai numeri giusti.
 */
import { getMatchUsage, emptyUsageCounts } from '../src/lib/player-usage';

type Ev = { type: string; team: 'home' | 'away'; playerId?: string; subOutPlayerId?: string; minute: number | null; period: any; id: string; matchId: string };
type Det = { events: Ev[]; lineup?: any; stats: any[] };

const ev = (o: Partial<Ev>): Ev => ({ type: 'note', team: 'home', minute: 0, period: '1T', id: 'e', matchId: 'm', ...o } as Ev);

const cases: { nome: string; details: Det; atteso: any }[] = [
  {
    nome: 'titolare che gioca tutta la partita',
    details: {
      events: [],
      lineup: { matchId: 'm', starters: [{ playerId: 'A' }], substitutes: [{ playerId: 'B' }] },
      stats: [{ playerId: 'A', matchId: 'm', minutesPlayed: 90, goals: 0, assists: 0, yellowCards: 0, redCards: 0 }],
    },
    atteso: { A: { appeared: true, isStarter: true, bench: 0, sub: 0 }, B: { appeared: false, bench: 1 } },
  },
  {
    nome: 'sub in panchina che NON entra',
    details: {
      events: [],
      lineup: { matchId: 'm', starters: [{ playerId: 'A' }], substitutes: [{ playerId: 'B' }, { playerId: 'C' }] },
      stats: [],
    },
    atteso: { B: { appeared: false, bench: 1 }, C: { appeared: false, bench: 1 }, D: { appeared: false, bench: 0 } },
  },
  {
    nome: 'subentrato (30 minuti)',
    details: {
      events: [ev({ type: 'substitution', playerId: 'B', subOutPlayerId: 'A', minute: 60 })],
      lineup: { matchId: 'm', starters: [{ playerId: 'A' }], substitutes: [{ playerId: 'B' }] },
      stats: [{ playerId: 'B', matchId: 'm', minutesPlayed: 30, goals: 0, assists: 0, yellowCards: 0, redCards: 0 }],
    },
    atteso: { B: { appeared: true, cameOn: true, sub: 1 } },
  },
  {
    nome: 'subentrato ultimo minuto di recupero: 0 minuti ma presenza',
    details: {
      events: [ev({ type: 'substitution', playerId: 'B', subOutPlayerId: 'A', minute: 2, period: '2TS' })],
      lineup: { matchId: 'm', starters: [{ playerId: 'A' }], substitutes: [{ playerId: 'B' }] },
      stats: [],
    },
    atteso: { B: { appeared: true, cameOn: true, sub: 1 } },
  },
  {
    nome: 'sostituzione avversaria con lo stesso playerId NON e\' un ingresso',
    details: {
      events: [ev({ type: 'substitution', team: 'away', playerId: 'B', minute: 60 })],
      lineup: { matchId: 'm', starters: [{ playerId: 'A' }], substitutes: [{ playerId: 'B' }] },
      stats: [],
    },
    atteso: { B: { appeared: false, cameOn: false, bench: 1 } },
  },
  {
    nome: 'lineup legacy con id come stringa',
    details: {
      events: [],
      lineup: { matchId: 'm', starters: ['A'], substitutes: ['B'] },
      stats: [],
    },
    atteso: { A: { appeared: true }, B: { appeared: false, bench: 1 } },
  },
];

let fail = 0;
for (const c of cases) {
  const out: any = {};
  for (const pid of ['A', 'B', 'C', 'D']) {
    const u = getMatchUsage(c.details, pid, true);
    const counts = emptyUsageCounts();
    if (u.isStarter) counts.starts++;
    if (u.cameOn && !u.isStarter) counts.subAppearances++;
    if (u.appeared) counts.appearances++;
    else if (u.isOnBench || u.isStarter) counts.bench++;
    else if (c.details.lineup) counts.notConvoked++;
    out[pid] = { ...counts, cameOn: u.cameOn };
  }
  for (const [pid, exp] of Object.entries<any>(c.atteso)) {
    const got = out[pid];
    for (const [k, v] of Object.entries<any>(exp)) {
      // 'appeared'/'isStarter' nell'aspettativa -> 'appearances'/'starts' nei conteggi
      const key = k === 'appeared' ? 'appearances' : k === 'isStarter' ? 'starts' : k;
      const g = k === 'bench' ? got.bench : k === 'sub' ? got.subAppearances : got[key];
      // le aspettative booleane su un conteggio confrontano con 1/0
      const want = typeof v === 'boolean' && key !== 'cameOn' ? (v ? 1 : 0) : v;
      if (g !== want) {
        console.error(`FAIL [${c.nome}] ${pid}.${k}: atteso ${v}, ottenuto ${g}`);
        fail++;
      }
    }
  }
  console.log(`ok  ${c.nome}: ${JSON.stringify(out)}`);
}
console.log(fail === 0 ? 'TUTTI I CASI PASSANO' : `${fail} ASSERZIONI FALLITE`);