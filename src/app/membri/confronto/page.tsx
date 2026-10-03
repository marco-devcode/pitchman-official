"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, User, Shield, Sword, Zap, Clock, AlertTriangle, Target, Calendar, BarChart2, ArrowRightLeft } from "lucide-react";

import { usePlayersStore } from "@/store/usePlayersStore";
import { useSeasonsStore } from "@/store/useSeasonsStore";
import { useAuthStore } from "@/store/useAuthStore";
import { readThemeChartPalette } from "@/lib/design-tokens";
import { aggregationRepository } from "@/lib/repositories/aggregation-repository";
import { getMatchUsage } from "@/lib/player-usage";
import { cn, displayPlayerName } from "@/lib/utils";
import { Player, getPrimaryRole } from '@/lib/types';
import { useThemeStore } from "@/store/useThemeStore";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RadarChart = dynamic(
  () => import("recharts").then((mod) => {
    const { RadarChart: RC, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer, Tooltip, Legend } = mod;
    const Chart = ({ data, name1, name2 }: { data: any[], name1: string, name2: string }) => {
      const { theme } = useThemeStore();
      const isDark = theme === "dark";

      const gridColor = isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)";
      const axisColor = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.4)";
      const tooltipBg = isDark ? "black" : "white";
      const palette = readThemeChartPalette(isDark);
      const tooltipBorder = palette.tooltipBorder;
      const tooltipText = isDark ? "white" : "black";
      const cursorFill = palette.cursorFill;

      return (
        <ResponsiveContainer width="100%" height={280}>
          <RC data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
            <PolarGrid stroke={gridColor} />
            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: axisColor, fontWeight: 900 }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar name={name1} dataKey="score1" stroke={isDark ? "#ace504" : "#2563eb"} fill={isDark ? "#ace504" : "#2563eb"} fillOpacity={0.15} strokeWidth={2} />
            <Radar name={name2} dataKey="score2" stroke="#ec4899" fill="#ec4899" fillOpacity={0.15} strokeWidth={2} />
            <Tooltip
              contentStyle={{ backgroundColor: tooltipBg, border: `1px solid ${tooltipBorder}`, borderRadius: 16, fontSize: 11, color: tooltipText }}
              itemStyle={{ color: tooltipText }}
              cursor={{ fill: cursorFill }}
              formatter={(val: number, name: string, props: any) => {
                const raw = name === name1 ? props.payload.raw1 : props.payload.raw2;
                return [raw, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 10, fontWeight: 900, paddingTop: 15, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
          </RC>
        </ResponsiveContainer>
      );
    }
    return { default: Chart };
  }),
  { ssr: false, loading: () => <Skeleton className="h-[280px] w-full" /> }
);

function calculatePlayerStats(playerId: string, context: any, player: Player, pStats: any) {
  let wins = 0, draws = 0, losses = 0;
  let totalMinutes = 0, cleanSheets = 0, goalsConcededOnPitch = 0, goalsScoredOnPitch = 0;

  const completedMatches = context.matches.filter((m: any) => m.status === "completed");
  for (const match of completedMatches) {
    const details = context.matchesDetails[match.id];
    if (!details) continue;
    // Stessa definizione degli altri aggregatori: entrare in campo e' la
    // presenza, la panchina no (nè come presenza né per W/D/L e minuti).
    const u = getMatchUsage(details, playerId, match.isHome);
    const isStarter = u.isStarter;
    const stat = details.stats.find((s: any) => s.playerId === playerId);

    if (u.appeared) {
      totalMinutes += u.minutesPlayed;

      const chronologicalEvents = [...details.events].sort((a: any, b: any) => a.minute - b.minute);
      const myTeam = match.isHome ? 'home' : 'away';
      const oppTeam = match.isHome ? 'away' : 'home';

      let enterMin = 0;
      let exitMin = match.duration || 90;

      if (!isStarter && stat && stat.minutesPlayed > 0) {
        const subIn = chronologicalEvents.find((e: any) => e.type === 'substitution' && e.playerId === playerId);
        enterMin = subIn ? subIn.minute : 0;
      }
      const subOut = chronologicalEvents.find((e: any) => e.type === 'substitution' && e.subOutPlayerId === playerId);
      if (subOut) exitMin = subOut.minute;

      let matchGoalsConcededCount = 0;
      chronologicalEvents.forEach((e: any) => {
        if (e.minute >= enterMin && e.minute <= exitMin) {
          if (e.type === 'goal') {
            if (e.team === myTeam) goalsScoredOnPitch++;
            if (e.team === oppTeam) { goalsConcededOnPitch++; matchGoalsConcededCount++; }
          } else if (e.type === 'own_goal') {
            if (e.team === myTeam) { goalsConcededOnPitch++; matchGoalsConcededCount++; }
            if (e.team === oppTeam) goalsScoredOnPitch++;
          }
        }
      });

      if (getPrimaryRole(player) === 'POR' && matchGoalsConcededCount === 0) cleanSheets++;

      if (!match.result) continue;
      const scored = match.isHome ? match.result.home : match.result.away;
      const conceded = match.isHome ? match.result.away : match.result.home;
      if (scored > conceded) wins++;
      else if (scored < conceded) losses++;
      else draws++;
    }
  }

  return pStats ? {
    appearances: pStats.stats.appearances, goals: pStats.stats.goals, assists: pStats.stats.assists,
    avgMinutes: pStats.stats.avgMinutes, yellowCards: pStats.stats.yellowCards ?? 0, redCards: pStats.stats.redCards ?? 0,
    totalMinutes, wins, losses, draws, cleanSheets, goalsConcededOnPitch, goalsScoredOnPitch
  } : { appearances: 0, goals: 0, assists: 0, avgMinutes: 0, yellowCards: 0, redCards: 0, totalMinutes: 0, wins: 0, losses: 0, draws: 0, cleanSheets: 0, goalsConcededOnPitch: 0, goalsScoredOnPitch: 0 };
}

