"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, User, Shield, Sword, Zap, Clock, AlertTriangle, Target, Calendar, TrendingUp, ArrowRightLeft, CalendarCheck } from "lucide-react";
import { GiSoccerBall, GiSoccerKick } from "react-icons/gi";
import { IoSquare } from "react-icons/io5";

import { usePlayersStore } from "@/store/usePlayersStore";
import { useSeasonsStore } from "@/store/useSeasonsStore";
import { PhysicalTab } from "@/components/allenamento/physical-tab";
import { useAuthStore } from "@/store/useAuthStore";
import { useThemeStore } from "@/store/useThemeStore";
import { aggregationRepository, type SeasonDataContext } from "@/lib/repositories/aggregation-repository";
import { trainingRepository } from "@/lib/repositories/training-repository";
import { filterContextByType, type FilterType } from "@/lib/aggregators/filter";
import { getMatchUsage } from "@/lib/player-usage";
import { useSettingsStore } from "@/store/useSettingsStore";
import { MatchTypeFilters } from "@/components/statistiche/match-type-filters";
import type { Player, TrainingSession, TrainingAttendance, TrainingStatus, Match, PlayerRole } from "@/lib/types";
import { getPrimaryRole } from "@/lib/types";
import { parseISO, isAfter, startOfDay } from "date-fns";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

// ─── Helper colori chart adattivi ─────────────────────────────────────────────
function useChartColors() {
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  return {
    primary:      isDark ? "#ace504"                  : "hsl(210 100% 45%)",
    primaryFill:  isDark ? "rgba(172,229,4,0.15)"     : "rgba(0,128,255,0.12)",
    grid:         isDark ? "rgba(255,255,255,0.05)"   : "rgba(0,0,0,0.07)",
    tick:         isDark ? "rgba(255,255,255,0.3)"    : "rgba(0,0,0,0.4)",
    tooltipBg:    isDark ? "rgba(0,0,0,0.92)"         : "rgba(255,255,255,0.97)",
    tooltipBorder:isDark ? "rgba(172,229,4,0.3)"      : "rgba(0,128,255,0.25)",
    tooltipColor: isDark ? "#fff"                     : "#000",
    cursorFill:   isDark ? "rgba(172,229,4,0.05)"     : "rgba(0,128,255,0.05)",
    muted:        isDark ? "rgba(255,255,255,0.2)"    : "rgba(0,0,0,0.1)",
  };
}

// ─── Tipi grafici ─────────────────────────────────────────────────────────────
interface RadarData {
  subject: string;
  score: number;
  rawValue: number;
}

interface BarData {
  name: string;
  value: number;
  color: string;
}

interface ChartColors {
  primary: string;
  primaryFill: string;
  grid: string;
  tick: string;
  tooltipBg: string;
  tooltipBorder: string;
  tooltipColor: string;
  cursorFill: string;
}

// Lazy-load grafici per ottimizzare LCP
const RadarChart = dynamic<{ data: RadarData[]; colors: ChartColors }>(
  () => import("recharts").then((mod) => {
    const { RadarChart: RC, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip } = mod;
    const Chart = ({ data, colors }: { data: RadarData[]; colors: ChartColors }) => (
      <ResponsiveContainer width="100%" height={240}>
        <RC data={data} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
          <PolarGrid stroke={colors.grid} />
          <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: colors.tick, fontWeight: 900 }} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar dataKey="score" stroke={colors.primary} fill={colors.primary} fillOpacity={0.15} strokeWidth={2} />
          <Tooltip
            contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 16, fontSize: 11, color: colors.tooltipColor }}
            itemStyle={{ color: colors.tooltipColor }}
            formatter={(val: number, name: string, props: any) => [props.payload.rawValue, ""]}
          />
        </RC>
      </ResponsiveContainer>
    );
    return { default: Chart };
  }),
  { ssr: false, loading: () => <Skeleton className="h-60 w-full" /> }
);

const BarChartComponent = dynamic<{ data: BarData[]; colors: ChartColors }>(
  () => import("recharts").then((mod) => {
    const { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } = mod;
    const Chart = ({ data, colors }: { data: BarData[]; colors: ChartColors }) => (
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barSize={28}>
          <XAxis dataKey="name" tick={{ fontSize: 9, fill: colors.tick, fontWeight: 900 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: colors.tick }} axisLine={false} tickLine={false} allowDecimals={false} />
          <Tooltip
            contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 16, fontSize: 11, color: colors.tooltipColor }}
            itemStyle={{ color: colors.tooltipColor }}
            cursor={{ fill: colors.cursorFill }}
          />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
    return { default: Chart };
  }),
  { ssr: false, loading: () => <Skeleton className="h-40 w-full" /> }
);

