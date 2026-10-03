import { computeAdvancedStatsBundle, normalizeMatch } from './stats-advanced-service';
import { Player, Match, MatchEvent, MatchLineup } from '../lib/types';

describe('Advanced Stats Service', () => {
    const mockPlayers: Player[] = [
        { id: 'P1', name: 'CB1', role: 'Difensore', stats: {} as any } as Player,
        { id: 'P2', name: 'CB2', role: 'Difensore', stats: {} as any } as Player,
        { id: 'P3', name: 'FW1', role: 'Attaccante', stats: {} as any } as Player,
        { id: 'P4', name: 'FW2', role: 'Attaccante', stats: {} as any } as Player,
    ];

    const mockMatches: Match[] = [
        { 
            id: 'M1', 
            status: 'completed', 
            isHome: true, 
            result: { home: 1, away: 0 },
            opponent: 'Opp1',
            date: '2024-01-01'
        } as Match,
        { 
            id: 'M2', 
            status: 'completed', 
            isHome: true, 
            result: { home: 2, away: 2 },
            opponent: 'Opp2',
            date: '2024-01-08'
        } as Match,
        { 
            id: 'M3', 
            status: 'completed', 
            isHome: false, 
            result: { home: 1, away: 2 }, // Our win
            opponent: 'Opp3',
            date: '2024-01-15'
        } as Match,
        { 
            id: 'M4', 
            status: 'completed', 
            isHome: true, 
            result: { home: 0, away: 1 }, // Our loss
            opponent: 'Opp4',
            date: '2024-01-22'
        } as Match,
    ];

    // NOTA: le lineup devono avere 11 titolari, non 3. Il test precedente ne
    // passava 3 ('P1','P2','P3') e il risultato era ZERO coppie DC, non un
    // bug di computeBestDefenseStats ma un test che non descriveva una partita:
    // in un 4-4-2 i centrali sono ai posti 2 e 3 (POR,TS,DC,DC,TD,...), quindi
    // con 3 elementi la seconda coppia non esiste e veniva scartata.
    // Verificato con una sonda: 11 titolari -> coppia in uscita, 3 -> lista
    // vuota.
    //
    // M4 mette P1 accanto a un altro centrale (DC3, non un giocatore reale):
    // e' il caso che tiene la coppia P1|P2 a 3 partite, come le asserzioni
    // qui sotto richiedono, e copre il fatto che la coppia si contesta solo
    // quando quei due sono davvero in campo insieme.
    const mockLineups: Record<string, MatchLineup> = {
        'M1': { matchId: 'M1', formation: '4-4-2', starters: ['POR', 'TS', 'P1', 'P2', 'TD', 'P3', 'CS', 'CD', 'AD', 'AS', 'ATT'], substitutes: [] },
        'M2': { matchId: 'M2', formation: '4-4-2', starters: ['POR', 'TS', 'P1', 'P2', 'TD', 'P4', 'CS', 'CD', 'AD', 'AS', 'ATT'], substitutes: [] },
        'M3': { matchId: 'M3', formation: '4-4-2', starters: ['POR', 'TS', 'P1', 'P2', 'TD', 'P3', 'CS', 'CD', 'AD', 'AS', 'ATT'], substitutes: [] },
        'M4': { matchId: 'M4', formation: '4-4-2', starters: ['POR', 'TS', 'P1', 'DC3', 'TD', 'P4', 'CS', 'CD', 'AD', 'AS', 'ATT'], substitutes: [] },
    };

    const mockEvents: Record<string, MatchEvent[]> = {
        'M1': [
            { id: 'E1', type: 'goal', team: 'home', playerId: 'P3', minute: 10, period: '1T' } as MatchEvent
        ],
        'M3': [
            { id: 'E2', type: 'goal', team: 'home', minute: 5, period: '1T' } as MatchEvent, // Opponent goal
            { id: 'E3', type: 'goal', team: 'away', playerId: 'P3', minute: 20, period: '1T' } as MatchEvent, // Our goal 1-1
            { id: 'E4', type: 'goal', team: 'away', playerId: 'P4', minute: 80, period: '2T' } as MatchEvent, // Our goal 1-2 (Decisive)
        ]
    };

    it('should correctly normalize matches with legacy result objects', () => {
        const m = mockMatches[0];
        const normalized = normalizeMatch(m);
        expect(normalized.teamGoals).toBe(1);
        expect(normalized.opponentGoals).toBe(0);
        expect(normalized.resultType).toBe('W');
    });

    it('should compute best CB pair with thresholds', () => {
        const stats = computeAdvancedStatsBundle('S1', mockMatches, mockLineups, {}, mockPlayers, { minPairMatches: 2, minStarterApps: 1 });
        
        expect(stats.bestCbPair.length).toBe(1);
        const pair = stats.bestCbPair[0];
        expect(pair.pairKey).toBe('P1|P2');
        expect(pair.matchesTogether).toBe(3);
        // M1: 0 goals conceded, M2: 2 goals conceded, M3: 1 goal conceded. Total 3.
        expect(pair.goalsConceded).toBe(3);
        expect(pair.goalsConcededPerMatch).toBe(1);
    });

    it('should compute best G/A per starter appearance', () => {
        const stats = computeAdvancedStatsBundle('S1', mockMatches, mockLineups, mockEvents, mockPlayers, { minPairMatches: 1, minStarterApps: 1 });
        
        const p3 = stats.bestGaPerStarter.find(s => s.playerId === 'P3');
        expect(p3?.goals).toBe(2); // M1 and M3
        expect(p3?.starterApps).toBe(2); // M1 and M3
        expect(p3?.gaPerStarter).toBe(1);

        const p4 = stats.bestGaPerStarter.find(s => s.playerId === 'P4');
        expect(p4?.goals).toBe(1); // M3
        expect(p4?.starterApps).toBe(2); // M2 and M4. Wait, P4 in M2 and M4. So apps=2.
        expect(p4?.gaPerStarter).toBe(0.5);
    });

    it('should compute decisive goals correctly', () => {
        const stats = computeAdvancedStatsBundle('S1', mockMatches, mockLineups, mockEvents, mockPlayers, { minPairMatches: 1, minStarterApps: 1 });
        
        // M1: 1-0 win, goal at 10' by P3. Result never returns to tie. P3 gets +1.
        // M3: 1-2 win. Timeline: 1-0 (opp), 1-1 (our P3), 1-2 (our P4). 
        // Lead stays after 1-2. P4 gets +1.
        
        const p3 = stats.decisiveGoalsLeaders.find(s => s.playerId === 'P3');
        const p4 = stats.decisiveGoalsLeaders.find(s => s.playerId === 'P4');
        
        expect(p3?.decisiveGoals).toBe(1);
        expect(p4?.decisiveGoals).toBe(1);
        expect(p4?.confidence).toBe('high');
    });

    it('should compute lowest starter loss rate', () => {
        const stats = computeAdvancedStatsBundle('S1', mockMatches, mockLineups, {}, mockPlayers, { minPairMatches: 1, minStarterApps: 1 });
        
        // M4 is the only loss. Starters: P1, P4.
        const p1 = stats.lowestStarterLossRate.find(s => s.playerId === 'P1');
        const p3 = stats.lowestStarterLossRate.find(s => s.playerId === 'P3');
        
        expect(p1?.starterLosses).toBe(1);
        expect(p1?.starterApps).toBe(4);
        expect(p1?.lossRate).toBe(0.25);
        
        expect(p3?.starterLosses).toBe(0);
        expect(p3?.starterApps).toBe(2);
        expect(p3?.lossRate).toBe(0);
    });
});
