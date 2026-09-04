import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    collection,
    query,
    where,
    getDocs,
    writeBatch
} from 'firebase/firestore';
import { matchRepository } from './match-repository';
import { playerRepository } from './player-repository';
import { eventRepository } from './event-repository';
import { statsRepository } from './stats-repository';
import { lineupRepository } from './lineup-repository';
import type {
    Match,
    Player,
    MatchEvent,
    PlayerMatchStats,
    MatchLineup,
    AdvancedStatsLeaderboard
} from '../types';
import {
    computeAdvancedStatsBundle,
    AdvancedStatsOptions
} from '../../services/stats-advanced-service';
import { AdvancedStatsLeaderboardSchema } from '../schemas';

export interface TeamStatsRecord {
    wins: number;
    draws: number;
    losses: number;
    goalsFor: number;
    goalsAgainst: number;
    matchesPlayed: number;
}

export interface FullTeamRecord {
    overall: TeamStatsRecord;
    home: TeamStatsRecord;
    away: TeamStatsRecord;
}

/**
 * Contesto di dati completo per una stagione, caricato una sola volta per ottimizzare i calcoli.
 */
export interface SeasonDataContext {
    matches: Match[];
    players: Player[];
    matchesDetails: {
        [matchId: string]: {
            events: MatchEvent[];
            lineup?: MatchLineup;
            stats: PlayerMatchStats[];
        }
    };
}

