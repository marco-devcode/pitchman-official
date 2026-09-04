"use client";

import { create } from 'zustand';
import { aggregationRepository, type SeasonDataContext } from '@/lib/repositories/aggregation-repository';
import { useSeasonsStore } from './useSeasonsStore';
import { useAuthStore } from './useAuthStore';
import type { AdvancedStatsLeaderboard, MatchType } from '@/lib/types';
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
    detailedContext: SeasonDataContext | null;
    loadSummaryStats: (seasonId?: string) => Promise<void>;
    loadDetailedStats: (seasonId?: string) => Promise<void>;
    setMatchFilter: (filter: FilterType) => void;
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
    detailedContext: null,

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
            const currentFilter = get().matchFilter;
            const filtered = filterContextByType(context, currentFilter);
            const agg = reaggregate(filtered, activeSeasonId);

            set({
                detailedContext: context,
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
            set({ matchFilter: filter });
            return;
        }
        const filtered = filterContextByType(ctx, filter);
        const agg = reaggregate(filtered, activeSeasonId);
        set({ matchFilter: filter, ...agg });
    },
}));
