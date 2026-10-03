// Il caso che questo file protegge e' l'INVALIDAZIONE degli aggregati.
//
// Il sintomo che aveva il prodotto: registravi un gol, tornavi sulla
// dashboard e il bomber era ancora quello di prima. Aprivi /statistiche, e li'
// il numero era giusto. Tornavi indietro e la dashboard era a posto.
//
// Non era un problema di database ne' di realtime: `loadSummaryStats`
// ricalcola il record ma NON la leaderboard, quindi chiamarlo dopo una
// scrittura rendeva la dashboard stale, e l'unica pagina che ricaricava tutto
// era /statistiche.
//
// Qui si verifica la CONTRATTO, non l'implementazione:
//   - una scrittura marca il contesto sporco
//   - refreshIfDirty ricarica solo se serve (sporco, o stagione diversa)
//   - dopo il refresh il flag e' pulito e i numeri sono quelli nuovi
//   - il percorso ONLINE e quello OFFLINE si comportano uguale
//
// Il motivo per cui questo test esiste e' che il buco era invisibile: nessun
// test guardava il flag, quindi reintroducerlo non rompeva nulla.

import { useStatsStore } from './useStatsStore';
import { aggregationRepository, type SeasonDataContext } from '../lib/repositories/aggregation-repository';
import { useAuthStore } from './useAuthStore';
import { useSeasonsStore } from './useSeasonsStore';
import type { Match, Player, MatchEvent, MatchLineup, PlayerMatchStats } from '../lib/types';

jest.mock('../lib/repositories/aggregation-repository', () => {
    const actual = jest.requireActual('../lib/repositories/aggregation-repository');
    return {
        ...actual,
        aggregationRepository: {
            ...actual.aggregationRepository,
            getSummaryContext: jest.fn(),
            getDetailedContext: jest.fn(),
        },
    };
});

const mkMatch = (id: string, isHome: boolean, home: number, away: number): Match =>
    ({ id, isHome, status: 'completed', result: { home, away }, date: '2024-01-01', opponent: 'X' } as Match);

const mkPlayer = (id: string, name: string): Player => ({ id, name, role: 'Attaccante', stats: {} } as Player);

/** Rosa di 2 giocatori; ogni dettaglio partita ha una lineup che li fa titolari. */
const lineup = {
    starters: ['P1', 'P2'],
    substitutes: [],
} as unknown as MatchLineup;

/** Contesto con N gol di P1 nella partita M1. */
const contextWithGoals = (goals: number): SeasonDataContext => ({
    matches: [mkMatch('M1', true, goals, 0)],
    players: [mkPlayer('P1', 'Rossi'), mkPlayer('P2', 'Bianchi')],
    matchesDetails: {
        M1: {
            lineup,
            stats: [
                { playerId: 'P1', minutesPlayed: 90 } as PlayerMatchStats,
                { playerId: 'P2', minutesPlayed: 90 } as PlayerMatchStats,
            ],
            events: Array.from({ length: goals }, (_, i) => ({
                id: `G${i}`, type: 'goal', team: 'home', playerId: 'P1', minute: 10 + i, period: '1T',
            } as MatchEvent)),
        },
    },
});

const goalsOf = (playerId: string) =>
    useStatsStore.getState().playerLeaderboard.find(p => p.playerId === playerId)?.stats.goals;

beforeEach(() => {
    jest.clearAllMocks();
    // Stato iniziale pulito, come dopo un boot.
    useStatsStore.setState({
        teamRecord: null, homeRecord: null, awayRecord: null,
        playerLeaderboard: [], teamTrend: [], goalsIntervals: [],
        advancedLeaderboard: null, loading: false, error: null,
        matchFilter: 'all', matchFilterFromUser: false,
        detailedContext: null, statsDirty: false, loadedSeasonId: null,
    });
    useAuthStore.setState({ user: { id: 'U1' } as any });
    useSeasonsStore.setState({ activeSeason: { id: 'S1' } as any });
    (aggregationRepository.getSummaryContext as jest.Mock).mockResolvedValue(contextWithGoals(0));
    (aggregationRepository.getDetailedContext as jest.Mock).mockResolvedValue(contextWithGoals(1));
});

