import { 
    Match,
    MatchEvent,
    MatchLineup,
    Player,
    AdvancedStatsLeaderboard,
    StarterPlayer,
    getPrimaryRole
} from '../lib/types';

export interface AdvancedStatsOptions {
    minStarterApps: number;
    minPairMatches: number;
}

const DEFAULT_OPTIONS: AdvancedStatsOptions = {
    minStarterApps: 3,
    minPairMatches: 3
};

/**
 * ADAPTERS: Normalize legacy data to the target schema
 */

export function normalizeMatch(match: Match): Match {
    const isHome = match.isHome;
    const result = match.result || { home: 0, away: 0 };
    const teamGoals = isHome ? result.home : result.away;
    const opponentGoals = isHome ? result.away : result.home;
    
    let resultType: 'W' | 'D' | 'L' | undefined;
    if (teamGoals > opponentGoals) resultType = 'W';
    else if (teamGoals < opponentGoals) resultType = 'L';
    else resultType = 'D';

    return {
        ...match,
        // DERIVATI, non persistiti: si ricalcolano da result a ogni lettura.
        //
        // Prima veniva usato `match.teamGoals ?? teamGoals`, cioe' se il
        // campo persistito esisteva vinceva quello. Ma nessuno scrive mai
        // teamGoals/opponentGoals su Firestore, e un valore presente in un
        // documento vecchio restava l'unico letto: il calendario mostrava 0-0
        // anche con result corretto a 6-0. Per partita: due fonti di verita'
        // e la stantia vinceva sempre perche' era la prima.
        //
        // result e' la sola fonte: e' quello che il calendario, la pagina
        // partita e i calcoli dei minuti leggono e ricalcolano.
        teamGoals,
        opponentGoals,
        resultType: match.resultType ?? resultType
    };
}

export function normalizeLineup(lineup: MatchLineup | undefined, players: Player[]): MatchLineup {
    if (!lineup) {
        return { matchId: '', starters: [], substitutes: [] };
    }

    const mapToStarter = (p: string | StarterPlayer): StarterPlayer => {
        if (typeof p === 'string') {
            const player = players.find(pl => pl.id === p);
            return {
                playerId: p,
                role: player ? getPrimaryRole(player) : 'DC',
                positionCode: undefined
            };
        }
        return p;
    };

    return {
        ...lineup,
        starters: lineup.starters.map(mapToStarter),
        substitutes: lineup.substitutes.map(mapToStarter)
    };
}

export function normalizeEvent(event: MatchEvent, match: Match): MatchEvent {
    const isOurTeam = event.team === (match.isHome ? 'home' : 'away');
    return {
        ...event,
        teamSide: event.teamSide ?? (isOurTeam ? 'our' : 'opponent')
    };
}

/**
 * BUSINESS LOGIC: Core stats computation
 */

