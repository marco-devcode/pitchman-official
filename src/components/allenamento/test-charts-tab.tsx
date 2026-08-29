'use client';

import { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useThemeStore } from '@/store/useThemeStore';
import { formatValue, formatDate, isDescendingUnit } from '@/lib/test-utils';
import type { PhysicalTest } from '@/lib/types';
import { Activity, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function useChartColors() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  return {
    primary: isDark ? '#ace504' : 'hsl(210 100% 45%)',
    primaryFill: isDark ? 'rgba(172,229,4,0.15)' : 'rgba(0,128,255,0.12)',
    grid: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)',
    tick: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)',
    tooltipBg: isDark ? 'rgba(0,0,0,0.92)' : 'rgba(255,255,255,0.97)',
    tooltipBorder: isDark ? 'rgba(172,229,4,0.3)' : 'rgba(0,128,255,0.25)',
    tooltipColor: isDark ? '#fff' : '#000',
    cursorFill: isDark ? 'rgba(172,229,4,0.05)' : 'rgba(0,128,255,0.05)',
  };
}

const LineChart = dynamic<{ data: { date: string; value: number }[]; colors: any; unit: string }>(
  () => import('recharts').then(mod => {
    const { LineChart: LC, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } = mod;
    return function Chart({ data, colors, unit }: any) {
      return (
        <ResponsiveContainer width="100%" height={170}>
          <LC data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: colors.tick, fontWeight: 900 }}
              tickFormatter={(v: string) => formatDate(v)}
            />
            <YAxis
              tick={{ fontSize: 9, fill: colors.tick, fontWeight: 900 }}
              width={42}
              tickFormatter={(v: number) => formatValue(v, unit)}
            />
            <Tooltip
              contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 12, fontSize: 11, color: colors.tooltipColor }}
              formatter={(value: number) => [formatValue(value, unit), 'Media']}
            />
            <Line type="monotone" dataKey="value" stroke={colors.primary} strokeWidth={2} dot={{ r: 3, fill: colors.primary }} />
          </LC>
        </ResponsiveContainer>
      );
    };
  }),
  { ssr: false, loading: () => <Skeleton className="h-44 w-full" /> }
);

export function TestChartsTab({ tests }: { tests: PhysicalTest[] }) {
  const chartColors = useChartColors();

  // Raggruppa per nome test, ordinato per data crescente, calcola media squadra per sessione
  const grouped = useMemo(() => {
    const byName = new Map<string, PhysicalTest[]>();
    for (const t of tests) {
      const arr = byName.get(t.name) ?? [];
      arr.push(t);
      byName.set(t.name, arr);
    }
    return Array.from(byName.entries())
      .map(([name, list]) => {
        const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
        const series = sorted.map(t => {
          const vals = t.results.map(r => r.value).filter(v => !isNaN(v));
          const avg = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
          return { date: t.date, value: Number(avg.toFixed(2)) };
        });
        return { name, unit: sorted[0]?.unit ?? 'altro', count: sorted.length, series };
      })
      .sort((a, b) => b.series[b.series.length - 1]?.date.localeCompare(a.series[a.series.length - 1]?.date ?? '') || 0);
  }, [tests]);

  if (tests.length === 0) {
    return (
      <div className="py-12 text-center bg-card dark:bg-black/20 border border-dashed border-border dark:border-white/10 rounded-3xl">
        <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/40 mb-4">Nessun test da visualizzare</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-1 flex items-center gap-1.5">
        <Users className="h-3 w-3" /> Andamento media squadra per test
      </p>
      {grouped.map(g => (
        <Card key={g.name} className="rounded-2xl bg-card dark:bg-black/40 border border-border dark:border-brand-green/20 overflow-hidden">
          <CardHeader className="pb-0 px-4 pt-4">
            <CardTitle className="text-xs font-black uppercase tracking-tight text-foreground dark:text-white flex items-center justify-between">
              <span className="truncate">{g.name}</span>
              <span className="text-[9px] font-bold text-muted-foreground/50 shrink-0 ml-2">
                {g.count} {g.count === 1 ? 'sessione' : 'sessioni'}
              </span>
            </CardTitle>
            <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40">
              {g.series.length > 1 ? 'Andamento nel tempo' : 'Media squadra'}
            </p>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-1">
            {g.series.length > 0 ? (
              <LineChart data={g.series} colors={chartColors} unit={g.unit} />
            ) : (
              <div className="h-44 flex items-center justify-center text-[10px] font-bold uppercase text-muted-foreground/40">
                Nessun dato
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
