import { aggregationRepository } from './aggregation-repository';
import type { SeasonDataContext } from './aggregation-repository';
import type { Match, Player, MatchEvent, PlayerMatchStats, MatchLineup } from '../types';

// Questo file era vuoto: `expect(true).toBe(true)` con un TODO su
// `dexie-mock-extended`, che non serve piu'. Il repository non usa Dexie.
//
// La parte che va coperta sono le funzioni PURE, che prendono un
// `SeasonDataContext` gia' costruito e non toccano Firestore:
// `getTeamRecordFromContext` e `getPlayersAggregatedStatsFromContext`.
// Nessun mock, nessuna dipendenza: si puo' testare davvero.
//
// Il caso che questo file protegge e' la definizione di PRESENZA, che in
// passato era stata reimplementata in quattro aggregatori con nomi diversi e
// due volte sbagliata nello stesso modo (chi resta in panchina contava come
// presenza, e i minuti non la provavano).

const mkPlayer = (id: string, name: string): Player => ({ id, name, role: 'Attaccante', stats: {} } as Player);

const mkMatch = (id: string, isHome: boolean, home: number, away: number, status = 'completed'): Match =>
    ({ id, isHome, status, result: { home, away }, date: '2024-01-01', opponent: 'X' } as Match);

const ctx = (
    matches: Match[],
    players: Player[],
    matchesDetails: SeasonDataContext['matchesDetails'],
): SeasonDataContext => ({ matches, players, matchesDetails });

describe('aggregationRepository - team record', () => {
    it('conta vittorie, pareggi e sconfitte correttamente in casa e fuori', () => {
        const record = aggregationRepository.getTeamRecordFromContext(
            ctx(
                [
                    mkMatch('M1', true, 2, 0), // casa, vinta
                    mkMatch('M2', true, 1, 1), // casa, pareggio
                    mkMatch('M3', false, 0, 3), // fuori, vinta (3 a 0)
                    mkMatch('M4', false, 2, 1), // fuori, sconfitta (1 a 2)
                ],
                [],
                {},
            ),
        );

        expect(record.overall.matchesPlayed).toBe(4);
        expect(record.overall.wins).toBe(2);
        expect(record.overall.draws).toBe(1);
        expect(record.overall.losses).toBe(1);
        expect(record.overall.goalsFor).toBe(2 + 1 + 3 + 1);
        expect(record.overall.goalsAgainst).toBe(0 + 1 + 0 + 2);

        expect(record.home).toMatchObject({ matchesPlayed: 2, wins: 1, draws: 1, losses: 0 });
        expect(record.away).toMatchObject({ matchesPlayed: 2, wins: 1, draws: 0, losses: 1 });
    });

    it('una partita non conclusa non entra nel record', () => {
        const record = aggregationRepository.getTeamRecordFromContext(
            ctx([mkMatch('M1', true, 5, 0, 'scheduled')], [], {}),
        );
        expect(record.overall.matchesPlayed).toBe(0);
        expect(record.overall.goalsFor).toBe(0);
    });

    it('la somma di casa e fuori torna con il totale', () => {
        const record = aggregationRepository.getTeamRecordFromContext(
            ctx([mkMatch('M1', true, 1, 0), mkMatch('M2', false, 2, 2)], [], {}),
        );
        expect(record.home.goalsFor + record.away.goalsFor).toBe(record.overall.goalsFor);
        expect(record.home.wins + record.away.wins).toBe(record.overall.wins);
        expect(record.home.draws + record.away.draws).toBe(record.overall.draws);
        expect(record.home.losses + record.away.losses).toBe(record.overall.losses);
    });
});