export function computeBestDefenseStats(
    matches: Match[],
    lineups: Record<string, MatchLineup>,
    players: Player[],
    options: AdvancedStatsOptions = DEFAULT_OPTIONS
): { bestCbPair: AdvancedStatsLeaderboard['bestCbPair'], bestCbTrio: AdvancedStatsLeaderboard['bestCbTrio'] } {
    const pairs: Record<string, { matchesTogether: number; goalsConceded: number; playerIds: string[] }> = {};
    const trios: Record<string, { matchesTogether: number; goalsConceded: number; playerIds: string[] }> = {};

    matches.forEach(m => {
        if (m.status !== 'completed' && (m.status as string) !== 'played') return;
        const normalizedMatch = normalizeMatch(m);
        const lineup = normalizeLineup(lineups[m.id], players);
        const formation = lineup.formation || '4-4-2';
        
        let targetCbs: string[] = [];
        let type: 'pair' | 'trio' | 'none' = 'none';

        if (formation.startsWith('4')) {
            // Difesa a 4: i centrali sono agli indici 2 e 3
            const s2 = lineup.starters[2];
            const s3 = lineup.starters[3];
            const p1 = s2 ? (typeof s2 === 'string' ? s2 : s2.playerId) : null;
            const p2 = s3 ? (typeof s3 === 'string' ? s3 : s3.playerId) : null;
            if (p1 && p2) {
                targetCbs = [p1, p2];
                type = 'pair';
            }
        } else if (formation.startsWith('3')) {
            // Difesa a 3: i tre centrali sono agli indici 1, 2 e 3
            const s1 = lineup.starters[1];
            const s2 = lineup.starters[2];
            const s3 = lineup.starters[3];
            const p1 = s1 ? (typeof s1 === 'string' ? s1 : s1.playerId) : null;
            const p2 = s2 ? (typeof s2 === 'string' ? s2 : s2.playerId) : null;
            const p3 = s3 ? (typeof s3 === 'string' ? s3 : s3.playerId) : null;
            if (p1 && p2 && p3) {
                targetCbs = [p1, p2, p3];
                type = 'trio';
            }
        }

        if (type === 'pair' && targetCbs.length === 2) {
            const ids = [...targetCbs].sort();
            const key = ids.join('|');
            if (!pairs[key]) pairs[key] = { matchesTogether: 0, goalsConceded: 0, playerIds: ids };
            pairs[key].matchesTogether += 1;
            pairs[key].goalsConceded += normalizedMatch.opponentGoals ?? 0;
        } else if (type === 'trio' && targetCbs.length === 3) {
            const ids = [...targetCbs].sort();
            const key = ids.join('|');
            if (!trios[key]) trios[key] = { matchesTogether: 0, goalsConceded: 0, playerIds: ids };
            trios[key].matchesTogether += 1;
            trios[key].goalsConceded += normalizedMatch.opponentGoals ?? 0;
        }
    });

    const rank = (items: Record<string, { matchesTogether: number; goalsConceded: number; playerIds: string[] }>, keyName: 'pairKey' | 'trioKey') => {
        return Object.entries(items)
            .map(([key, data]) => ({
                [keyName]: key,
                playerIds: data.playerIds,
                matchesTogether: data.matchesTogether,
                goalsConceded: data.goalsConceded,
                goalsConcededPerMatch: data.goalsConceded / data.matchesTogether
            }))
            .filter(p => p.matchesTogether >= options.minPairMatches)
            .sort((a, b) => {
                if (a.goalsConcededPerMatch !== b.goalsConcededPerMatch) return a.goalsConcededPerMatch - b.goalsConcededPerMatch;
                if (a.matchesTogether !== b.matchesTogether) return b.matchesTogether - a.matchesTogether;
                return (a[keyName] as string).localeCompare(b[keyName] as string);
            }) as any[];
    };

    return {
        bestCbPair: rank(pairs, 'pairKey'),
        bestCbTrio: rank(trios, 'trioKey')
    };
}

export function computeBestGaPerStarter(
    matches: Match[],
    lineups: Record<string, MatchLineup>,
    events: Record<string, MatchEvent[]>,
    players: Player[],
    options: AdvancedStatsOptions = DEFAULT_OPTIONS
): AdvancedStatsLeaderboard['bestGaPerStarter'] {
    const stats: Record<string, { goals: number; assists: number; starterApps: number }> = {};

    players.forEach(p => {
        stats[p.id] = { goals: 0, assists: 0, starterApps: 0 };
    });

    matches.forEach(m => {
        if (m.status !== 'completed' && (m.status as string) !== 'played') return;
        const lineup = normalizeLineup(lineups[m.id], players);
        const matchEvents = (events[m.id] || []).map(e => normalizeEvent(e, m));

        lineup.starters.forEach(s => {
            const pid = (s as StarterPlayer).playerId;
            if (stats[pid]) stats[pid].starterApps += 1;
        });

        matchEvents.forEach(e => {
            if (e.type === 'goal' && e.teamSide === 'our') {
                if (e.playerId && stats[e.playerId]) stats[e.playerId].goals += 1;
                if (e.assistPlayerId && stats[e.assistPlayerId]) stats[e.assistPlayerId].assists += 1;
            } else if (e.type === 'assist' && e.teamSide === 'our') {
                if (e.playerId && stats[e.playerId]) stats[e.playerId].assists += 1;
            }
        });
    });

    return Object.entries(stats)
        .map(([playerId, data]) => ({
            playerId,
            goals: data.goals,
            assists: data.assists,
            starterApps: data.starterApps,
            gaPerStarter: data.starterApps > 0 ? (data.goals + data.assists) / data.starterApps : 0
        }))
        .filter(p => p.starterApps >= options.minStarterApps)
        .sort((a, b) => {
            if (b.gaPerStarter !== a.gaPerStarter) return b.gaPerStarter - a.gaPerStarter;
            if ((b.goals + b.assists) !== (a.goals + a.assists)) return (b.goals + b.assists) - (a.goals + a.assists);
            if (b.starterApps !== a.starterApps) return b.starterApps - a.starterApps;
            return a.playerId.localeCompare(b.playerId);
        });
}

