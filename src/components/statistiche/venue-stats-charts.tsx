"use client";

import { useStatsStore } from "@/store/useStatsStore";
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { COLORS, useThemeCharts } from "@/lib/design-tokens";

export function VenueStatsCharts() {
    const { teamRecord, homeRecord, awayRecord } = useStatsStore();
    const charts = useThemeCharts();
    const isDark = charts.isDark;

    // Colori centralizzati
    const WIN_COLOR = charts.primary;
    const DRAW_COLOR = COLORS.functional.draw;
    const LOSS_COLOR = COLORS.functional.loss;

    const TOOLTIP_BG = isDark ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.97)";
    const TOOLTIP_BORDER = charts.grid;
    const TOOLTIP_COLOR = charts.text;

    if (!teamRecord || teamRecord.matchesPlayed === 0) return null;

    const prepareData = (record: any) => [
        { name: "VITTORIE", value: record.wins, fill: WIN_COLOR },
        { name: "PAREGGI", value: record.draws, fill: DRAW_COLOR },
        { name: "SCONFITTE", value: record.losses, fill: LOSS_COLOR },
    ].filter(d => d.value > 0);

    const chartConfig = { value: { label: "Partite" } };

    const SmallPieChart = ({ title, data, total }: { title: string; data: any[]; total: number }) => (
        <div className="flex flex-col items-center">
            <h4 className="text-[10px] font-black uppercase mb-2 tracking-widest text-muted-foreground">{title}</h4>
            <div className="h-32 w-32 relative">
                <ChartContainer config={chartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={25}
                                outerRadius={40}
                                paddingAngle={2}
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
                    <span className="text-xl font-black leading-none text-foreground">{total}</span>
                    <span className="text-[8px] font-black text-muted-foreground dark:text-muted-foreground/50 uppercase tracking-widest">Gare</span>
                </div>
            </div>
        </div>
    );

    return (
        <Card className="bg-card border border-primary/20 dark:border-brand-green/30 shadow-sm dark:shadow-themesoft rounded-3xl overflow-hidden backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-black uppercase tracking-tight text-primary dark: text-white">Statistiche Risultati</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase text-muted-foreground dark:text-muted-foreground/60 tracking-wider">Distribuzione esiti Totale, In Casa e In Trasferta.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <div className="grid grid-cols-3 gap-2">
                    <SmallPieChart title="Totale" data={prepareData(teamRecord)} total={teamRecord.matchesPlayed} />
                    <SmallPieChart title="In Casa" data={prepareData(homeRecord || {})} total={homeRecord?.matchesPlayed || 0} />
                    <SmallPieChart title="Trasferta" data={prepareData(awayRecord || {})} total={awayRecord?.matchesPlayed || 0} />
                </div>
                {/* Legenda */}
                <div className="flex justify-center gap-4 mt-6">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-brand-green dark:bg-primary" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/80">Vittoria</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-draw" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/80">Pareggio</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-loss" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/80">Sconfitta</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}