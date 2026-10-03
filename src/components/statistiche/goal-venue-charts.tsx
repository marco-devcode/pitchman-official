"use client";

import { useStatsStore } from "@/store/useStatsStore";
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { GiSoccerBall } from "react-icons/gi";

import { COLORS, useThemeCharts } from "@/lib/design-tokens";

export function GoalVenueCharts() {
    const { homeRecord, awayRecord } = useStatsStore();
    // I colori vengono da `useThemeCharts`, non da `COLORS.charts.primary(isDark)`:
    // quella e' una funzione che legge `--a1` solo quando viene chiamata, e senza
    // una dipendenza React il grafico restava del colore precedente quando
    // l'utente cambiava i due colori con la pagina gia' aperta.
    const charts = useThemeCharts();
    const isDark = charts.isDark;

    const HOME_COLOR = charts.primary;
    const AWAY_COLOR = COLORS.functional.draw;

    const TOOLTIP_BG = isDark ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.97)";
    const TOOLTIP_BORDER = charts.grid;
    const TOOLTIP_COLOR = charts.text;

    if (!homeRecord || !awayRecord) return null;
    if (homeRecord.matchesPlayed === 0 && awayRecord.matchesPlayed === 0) return null;

    const scoredData = [
        { name: "IN CASA", value: homeRecord.goalsFor, fill: HOME_COLOR },
        { name: "TRASFERTA", value: awayRecord.goalsFor, fill: AWAY_COLOR },
    ].filter(d => d.value > 0);

    const concededData = [
        { name: "IN CASA", value: homeRecord.goalsAgainst, fill: HOME_COLOR },
        { name: "TRASFERTA", value: awayRecord.goalsAgainst, fill: AWAY_COLOR },
    ].filter(d => d.value > 0);

    const chartConfig = { value: { label: "Gol" } };

    const GoalPieChart = ({ title, data, total }: { title: string; data: any[]; total: number }) => (
        <div className="flex flex-col items-center">
            <h4 className="text-[10px] font-black uppercase mb-2 tracking-widest text-muted-foreground">{title}</h4>
            <div className="h-40 w-40 relative">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={35}
                                outerRadius={55}
                                paddingAngle={4}
                                label={({ value }) => `${value}`}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.fill} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{ backgroundColor: TOOLTIP_BG, borderRadius: 14, border: `1px solid ${TOOLTIP_BORDER}`, fontSize: 11, color: TOOLTIP_COLOR, fontWeight: 700 }}
                                itemStyle={{ color: TOOLTIP_COLOR }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <span className="text-2xl font-black leading-none text-foreground">{total}</span>
                    <span className="text-[8px] font-black text-muted-foreground dark:text-muted-foreground/50 uppercase tracking-widest mt-1">Totali</span>
                </div>
            </div>
        </div>
    );

    return (
        <Card className="bg-card border border-primary/20 dark:border-brand-green/30 shadow-sm dark:shadow-themesoft rounded-3xl overflow-hidden backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="font-black uppercase tracking-tight text-base dark:text-white flex items-center gap-2">
                    <GiSoccerBall className="h-4 w-4" />
                    DIFFERENZA RETI
                </CardTitle>
                <CardDescription className="text-[10px] font-black uppercase text-muted-foreground dark:text-muted-foreground/60 tracking-wider">Distribuzione gol fatti e subiti tra casa e trasferta.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                    <GoalPieChart title="Gol Fatti" data={scoredData} total={homeRecord.goalsFor + awayRecord.goalsFor} />
                    <GoalPieChart title="Gol Subiti" data={concededData} total={homeRecord.goalsAgainst + awayRecord.goalsAgainst} />
                </div>
                {/* Legenda */}
                <div className="flex justify-center gap-6 mt-6 border-t border-border pt-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-brand-green dark:bg-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/80">In Casa</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-draw" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/80">Trasferta</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}