function getPeriodOrder(period: string): number {
    switch (period) {
        case '1T': return 1;
        case '2T': return 2;
        case '1TS': return 3;
        case '2TS': return 4;
        default: return 5;
    }
}

export function computeDecisiveGoals(
    matches: Match[],
    events: Record<string, MatchEvent[]>,
    options: AdvancedStatsOptions = DEFAULT_OPTIONS
): AdvancedStatsLeaderboard['decisiveGoalsLeaders'] {
    const decisiveCounts: Record<string, { count: number; highConfidence: boolean }> = {};

    matches.forEach(m => {
        if (m.status !== 'completed' && (m.status as string) !== 'played') return;
        const normalizedMatch = normalizeMatch(m);
        if (normalizedMatch.resultType !== 'W') return;

        const matchEvents = (events[m.id] || []).map(e => normalizeEvent(e, m))
            .filter(e => e.type === 'goal' || e.type === 'own_goal')
            .sort((a, b) => {
                const poA = getPeriodOrder(a.period);
                const poB = getPeriodOrder(b.period);
                if (poA !== poB) return poA - poB;
                return (a.minute ?? 0) - (b.minute ?? 0);
            });

        // Check if we have opponent goals in the events. If not, confidence is mixed.
        const hasOpponentGoalEvents = matchEvents.some(e => e.teamSide === 'opponent');
        const expectedOpponentGoals = normalizedMatch.opponentGoals ?? 0;
        const actualOpponentGoalEvents = matchEvents.filter(e => e.teamSide === 'opponent').length;
        const isHighConfidence = hasOpponentGoalEvents || expectedOpponentGoals === 0;
        // In theory, if expectedOpponentGoals > actualOpponentGoalEvents, we are missing some events.
        const confidence = (isHighConfidence && (actualOpponentGoalEvents === expectedOpponentGoals)) ? 'high' : 'mixed';

        let ourScore = 0;
        let oppScore = 0;
        const history: Array<{ scorerId: string | undefined; teamSide: 'our' | 'opponent'; scoreAfter: [number, number] }> = [];

        matchEvents.forEach(e => {
            // Per own_goal, il gol va alla squadra avversaria di chi lo segna
            const effectiveTeamSide = e.type === 'own_goal' 
                ? (e.teamSide === 'our' ? 'opponent' : 'our')
                : e.teamSide;
            if (effectiveTeamSide === 'our') ourScore++;
            else oppScore++;
            history.push({ scorerId: e.type === 'goal' ? e.playerId : undefined, teamSide: effectiveTeamSide as 'our' | 'opponent', scoreAfter: [ourScore, oppScore] });
        });

        // Search for the first goal after which we stay in the lead until the end.
        // We evaluate each 'our' goal.
        let firstDecisiveIndex = -1;
        for (let i = 0; i < history.length; i++) {
            if (history[i].teamSide === 'our') {
                // Is this goal the one that started the PERMANENT lead?
                // Check all subsequent states (including this one)
                let staysInLead = true;
                for (let j = i; j < history.length; j++) {
                    if (history[j].scoreAfter[0] <= history[j].scoreAfter[1]) {
                        staysInLead = false;
                        break;
                    }
                }
                if (staysInLead) {
                    firstDecisiveIndex = i;
                    break;
                }
            }
        }

        if (firstDecisiveIndex !== -1) {
            const scorerId = history[firstDecisiveIndex].scorerId;
            if (scorerId) {
                if (!decisiveCounts[scorerId]) decisiveCounts[scorerId] = { count: 0, highConfidence: true };
                decisiveCounts[scorerId].count += 1;
                if (confidence === 'mixed') decisiveCounts[scorerId].highConfidence = false;
            }
        }
    });

    return Object.entries(decisiveCounts)
        .map(([playerId, data]) => ({
            playerId,
            decisiveGoals: data.count,
            confidence: (data.highConfidence ? 'high' : 'mixed') as 'high' | 'mixed'
        }))
        .sort((a, b) => {
            if (b.decisiveGoals !== a.decisiveGoals) return b.decisiveGoals - a.decisiveGoals;
            return a.playerId.localeCompare(b.playerId);
        });
}

