"use client";

import { useStatsStore } from "@/store/useStatsStore";
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { useThemeStore } from "@/store/useThemeStore";

import { COLORS as DesignTokens } from "@/lib/design-tokens";

export function GoalsIntervalChart() {
    const { goalsIntervals } = useStatsStore();
    const { theme } = useThemeStore();
    const isDark = theme === "dark";

    const TOOLTIP_BG = isDark ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.97)";
    const TOOLTIP_BORDER = DesignTokens.charts.grid(isDark);
    const TOOLTIP_COLOR = DesignTokens.charts.text(isDark);
    const LEGEND_COLOR = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";

    const hasData = goalsIntervals.some(item => item.value > 0);

    if (!hasData) {
        return (
            <Card className="bg-card border border-primary/20 dark:border-brand-green/30 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.05)] rounded-3xl overflow-hidden backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-base font-black uppercase tracking-tight text-primary">Distribuzione Gol</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm font-bold text-muted-foreground/80 dark:text-muted-foreground/60 uppercase tracking-widest text-center py-10 opacity-50">Nessun gol segnato finora.</p>
                </CardContent>
            </Card>
        );
    }

    const chartConfig = { value: { label: "Gol" } };

    const INTERVAL_COLORS = isDark
        ? [DesignTokens.brand.green, "rgba(172, 229, 4, 0.7)", "rgba(172, 229, 4, 0.4)"]
        : [DesignTokens.charts.primary(false), "rgba(0, 120, 255, 0.6)", "rgba(0, 120, 255, 0.3)"];

    return (
        <Card className="bg-card border border-primary/20 dark:border-brand-green/30 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.05)] rounded-3xl overflow-hidden backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-black uppercase tracking-tight text-primary dark:text-white">Gol per Intervallo</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase text-muted-foreground/80 dark:text-muted-foreground/60 tracking-wider">Distribuzione dei gol segnati nei diversi momenti della gara.</CardDescription>
            </CardHeader>
            <CardContent>
                <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={goalsIntervals}
                                dataKey="value"
                                nameKey="name"
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={8}
                                stroke="none"
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                labelLine={false}
                            >
                                {goalsIntervals.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={INTERVAL_COLORS[index % INTERVAL_COLORS.length]}
                                        className="hover:opacity-80 transition-opacity cursor-pointer"
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: TOOLTIP_BG,
                                    borderRadius: 16,
                                    border: `1px solid ${TOOLTIP_BORDER}`,
                                    color: TOOLTIP_COLOR,
                                    fontSize: 12,
                                    fontWeight: 900,
                                }}
                                itemStyle={{ color: TOOLTIP_COLOR }}
                            />
                            <Legend
                                iconType="circle"
                                wrapperStyle={{
                                    paddingTop: 20,
                                    fontSize: 10,
                                    fontWeight: 900,
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                    color: LEGEND_COLOR,
                                }}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartContainer>
            </CardContent>
        </Card>
    );
}