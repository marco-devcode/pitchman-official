// Questo file protegge UNA cosa sola: che ogni percorso di scrittura dei
// match segnali gli aggregati come sporchi.
//
// Il buco originale non era in un algoritmo: era che la dashboard legge
// `playerLeaderboard` (aggiornata solo da loadDetailedStats) mentre i metodi
// di scrittura chiamavano `loadSummaryStats`, che NON la tocca. Il risultato
// era: registri un gol, torni sulla dashboard, il numero e' vecchio; apri
// /statistiche, e' giusto.
//
// Qui non si verifica COME si marca il flag (lo fa useStatsStore.test.ts),
// ma che si marca davvero in TUTTI i metodi che scrivono. Il perche' di un
// test dedicato: il buco era gia' comparso una volta, sui percorsi OFFLINE
// (che fanno `return` prima di syncAndPersistMinutes), ed e' tornabile con
// un nuovo metodo che nessuno ricorda di aggiornare.

jest.mock('@/lib/repositories/event-repository', () => ({
    eventRepository: {
        add: jest.fn(async (e: any) => ({ ...e, id: 'SERVER1' })),
        update: jest.fn(async () => ({})),
        delete: jest.fn(async () => ({})),
        getForMatch: jest.fn(async () => []),
    },
}));

jest.mock('@/lib/repositories/lineup-repository', () => ({
    lineupRepository: {
        save: jest.fn(async () => ({})),
        getForMatch: jest.fn(async () => null),
    },
}));

jest.mock('@/lib/repositories/stats-repository', () => ({
    statsRepository: {
        upsert: jest.fn(async () => ({})),
        getForMatch: jest.fn(async () => []),
    },
}));

jest.mock('@/lib/repositories/match-repository', () => ({
    matchRepository: {
        update: jest.fn(async () => ({})),
        getById: jest.fn(async () => null),
        // syncAndPersistMinutes chiama aggregationRepository.syncAllPlayersStats,
        // che rilegge TUTTA la stagione: serve getAll o il processo muore qui.
        getAll: jest.fn(async () => []),
    },
}));

jest.mock('@/lib/repositories/aggregation-repository', () => ({
    aggregationRepository: {
        syncAllPlayersStats: jest.fn(async () => {}),
        // Dopo aver salvato le stats, syncAndPersistMinutes chiama anche
        // loadSummaryStats. Senza questo, il mock mancante fareva scattare un
        // console.error a ogni test: rumore che non riguarda il contratto
        // verificato qui (l'invalidazione), solo la catena di chiamate.
        getSummaryContext: jest.fn(async () => ({ matches: [], players: [], matchesDetails: {} })),
    },
}));

jest.mock('@/lib/repositories/player-repository', () => ({
    playerRepository: {
        getAll: jest.fn(async () => []),
        update: jest.fn(async () => ({})),
    },
}));

// La coda offline: si registrano le mutazioni accodate, cosi' il test puo'
// verificare che anche quei percorsi (che NON chiamano i repository)
// invalidino gli aggregati.
// Firebase e' gia' mockato in jest.setup.js per tutte le suite: qui non si
// ripete, altrimenti una copia che invecchia e mente.

const enqueued: any[] = [];
jest.mock('@/lib/sync-queue', () => ({
    enqueueMutation: jest.fn(async (m: any) => { enqueued.push(m); }),
    isOffline: jest.fn(() => false),
    flushQueue: jest.fn(async () => 0),
    startSyncListeners: jest.fn(() => () => {}),
}));

import { useMatchDetailStore } from './useMatchDetailStore';
import { useStatsStore } from './useStatsStore';
import { useAuthStore } from './useAuthStore';
import { useSeasonsStore } from './useSeasonsStore';
import { isOffline } from '@/lib/sync-queue';
import { eventRepository } from '@/lib/repositories/event-repository';
import { lineupRepository } from '@/lib/repositories/lineup-repository';

const mockOffline = (v: boolean) => (isOffline as jest.Mock).mockReturnValue(v);

