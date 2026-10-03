"use client";

import { create } from 'zustand';
import { aggregationRepository, type SeasonDataContext } from '@/lib/repositories/aggregation-repository';
import { useSeasonsStore } from './useSeasonsStore';
import { useAuthStore } from './useAuthStore';
import { useSettingsStore } from './useSettingsStore';
import type { AdvancedStatsLeaderboard, MatchType } from '@/lib/types';
import type { PlayerUsageCounts } from '@/lib/player-usage';
import { getErrorMessage } from '@/lib/error-utils';
import { filterContextByType, type FilterType } from '@/lib/aggregators/filter';

interface TeamRecord {
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    matchesPlayed: number;
}

interface PlayerLeaderboardEntry {
    playerId: string;
    name: string;
    firstName?: string;
    lastName?: string;
    stats: {
        appearances: number;
        goals: number;
        assists: number;
        avgMinutes: number;
        yellowCards: number;
        redCards: number;
    };
    /** Pan / Sub / NC: la panchina NON e' una presenza, quindi va contata qui */
    usage?: PlayerUsageCounts;
}

interface TrendEntry {
    date: string;
    opponent: string;
    value: number;
}

interface IntervalEntry {
    name: string;
    value: number;
    fill: string;
}

interface StatsState {
    teamRecord: TeamRecord | null;
    homeRecord: TeamRecord | null;
    awayRecord: TeamRecord | null;
    playerLeaderboard: PlayerLeaderboardEntry[];
    teamTrend: TrendEntry[];
    goalsIntervals: IntervalEntry[];
    advancedLeaderboard: AdvancedStatsLeaderboard | null;
    loading: boolean;
    error: string | null;
    matchFilter: FilterType;
    /** true se l'utente ha scelto la tab a mano: la preferenza salvata non la sovrascrive */
    matchFilterFromUser: boolean;
    detailedContext: SeasonDataContext | null;
    /**
     * true se qualcosa ha scritto dopo l'ultimo loadDetailedStats riuscito.
     *
     * Il riepilogo e la leaderboard sono due viste diverse dello stesso dato:
     * `loadSummaryStats` ricalcola il record ma NON la leaderboard, quindi
     * chiamarlo dopo una scrittura rende la dashboard (che legge la
     * leaderboard) stale fino alla prossima pagina /statistiche. Qui si
     * marca invece il contesto come sporco e si lascia decidere a chi
     * visualizza la dashboard quanto ricaricare: il refresh completo costa 3
     * query per partita completata, e va pagato solo quando serve vederlo.
     */
    statsDirty: boolean;
    /**
     * Stagione per cui `detailedContext` e gli aggregati sono validi.
     *
     * Serve a coprire il cambio stagione, che non e' una "scrittura": il flag
     * puo' essere pulito mentre il contesto in memoria appartiene ancora alla
     * stagione precedente, e la dashboard mostrerebbe i numeri dell'altra.
     */
    loadedSeasonId: string | null;
    /** Segnala che gli aggregati in memoria non riflettono piu' Firestore */
    markStatsDirty: () => void;
    /** Ricarica gli aggregati se sporchi o di un'altra stagione: ritorna true se ha ricaricato */
    refreshIfDirty: (seasonId?: string) => Promise<boolean>;
    loadSummaryStats: (seasonId?: string) => Promise<void>;
    loadDetailedStats: (seasonId?: string) => Promise<void>;
    setMatchFilter: (filter: FilterType) => void;
    /** Riapplica la preferenza salvata in Gestione Squadra (azzera la scelta manuale) */
    applyDefaultFilter: () => void;
}

function reaggregate(ctx: SeasonDataContext, seasonId: string) {
    const records = aggregationRepository.getTeamRecordFromContext(ctx);
    const playerLeaderboard = aggregationRepository.getPlayersAggregatedStatsFromContext(ctx);
    const teamTrend = aggregationRepository.getTeamTrendFromContext(ctx);
    const goalsIntervals = aggregationRepository.getGoalsByIntervalFromContext(ctx);
    const advancedLeaderboard = aggregationRepository.getAdvancedStatsFromContext(ctx, seasonId);
    const sorted = [...playerLeaderboard].sort((a, b) => {
        if (b.stats.goals !== a.stats.goals) return b.stats.goals - a.stats.goals;
        if (b.stats.assists !== a.stats.assists) return b.stats.assists - a.stats.assists;
        return b.stats.appearances - a.stats.appearances;
    });
    return {
        teamRecord: records.overall,
        homeRecord: records.home,
        awayRecord: records.away,
        playerLeaderboard: sorted as PlayerLeaderboardEntry[],
        teamTrend: teamTrend as TrendEntry[],
        goalsIntervals,
        advancedLeaderboard,
    };
}