// ─── Tipi interni ─────────────────────────────────────────────────────────────
interface PlayerDetailStats {
  appearances: number;
  goals: number;
  assists: number;
  avgMinutes: number;
  yellowCards: number;
  redCards: number;
  totalMinutes: number;
  wins: number;
  losses: number;
  draws: number;
  cleanSheets: number;
  goalsConcededOnPitch: number;
  goalsScoredOnPitch: number;
  starts: number;
  subs: number;
  /** In panchina senza mai entrare: NON e' una presenza */
  bench: number;
  /** Completate con lineup in cui non era convocato (stessa regola del tab Giocatori) */
  notConvoked: number;
  goalsPer90: number;
  /** Media minuti per partita piena (percentuale sulla durata reale) */
  minutesPer90: number;
  /** Durata media reale delle partite: il denominatore delle metriche per 90' */
  matchDuration: number;
  assistsPer90: number;
  gaPer90: number;
  trainingAttendanceRate: number | null;
}

interface TrainingRecord {
  session: TrainingSession;
  status: TrainingStatus | null;
}

interface MatchRecord {
  match: Match;
  status: "titolare" | "entrato" | "inutilizzato" | "non_convocato" | "da_giocare" | "infortunato";
}

const roleLabel: Record<string, string> = {
  Portiere: "POR",
  Difensore: "DIF",
  Centrocampista: "CEN",
  Attaccante: "ATT",
};

const roleBg: Record<string, string> = {
  Portiere: "bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500 border-amber-200 dark:border-amber-500/30 shadow-sm dark:shadow-[0_0_10px_rgba(245,158,11,0.1)]",
  Difensore: "bg-slate-100 dark:bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-500/30",
  Centrocampista: "bg-blue-100 dark:bg-brand-green/10 text-blue-700 dark:text-brand-green border-blue-200 dark:border-brand-green/30 shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.1)]",
  Attaccante: "bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-500 border-red-200 dark:border-red-500/30 shadow-sm dark:shadow-[0_0_10px_rgba(239,68,68,0.1)]",
};

// ─── Componente StatCard ───────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = "text-primary dark:text-brand-green" }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 bg-card dark:bg-black/40 backdrop-blur-sm border border-border dark:border-brand-green/20 rounded-2xl p-4 text-center shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.05)] hover:border-primary/50 dark:hover:border-brand-green/40 transition-all">
      <Icon className={`h-5 w-5 ${color} mb-1 opacity-80`} />
      <span className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground dark:text-white/30">{label}</span>
      <span className={`text-2xl font-black text-foreground dark:text-white`}>{value}</span>
      {sub && <span className="text-[8px] text-muted-foreground dark:text-white/40 font-black uppercase tracking-tighter">{sub}</span>}
    </div>
  );
}

// ─── Componente HeatMap presenza allenamenti ───────────────────────────────────
function TrainingHeatmap({ records }: { records: TrainingRecord[] }) {
  const statusColor: Record<string, string> = {
    presente: "bg-emerald-500",
    ritardo: "bg-amber-400",
    assente: "bg-red-500",
    infortunato: "bg-fuchsia-500"
  };
  const statusLabel: Record<string, string> = {
    presente: "Presente",
    ritardo: "In ritardo",
    assente: "Assente",
    infortunato: "Infortunato"
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-xs border-2 border-dashed rounded-xl">
        Nessun allenamento registrato per questa stagione.
      </div>
    );
  }

  const today = startOfDay(new Date());
  const pastRecords = records.filter(r => {
    const d = r.session.date.includes('T') ? parseISO(r.session.date) : new Date(r.session.date);
    return !isAfter(startOfDay(d), today);
  });
  
  const presenti = pastRecords.filter((r) => r.status === "presente" || r.status === "ritardo").length;
  const totale = pastRecords.length;
  const percentuale = totale > 0 ? Math.round((presenti / totale) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-muted dark:bg-black/40 rounded-full h-2.5 overflow-hidden border border-border dark:border-white/5">
          <div
            className="h-full bg-primary dark:bg-brand-green rounded-full transition-all duration-700 shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.5)]"
            style={{ width: `${percentuale}%` }}
          />
        </div>
        <span className="text-xs font-black text-primary dark:text-brand-green min-w-[3rem] text-right">{percentuale}%</span>
      </div>
      <p className="text-[9px] text-muted-foreground dark:text-white/30 font-black uppercase tracking-widest mt-1">
        {presenti} presenze su {totale} allenamenti svolti
      </p>

      {/* Griglia dot */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {records.slice(0, 60).map((r) => (
          <div
            key={r.session.id}
            title={`${r.session.date} — ${r.status ? statusLabel[r.status] : "N/A"}`}
            className={`h-3.5 w-3.5 rounded-sm ${r.status ? statusColor[r.status] : "bg-muted"} cursor-default transition-transform hover:scale-125`}
          />
        ))}
        {records.length > 60 && (
          <span className="text-[9px] text-muted-foreground self-center">+{records.length - 60}</span>
        )}
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-4 pt-1">
        {Object.entries(statusColor).map(([key, cls]) => (
          <div key={key} className="flex items-center gap-1">
            <div className={`h-2.5 w-2.5 rounded-sm ${cls}`} />
            <span className="text-[9px] text-muted-foreground font-medium capitalize">{statusLabel[key]}</span>
          </div>
        ))}
        <div className="flex items-center gap-1">
          <div className="h-2.5 w-2.5 rounded-sm bg-muted" />
          <span className="text-[9px] text-muted-foreground font-medium">N/A</span>
        </div>
      </div>
    </div>
  );
}

