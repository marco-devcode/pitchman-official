"use client";

import { useState } from "react";
import { useStatsStore } from "@/store/useStatsStore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Zap,
    ShieldCheck,
    Target,
    Users,
    Trophy,
    X,
    TrendingUp
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type RankingType = 'defense' | 'efficiency' | 'decisive' | 'amulet';

export function AdvancedStatsSection() {
    const { advancedLeaderboard, playerLeaderboard, loading } = useStatsStore();
    const [defenseType, setDefenseType] = useState<'4' | '3'>('4');
    const [selectedRanking, setSelectedRanking] = useState<RankingType | null>(null);

    if (loading && !advancedLeaderboard) {
        return <Skeleton className="h-64 w-full rounded-3xl" />;
    }

    if (!advancedLeaderboard) {
        return null; // Don't show anything if no data
    }

    const { bestCbPair, bestCbTrio = [], bestGaPerStarter, decisiveGoalsLeaders, lowestStarterLossRate } = advancedLeaderboard;

    const mainCbPair = bestCbPair[0];
    const mainCbTrio = bestCbTrio[0];
    const bestGaPlayer = bestGaPerStarter[0];
    const topDecisive = decisiveGoalsLeaders[0];
    const bestLossRatePlayer = lowestStarterLossRate[0];

    // Helper to find player name
    const getPlayerName = (id: string) => {
        return playerLeaderboard.find(p => p.playerId === id)?.name || id;
    };

    const currentBestDefense = defenseType === '4' ? mainCbPair : mainCbTrio;

    const renderRankingList = () => {
        if (!selectedRanking) return null;

        switch (selectedRanking) {
            case 'defense':
                const defenseData = defenseType === '4' ? bestCbPair : bestCbTrio;
                return (
                    <div className="space-y-2 mt-4">
                        {defenseData.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-muted/20 dark:bg-white/5 rounded-2xl border border-transparent hover:border-brand-green/30 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black w-4 text-muted-foreground">#{idx + 1}</span>
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-black uppercase tracking-tight text-foreground dark:text-white">
                                            {(item as any).playerIds.map((id: string) => getPlayerName(id)).join(' + ')}
                                        </p>
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">{item.matchesTogether} Gare insieme</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-brand-green">{item.goalsConcededPerMatch.toFixed(2)}</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Subiti/Gara</p>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'efficiency':
                return (
                    <div className="space-y-2 mt-4">
                        {bestGaPerStarter.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-muted/20 dark:bg-white/5 rounded-2xl border border-transparent hover:border-primary/30 dark:hover:border-brand-green/30 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black w-4 text-muted-foreground">#{idx + 1}</span>
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-black uppercase tracking-tight text-foreground dark:text-white">{getPlayerName(item.playerId)}</p>
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">{item.starterApps} Start • {item.goals}G {item.assists}A</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-primary dark:text-brand-green">{item.gaPerStarter.toFixed(2)}</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase">G+A / Start</p>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'decisive':
                return (
                    <div className="space-y-2 mt-4">
                        {decisiveGoalsLeaders.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-muted/20 dark:bg-white/5 rounded-2xl border border-transparent hover:border-primary/30 dark:hover:border-brand-green/30 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black w-4 text-muted-foreground">#{idx + 1}</span>
                                    <p className="text-[11px] font-black uppercase tracking-tight text-foreground dark:text-white">{getPlayerName(item.playerId)}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-primary dark:text-brand-green">{item.decisiveGoals}</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Gol Decisivi</p>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            case 'amulet':
                return (
                    <div className="space-y-2 mt-4">
                        {lowestStarterLossRate.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-muted/20 dark:bg-white/5 rounded-2xl border border-transparent hover:border-primary/30 dark:hover:border-brand-green/30 transition-all">
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-black w-4 text-muted-foreground">#{idx + 1}</span>
                                    <div className="space-y-0.5">
                                        <p className="text-[11px] font-black uppercase tracking-tight text-foreground dark:text-white">{getPlayerName(item.playerId)}</p>
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">{item.starterApps} Start • {item.starterLosses} Perse</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-black text-primary dark:text-brand-green">{Math.round(item.lossRate * 100)}%</p>
                                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Loss Rate</p>
                                </div>
                            </div>
                        ))}
                    </div>
                );
            default:
                return null;
        }
    };

    const getRankingTitle = () => {
        switch (selectedRanking) {
            case 'defense': return "Classifica Muro Difensivo";
            case 'efficiency': return "Efficiency Index (G+A/Start)";
            case 'decisive': return "Classifica Risolutori";
            case 'amulet': return "Classifica Amuleto Squadra";
            default: return "Classifica";
        }
    };

    const getRankingIcon = () => {
        const iconClass = "h-5 w-5 text-foreground dark:text-white";
        switch (selectedRanking) {
            case 'defense': return <ShieldCheck className={iconClass} />;
            case 'efficiency': return <Zap className={iconClass} />;
            case 'decisive': return <Target className={iconClass} />;
            case 'amulet': return <Users className={iconClass} />;
            default: return <Trophy className={iconClass} />;
        }
    };

    return (
        <div className="space-y-4 pt-4 border-t border-brand-green/10">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-primary dark:text-brand-green/60 ml-1">Statistiche Advanced</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. BEST DEFENSE (Pair or Trio) */}
                <Card 
                    onClick={() => setSelectedRanking('defense')}
                    className="cursor-pointer bg-card dark:bg-black/40 border-border dark:border-brand-green/30 shadow-sm rounded-3xl overflow-hidden transition-all hover:border-brand-green/50 hover:shadow-[0_0_20px_rgba(172,229,4,0.1)] group relative"
                >
                    <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground group-hover:text-brand-green transition-colors">
                            <ShieldCheck className="h-3 w-3" />
                            Muro Difensivo
                        </CardTitle>
                        <div className="relative z-10" onClick={(e) => e.stopPropagation()}>
                            <Tabs 
                                value={defenseType} 
                                onValueChange={(v) => setDefenseType(v as '3' | '4')}
                                className="h-7"
                            >
                                <TabsList className="bg-black/20 border border-white/5 h-7 p-0.5 rounded-lg">
                                    <TabsTrigger 
                                        value="4" 
                                        className="text-[8px] font-black h-6 px-2 data-[state=active]:bg-brand-green data-[state=active]:text-black uppercase"
                                    >
                                        DIF A 4
                                    </TabsTrigger>
                                    <TabsTrigger 
                                        value="3" 
                                        className="text-[8px] font-black h-6 px-2 data-[state=active]:bg-brand-green data-[state=active]:text-black uppercase"
                                    >
                                        DIF A 3
                                    </TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                    </CardHeader>
                    <CardContent className="pb-4">
                        {currentBestDefense ? (
                            <div className="space-y-1">
                                <p className="text-[11px] font-black uppercase tracking-tight truncate text-foreground dark:text-white">
                                    {currentBestDefense.playerIds.map(id => getPlayerName(id)).join(' + ')}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-brand-green">{currentBestDefense.goalsConcededPerMatch.toFixed(2)}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Subiti/Gara</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm font-bold text-muted-foreground/80 dark:text-muted-foreground/30">Poche gare</p>
                        )}
                    </CardContent>
                </Card>

                {/* 2. BEST G/A PER STARTER */}
                <Card 
                    onClick={() => setSelectedRanking('efficiency')}
                    className="cursor-pointer bg-card dark:bg-black/40 border-border dark:border-brand-green/30 shadow-sm rounded-3xl overflow-hidden transition-all hover:border-primary/50 dark:hover:border-brand-green/50 hover:shadow-[0_0_20px_rgba(172,229,4,0.1)] group"
                >
                    <CardHeader className="pb-1">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground group-hover:text-primary dark:group-hover:text-brand-green transition-colors">
                            <Zap className="h-3 w-3" />
                            Efficiency Index
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        {bestGaPlayer ? (
                            <div className="space-y-1">
                                <p className="text-sm font-black uppercase tracking-tight truncate text-foreground dark:text-white">
                                    {getPlayerName(bestGaPlayer.playerId)}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-primary dark:text-brand-green">{bestGaPlayer.gaPerStarter.toFixed(2)}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">G+A / Start</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm font-bold text-muted-foreground/80 dark:text-muted-foreground/30">Poche gare</p>
                        )}
                    </CardContent>
                </Card>

                {/* 3. MOST DECISIVE GOALS */}
                <Card 
                    onClick={() => setSelectedRanking('decisive')}
                    className="cursor-pointer bg-card dark:bg-black/40 border-border dark:border-brand-green/30 shadow-sm rounded-3xl overflow-hidden transition-all hover:border-primary/50 dark:hover:border-brand-green/50 hover:shadow-[0_0_20px_rgba(172,229,4,0.1)] group"
                >
                    <CardHeader className="pb-1">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground group-hover:text-primary dark:group-hover:text-brand-green transition-colors">
                            <Target className="h-3 w-3" />
                            RISOLUTORE
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        {topDecisive ? (
                            <div className="space-y-1">
                                <p className="text-sm font-black uppercase tracking-tight truncate text-foreground dark:text-white">
                                    {getPlayerName(topDecisive.playerId)}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-primary dark:text-brand-green">{topDecisive.decisiveGoals}</span>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">Gol decisivi</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm font-bold text-muted-foreground/80 dark:text-muted-foreground/30">Nessun Goal</p>
                        )}
                    </CardContent>
                </Card>

                {/* 4. LOWEST LOSS RATE */}
                <Card 
                    onClick={() => setSelectedRanking('amulet')}
                    className="cursor-pointer bg-card dark:bg-black/40 border-border dark:border-brand-green/30 shadow-sm rounded-3xl overflow-hidden transition-all hover:border-primary/50 dark:hover:border-brand-green/50 hover:shadow-[0_0_20px_rgba(172,229,4,0.1)] group"
                >
                    <CardHeader className="pb-1">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground group-hover:text-primary dark:group-hover:text-brand-green transition-colors">
                            <Users className="h-3 w-3" />
                            Amuleto Squadra
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-4">
                        {bestLossRatePlayer ? (
                            <div className="space-y-1">
                                <p className="text-sm font-black uppercase tracking-tight truncate text-foreground dark:text-white">
                                    {getPlayerName(bestLossRatePlayer.playerId)}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-primary dark:text-brand-green">{Math.round(bestLossRatePlayer.lossRate * 100)}%</span>
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-60">% partite perse</span>
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm font-bold text-muted-foreground/80 dark:text-muted-foreground/30">Poche gare</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* RANKING DIALOG */}
            <Dialog open={!!selectedRanking} onOpenChange={(open) => !open && setSelectedRanking(null)}>
                <DialogContent className="max-w-[90vw] sm:max-w-md bg-card dark:bg-black border border-border dark:border-brand-green/30 p-6 rounded-[32px] shadow-2xl overflow-hidden">
                    <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-muted/20 dark:bg-white/5 border border-border dark:border-white/10 shadow-sm">
                                {getRankingIcon()}
                            </div>
                            <div className="space-y-0.5">
                                <DialogTitle className="text-lg font-black uppercase tracking-tight leading-none">
                                    {getRankingTitle()}
                                </DialogTitle>
                                <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60">Leaderboard Stagionale</p>
                            </div>
                        </div>
                        {selectedRanking === 'defense' && (
                            <div className="mr-8">
                                <Tabs 
                                    value={defenseType} 
                                    onValueChange={(v) => setDefenseType(v as '3' | '4')}
                                    className="h-9"
                                >
                                    <TabsList className="bg-muted/50 dark:bg-black/40 border border-divider dark:border-white/5 h-9 p-1 rounded-xl">
                                        <TabsTrigger 
                                            value="4" 
                                            className="text-[10px] font-black h-7 px-3 data-[state=active]:bg-brand-green data-[state=active]:text-black uppercase tracking-widest"
                                        >
                                            DIF A 4
                                        </TabsTrigger>
                                        <TabsTrigger 
                                            value="3" 
                                            className="text-[10px] font-black h-7 px-3 data-[state=active]:bg-brand-green data-[state=active]:text-black uppercase tracking-widest"
                                        >
                                            DIF A 3
                                        </TabsTrigger>
                                    </TabsList>
                                </Tabs>
                            </div>
                        )}
                    </DialogHeader>

                    <div className="mt-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                        {renderRankingList()}
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={() => setSelectedRanking(null)}
                            className="px-6 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest bg-muted/20 dark:bg-white/5 text-muted-foreground hover:bg-muted/30 dark:hover:bg-white/10 transition-all border border-transparent hover:border-border"
                        >
                            Chiudi
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
