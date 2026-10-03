"use client";

import { useStatsStore } from "@/store/useStatsStore";
import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer } from "@/components/ui/chart";
import { useThemeStore } from "@/store/useThemeStore";

import { useThemeCharts } from "@/lib/design-tokens";

export function GoalsIntervalChart() {
    const { goalsIntervals } = useStatsStore();
    const { theme } = useThemeStore();
    const isDark = theme === "dark";

    // I colori dei grafici arrivano dall'unico hook che li rilette quando
    // l'utente cambia i due colori: `COLORS.charts.*(isDark)` e' una funzione
    // che legge `--a1` solo quando viene chiamata, e senza una dipendenza
    // React il valore restava quello di prima.
    const charts = useThemeCharts();

    const TOOLTIP_BG = isDark ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.97)";
    const TOOLTIP_BORDER = charts.grid;
    const TOOLTIP_COLOR = charts.text;
    const LEGEND_COLOR = isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)";

    const hasData = goalsIntervals.some(item => item.value > 0);

    if (!hasData) {
        return (
            <Card className="bg-card border border-primary/20 dark:border-brand-green/30 shadow-sm dark:shadow-themesoft rounded-3xl overflow-hidden backdrop-blur-sm">
                <CardHeader>
                    <CardTitle className="text-base font-black uppercase tracking-tight text-primary">Distribuzione Gol</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm font-bold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-widest text-center py-10 opacity-50">Nessun gol segnato finora.</p>
                </CardContent>
            </Card>
        );
    }

    const chartConfig = { value: { label: "Gol" } };

    // Tre barre: il primo colore del tema, il secondo, e una via di mezzo.
    // Prima erano il verde del brand piu' due sue sfumature fisse, quindi i
    // gol per intervallo restavano verdi con qualunque tema e il secondo
    // colore non compariva mai.
    //
    // `useThemeCharts` invece di `DesignTokens.charts.primary(true)`: quella e'
    // una funzione che legge `--a1` quando viene chiamata, e le due righe
    // passavano `true`/`false` a mano invece di `isDark`. Il risultato era che
    // i colori restavano indietro quando l'utente cambiava i due colori con la
    // pagina gia' aperta.
    const INTERVAL_COLORS = [
        charts.primary,
        charts.secondary,
        charts.primaryGlow,
    ];

    return (
        <Card className="bg-card border border-primary/20 dark:border-brand-green/30 shadow-sm dark:shadow-themesoft rounded-3xl overflow-hidden backdrop-blur-sm">
            <CardHeader className="pb-2">
                <CardTitle className="text-base font-black uppercase tracking-tight text-primary dark:text-white">Gol per Intervallo</CardTitle>
                <CardDescription className="text-[10px] font-black uppercase text-muted-foreground dark:text-muted-foreground/60 tracking-wider">Distribuzione dei gol segnati nei diversi momenti della gara.</CardDescription>
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