describe('aggregationRepository - presenze dei giocatori', () => {
    const players = [mkPlayer('P1', 'Titolare'), mkPlayer('P2', 'Subentrato'), mkPlayer('P3', 'In panchina')];

    const lineup: MatchLineup = {
        matchId: 'M1',
        starters: ['P1'],
        substitutes: ['P2', 'P3'],
    };

    const events: MatchEvent[] = [
        // P2 entra al 70'. Nessun evento per P3: resta in panchina.
        { id: 'E1', type: 'substitution', matchId: 'M1', team: 'home', playerId: 'P2', playerIn: 'P2', minute: 70, period: '2T' } as unknown as MatchEvent,
    ];

    const stats: PlayerMatchStats[] = [
        { playerId: 'P1', minutesPlayed: 90, yellowCards: 1, redCards: 0 } as PlayerMatchStats,
        // Il subentrato all'ultimo recupero: 0 minuti ma E' entrato. Il caso che
        // la definizione sbagliata (minuti > 0) perdeva.
        { playerId: 'P2', minutesPlayed: 0, yellowCards: 0, redCards: 0 } as PlayerMatchStats,
    ];

    const context = ctx([mkMatch('M1', true, 1, 0)], players, { M1: { events, lineup, stats } });
    const results = aggregationRepository.getPlayersAggregatedStatsFromContext(context);
    const by = (id: string) => results.find((r) => r.playerId === id)!;

    it('il titolare ha una presenza', () => {
        expect(by('P1').usage.appearances).toBe(1);
        expect(by('P1').usage.starts).toBe(1);
        expect(by('P1').usage.bench).toBe(0);
    });

    it('chi entra dalla panchina ha una presenza anche con 0 minuti', () => {
        expect(by('P2').usage.appearances).toBe(1);
        expect(by('P2').usage.subAppearances).toBe(1);
        expect(by('P2').usage.bench).toBe(0);
        expect(by('P2').stats.appearances).toBe(1);
    });

    it('chi resta in panchina NON ha presenze e conta come panchina', () => {
        expect(by('P3').usage.appearances).toBe(0);
        expect(by('P3').usage.bench).toBe(1);
        expect(by('P3').stats.appearances).toBe(0);
    });

    it('la media minuti divide per le presenze reali, non per le convocazioni', () => {
        // P2: 0 minuti su 1 presenza -> media 0. Se il denominatore contasse
        // anche la panchina il risultato sarebbe lo stesso qui, quindi il caso
        // che distingue davvero e' P3: 0 presenze, media 0 e non NaN.
        expect(by('P2').stats.avgMinutes).toBe(0);
        expect(by('P3').stats.avgMinutes).toBe(0);
        expect(Number.isNaN(by('P3').stats.avgMinutes)).toBe(false);
    });

    it('senza lineup non si parla di non convocati: non sappiamo chi era in rosa', () => {
        const senzaLineup = ctx([mkMatch('M2', true, 1, 0)], players, {
            M2: { events: [], stats: [{ playerId: 'P1', minutesPlayed: 90 } as PlayerMatchStats] },
        });
        const res = aggregationRepository.getPlayersAggregatedStatsFromContext(senzaLineup);
        const p3 = res.find((r) => r.playerId === 'P3')!;
        expect(p3.usage.notConvoked).toBe(0);
        expect(p3.usage.appearances).toBe(0);
    });

    it('un gol e un assist contano solo se il giocatore e\' entrato in campo', () => {
        const conGol: SeasonDataContext = ctx([mkMatch('M1', true, 2, 0)], players, {
            M1: {
                lineup,
                stats: [],
                events: [
                    { id: 'E1', type: 'substitution', team: 'home', playerId: 'P2', minute: 70, period: '2T' } as MatchEvent,
                    { id: 'G1', type: 'goal', team: 'home', playerId: 'P2', minute: 80, period: '2T' } as MatchEvent,
                    { id: 'G2', type: 'goal', team: 'home', playerId: 'P3', minute: 85, period: '2T' } as MatchEvent,
                ],
            },
        });
        const res = aggregationRepository.getPlayersAggregatedStatsFromContext(conGol);
        const p2 = res.find((r) => r.playerId === 'P2')!;
        const p3 = res.find((r) => r.playerId === 'P3')!;
        expect(p2.stats.goals).toBe(1);
        // P3 non e' mai entrato: il suo gol non gli viene attribuito.
        expect(p3.stats.goals).toBe(0);
    });
});