export const useStatsStore = create<StatsState>((set, get) => ({
    teamRecord: null,
    homeRecord: null,
    awayRecord: null,
    playerLeaderboard: [],
    teamTrend: [],
    goalsIntervals: [],
    advancedLeaderboard: null,
    loading: true,
    error: null,
    matchFilter: 'all',
    matchFilterFromUser: false,
    detailedContext: null,
    statsDirty: false,
    loadedSeasonId: null,

    // Idempotente sul valore: se e' gia' sporco non si crea un nuovo stato
    // (e quindi non si forza un rerender) per ogni scrittura in sequenza.
    markStatsDirty: () => { if (!get().statsDirty) set({ statsDirty: true }); },

    refreshIfDirty: async (seasonId?: string) => {
        const target = seasonId ?? useSeasonsStore.getState().activeSeason?.id;

        // Senza stagione non c'e' niente da ricaricare. Va detto PRIMA del
        // confronto: `loadedSeasonId` (null) === target (undefined) e' falso,
        // quindi senza questo controllo si entrava in loadDetailedStats, che
        // usciva subito, e refreshIfDirty ritornava true mentendo: il
        // chiamante credeva i numeri freschi mentre erano quelli di prima.
        if (!target) return false;

        const state = get();

        // Niente da fare se il contesto e' pulito E gia' della stagione
        // richiesta: e' il caso normale al primo arrivo sulla dashboard, e
        // ricaricare li' costerebbe 3 query per partita completata senza
        // motivo. Il cambio stagione ricarica perche' loadedSeasonId non
        // combacia, anche con il flag pulito.
        if (!state.statsDirty && state.loadedSeasonId === target) return false;

        await state.loadDetailedStats(target);
        return true;
    },

    loadSummaryStats: async (seasonId?: string) => {
        const user = useAuthStore.getState().user;
        const activeSeasonId = seasonId ?? useSeasonsStore.getState().activeSeason?.id;

        if (!user || !activeSeasonId) {
            set({ loading: false });
            return;
        }

        if (get().teamRecord === null) set({ loading: true, error: null });

        try {
            const context = await aggregationRepository.getSummaryContext(user.id, activeSeasonId);
            const records = aggregationRepository.getTeamRecordFromContext(context);

            set({
                teamRecord: records.overall,
                homeRecord: records.home,
                awayRecord: records.away,
                loading: false,
                error: null,
            });
        } catch (error) {
            console.error("Errore nel caricamento summary stats:", error);
            set({ loading: false, error: getErrorMessage(error) });
        }
    },

    loadDetailedStats: async (seasonId?: string) => {
        const user = useAuthStore.getState().user;
        const activeSeasonId = seasonId ?? useSeasonsStore.getState().activeSeason?.id;

        if (!user || !activeSeasonId) {
            set({ loading: false });
            return;
        }

        if (get().playerLeaderboard.length === 0) set({ loading: true, error: null });

        try {
            const context = await aggregationRepository.getDetailedContext(user.id, activeSeasonId);
            // Se l'utente non ha ancora scelto una tab, si usa la preferenza salvata in Gestione Squadra.
            const currentFilter = get().matchFilterFromUser
                ? get().matchFilter
                : (useSettingsStore.getState().statsDefaultFilter ?? 'all');
            const filtered = filterContextByType(context, currentFilter);
            const agg = reaggregate(filtered, activeSeasonId);

            set({
                detailedContext: context,
                matchFilter: currentFilter,
                statsDirty: false,
                loadedSeasonId: activeSeasonId,
                ...agg,
                loading: false,
                error: null,
            });
        } catch (error) {
            console.error("Errore nel caricamento detailed stats:", error);
            set({ loading: false, error: getErrorMessage(error) });
        }
    },

    setMatchFilter: (filter: FilterType) => {
        const ctx = get().detailedContext;
        const activeSeasonId = useSeasonsStore.getState().activeSeason?.id;
        if (!ctx || !activeSeasonId) {
            set({ matchFilter: filter, matchFilterFromUser: true });
            return;
        }
        const filtered = filterContextByType(ctx, filter);
        const agg = reaggregate(filtered, activeSeasonId);
        set({ matchFilter: filter, matchFilterFromUser: true, ...agg });
    },

    applyDefaultFilter: () => {
        const filter = useSettingsStore.getState().statsDefaultFilter ?? 'all';
        const ctx = get().detailedContext;
        const activeSeasonId = useSeasonsStore.getState().activeSeason?.id;
        if (!ctx || !activeSeasonId) {
            set({ matchFilter: filter, matchFilterFromUser: false });
            return;
        }
        const filtered = filterContextByType(ctx, filter);
        const agg = reaggregate(filtered, activeSeasonId);
        set({ matchFilter: filter, matchFilterFromUser: false, ...agg });
    },
}));