export function computeLowestStarterLossRate(
    matches: Match[],
    lineups: Record<string, MatchLineup>,
    players: Player[],
    options: AdvancedStatsOptions = DEFAULT_OPTIONS
): AdvancedStatsLeaderboard['lowestStarterLossRate'] {
    const stats: Record<string, { starterApps: number; starterLosses: number }> = {};

    players.forEach(p => {
        stats[p.id] = { starterApps: 0, starterLosses: 0 };
    });

    matches.forEach(m => {
        if (m.status !== 'completed' && (m.status as string) !== 'played') return;
        const normalizedMatch = normalizeMatch(m);
        const lineup = normalizeLineup(lineups[m.id], players);
        
        const isLoss = normalizedMatch.resultType === 'L';

        lineup.starters.forEach(s => {
            const pid = (s as StarterPlayer).playerId;
            if (stats[pid]) {
                stats[pid].starterApps += 1;
                if (isLoss) stats[pid].starterLosses += 1;
            }
        });
    });

    return Object.entries(stats)
        .map(([playerId, data]) => ({
            playerId,
            starterApps: data.starterApps,
            starterLosses: data.starterLosses,
            lossRate: data.starterApps > 0 ? data.starterLosses / data.starterApps : 0
        }))
        .filter(p => p.starterApps >= options.minStarterApps)
        .sort((a, b) => {
            if (a.lossRate !== b.lossRate) return a.lossRate - b.lossRate;
            if (b.starterApps !== a.starterApps) return b.starterApps - a.starterApps;
            if (a.starterLosses !== b.starterLosses) return a.starterLosses - b.starterLosses;
            return a.playerId.localeCompare(b.playerId);
        });
}

export function computeAdvancedStatsBundle(
    seasonId: string,
    matches: Match[],
    lineups: Record<string, MatchLineup>,
    events: Record<string, MatchEvent[]>,
    players: Player[],
    options: AdvancedStatsOptions = DEFAULT_OPTIONS
): AdvancedStatsLeaderboard {
    const warnings: string[] = [];
    
    if (matches.length === 0) warnings.push('Nessuna partita trovata per questa stagione.');
    if (players.length === 0) warnings.push('Nessun giocatore trovato.');

    const { bestCbPair, bestCbTrio } = computeBestDefenseStats(matches, lineups, players, options);
    const bestGaPerStarter = computeBestGaPerStarter(matches, lineups, events, players, options);
    const decisiveGoalsLeaders = computeDecisiveGoals(matches, events, options);
    const lowestStarterLossRate = computeLowestStarterLossRate(matches, lineups, players, options);

    return {
        generatedAt: new Date().toISOString(),
        seasonId,
        filters: options,
        bestCbPair,
        bestCbTrio,
        bestGaPerStarter,
        decisiveGoalsLeaders,
        lowestStarterLossRate,
        meta: warnings.length > 0 ? { warnings } : undefined
    };
}