const lineup = {
    starters: ['P1'],
    substitutes: ['P2'],
} as any;

/** Prepara lo store con una partita in memoria, senza passare dai repository. */
const primeStore = (matchOverrides: Record<string, any> = {}) => {
    // I metodi di scrittura escono subito se non c'e' un utente
    // (`if (!matchId || !match || !user) return`), quindi senza questo
    // l'invalidazione non viene proprio eseguita e il test passerebbe/
    // fallirebbe per il motivo sbagliato.
    useAuthStore.setState({ user: { id: 'U1' } as any, isAuthenticated: true, isInitialized: true });
    useSeasonsStore.setState({ activeSeason: { id: 'S1' } as any });

    useMatchDetailStore.setState({
        matchId: 'M1',
        match: {
            id: 'M1', seasonId: 'S1', isHome: true, status: 'completed',
            result: { home: 0, away: 0 }, duration: 90, opponent: 'X', date: '2026-01-01',
            ...matchOverrides,
        } as any,
        events: [],
        lineup,
        stats: [],
        allPlayers: [
            { id: 'P1', name: 'Rossi' } as any,
            { id: 'P2', name: 'Bianchi' } as any,
        ],
        loading: false,
        error: null,
    });
    useStatsStore.setState({ statsDirty: false, loadedSeasonId: 'S1' });
};

const isDirty = () => useStatsStore.getState().statsDirty;

beforeEach(() => {
    jest.clearAllMocks();
    enqueued.length = 0;
    mockOffline(false);
    primeStore();
});

