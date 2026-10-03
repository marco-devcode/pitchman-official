"use client";

import { useStatsStore } from "@/store/useStatsStore";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { useThemeStore } from "@/store/useThemeStore";
import { COLORS } from "@/lib/design-tokens";

export function TeamPerformanceChart() {
    const { teamTrend } = useStatsStore();
    const { theme } = useThemeStore();
    const isDark = theme === "dark";

    // Colori adattivi centralizzati
    const LINE_COLOR = COLORS.charts.primary(isDark);
    const GRID_COLOR = COLORS.charts.grid(isDark);
    const REF_COLOR = COLORS.charts.grid(isDark);
    const TICK_COLOR = isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.4)";
    const TOOLTIP_BG = isDark ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.97)";
    const TOOLTIP_BORDER = COLORS.charts.grid(isDark);
    const TOOLTIP_TEXT = COLORS.charts.text(isDark);
    const TOOLTIP_SUB = isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.4)";

    if (!teamTrend || teamTrend.length === 0) {
        return (
            <Card className="bg-card border border-primary/20 dark:border-brand-green/30 rounded-3xl">
                <CardHeader>
                    <CardTitle className="text-base font-black uppercase tracking-tight dark:text-white">Andamento Risultati</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">Registra una partita per vedere l'andamento.</p>
                </CardContent>
            </Card>
        );
    }

    const chartConfig = {
        value: { label: "Esito", color: LINE_COLOR },
    };

    return (
        <Card className="bg-card border border-primary/20 dark:border-brand-green/30 shadow-sm dark:shadow-themesoft rounded-3xl overflow-hidden backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-black uppercase tracking-tight dark:text-white">Andamento Risultati</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase text-muted-foreground dark:text-muted-foreground/60 tracking-wider">
                    Sequenza cronologica di Vittorie (V), Pareggi (P) e Sconfitte (S).
                </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
                <ChartContainer config={chartConfig} className="min-h-[250px] w-full">
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={teamTrend} margin={{ top: 20, right: 20, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={GRID_COLOR} />
                            <XAxis
                                dataKey="date"
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                tick={{ fontSize: 9, fontWeight: 900, fill: TICK_COLOR }}
                            />
                            <YAxis
                                domain={[-1.2, 1.2]}
                                ticks={[-1, 0, 1]}
                                tickFormatter={(val) => {
                                    if (val === 1) return "V";
                                    if (val === -1) return "S";
                                    return "P";
                                }}
                                tickLine={false}
                                axisLine={false}
                                tick={{ fontSize: 11, fontStyle: "italic", fontWeight: 900, fill: TICK_COLOR }}
                            />
                            <Tooltip
                                content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                        const data = payload[0].payload;
                                        const resultLabel =
                                            data.value === 1 ? "Vittoria" :
                                                data.value === -1 ? "Sconfitta" : "Pareggio";
                                        const resultColor =
                                            data.value === 1 ? COLORS.functional.win :
                                                data.value === -1 ? COLORS.functional.loss : COLORS.functional.draw;

                                        return (
                                            <div style={{
                                                backgroundColor: TOOLTIP_BG,
                                                border: `1px solid ${TOOLTIP_BORDER}`,
                                                borderRadius: 16,
                                                padding: "10px 14px",
                                                fontSize: 10,
                                                minWidth: 140,
                                                color: TOOLTIP_TEXT,
                                            }}>
                                                <p style={{ color: TOOLTIP_SUB, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", borderBottom: `1px solid ${TOOLTIP_SUB}30`, paddingBottom: 6, marginBottom: 6 }}>
                                                    {data.date}
                                                </p>
                                                <p style={{ color: TOOLTIP_SUB, fontWeight: 900, textTransform: "uppercase", marginBottom: 2 }}>Avversario</p>
                                                <p style={{ color: TOOLTIP_TEXT, fontWeight: 900, fontSize: 13, textTransform: "uppercase", marginBottom: 8 }}>{data.opponent}</p>
                                                <p style={{ color: TOOLTIP_SUB, fontWeight: 900, textTransform: "uppercase", fontSize: 9, borderTop: `1px solid ${TOOLTIP_SUB}30`, paddingTop: 6, marginBottom: 2 }}>Risultato</p>
                                                <p style={{ color: resultColor, fontWeight: 900, fontSize: 15, fontStyle: "italic", textTransform: "uppercase" }}>{resultLabel}</p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <ReferenceLine y={0} stroke={REF_COLOR} />
                            <Line
                                type="monotone"
                                dataKey="value"
                                stroke={LINE_COLOR}
                                strokeWidth={4}
                                dot={{ r: 4, fill: LINE_COLOR, strokeWidth: 0 }}
                                activeDot={{ r: 6, fill: LINE_COLOR, strokeWidth: 4, stroke: `${LINE_COLOR}33` }}
                                animationDuration={1000}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}