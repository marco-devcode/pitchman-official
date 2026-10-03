"use client";

import { useMemo, useEffect, useState } from "react";
import { useStatsStore } from "@/store/useStatsStore";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { displayPlayerName } from "@/lib/utils";
import { Activity } from "lucide-react";
import { useChartColors } from "@/lib/design-tokens";


// Dot custom con nome giocatore sopra
function PlayerDot(props: {
  cx?: number;
  cy?: number;
  payload?: { name: string; shortName: string; x: number; y: number };
  dotColor: string;
  glowColor: string;
}) {
  const { cx = 0, cy = 0, payload, dotColor, glowColor } = props;
  if (!payload) return null;

  const r = 5;

  return (
    <g>
      {/* Alone esterno */}
      <circle cx={cx} cy={cy} r={r + 3} fill={dotColor} opacity={0.12} />
      {/* Punto principale */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={dotColor}
        style={{ filter: `drop-shadow(0 0 5px ${glowColor})` }}
      />
      {/* Nome giocatore */}
      <text
        x={cx}
        y={cy - r - 5}
        textAnchor="middle"
        fontSize={9}
        fontWeight={900}
        fontFamily="inherit"
        fill="currentColor"
        opacity={0.75}
        style={{ textTransform: "uppercase", letterSpacing: "0.05em" }}
      >
        {payload.shortName}
      </text>
    </g>
  );
}

// Tooltip personalizzato
function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { name: string; x: number; y: number } }>;
}) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;

  return (
    <div className="bg-background dark:bg-black border border-border dark:border-brand-green/30 rounded-2xl p-3 shadow-xl dark:shadow-theme text-xs">
      <p className="font-black uppercase tracking-wider text-foreground dark:text-white mb-2">
        {data.name}
      </p>
      <div className="space-y-1">
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground font-bold uppercase tracking-widest">Partite</span>
          <span className="font-black text-primary dark:text-brand-green">{data.x}</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground font-bold uppercase tracking-widest">Minuti tot.</span>
          <span className="font-black text-primary dark:text-brand-green">{data.y}&apos;</span>
        </div>
        <div className="flex items-center justify-between gap-6">
          <span className="text-muted-foreground font-bold uppercase tracking-widest">Media/partita</span>
          <span className="font-black text-foreground dark:text-white">
            {data.x > 0 ? Math.round(data.y / data.x) : 0}&apos;
          </span>
        </div>
      </div>
    </div>
  );
}

export function SquadUsageChart() {
  const { playerLeaderboard } = useStatsStore();
  const { dotColor, glowColor } = useChartColors();

  const chartData = useMemo(() => {
    return playerLeaderboard
      .filter((p) => p.stats.appearances > 0)
      .map((p) => {
        const nameParts = (p.lastName || p.name || "").split(" ");
        const shortName = p.lastName || nameParts[nameParts.length - 1] || p.name;
        return {
          playerId: p.playerId,
          name: displayPlayerName(p as Parameters<typeof displayPlayerName>[0]),
          shortName: shortName.toUpperCase().slice(0, 9),
          x: p.stats.appearances,
          y: Math.round(p.stats.appearances * p.stats.avgMinutes),
        };
      });
  }, [playerLeaderboard]);

  if (!chartData.length) {
    return (
      <Card className="bg-card dark:bg-black/40 border-border dark:border-brand-green/30 rounded-3xl">
        <CardContent className="flex items-center justify-center py-24">
          <p className="text-sm text-muted-foreground text-center">
            Nessun dato disponibile. Registra qualche partita con statistiche giocatore.
          </p>
        </CardContent>
      </Card>
    );
  }

  const maxX = Math.max(...chartData.map((d) => d.x));
  const maxY = Math.max(...chartData.map((d) => d.y));

  return (
    <Card className="bg-card dark:bg-black/40 border-border dark:border-brand-green/30 shadow-sm dark:shadow-themesoft rounded-3xl overflow-hidden backdrop-blur-sm transition-colors">
      <CardContent className="pr-2 pt-6 pb-6">
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart
            margin={{ top: 30, right: 30, left: 10, bottom: 40 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="currentColor"
              opacity={0.06}
            />
            <XAxis
              type="number"
              dataKey="x"
              name="Partite"
              domain={[0, maxX + 1]}
              tickCount={Math.min(maxX + 2, 12)}
              allowDecimals={false}
              tick={{
                fontSize: 10,
                fontWeight: 700,
                fill: "currentColor",
                opacity: 0.5,
              }}
              axisLine={{ stroke: "currentColor", opacity: 0.1 }}
              tickLine={false}
              label={{
                value: "PARTITE GIOCATE",
                position: "insideBottom",
                offset: -28,
                style: {
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.15em",
                  fill: "currentColor",
                  opacity: 0.35,
                },
              }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Minuti"
              domain={[0, maxY + 30]}
              tickCount={6}
              allowDecimals={false}
              tick={{
                fontSize: 10,
                fontWeight: 700,
                fill: "currentColor",
                opacity: 0.5,
              }}
              axisLine={{ stroke: "currentColor", opacity: 0.1 }}
              tickLine={false}
              tickFormatter={(v) => `${v}'`}
              label={{
                value: "MINUTI TOTALI",
                angle: -90,
                position: "insideLeft",
                offset: 15,
                style: {
                  fontSize: 9,
                  fontWeight: 900,
                  letterSpacing: "0.15em",
                  fill: "currentColor",
                  opacity: 0.35,
                },
              }}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{ strokeDasharray: "3 3", stroke: dotColor, strokeOpacity: 0.3 }}
            />
            <Scatter
              data={chartData}
              shape={(shapeProps: object) => (
                <PlayerDot
                  {...(shapeProps as { cx?: number; cy?: number; payload?: { name: string; shortName: string; x: number; y: number } })}
                  dotColor={dotColor}
                  glowColor={glowColor}
                />
              )}
            />
          </ScatterChart>
        </ResponsiveContainer>

        {/* Legenda */}
        <div className="mt-2 flex items-center justify-center gap-2 px-6">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{
              backgroundColor: dotColor,
              boxShadow: `0 0 6px ${glowColor}`,
            }}
          />
          <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/50">
            Ogni punto rappresenta un giocatore — in alto a destra = più utilizzato
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