describe('useMatchDetailStore - ogni scrittura invalida gli aggregati', () => {
    describe('online', () => {
        it('addEvent (gol)', async () => {
            await useMatchDetailStore.getState().addEvent({
                type: 'goal', team: 'home', playerId: 'P1', minute: 20, period: '1T',
            } as any);
            expect(isDirty()).toBe(true);
        });

        it('addEvents (gol multipli)', async () => {
            await useMatchDetailStore.getState().addEvents([
                { type: 'goal', team: 'home', playerId: 'P1', minute: 20, period: '1T' } as any,
                { type: 'yellow_card', team: 'home', playerId: 'P2', minute: 30, period: '1T' } as any,
            ]);
            expect(isDirty()).toBe(true);
        });

        it('updateEvent', async () => {
            await useMatchDetailStore.getState().addEvent({
                type: 'goal', team: 'home', playerId: 'P1', minute: 20, period: '1T',
            } as any);
            // riparto pulito per misurare solo updateEvent
            useStatsStore.setState({ statsDirty: false });
            const eventId = useMatchDetailStore.getState().events[0].id;
            await useMatchDetailStore.getState().updateEvent(eventId, { minute: 25 } as any);
            expect(isDirty()).toBe(true);
        });

        it('deleteEvent', async () => {
            await useMatchDetailStore.getState().addEvent({
                type: 'goal', team: 'home', playerId: 'P1', minute: 20, period: '1T',
            } as any);
            useStatsStore.setState({ statsDirty: false });
            const eventId = useMatchDetailStore.getState().events[0].id;
            await useMatchDetailStore.getState().deleteEvent(eventId);
            expect(isDirty()).toBe(true);
        });

        it('updateMatch (risultato e stato)', async () => {
            await useMatchDetailStore.getState().updateMatch({ result: { home: 3, away: 1 } });
            expect(isDirty()).toBe(true);
        });

        it('updateMatch (solo durata: niente di rilevante, resta coerente)', async () => {
            // Non e' il caso che deve marcare, ma marcare non e' un danno:
            // refreshIfDirty ricarica una volta sola al prossimo arrivo.
            // Il test documenta che marcare qui non e' un bug.
            await useMatchDetailStore.getState().updateMatch({ duration: 90 });
            expect(isDirty()).toBe(true);
        });

        it('saveLineup (formazione: presenze e minuti cambiano)', async () => {
            await useMatchDetailStore.getState().saveLineup(lineup);
            expect(isDirty()).toBe(true);
        });

        it('saveAllStats (statistiche salvate a mano)', async () => {
            await useMatchDetailStore.getState().saveAllStats([
                { playerId: 'P1', minutesPlayed: 90 } as any,
            ]);
            expect(isDirty()).toBe(true);
        });
    });

    describe('offline', () => {
        // Sono i percorsi che fanno `return` PRIMA di chiamare
        // syncAndPersistMinutes, e quindi non transitavano dal punto unico di
        // invalidazione: erano gia' il buco una volta.
        it('addEvent accodato', async () => {
            mockOffline(true);
            await useMatchDetailStore.getState().addEvent({
                type: 'goal', team: 'home', playerId: 'P1', minute: 20, period: '1T',
            } as any);
            expect(enqueued.length).toBe(1);
            expect(isDirty()).toBe(true);
        });

        it('updateEvent accodato', async () => {
            await useMatchDetailStore.getState().addEvent({
                type: 'goal', team: 'home', playerId: 'P1', minute: 20, period: '1T',
            } as any);
            const eventId = useMatchDetailStore.getState().events[0].id;

            useStatsStore.setState({ statsDirty: false });
            enqueued.length = 0;
            mockOffline(true);
            await useMatchDetailStore.getState().updateEvent(eventId, { minute: 30 } as any);

            expect(enqueued.length).toBe(1);
            expect(isDirty()).toBe(true);
        });

        it('deleteEvent accodato', async () => {
            await useMatchDetailStore.getState().addEvent({
                type: 'goal', team: 'home', playerId: 'P1', minute: 20, period: '1T',
            } as any);
            const eventId = useMatchDetailStore.getState().events[0].id;

            useStatsStore.setState({ statsDirty: false });
            enqueued.length = 0;
            mockOffline(true);
            await useMatchDetailStore.getState().deleteEvent(eventId);

            expect(enqueued.length).toBe(1);
            expect(isDirty()).toBe(true);
        });

        it('saveLineup accodato', async () => {
            mockOffline(true);
            await useMatchDetailStore.getState().saveLineup(lineup);
            expect(enqueued.length).toBe(1);
            expect(isDirty()).toBe(true);
        });

        it('saveAllStats accodato', async () => {
            mockOffline(true);
            await useMatchDetailStore.getState().saveAllStats([
                { playerId: 'P1', minutesPlayed: 45 } as any,
            ]);
            expect(enqueued.length).toBe(1);
            expect(isDirty()).toBe(true);
        });

        it('load che RIPARA un risultato stantio invalida anche lui', async () => {
            // `load` e' un lettore, ma se corregge il campo result salvato o
            // completa una partita passata, scrive davvero: il record cambia e
            // la dashboard deve rivederlo.
            const { matchRepository } = require('@/lib/repositories/match-repository');
            matchRepository.getById.mockResolvedValue({
                id: 'M1', seasonId: 'S1', isHome: true, status: 'completed',
                // Deliberatamente stantio: 0-0 mentre gli eventi dicono 2-0.
                result: { home: 0, away: 0 }, date: '2026-01-01', opponent: 'X',
            });
            (eventRepository.getForMatch as jest.Mock).mockResolvedValue([
                { id: 'G1', type: 'goal', team: 'home', playerId: 'P1', minute: 10, period: '1T' },
                { id: 'G2', type: 'goal', team: 'home', playerId: 'P1', minute: 20, period: '1T' },
            ]);

            useStatsStore.setState({ statsDirty: false });
            await useMatchDetailStore.getState().load('M1', 'S1');

            expect(matchRepository.update).toHaveBeenCalled();
            expect(isDirty()).toBe(true);
        });
    });

    it('syncAndPersistMinutes e\' il punto unico per i percorsi che ci passano', async () => {
        // Se domani un nuovo metodo di scrittura che chiama
        // syncAndPersistMinutes, non serve ricordarsi del flag: e' gia' la'.
        await useMatchDetailStore.getState().syncAndPersistMinutes();
        expect(isDirty()).toBe(true);
    });
});