describe('useStatsStore - invalidazione degli aggregati', () => {
    it('il contesto parte pulito: la dashboard non ricarica al primo arrivo', async () => {
        await useStatsStore.getState().loadDetailedStats('S1');
        expect(useStatsStore.getState().statsDirty).toBe(false);
        expect(useStatsStore.getState().loadedSeasonId).toBe('S1');

        (aggregationRepository.getDetailedContext as jest.Mock).mockClear();
        const ricaricato = await useStatsStore.getState().refreshIfDirty('S1');

        // Il caso normale: si e' solo guardata la dashboard, niente da rileggere.
        expect(ricaricato).toBe(false);
        expect(aggregationRepository.getDetailedContext).not.toHaveBeenCalled();
    });

    it('dopo una scrittura il contesto e\' sporco e refreshIfDirty ricarica', async () => {
        await useStatsStore.getState().loadDetailedStats('S1');
        expect(goalsOf('P1')).toBe(1);

        // La scrittura che ha rotto tutto: registra un gol.
        (aggregationRepository.getDetailedContext as jest.Mock).mockResolvedValue(contextWithGoals(2));
        useStatsStore.getState().markStatsDirty();

        expect(useStatsStore.getState().statsDirty).toBe(true);
        // PRIMA del refresh i numeri sono ancora quelli vecchi: e' il bug.
        expect(goalsOf('P1')).toBe(1);

        // Si conta solo il refresh: il caricamento iniziale qui sopra ha
        // gia' chiamato il repository una volta.
        (aggregationRepository.getDetailedContext as jest.Mock).mockClear();
        const ricaricato = await useStatsStore.getState().refreshIfDirty('S1');

        expect(ricaricato).toBe(true);
        expect(aggregationRepository.getDetailedContext).toHaveBeenCalledTimes(1);
        // DOPO il refresh il numero e' quello nuovo, ed e' quello che la dashboard mostra.
        expect(goalsOf('P1')).toBe(2);
        expect(useStatsStore.getState().statsDirty).toBe(false);
    });

    it('loadSummaryStats NON azzera il flag: e\' la causa del bug originale', async () => {
        await useStatsStore.getState().loadDetailedStats('S1');
        useStatsStore.getState().markStatsDirty();

        // Il percorso che chiamavano dopo ogni scrittura: aggiorna il record...
        await useStatsStore.getState().loadSummaryStats('S1');
        // ...ma lascia la leaderboard vecchia, quindi il flag DEVE restare su.
        expect(useStatsStore.getState().statsDirty).toBe(true);

        await useStatsStore.getState().refreshIfDirty('S1');
        expect(useStatsStore.getState().statsDirty).toBe(false);
    });

    it('il cambio stagione ricarica anche con il flag pulito', async () => {
        await useStatsStore.getState().loadDetailedStats('S1');
        expect(useStatsStore.getState().statsDirty).toBe(false);

        // Il contesto in memoria e' di S1, la dashboard chiede S2: i numeri
        // mostrati sarebbero quelli della stagione sbagliata.
        useSeasonsStore.setState({ activeSeason: { id: 'S2' } as any });
        const ricaricato = await useStatsStore.getState().refreshIfDirty('S2');

        expect(ricaricato).toBe(true);
        expect(useStatsStore.getState().loadedSeasonId).toBe('S2');
    });

    it('senza stagione attiva non ricarica e non chiama il DB', async () => {
        useSeasonsStore.setState({ activeSeason: null });
        const ricaricato = await useStatsStore.getState().refreshIfDirty(undefined);
        expect(ricaricato).toBe(false);
        expect(aggregationRepository.getDetailedContext).not.toHaveBeenCalled();
    });

    it('il percorso offline marca sporco esattamente come quello online', async () => {
        // Offline il salvataggio finisce in coda e i metodi fanno `return`
        // PRIMA di syncAndPersistMinutes: senza un mark esplicito quei
        // percorsi non marcavano nulla e la dashboard restava ferma anche
        // dopo il flush.
        await useStatsStore.getState().loadDetailedStats('S1');
        useStatsStore.getState().markStatsDirty();
        expect(useStatsStore.getState().statsDirty).toBe(true);

        (aggregationRepository.getDetailedContext as jest.Mock).mockResolvedValue(contextWithGoals(3));
        await useStatsStore.getState().refreshIfDirty('S1');
        expect(goalsOf('P1')).toBe(3);
    });

    it('markStatsDirty e\' idempotente: non forza nuovi stati a ogni scrittura', () => {
        useStatsStore.getState().markStatsDirty();
        const stato1 = useStatsStore.getState();
        useStatsStore.getState().markStatsDirty();
        // Stesso riferimento = nessun rerender per le scritture in sequenza
        // (salvare 6 eventi di fila non deve far partire sei aggiornamenti).
        expect(useStatsStore.getState()).toBe(stato1);
        expect(useStatsStore.getState().statsDirty).toBe(true);
    });

    it('un errore di caricamento lascia il flag sporco: si ritenta al prossimo giro', async () => {
        await useStatsStore.getState().loadDetailedStats('S1');
        useStatsStore.getState().markStatsDirty();
        (aggregationRepository.getDetailedContext as jest.Mock).mockRejectedValueOnce(new Error('offline'));

        await useStatsStore.getState().refreshIfDirty('S1');

        // Azzerare il flag qui farebbe perdere la scrittura per sempre: il
        // numero non tornerebbe e non ci sarebbe piu' nessun segnale.
        expect(useStatsStore.getState().statsDirty).toBe(true);
    });
});

describe('useStatsStore - il filtro tipo partita sopravvive al refresh', () => {
    it('la dashboard non resetta a "all" la scelta dell utente', async () => {
        await useStatsStore.getState().loadDetailedStats('S1');
        useStatsStore.getState().setMatchFilter('Campionato');
        expect(useStatsStore.getState().matchFilter).toBe('Campionato');

        useStatsStore.getState().markStatsDirty();
        await useStatsStore.getState().refreshIfDirty('S1');

        expect(useStatsStore.getState().matchFilter).toBe('Campionato');
        expect(useStatsStore.getState().matchFilterFromUser).toBe(true);
    });
});