export const aggregationRepository = {
    /**
     * Carica solo i dati necessari per il riepilogo (vittorie/sconfitte).
     * Molto veloce perché non scarica i dettagli delle singole partite.
     */
    async getSummaryContext(userId: string, seasonId: string): Promise<SeasonDataContext> {
        const [matches, players] = await Promise.all([
            matchRepository.getAll(userId, seasonId),
            playerRepository.getAll(userId, seasonId)
        ]);

        return { matches, players, matchesDetails: {} };
    },

    /**
     * Carica i dati dettagliati SOLO per le partite dove ha giocato un giocatore specifico.
     * Molto più veloce perché filtra lato server/DB prima di scaricare eventi/lineup/stats.
     */
    async getPlayerDetailedContext(userId: string, seasonId: string, playerId: string): Promise<SeasonDataContext> {
        const [matches, players] = await Promise.all([
            matchRepository.getAll(userId, seasonId),
            playerRepository.getAll(userId, seasonId)
        ]);

        const completedMatches = matches.filter(m => m.status === 'completed');

        // Prima scarica solo le lineup per trovare le partite dove ha giocato
        const lineups = await Promise.all(completedMatches.map(async (match) => {
            try {
                return await lineupRepository.getForMatch(match.id, seasonId, userId);
            } catch {
                return undefined;
            }
        }));

        // Filtra le partite dove il giocatore era titolare o in panchina
        const relevantMatchIds = completedMatches
            .filter((match, idx) => {
                const lineup = lineups[idx];
                if (!lineup) return false;
                const inStarters = lineup.starters.some(pid =>
                    (typeof pid === 'string' ? pid : pid.playerId) === playerId
                );
                const inSubs = lineup.substitutes.some(pid =>
                    (typeof pid === 'string' ? pid : pid.playerId) === playerId
                );
                return inStarters || inSubs;
            })
            .map(m => m.id);

        // Ora scarica dettagli COMPLETI solo per le partite rilevanti
        const detailsResults = await Promise.all(relevantMatchIds.map(async (matchId) => {
            try {
                const [events, lineup, stats] = await Promise.all([
                    eventRepository.getForMatch(matchId, seasonId, userId).catch(() => []),
                    lineupRepository.getForMatch(matchId, seasonId, userId).catch(() => undefined),
                    statsRepository.getForMatch(matchId, seasonId, userId).catch(() => [])
                ]);
                return { matchId, events, lineup, stats };
            } catch (e) {
                console.warn(`Could not fetch details for match ${matchId}`, e);
                return { matchId, events: [], lineup: undefined, stats: [] };
            }
        }));

        const matchesDetails: SeasonDataContext['matchesDetails'] = {};
        detailsResults.forEach(res => {
            matchesDetails[res.matchId] = {
                events: res.events,
                lineup: res.lineup,
                stats: res.stats
            };
        });

        return { matches, players, matchesDetails };
    },

    /**
     * Carica tutti i dati, inclusi eventi, formazioni e statistiche di ogni partita.
     * Usato per i grafici e le leaderboard.
     */
    async getDetailedContext(userId: string, seasonId: string): Promise<SeasonDataContext> {
        const [matches, players] = await Promise.all([
            matchRepository.getAll(userId, seasonId),
            playerRepository.getAll(userId, seasonId)
        ]);

        const completedMatches = matches.filter(m => m.status === 'completed');

        const detailsResults = await Promise.all(completedMatches.map(async (match) => {
            try {
                const [events, lineup, stats] = await Promise.all([
                    eventRepository.getForMatch(match.id, seasonId, userId).catch(() => []),
                    lineupRepository.getForMatch(match.id, seasonId, userId).catch(() => undefined),
                    statsRepository.getForMatch(match.id, seasonId, userId).catch(() => [])
                ]);
                return { matchId: match.id, events, lineup, stats };
            } catch (e) {
                console.warn(`Could not fetch details for match ${match.id}`, e);
                return { matchId: match.id, events: [], lineup: undefined, stats: [] };
            }
        }));

        const matchesDetails: SeasonDataContext['matchesDetails'] = {};
        detailsResults.forEach(res => {
            matchesDetails[res.matchId] = {
                events: res.events,
                lineup: res.lineup,
                stats: res.stats
            };
        });

        return { matches, players, matchesDetails };
    },

    getTeamRecordFromContext(context: SeasonDataContext): FullTeamRecord {
        const createRecord = (): TeamStatsRecord => ({
            wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, matchesPlayed: 0,
        });

        const record: FullTeamRecord = {
            overall: createRecord(),
            home: createRecord(),
            away: createRecord()
        };

        const completedMatches = context.matches.filter(m => m.status === 'completed');

        for (const match of completedMatches) {
            const result = match.result || { home: 0, away: 0 };

            const target = match.isHome ? record.home : record.away;
            record.overall.matchesPlayed++;
            target.matchesPlayed++;

            const homeGoals = result.home;
            const awayGoals = result.away;

            if (match.isHome) {
                record.overall.goalsFor += homeGoals;
                record.overall.goalsAgainst += awayGoals;
                target.goalsFor += homeGoals;
                target.goalsAgainst += awayGoals;

                if (homeGoals > awayGoals) { record.overall.wins++; target.wins++; }
                else if (homeGoals < awayGoals) { record.overall.losses++; target.losses++; }
                else { record.overall.draws++; target.draws++; }
            } else {
                record.overall.goalsFor += awayGoals;
                record.overall.goalsAgainst += homeGoals;
                target.goalsFor += awayGoals;
                target.goalsAgainst += homeGoals;

                if (awayGoals > homeGoals) { record.overall.wins++; target.wins++; }
                else if (awayGoals < homeGoals) { record.overall.losses++; target.losses++; }
                else { record.overall.draws++; target.draws++; }
            }
        }
        return record;
    },

    getTeamTrendFromContext(context: SeasonDataContext) {
        const completedMatches = context.matches.filter(m => m.status === 'completed');

        return completedMatches.map(match => {
            let value = 0;
            const { home, away } = match.result || { home: 0, away: 0 };
            if (match.isHome) {
                if (home > away) value = 1;
                else if (home < away) value = -1;
            } else {
                if (away > home) value = 1;
                else if (away < home) value = -1;
            }
            return {
                date: new Date(match.date).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
                opponent: match.opponent,
                value
            };
        }).filter((item): item is NonNullable<typeof item> => item !== null);
    },

    getGoalsByIntervalFromContext(context: SeasonDataContext) {
        const completedMatches = context.matches.filter(m => m.status === 'completed');

        let duration = 90;
        if (context.matches.length > 0) {
            const lastMatch = completedMatches[completedMatches.length - 1] || context.matches[context.matches.length - 1];
            if (lastMatch && lastMatch.duration) {
                duration = lastMatch.duration;
            }
        }

        const int1Limit = Math.round(duration / 3);
        const int2Limit = Math.round((duration * 2) / 3);

        const int1Key = `1-${int1Limit}`;
        const int2Key = `${int1Limit + 1}-${int2Limit}`;
        const int3Key = `${int2Limit + 1}-${duration}+`;

        const intervals: Record<string, number> = {
            [int1Key]: 0,
            [int2Key]: 0,
            [int3Key]: 0,
        };

        for (const match of completedMatches) {
            const details = context.matchesDetails[match.id];
            if (!details) continue;

            const matchDuration = match.duration || 90;
            const halfTime = Math.floor(matchDuration / 2);

            const isPitchManTeam = match.isHome ? 'home' : 'away';
            const goals = details.events.filter(e => e.type === 'goal' && e.team === isPitchManTeam);

            goals.forEach(event => {
                if (event.minute === null) {
                    intervals[int3Key]++;
                    return;
                }

                const min = event.minute;
                let absMin = 0;

                if (event.period === '1T') {
                    absMin = Math.min(min, halfTime);
                } else if (event.period === '2T') {
                    absMin = halfTime + Math.min(min, halfTime);
                } else {
                    absMin = matchDuration + min;
                }

                if (absMin <= int1Limit) intervals[int1Key]++;
                else if (absMin <= int2Limit) intervals[int2Key]++;
                else intervals[int3Key]++;
            });
        }

        return [
            { name: `${int1Key}'`, value: intervals[int1Key], fill: "#ace504" },
            { name: `${int2Key}'`, value: intervals[int2Key], fill: "rgba(172, 229, 4, 0.6)" },
            { name: `${int2Limit + 1}-${duration}'+`, value: intervals[int3Key], fill: "rgba(172, 229, 4, 0.3)" }
        ];
    },

    getPlayersAggregatedStatsFromContext(context: SeasonDataContext) {
        const completedMatches = context.matches.filter(m => m.status === 'completed');
        const results = [];

        for (const player of context.players) {
            let appearances = 0;
            let goals = 0;
            let assists = 0;
            let totalMinutes = 0;
            let yellowCards = 0;
            let redCards = 0;

            for (const match of completedMatches) {
                const details = context.matchesDetails[match.id];
                if (!details) continue;

                const isStarter = details.lineup?.starters.some(pid => (typeof pid === 'string' ? pid : pid.playerId) === player.id) ?? false;
                const playerStats = details.stats.find(s => s.playerId === player.id);
                const hasPlayed = isStarter || !!playerStats;

                if (hasPlayed) {
                    appearances++;
                    if (playerStats) {
                        totalMinutes += playerStats.minutesPlayed || 0;
                        yellowCards += playerStats.yellowCards || 0;
                        redCards += playerStats.redCards || 0;
                    }

                    const isPitchManSide = match.isHome ? 'home' : 'away';
                    // Nota: own_goal NON viene conteggiato come gol personale del giocatore
                    goals += details.events.filter(e => e.type === 'goal' && e.playerId === player.id && e.team === isPitchManSide).length;
                    assists += details.events.filter(e => e.type === 'goal' && e.assistPlayerId === player.id && e.team === isPitchManSide).length;
                }
            }

            results.push({
                playerId: player.id,
                name: player.name,
                stats: {
                    appearances,
                    goals,
                    assists,
                    avgMinutes: appearances > 0 ? Math.round(totalMinutes / appearances) : 0,
                    yellowCards,
                    redCards
                }
            });
        }
        return results;
    },

    // Compatibilità legacy e sync
    async syncAllPlayersStats(userId: string, seasonId?: string) {
        if (!userId || !seasonId) return;
        const context = await this.getDetailedContext(userId, seasonId);
        const allStats = this.getPlayersAggregatedStatsFromContext(context);
        for (const { playerId, stats } of allStats) {
            await playerRepository.update(playerId, seasonId, { stats });
        }
    },

    /**
     * Calcola le statistiche avanzate (Leaderboard) senza ricaricare il contesto dal DB.
     */
    getAdvancedStatsFromContext(context: SeasonDataContext, seasonId: string, options?: AdvancedStatsOptions): AdvancedStatsLeaderboard {
        const matches = context.matches;
        const players = context.players;
        const lineups: Record<string, MatchLineup> = {};
        const events: Record<string, MatchEvent[]> = {};

        Object.entries(context.matchesDetails).forEach(([id, details]) => {
            if (details.lineup) lineups[id] = details.lineup;
            events[id] = details.events;
        });

        return computeAdvancedStatsBundle(seasonId, matches, lineups, events, players, options);
    },

    /**
     * Calcola le statistiche avanzate (Leaderboard) per la stagione attuale ricaricando il DB.
     */
    async getAdvancedStats(userId: string, seasonId: string, options?: AdvancedStatsOptions): Promise<AdvancedStatsLeaderboard> {
        const context = await this.getDetailedContext(userId, seasonId);
        return this.getAdvancedStatsFromContext(context, seasonId, options);
    },

    /**
     * Calcola e salva le statistiche avanzate su Firestore.
     */
    async rebuildAndPersistSeasonAggregates(userId: string, seasonId: string, options?: AdvancedStatsOptions) {
        const leaderboard = await this.getAdvancedStats(userId, seasonId, options);
        const db = getFirestore();

        // 1. Salva leaderboard corrente
        const leaderboardRef = doc(db, 'teams', seasonId, 'aggregates', 'leaderboards', 'current', 'data');
        await setDoc(leaderboardRef, {
            ...leaderboard,
            teamOwnerId: userId,
            updatedAt: new Date().toISOString()
        });

        // 2. Opzionale: Salva i cbPair aggregati individualmente per query dirette
        const batch = writeBatch(db);
        leaderboard.bestCbPair.forEach(pair => {
            const pairRef = doc(db, 'teams', seasonId, 'aggregates', 'cbPairs', pair.pairKey);
            batch.set(pairRef, { ...pair, teamOwnerId: userId, updatedAt: new Date().toISOString() });
        });

        // 3. Opzionale: Aggiorna campi playerStats se necessario (ma già gestito da syncAllPlayersStats)

        await batch.commit();
        return leaderboard;
    },

    async getPersistedLeaderboard(seasonId: string): Promise<AdvancedStatsLeaderboard | undefined> {
        try {
            const db = getFirestore();
            const leaderboardRef = doc(db, 'teams', seasonId, 'aggregates', 'leaderboards', 'current', 'data');
            const snap = await getDoc(leaderboardRef);

            if (snap.exists()) {
                const data = snap.data();
                const parsed = AdvancedStatsLeaderboardSchema.safeParse(data);
                if (!parsed.success) {
                    console.error('Invalid leaderboard schema in Firestore', parsed.error);
                    return data as any as AdvancedStatsLeaderboard;
                }
                return parsed.data as AdvancedStatsLeaderboard;
            }
        } catch (error) {
            console.warn("Non è stato possibile caricare le statistiche persistite (possibile problema di permessi o documento mancante).", error);
        }
        return undefined;
    }
};