const splitName = (fullName: string) => {
  const parts = fullName.split(" ");
  const firstName = parts.shift() || "";
  return { firstName, lastName: parts.join(" ") };
};

function ConfrontoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const p1Id = searchParams.get("p1");
  const p2Id = searchParams.get("p2");

  const { players, fetchAll: fetchPlayers } = usePlayersStore();
  const { activeSeason, fetchAll: fetchSeasons } = useSeasonsStore();
  const { user } = useAuthStore();

  const [loading, setLoading] = useState(true);
  const [statsP1, setStatsP1] = useState<any>(null);
  const [statsP2, setStatsP2] = useState<any>(null);
  const [selectOpen, setSelectOpen] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (!activeSeason) await fetchSeasons();
      await fetchPlayers();
    };
    init();
  }, [fetchPlayers, fetchSeasons, activeSeason]);

  const p1 = useMemo(() => players.find(p => p.id === p1Id) || null, [players, p1Id]);
  const p2 = useMemo(() => players.find(p => p.id === p2Id) || null, [players, p2Id]);

  useEffect(() => {
    if (!user || !activeSeason || !p1Id) return;

    const loadData = async () => {
      setLoading(true);
      try {
        const context = await aggregationRepository.getDetailedContext(user.id, activeSeason.id);
        const playerStats = aggregationRepository.getPlayersAggregatedStatsFromContext(context);

        if (p1Id) {
          const pCurrent = players.find(p => p.id === p1Id);
          if (pCurrent) {
            setStatsP1(calculatePlayerStats(p1Id, context, pCurrent, playerStats.find(s => s.playerId === p1Id)));
          }
        }
        if (p2Id) {
          const pCurrent = players.find(p => p.id === p2Id);
          if (pCurrent) {
            setStatsP2(calculatePlayerStats(p2Id, context, pCurrent, playerStats.find(s => s.playerId === p2Id)));
          }
        }
      } catch (e) {
        console.error("Error loading stats", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [user, activeSeason, p1Id, p2Id, players]);

  // Restrict p2 selection based on p1's role
  const isP1Goalkeeper = p1 ? getPrimaryRole(p1) === 'POR' : false;
  const eligibleP2s = useMemo(() => {
    if (!p1) return [];
    return players.filter(p => {
      if (p.id === p1.id) return false;
      if (isP1Goalkeeper) return getPrimaryRole(p) === 'POR';
      return getPrimaryRole(p) !== 'POR'; // Outfield players compared with outfield
    });
  }, [players, p1]);

  const handleChangeP2 = (v: string) => {
    router.replace(`/membri/confronto?p1=${p1Id}&p2=${v}`);
  };

  const radarData = useMemo(() => {
    if (!statsP1 || !statsP2) return [];
    const maxApps = Math.max(statsP1.appearances, statsP2.appearances, 1);
    const maxGoals = Math.max(statsP1.goals, statsP2.goals, 10);
    const maxAssists = Math.max(statsP1.assists, statsP2.assists, 10);
    const maxWins = maxApps;
    const maxMins = 90;

    return [
      {
        subject: "Presenze",
        score1: (statsP1.appearances / maxApps) * 100, raw1: statsP1.appearances,
        score2: (statsP2.appearances / maxApps) * 100, raw2: statsP2.appearances
      },
      {
        subject: "Gol",
        score1: (statsP1.goals / maxGoals) * 100, raw1: statsP1.goals,
        score2: (statsP2.goals / maxGoals) * 100, raw2: statsP2.goals
      },
      {
        subject: "Assist",
        score1: (statsP1.assists / maxAssists) * 100, raw1: statsP1.assists,
        score2: (statsP2.assists / maxAssists) * 100, raw2: statsP2.assists
      },
      {
        subject: "Vittorie",
        score1: (statsP1.wins / maxWins) * 100, raw1: statsP1.wins,
        score2: (statsP2.wins / maxWins) * 100, raw2: statsP2.wins
      },
      {
        subject: "Min/Medi",
        score1: (statsP1.avgMinutes / maxMins) * 100, raw1: statsP1.avgMinutes,
        score2: (statsP2.avgMinutes / maxMins) * 100, raw2: statsP2.avgMinutes
      },
    ];
  }, [statsP1, statsP2]);

  if (!p1Id || (!p1 && !loading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
        <ArrowRightLeft className="h-12 w-12 text-muted-foreground" />
        <p className="text-sm font-medium text-muted-foreground">Seleziona un giocatore da confrontare.</p>
        <Button variant="outline" onClick={() => router.push("/membri")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Torna alla Rosa
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8 max-w-4xl mx-auto">
      <PageHeader
        title={
          <div className="flex items-center gap-2">
            <Link href={`/membri/${p1Id}`} className="h-8 w-8 flex items-center justify-center rounded-xl bg-card dark:bg-black border border-border dark:border-brand-green/20 text-primary dark:text-brand-green hover:bg-muted dark:hover:bg-brand-green/10 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="font-light text-foreground dark:text-white">Confronto</span>
            <span className="font-black text-foreground dark:text-white">Giocatori</span>
          </div>
        }
      />

      {/* Selectors */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-card dark:bg-black/40 backdrop-blur-sm border-border dark:border-brand-green/30 rounded-3xl shadow-sm dark:shadow-themesoft transition-colors">
          <CardContent className="p-5 flex flex-col items-center text-center gap-1">
            <div className="p-3 bg-primary/10 dark:bg-brand-green/10 rounded-2xl mb-2">
              <User className="h-6 w-6 text-primary dark:text-brand-green" />
            </div>
            <h3 className="font-black text-lg text-foreground dark:text-white leading-tight">{p1 ? displayPlayerName(p1) : "..."}</h3>
            <span className="text-[9px] font-black tracking-[0.2em] uppercase text-muted-foreground dark:text-white/30">{p1?.role}</span>
          </CardContent>
        </Card>

        <Card className={cn(
          "backdrop-blur-sm rounded-3xl transition-all duration-500",
          p2 
            ? "bg-card dark:bg-black/40 border-pink-500/30 shadow-sm dark:shadow-[0_0_20px_rgba(236,72,153,0.05)]" 
            : "bg-muted/30 dark:bg-black/20 border-border dark:border-white/5 border-dashed"
        )}>
          <CardContent className="p-5 flex flex-col items-center justify-center text-center gap-2 h-full">
            <Select
              value={p2?.id ?? ""}
              onValueChange={handleChangeP2}
              open={selectOpen}
              onOpenChange={setSelectOpen}
            >
              {p2 ? (
                <>
                  <div className="p-3 bg-pink-500/10 rounded-2xl mb-2">
                    <User className="h-6 w-6 text-pink-500" />
                  </div>
                  <h3 className="font-black text-lg text-foreground dark:text-white leading-tight">{displayPlayerName(p2)}</h3>
                  <SelectTrigger className="h-6 text-[8px] font-black uppercase tracking-widest text-pink-500 bg-transparent border border-pink-500/40 hover:bg-pink-500/10 mt-1 shadow-none rounded-xl px-3 outline-none">
                    <span>CAMBIA GIOCATORE</span>
                  </SelectTrigger>
                </>
              ) : (
                <SelectTrigger className="w-full h-12 bg-muted/40 dark:bg-black/60 border-divider dark:border-white/10 text-foreground dark:text-white rounded-xl font-black uppercase text-[10px] tracking-widest outline-none">
                  <SelectValue placeholder="CONFRONTA CON..." />
                </SelectTrigger>
              )}
              <SelectContent className="bg-card dark:bg-black border-border dark:border-white/10 text-foreground dark:text-white rounded-xl">
                {eligibleP2s.map(plyr => (
                  <SelectItem key={plyr.id} value={plyr.id} className="font-bold text-[10px] uppercase focus:bg-primary/20 dark:focus:bg-brand-green/20 focus:text-primary dark:focus:text-brand-green rounded-xl transition-colors">{displayPlayerName(plyr)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>

      {p1 && p2 && statsP1 && statsP2 && (
        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
          <Card className="rounded-3xl bg-card dark:bg-black/40 backdrop-blur-sm border-border dark:border-white/5 shadow-sm dark:shadow-[0_0_20px_rgba(0,0,0,0.2)] overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 transition-colors">
            <CardHeader className="pb-0 px-6 pt-6 bg-muted/20 dark:bg-black/20">
              <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-muted-foreground/40 dark:text-white/30 flex items-center justify-center gap-2">
                <BarChart2 className="h-4 w-4 text-primary dark:text-brand-green" /> Bilanciamento Tecnico Comparativo
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 px-6">
              <RadarChart data={radarData} name1={p1.name} name2={p2.name} />
            </CardContent>
          </Card>

          <Card className="rounded-3xl bg-card dark:bg-black/40 backdrop-blur-sm border-border dark:border-white/5 shadow-sm dark:shadow-[0_0_25px_rgba(0,0,0,0.4)] overflow-hidden transition-colors">
            <CardContent className="p-0">
              <div className="grid grid-cols-3 divide-x divide-divider dark:divide-white/5 border-b border-divider dark:border-white/5 items-center py-4 bg-muted/40 dark:bg-black/60">
                <div className="text-center font-black text-foreground dark:text-white text-xs truncate px-2 uppercase tracking-tight">{splitName(p1.name).lastName}</div>
                <div className="text-center text-[8px] font-black text-muted-foreground dark:text-muted-foreground/30 dark:text-white/30 uppercase tracking-[0.2em]">Metrica Analisi</div>
                <div className="text-center font-black text-pink-500 text-xs truncate px-2 uppercase tracking-tight">{splitName(p2.name).lastName}</div>
              </div>

              {[
                { label: "Presenze", val1: statsP1.appearances, val2: statsP2.appearances, better: "high" },
                { label: "Valore Gol", val1: statsP1.goals, val2: statsP2.goals, better: "high" },
                { label: "Assist", val1: statsP1.assists, val2: statsP2.assists, better: "high" },
                { label: "Min totali", val1: statsP1.totalMinutes, val2: statsP2.totalMinutes, better: "high" },
                { label: "Min medi", val1: statsP1.avgMinutes, val2: statsP2.avgMinutes, better: "high" },
                { label: "Vittorie", val1: statsP1.wins, val2: statsP2.wins, better: "high" },
                { label: "Gol On-Pitch", val1: statsP1.goalsScoredOnPitch, val2: statsP2.goalsScoredOnPitch, better: "high" },
                { label: "Gol Subiti On-Pitch", val1: statsP1.goalsConcededOnPitch, val2: statsP2.goalsConcededOnPitch, better: "low" },
                ...(isP1Goalkeeper ? [{ label: "Clean Sheets", val1: statsP1.cleanSheets, val2: statsP2.cleanSheets, better: "high" }] : []),
              ].map((row, i) => {
                const is1Better = row.better === "high" ? row.val1 > row.val2 : row.val1 < row.val2;
                const is2Better = row.better === "high" ? row.val2 > row.val1 : row.val2 < row.val1;
                return (
                  <div key={i} className="grid grid-cols-3 divide-x divide-divider dark:divide-white/5 border-b border-divider dark:border-white/5 last:border-0 items-center py-4 hover:bg-muted dark:hover:bg-white/5 transition-colors group">
                    <div className={cn(
                      "text-center font-black transition-all",
                      is1Better 
                        ? "text-primary dark:text-brand-green text-xl shadow-[inset_0_-2px_0_rgba(37,99,235,0.4)] dark:shadow-theme-bright" 
                        : "text-muted-foreground dark:text-muted-foreground/20 dark:text-white/20 text-sm"
                    )}>{row.val1}</div>
                    <div className="text-center text-[9px] font-black text-muted-foreground dark:text-muted-foreground/40 dark:text-white/40 uppercase tracking-widest group-hover:text-primary dark:group-hover:text-brand-green transition-colors">{row.label}</div>
                    <div className={cn(
                      "text-center font-black transition-all",
                      is2Better ? "text-pink-500 text-xl shadow-[inset_0_-2px_0_rgba(236,72,153,0.4)]" : "text-muted-foreground dark:text-muted-foreground/20 dark:text-white/20 text-sm"
                    )}>{row.val2}</div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

export default function ConfrontoPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground text-sm">Caricamento...</div>}>
      <ConfrontoContent />
    </Suspense>
  );
}
