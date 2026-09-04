import type { SeasonDataContext, TeamStatsRecord } from '@/lib/repositories/aggregation-repository';
import type { Match, MatchType } from '@/lib/types';

export type FilterType = 'all' | MatchType;

export const MATCH_FILTERS: FilterType[] = ['all', 'Campionato', 'Torneo', 'Amichevole'];

export function filterContextByType(ctx: SeasonDataContext, type: FilterType): SeasonDataContext {
  if (type === 'all') return ctx;
  const filteredMatches: Match[] = ctx.matches.filter((m: Match) => m.type === type);
  const filteredDetails: SeasonDataContext['matchesDetails'] = {};
  for (const m of filteredMatches) {
    if (ctx.matchesDetails[m.id]) {
      filteredDetails[m.id] = ctx.matchesDetails[m.id];
    }
  }
  return { ...ctx, matches: filteredMatches, matchesDetails: filteredDetails };
}

export interface TeamRecord {
  overall: TeamStatsRecord;
  home: TeamStatsRecord;
  away: TeamStatsRecord;
}

export function computeTeamRecord(ctx: SeasonDataContext): TeamRecord {
  const create = (): TeamStatsRecord => ({ wins: 0, draws: 0, losses: 0, goalsFor: 0, goalsAgainst: 0, matchesPlayed: 0 });
  const overall = create();
  const home = create();
  const away = create();

  for (const m of ctx.matches) {
    if (m.status !== 'completed') continue;
    const result = m.result || { home: 0, away: 0 };
    if (m.isHome) {
      overall.matchesPlayed++;
      home.matchesPlayed++;
      overall.goalsFor += result.home;
      overall.goalsAgainst += result.away;
      home.goalsFor += result.home;
      home.goalsAgainst += result.away;
      if (result.home > result.away) { overall.wins++; home.wins++; }
      else if (result.home < result.away) { overall.losses++; home.losses++; }
      else { overall.draws++; home.draws++; }
    } else {
      overall.matchesPlayed++;
      away.matchesPlayed++;
      overall.goalsFor += result.away;
      overall.goalsAgainst += result.home;
      away.goalsFor += result.away;
      away.goalsAgainst += result.home;
      if (result.away > result.home) { overall.wins++; away.wins++; }
      else if (result.away < result.home) { overall.losses++; away.losses++; }
      else { overall.draws++; away.draws++; }
    }
  }
  return { overall, home, away };
}

export interface PlayerStatsRow {
  playerId: string;
  name: string;
  stats: {
    appearances: number;
    goals: number;
    assists: number;
    avgMinutes: number;
    yellowCards: number;
    redCards: number;
  };
}

export function computePlayerStats(ctx: SeasonDataContext): PlayerStatsRow[] {
  const completed = ctx.matches.filter((m: Match) => m.status === 'completed');
  const rows: PlayerStatsRow[] = [];
  for (const p of ctx.players) {
    let appearances = 0;
    let goals = 0;
    let assists = 0;
    let minutes = 0;
    let yellowCards = 0;
    let redCards = 0;
    for (const m of completed) {
      const details = ctx.matchesDetails[m.id];
      if (!details) continue;
      const lineup = details.lineup;
      const isStarter = lineup?.starters.some((pid: any) => (typeof pid === 'string' ? pid : pid.playerId) === p.id) ?? false;
      const isSub = lineup?.substitutes.some((pid: any) => (typeof pid === 'string' ? pid : pid.playerId) === p.id) ?? false;
      const stats = details.stats.find((s: any) => s.playerId === p.id);
      const hasPlayed = isStarter || isSub || !!stats;
      if (hasPlayed) {
        appearances++;
        if (stats) {
          minutes += stats.minutesPlayed || 0;
          yellowCards += stats.yellowCards || 0;
          redCards += stats.redCards || 0;
        }
        const side = m.isHome ? 'home' : 'away';
        goals += details.events.filter((e: any) => e.type === 'goal' && e.playerId === p.id && e.team === side).length;
        assists += details.events.filter((e: any) => e.type === 'goal' && e.assistPlayerId === p.id && e.team === side).length;
      }
    }
    rows.push({
      playerId: p.id,
      name: p.name,
      stats: {
        appearances,
        goals,
        assists,
        avgMinutes: appearances > 0 ? Math.round(minutes / appearances) : 0,
        yellowCards,
        redCards,
      },
    });
  }
  return rows.sort((a, b) => b.stats.goals - a.stats.goals);
}

export interface IntervalData {
  label: string;
  value: number;
  fill: string;
}

export function computeGoalsByInterval(ctx: SeasonDataContext): IntervalData[] {
  const completed = ctx.matches.filter((m: Match) => m.status === 'completed');
  const int1 = 30;
  const int2 = 60;
  const labels: Array<{ label: string; condition: (min: number) => boolean }> = [
    { label: '1-30', condition: (min: number) => min <= int1 },
    { label: '31-60', condition: (min: number) => min > int1 && min <= int2 },
    { label: '61+', condition: (min: number) => min > int2 },
  ];
  const values = labels.map(() => 0);
  for (const m of completed) {
    const details = ctx.matchesDetails[m.id];
    if (!details) continue;
    const side = m.isHome ? 'home' : 'away';
    for (const e of details.events.filter((e: any) => e.type === 'goal' && e.team === side)) {
      const minute = e.minute ?? 0;
      for (let i = 0; i < labels.length; i++) {
        if (labels[i].condition(minute)) {
          values[i]++;
          break;
        }
      }
    }
  }
  return labels.map((l, i) => ({ label: l.label, value: values[i], fill: '#ace504' }));
}
