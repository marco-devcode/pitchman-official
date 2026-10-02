"use client";

import { useStatsStore } from "@/store/useStatsStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GiSoccerBall } from "react-icons/gi";
import { Swords, TrendingUp, TrendingDown } from "lucide-react";
import { AdvancedStatsSection } from "./advanced-stats-section";

export function TeamRecord() {
    const { teamRecord } = useStatsStore();

    if (!teamRecord) {
        return <p className="text-center py-10 text-muted-foreground">Nessun dato disponibile.</p>;
    }

    const goalDifference = teamRecord.goalsFor - teamRecord.goalsAgainst;
    const total = teamRecord.matchesPlayed;

    const winPct = total > 0 ? Math.round((teamRecord.wins / total) * 100) : 0;
    const drawPct = total > 0 ? Math.round((teamRecord.draws / total) * 100) : 0;
    const lossPct = total > 0 ? Math.round((teamRecord.losses / total) * 100) : 0;

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                {/* Card Record Partite */}
                <Card className="bg-card dark:bg-black/40 border-border dark:border-brand-green/30 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.05)] rounded-3xl overflow-hidden backdrop-blur-sm transition-colors">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2 text-primary dark:text-white">
                            <Swords className="h-4 w-4" />
                            Andamento Stagione
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black text-foreground dark:text-white mb-4">{teamRecord.matchesPlayed} <span className="text-xs font-bold text-muted-foreground/80 dark:text-muted-foreground/60 uppercase tracking-widest ml-1">Gare totali</span></div>
                        <div className="grid grid-cols-3 gap-2">
                            <div className="flex flex-col items-center p-3 bg-muted/50 dark:bg-black/40 rounded-2xl border border-primary/20 dark:border-brand-green/20 group hover:border-primary/40 dark:hover:border-brand-green/40 transition-all">
                                <span className="text-[10px] font-black text-primary dark:text-brand-green uppercase tracking-widest mb-1.5 opacity-80">VITTORIA</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-foreground dark:text-white">{teamRecord.wins}</span>
                                    <span className="text-xs font-bold text-primary/60 dark:text-brand-green/60">({winPct}%)</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-muted/50 dark:bg-black/40 rounded-2xl border border-divider dark:border-white/5 group hover:border-divider/20 dark:hover:border-white/10 transition-all">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-1.5 opacity-80">PAREGGIO</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-foreground dark:text-white">{teamRecord.draws}</span>
                                    <span className="text-xs font-bold text-muted-foreground/80 dark:text-muted-foreground/40">({drawPct}%)</span>
                                </div>
                            </div>
                            <div className="flex flex-col items-center p-3 bg-muted/50 dark:bg-black/40 rounded-2xl border border-rose-500/20 group hover:border-rose-500/40 transition-all">
                                <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1.5 opacity-80">SCONFITTA</span>
                                <div className="flex items-baseline gap-1">
                                    <span className="text-2xl font-black text-foreground dark:text-white">{teamRecord.losses}</span>
                                    <span className="text-xs font-bold text-rose-500/60">({lossPct}%)</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Card Bilancio Reti */}
                <Card className="bg-card dark:bg-black/40 border-border dark:border-brand-green/30 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.05)] rounded-3xl overflow-hidden backdrop-blur-sm transition-colors">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base font-black uppercase tracking-tight flex items-center gap-2 text-primary dark:text-white">
                            <GiSoccerBall className="h-4 w-4" />
                            DIFFERENZA RETI
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end justify-between mb-6">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <span className={`text-4xl font-black ${goalDifference > 0 ? 'text-primary dark:text-brand-green' : goalDifference < 0 ? 'text-rose-500' : 'text-foreground dark:text-white'}`}>
                                        {goalDifference > 0 ? `+${goalDifference}` : goalDifference}
                                    </span>
                                    {goalDifference > 0 ? <TrendingUp className="h-7 w-7 text-primary dark:text-brand-green drop-shadow-[0_0_8px_rgba(172,229,4,0.4)]" /> : goalDifference < 0 ? <TrendingDown className="h-7 w-7 text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]" /> : null}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/5">
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-primary/10 dark:bg-brand-green/10 rounded-xl border border-primary/20 dark:border-brand-green/20">
                                    <GiSoccerBall className="h-4 w-4 text-primary dark:text-brand-green" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Gol Fatti</p>
                                    <p className="text-xl font-black text-foreground dark:text-white">{teamRecord.goalsFor}</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-rose-500/10 rounded-xl border border-rose-500/20">
                                    <GiSoccerBall className="h-4 w-4 text-rose-500" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">Gol Subiti</p>
                                    <p className="text-xl font-black text-foreground dark:text-white">{teamRecord.goalsAgainst}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <AdvancedStatsSection />
        </div>
    );
}