// ─── Componente HeatMap presenza partite ───────────────────────────────────────
function MatchHeatmap({ records }: { records: MatchRecord[] }) {
  const statusColor: Record<string, string> = {
    titolare: "bg-emerald-500",
    entrato: "bg-amber-400",
    inutilizzato: "bg-orange-500",
    non_convocato: "bg-red-500",
    da_giocare: "bg-muted",
    infortunato: "bg-fuchsia-500"
  };
  const statusLabel: Record<string, string> = {
    titolare: "Titolare",
    entrato: "Subentrato",
    inutilizzato: "Panchina",
    non_convocato: "Non convoc.",
    da_giocare: "Da giocare",
    infortunato: "Infortunato"
  };

  if (records.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-xs border-2 border-dashed rounded-xl">
        Nessuna partita in calendario.
      </div>
    );
  }

  const presenze = records.filter(r => r.status === "titolare" || r.status === "entrato").length;
  const matchDisputati = records.filter(r => r.status !== "da_giocare").length;
  const pct = matchDisputati > 0 ? Math.round((presenze / matchDisputati) * 100) : 0;

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-muted dark:bg-black/40 rounded-full h-2.5 overflow-hidden border border-border dark:border-white/5">
          <div
            className="h-full bg-primary dark:bg-brand-green rounded-full transition-all duration-700 shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.5)]"
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-black text-primary dark:text-brand-green min-w-[3rem] text-right">{pct}%</span>
      </div>
      <p className="text-[9px] text-muted-foreground dark:text-white/30 font-black uppercase tracking-widest mt-1">
        Presenza in campo nel {pct}% dei match disputati
      </p>

      {/* Griglia dot */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {records.slice(0, 60).map((r, idx) => (
          <div
            key={r.match.id}
            title={`Giornata ${idx + 1} - ${r.match.opponent} — ${statusLabel[r.status]}`}
            className={`h-3.5 w-3.5 rounded-sm ${statusColor[r.status]} cursor-default transition-transform hover:scale-125`}
          />
        ))}
        {records.length > 60 && (
          <span className="text-[9px] text-muted-foreground self-center">+{records.length - 60}</span>
        )}
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {Object.entries(statusColor).map(([key, cls]) => {
          if (key === "da_giocare") return null;
          return (
            <div key={key} className="flex items-center gap-1">
              <div className={`h-2.5 w-2.5 rounded-sm ${cls}`} />
              <span className="text-[9px] text-muted-foreground font-medium capitalize">{statusLabel[key]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helper: il giocatore era infortunato in quella data? ──────────────────────
function isInjuredAtDate(dateStr: string, injuries?: { startDate: string; endDate: string }[]): boolean {
  if (!injuries || injuries.length === 0) return false;
  const d = new Date(dateStr);
  return injuries.some(inj => {
    const s = new Date(inj.startDate);
    const e = new Date(inj.endDate);
    return d >= s && d <= e;
  });
}

/**
 * Durata della partita per le metriche per "90'", letta dalle IMPOSTAZIONI
 * (Gestione Squadra), non dalle partite ne da una costante.
 *
 * Prima era la media delle `match.duration`: con partite da 60 produceva 60,
 * ma se ogni partita ha la propria durata (una da 40, una da 90) dava un
 * numero che non corrispondeva a nessuna impostazione. Il denominatore deve
 * essere quello che l'utente ha scelto, e cambiare quando lo cambia.
 */
function resolveMatchDuration(setting: number | undefined | null): number {
  return typeof setting === 'number' && setting > 0 ? Math.round(setting) : 90;
}

// ─── Calcolo statistiche di un giocatore su un contesto GIÀ filtrato per tipo partita ──
// Pure function: prende il contesto, non lo legge dallo store. Chiamata da un useMemo
// con il contesto filtrato, così cambiare tab ricalcola tutto senza rifetch.
function computePlayerStats(
  context: SeasonDataContext,
  playerId: string,
  player: Player | null,
  isInjuredAtDate: (dateStr: string, injuries?: { startDate: string; endDate: string }[]) => boolean,
  /** Durata partita dalle Impostazioni: denominatore delle metriche per 90' */
  matchDurationSetting?: number | null,
): { playerStats: PlayerDetailStats; matchRecords: MatchRecord[] } {
  const avgMatchDuration = resolveMatchDuration(matchDurationSetting);
  const allStats = aggregationRepository.getPlayersAggregatedStatsFromContext(context);
  const pStats = allStats.find((s) => s.playerId === playerId);

  // Calcola W/D/L e metriche "On Pitch"
  let wins = 0, draws = 0, losses = 0;
  let totalMinutes = 0;
  let cleanSheets = 0;
  let goalsConcededOnPitch = 0;
  let goalsScoredOnPitch = 0;
  let starts = 0;
  let subs = 0;
  let bench = 0;
  let notConvoked = 0;

  const completedMatches = context.matches.filter((m) => m.status === "completed");
  for (const match of completedMatches) {
    const details = context.matchesDetails[match.id];
    if (!details) continue;
    // Unica definizione di presenza: titolare o entrato. Essere in panchina
    // NON conta (nè come presenza né per W/D/L e minuti).
    const u = getMatchUsage(details, playerId, match.isHome);
    const isStarter = u.isStarter;
    const stat = details.stats.find((s) => s.playerId === playerId);

    if (!u.appeared && (u.isOnBench || u.isStarter)) bench++;
    // Stessa regola del tab Giocatori: senza lineup non sappiamo chi era in
    // rosa, quindi quelle partite non sono "non convocato".
    else if (!u.appeared && details.lineup) notConvoked++;

    if (u.appeared) {
      totalMinutes += u.minutesPlayed;
      if (isStarter) starts++;
      else if (u.cameOn) subs++;

      // Calcolo On-Pitch Goals
      const chronologicalEvents = [...details.events].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
      const myTeam = match.isHome ? 'home' : 'away';
      const oppTeam = match.isHome ? 'away' : 'home';

      let enterMin = 0;
      let exitMin = match.duration || 90;

      if (!isStarter && stat && stat.minutesPlayed > 0) {
        const subIn = chronologicalEvents.find(e => e.type === 'substitution' && e.playerId === playerId);
        enterMin = subIn ? (subIn.minute ?? 0) : 0;
      }
      const subOut = chronologicalEvents.find(e => e.type === 'substitution' && e.subOutPlayerId === playerId);
      if (subOut) exitMin = subOut.minute ?? (match.duration || 90);

      let matchGoalsConcededCount = 0;
      chronologicalEvents.forEach(e => {
        if (e.minute !== null && e.minute >= enterMin && e.minute <= exitMin) {
          if (e.type === 'goal') {
            if (e.team === myTeam) goalsScoredOnPitch++;
            if (e.team === oppTeam) {
              goalsConcededOnPitch++;
              matchGoalsConcededCount++;
            }
          } else if (e.type === 'own_goal') {
            // Autogol: un own_goal della mia squadra = gol subito, dell'avversario = gol fatto
            if (e.team === myTeam) {
              goalsConcededOnPitch++;
              matchGoalsConcededCount++;
            }
            if (e.team === oppTeam) goalsScoredOnPitch++;
          }
        }
      });

      // Applica clean sheet logic
      if (player && getPrimaryRole(player) === 'POR' && matchGoalsConcededCount === 0) cleanSheets++;

      if (!match.result) continue;
      const scored = match.isHome ? match.result.home : match.result.away;
      const conceded = match.isHome ? match.result.away : match.result.home;
      if (scored > conceded) wins++;
      else if (scored < conceded) losses++;
      else draws++;
    }
  }

  // Il denominatore e' la durata impostata in Gestione Squadra, non un 90
  // fisso e non la media delle partite: cambiando l'impostazione cambia qui.
  const totalNinety = totalMinutes > 0 ? totalMinutes / avgMatchDuration : 0;
  // "Minuti per partita piena" = media minuti per presenza, rapportata alla
  // durata REALE (1.0 = ha giocato tutta la partita). Non usa `appearances`
  // perche' qui si conta con starts + subs: sono le due facce della presenza.
  const presenze = starts + subs;
  const minutesPer90 = presenze > 0
    ? Math.round((totalMinutes / presenze) / avgMatchDuration * 100) / 100
    : 0;
  const playerStats: PlayerDetailStats = pStats
    ? {
      appearances: pStats.stats.appearances,
      goals: pStats.stats.goals,
      assists: pStats.stats.assists,
      avgMinutes: pStats.stats.avgMinutes,
      yellowCards: pStats.stats.yellowCards ?? 0,
      redCards: pStats.stats.redCards ?? 0,
      totalMinutes,
      wins,
      losses,
      draws,
      cleanSheets,
      goalsConcededOnPitch,
      goalsScoredOnPitch,
      starts,
      subs,
      bench,
      notConvoked,
      goalsPer90: totalNinety > 0 ? Math.round((pStats.stats.goals / totalNinety) * 100) / 100 : 0,
      assistsPer90: totalNinety > 0 ? Math.round((pStats.stats.assists / totalNinety) * 100) / 100 : 0,
      gaPer90: totalNinety > 0 ? Math.round(((pStats.stats.goals + pStats.stats.assists) / totalNinety) * 100) / 100 : 0,
      minutesPer90,
      matchDuration: avgMatchDuration,
      trainingAttendanceRate: null,
    }
    : { appearances: 0, goals: 0, assists: 0, avgMinutes: 0, yellowCards: 0, redCards: 0, totalMinutes: 0, wins: 0, losses: 0, draws: 0, cleanSheets: 0, goalsConcededOnPitch: 0, goalsScoredOnPitch: 0, starts: 0, subs: 0, bench: 0, notConvoked: 0, goalsPer90: 0, assistsPer90: 0, gaPer90: 0, minutesPer90: 0, matchDuration: avgMatchDuration, trainingAttendanceRate: null };

  // Storico presenze partite
  const allMatches = [...context.matches].sort((a, b) => a.date.localeCompare(b.date));
  const matchRecords: MatchRecord[] = allMatches.map(match => {
    if (match.status !== "completed") return { match, status: "da_giocare" };
    const details = context.matchesDetails[match.id];
    if (!details || !details.lineup) return { match, status: "non_convocato" };

    // stesso criterio dell aggregatore: entrare conta, anche con 0 minuti
    const u = getMatchUsage(details, playerId, match.isHome);

    if (u.isStarter) return { match, status: "titolare" };
    if (u.isOnBench) {
      if (u.cameOn) return { match, status: "entrato" };
      return { match, status: "inutilizzato" };
    }

    if (isInjuredAtDate(match.date, player?.injuries)) {
      return { match, status: "infortunato" };
    }
    return { match, status: "non_convocato" };
  });

  return { playerStats, matchRecords };
}

// ─── Pagina principale ─────────────────────────────────────────────────────────
export default function PlayerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const playerId = params.id as string;

  const { players, fetchAll: fetchPlayers } = usePlayersStore();
  const { activeSeason, fetchAll: fetchSeasons } = useSeasonsStore();
  const { user } = useAuthStore();
  const chartColors = useChartColors();

  const [loadingData, setLoadingData] = useState(true);
  const [playerContext, setPlayerContext] = useState<SeasonDataContext | null>(null);
  const [trainingRecords, setTrainingRecords] = useState<TrainingRecord[]>([]);
  const [statsFilter, setStatsFilter] = useState<FilterType>('all');
  const [filterTouched, setFilterTouched] = useState(false);
  const statsDefaultFilter = useSettingsStore((s) => s.statsDefaultFilter);
  // Denominatore delle metriche per 90'. Subscribe esplicito: senza questa
  // riga, cambiare la durata in Gestione Squadra NON ricalcolerebbe nulla e
  // la scheda continuerebbe a mostrare il vecchio "90'".
  const defaultDuration = useSettingsStore((s) => s.defaultDuration);

  const handleFilterChange = useCallback((f: FilterType) => {
    setStatsFilter(f);
    setFilterTouched(true);
  }, []);

  // Ricerca giocatore nella lista già in cache oppure aspettiamo il fetch
  const player = useMemo(
    () => players.find((p) => p.id === playerId) ?? null,
    [players, playerId]
  );

  useEffect(() => {
    const init = async () => {
      if (!activeSeason) await fetchSeasons();
      await fetchPlayers();
    };
    init();
  }, [fetchPlayers, fetchSeasons, activeSeason]);

  useEffect(() => {
    if (!user || !activeSeason) return;

    const loadStats = async () => {
      setLoadingData(true);
      try {
        // Aggregazione ottimizzata per SOLO questo giocatore.
        // Il contesto greggio viene tenuto in stato: il filtro per tipo partita
        // viene applicato DOPO, in un useMemo, così cambiare tab non rifetcha nulla.
        const context = await aggregationRepository.getPlayerDetailedContext(user.id, activeSeason.id, playerId);
        setPlayerContext(context);

        // Storico presenze allenamenti (indipendente dal tipo partita)
        const sessions = await trainingRepository.getAll(activeSeason.id);
        const sortedSessions = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
        const sessionIds = sortedSessions.map((s) => s.id);
        const allAtt = await trainingRepository.getAllAttendanceForSeason(activeSeason.id, sessionIds);

        const records: TrainingRecord[] = sortedSessions.map((session) => {
          const attRecord = allAtt.find((a) => a.sessionId === session.id);
          const playerAtt = attRecord?.attendance.find((a) => a.playerId === playerId);
          let status = playerAtt?.status ?? null;

          if (isInjuredAtDate(session.date, player?.injuries) && (!status || status === "assente")) {
             status = "infortunato" as any;
          }

          return { session, status };
        });
        setTrainingRecords(records);
      } catch (e) {
        console.error("Errore caricamento dettaglio giocatore:", e);
      } finally {
        setLoadingData(false);
      }
    };

    loadStats();
  }, [user, activeSeason, playerId]);

  // La tab scelta vale finche l'utente non ne sceglie un'altra: la preferenza salvata
  // in Gestione Squadra e' il default, non un override di una scelta esplicita.
  useEffect(() => {
    if (filterTouched) return;
    setStatsFilter(statsDefaultFilter ?? 'all');
  }, [filterTouched, statsDefaultFilter]);

  // Statistiche e heatmap partite ricalcolate sul contesto FILTRATO per tipo partita.
  // Il filtro agisce sui dati, non solo sull'etichetta della tab.
  const { playerStats, matchRecords } = useMemo(() => {
    if (!playerContext) return { playerStats: null, matchRecords: [] as MatchRecord[] };
    const filtered = filterContextByType(playerContext, statsFilter);
    return computePlayerStats(filtered, playerId, player, isInjuredAtDate, defaultDuration);
  }, [playerContext, statsFilter, playerId, player, defaultDuration]);

  const radarData = useMemo(() => {
    if (!playerStats) return [];
    const maxApps = Math.max(playerStats.appearances, 1);
    const maxGoals = Math.max(playerStats.goals, 10);
    const maxAssists = Math.max(playerStats.assists, 10);
    const maxWins = maxApps;
    // Scala del radar = durata REALE media delle partite, non 90 fisso
    const maxMins = playerStats.matchDuration;

    return [
      { subject: "Presenze", score: (playerStats.appearances / maxApps) * 100, rawValue: playerStats.appearances },
      { subject: "Gol", score: (playerStats.goals / maxGoals) * 100, rawValue: playerStats.goals },
      { subject: "Assist", score: (playerStats.assists / maxAssists) * 100, rawValue: playerStats.assists },
      { subject: "Vittorie", score: (playerStats.wins / maxWins) * 100, rawValue: playerStats.wins },
      { subject: "Min/Medi", score: (playerStats.avgMinutes / maxMins) * 100, rawValue: playerStats.avgMinutes },
    ];
  }, [playerStats]);

  const barData = useMemo(() => {
    if (!playerStats) return [];
    return [
      { name: "Vittorie", value: playerStats.wins, color: chartColors.primary },
      { name: "Pareggi", value: playerStats.draws, color: chartColors.muted },
      { name: "Sconfitte", value: playerStats.losses, color: "#ef4444" },
    ];
  }, [playerStats, chartColors]);

  // Presenze allenamento %: (presente + ritardo) / sessioni valutate (esclusi infortunati)
  const trainingRate = useMemo(() => {
    if (!trainingRecords.length) return null;
    let evaluated = 0, present = 0;
    for (const r of trainingRecords) {
      const status = r.status as string | null;
      if (status === 'infortunato' || status === null) continue;
      evaluated++;
      if (status === 'presente' || status === 'ritardo') present++;
    }
    return evaluated > 0 ? Math.round((present / evaluated) * 100) : null;
  }, [trainingRecords]);

  // Inject computed training rate into playerStats without mutating the source
  const displayStats = useMemo(() => {
    if (!playerStats) return null;
    return { ...playerStats, trainingAttendanceRate: trainingRate };
  }, [playerStats, trainingRate]);

  const splitName = (fullName: string) => {
    const parts = fullName.split(" ");
    const firstName = parts.shift() || "";
    return { firstName, lastName: parts.join(" ") };
  };

  // ─── Loading skeleton ────────────────────────────────────────────────────────
  if (!player && !loadingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 px-4 text-center">
        <div className="h-24 w-24 rounded-full bg-primary/10 dark:bg-brand-green/10 flex items-center justify-center mb-2 border border-primary/20 dark:border-brand-green/20 shadow-sm dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] relative">
          <User className="h-12 w-12 text-primary dark:text-brand-green opacity-80" />
          <div className="absolute inset-0 rounded-full animate-ping opacity-20 bg-primary dark:bg-brand-green"></div>
        </div>
        <h2 className="text-2xl md:text-3xl font-black text-foreground dark:text-white uppercase tracking-widest mt-2 relative after:content-[''] after:absolute after:bottom-[-8px] after:left-1/2 after:-translate-x-1/2 after:w-16 after:h-[3px] after:bg-gradient-to-r after:from-transparent after:via-primary dark:after:via-brand-green after:to-transparent">
          Non Trovato
        </h2>
        <p className="text-sm font-medium text-muted-foreground dark:text-white/50 max-w-sm mt-4 leading-relaxed">
          I dettagli di questo membro non sono disponibili. Potrebbe essere stato rimosso dalla rosa o essersi verificato un errore.
        </p>
        <Button 
          onClick={() => router.push("/membri")} 
          className="mt-6 bg-primary dark:bg-black border-2 border-primary dark:border-brand-green/80 text-white dark:text-white hover:opacity-90 dark:hover:bg-brand-green/10 font-black tracking-wider uppercase rounded-2xl px-8 h-14 shadow-md dark:shadow-[0_0_15px_rgba(172,229,4,0.2)] transition-all"
        >
          <ArrowLeft className="h-5 w-5 mr-3" /> Ritorna alla Rosa
        </Button>
      </div>
    );
  }

  const { firstName, lastName } = player ? splitName(player.name) : { firstName: "…", lastName: "" };

  return (
    <div className="space-y-4 pb-8">
      {/* Header */}
      <PageHeader
        title={
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Link href="/membri" className="h-8 w-8 flex items-center justify-center rounded-xl bg-background dark:bg-black border border-primary/20 dark:border-brand-green/20 text-primary dark:text-brand-green hover:bg-primary/10 dark:hover:bg-brand-green/10 transition-colors">
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <span className="text-xl md:text-3xl text-foreground dark:text-white">
                {loadingData && !player ? (
                  <Skeleton className="h-7 w-40 bg-muted dark:bg-white/5" />
                ) : (
                  <>
                    <span className="font-light">{firstName}</span>
                    {lastName && <span className="font-black ml-1.5">{lastName}</span>}
                  </>
                )}
              </span>
                <div className="flex gap-1.5 items-center">
                  {player && (
                    <>
                      <span
                        className={`text-[8px] font-black px-2 py-0.5 rounded-full border shadow-sm ${roleBg[getPrimaryRole(player)] ?? "bg-muted dark:bg-white/5 text-muted-foreground dark:text-white/40 border-border dark:border-white/10"}`}
                      >
                        {roleLabel[getPrimaryRole(player)] ?? getPrimaryRole(player)}
                      </span>
                      {player.secondaryRoles && player.secondaryRoles.map(r => (
                        <span
                          key={r}
                          className="text-[8px] font-bold px-2 py-0.5 rounded-full border border-border dark:border-white/10 bg-muted/50 dark:bg-white/5 text-muted-foreground dark:text-muted-foreground/70 dark:text-white/30"
                        >
                          {roleLabel[r] ?? r}
                        </span>
                      ))}
                    </>
                  )}
                </div>
            </div>
            <span className="text-[8px] md:text-[10px] uppercase font-black text-muted-foreground dark:text-white/30 tracking-[0.2em] ml-10">
              {activeSeason?.name ?? "…"}
            </span>
          </div>
        }
      >
        <Link href={`/membri/confronto?p1=${playerId}`}>
          <Button variant="outline" size="sm" className="hidden md:flex gap-2 rounded-xl bg-background dark:bg-black border-primary/30 dark:border-brand-green/30 text-foreground dark:text-white hover:bg-primary/10 dark:hover:bg-brand-green/10 border-2">
            <ArrowRightLeft className="h-4 w-4 text-primary dark:text-brand-green" />
            <span className="text-xs font-black uppercase tracking-wider">Confronta</span>
          </Button>
        </Link>
        <Link href={`/membri/confronto?p1=${playerId}`} className="md:hidden">
          <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl bg-background dark:bg-black border-primary/30 dark:border-brand-green/30 text-foreground dark:text-white hover:bg-primary/10 dark:hover:bg-brand-green/10 border-2">
            <ArrowRightLeft className="h-5 w-5 text-primary dark:text-brand-green" />
          </Button>
        </Link>
      </PageHeader>

      {/* Tab filtro tipo partita: filtrano davvero statistiche, heatmap e grafici */}
      <MatchTypeFilters
        context={playerContext || undefined}
        loadingContext={loadingData || !playerContext}
        filter={statsFilter}
        onFilterChange={handleFilterChange}
      />

      {/* Statistiche principali e avanzate */}
      <div className="space-y-2">
        {loadingData ? (
          <div className="grid grid-cols-3 gap-2">
            {[...Array(9)].map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
          </div>
        ) : displayStats ? (
          <>
            {/* 1^ riga: Presenze totali, da titolare e da subentrato */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={Calendar} label="Presenze Totali" value={displayStats.appearances} />
              <StatCard icon={User} label="Da Titolare" value={displayStats.starts} />
              <StatCard icon={Zap} label="Da Subentrato" value={displayStats.subs} />
            </div>

            {/* 1b: panchina e non convocato. La panchina NON e' una presenza:
                per questo sta fuori dai totali di sopra. */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard
                icon={User}
                label="In Panchina"
                value={displayStats.bench}
                sub="non entrato"
                color="text-orange-500"
              />
              <StatCard
                icon={User}
                label="Non Convocato"
                value={displayStats.notConvoked}
                sub="partite"
                color="text-muted-foreground"
              />
            </div>

            {/* 2^ riga: Gol, Assist, Gol ogni xx minuti */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={GiSoccerBall} label="Gol" value={displayStats.goals} />
              <StatCard icon={GiSoccerKick} label="Assist" value={displayStats.assists} />
              <StatCard 
                icon={Clock} 
                label="Un Gol Ogni..." 
                value={displayStats.goals > 0 ? Math.round(displayStats.totalMinutes / displayStats.goals) : "---"} 
                sub="minuti" 
              />
            </div>

            {/* 3^ riga: minuti giocati totali, ammonizioni, espulsioni */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={Clock} label="Minuti Totali" value={displayStats.totalMinutes} sub="minuti" />
              <StatCard icon={IoSquare} label="Ammonizioni" value={displayStats.yellowCards} color="text-yellow-400" />
              <StatCard icon={IoSquare} label="Espulsioni" value={displayStats.redCards} color="text-red-600" />
            </div>

            {/* 4^ riga: gol fatti/subiti mentre è in campo */}
            <div className="grid grid-cols-2 gap-2">
              <StatCard icon={GiSoccerBall} label="Gol Fatti" value={displayStats.goalsScoredOnPitch} sub="in campo" color="text-primary dark:text-brand-green" />
              <StatCard icon={GiSoccerBall} label="Gol Subiti" value={displayStats.goalsConcededOnPitch} sub="in campo" color="text-rose-500" />
            </div>

            {/* 5^ riga: efficienza per partita piena. Il "90'" segue la
                durata reale impostata in Gestione Squadra, non e' fisso. */}
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={Clock} label={`Minuti / ${displayStats.matchDuration}'`} value={displayStats.minutesPer90} sub="media" />
              <StatCard icon={GiSoccerBall} label={`Gol / ${displayStats.matchDuration}'`} value={displayStats.goalsPer90} sub="media" color="text-primary dark:text-brand-green" />
              <StatCard icon={GiSoccerKick} label={`Assist / ${displayStats.matchDuration}'`} value={displayStats.assistsPer90} sub="media" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <StatCard icon={Target} label={`G+A / ${displayStats.matchDuration}'`} value={displayStats.gaPer90} sub="media" color="text-primary dark:text-brand-green" />
            </div>

            {/* 6^ riga: presenze allenamento (da trainingRecords già caricati) */}
            <div className="grid grid-cols-1 gap-2">
              <StatCard
                icon={CalendarCheck}
                label="Presenze Allenamento"
                value={displayStats.trainingAttendanceRate != null ? `${displayStats.trainingAttendanceRate}%` : "---"}
                sub="su sessioni valutate"
              />
            </div>
          </>
        ) : null}
      </div>

      {/* Grafici rendimento */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Radar */}
        <Card className="rounded-3xl bg-card dark:bg-black/40 backdrop-blur-sm border-border dark:border-brand-green/20 shadow-sm dark:shadow-[0_0_20px_rgba(172,229,4,0.05)] overflow-hidden">
          <CardHeader className="pb-0 px-6 pt-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-white/30 flex items-center gap-2">
              <TrendingUp className="h-3.5 w-3.5 text-primary dark:text-brand-green" /> Profilo Tecnico
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 px-6">
            {loadingData ? <Skeleton className="h-60 w-full bg-muted dark:bg-white/5" /> : <RadarChart data={radarData} colors={chartColors} />}
          </CardContent>
        </Card>

        {/* Barchart W/D/L */}
        <Card className="rounded-3xl bg-card dark:bg-black/40 backdrop-blur-sm border-border dark:border-brand-green/20 shadow-sm dark:shadow-[0_0_20px_rgba(172,229,4,0.05)] overflow-hidden">
          <CardHeader className="pb-0 px-6 pt-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-white/30 flex items-center gap-2">
              <Sword className="h-3.5 w-3.5 text-primary dark:text-brand-green" /> Risultati Personali
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-6 pb-6">
            {loadingData ? <Skeleton className="h-40 w-full bg-muted dark:bg-white/5" /> : (
              <>
                <BarChartComponent data={barData} colors={chartColors} />
                <p className="text-[9px] text-center text-muted-foreground dark:text-white/20 mt-2 font-black uppercase tracking-widest">
                  Partite giocate: <strong className="text-foreground dark:text-white/60">{playerStats?.appearances ?? 0}</strong> · Minuti totali: <strong className="text-foreground dark:text-white/60">{playerStats?.totalMinutes ?? 0}'</strong>
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Heatmap presenze */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card className="rounded-3xl bg-card dark:bg-black/40 backdrop-blur-sm border border-border dark:border-brand-green/20 shadow-sm dark:shadow-[0_0_20px_rgba(172,229,4,0.05)] overflow-hidden">
          <CardHeader className="pb-0 px-6 pt-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-white/30 flex items-center gap-2">
              <Sword className="h-3.5 w-3.5 text-primary dark:text-brand-green" /> Storico Presenze Partite
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-6 pb-6">
            {loadingData ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full bg-muted dark:bg-white/5" />
                <Skeleton className="h-16 w-full bg-muted dark:bg-white/5" />
              </div>
            ) : (
              <MatchHeatmap records={matchRecords} />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-3xl bg-card dark:bg-black/40 backdrop-blur-sm border border-border dark:border-brand-green/20 shadow-sm dark:shadow-[0_0_20px_rgba(172,229,4,0.05)] overflow-hidden">
          <CardHeader className="pb-0 px-6 pt-6">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-white/30 flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-primary dark:text-brand-green" /> Storico Presenze Allenamenti
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 px-6 pb-6">
            {loadingData ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full bg-muted dark:bg-white/5" />
                <Skeleton className="h-16 w-full bg-muted dark:bg-white/5" />
              </div>
            ) : (
              <TrainingHeatmap records={trainingRecords} />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Physical Tests */}
      <PhysicalTab />
    </div>
  );
}
