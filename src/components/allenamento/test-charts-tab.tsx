'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useThemeStore } from '@/store/useThemeStore';
import { formatValue, formatDate, isDescendingUnit } from '@/lib/test-utils';
import { displayStarterName } from '@/lib/utils';
import type { PhysicalTest, Player } from '@/lib/types';
import { Activity, Users, BarChart3, TrendingUp } from 'lucide-react';
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

/**
 * Media e deviazione standard CAMPIONARIA dei valori di un tentativo.
 *
 * Campionaria (n-1) e non popolazione (n): su un campione di giocatori e' la
 * stima corretta della dispersione. Con un solo valore la deviazione non e'
 * definita, quindi si restituisce n=1 e il chiamante non disegna la banda:
 * restituire 0 la farebbe sembrare "nessuna dispersione" invece di
 * "non misurabile".
 */

/**
 * Media, massimo e minimo dei valori di un tentativo.
 *
 * L'alone e' MAX/MIN, non la deviazione standard: la deviazione e' un numero
 * astratto che non dice niente del distacco reale fra i giocatori, mentre il
 * massimo e il minimo dicono quanto vanno dal peggiore al migliore. MAX e MIN
 * sono anche i due estremi che l'utente chiede di leggere nel popup.
 */
function statsOf(values: number[]): { avg: number; max: number; min: number; n: number } {
  const vals = values.filter((v) => !isNaN(v));
  if (vals.length === 0) return { avg: 0, max: 0, min: 0, n: 0 };
  const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
  return {
    avg,
    max: Math.max(...vals),
    min: Math.min(...vals),
    n: vals.length,
  };
}

/**
 * Evoluzione: media per test nel tempo, con alone +/- deviazione standard.
 *
 * L'alone e' un'Area che riempie fra media-sd e media+sd con gradiente verde
 * neon trasparente. Recharts non ha "area fra due serie", quindi si disegna
 * l'area ALTA e si stacca quella BASSA con un riempimento quasi trasparente:
 * e' il modo per ottenere la banda senza inventare una serie finta.
 */
const EvoluzioneChart = dynamic<any>(
  () => import('recharts').then((mod) => {
    const {
      LineChart: _LC, Line, XAxis, YAxis, CartesianGrid, Tooltip,
      ResponsiveContainer, Area, ComposedChart,
    } = mod;
    return function Chart({ data, colors, unit }: any) {
      return (
        <ResponsiveContainer width="100%" height={190}>
          <ComposedChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id="bandaSd" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.primary} stopOpacity={0.38} />
                <stop offset="100%" stopColor={colors.primary} stopOpacity={0.12} />
              </linearGradient>
            </defs>
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
              labelFormatter={(v: any) => formatDate(String(v))}
              formatter={(_v: any, _n: any, item: any) => {
                const d = item?.payload ?? {};
                const righe = [
                  { k: 'MAX', v: d.max },
                  { k: 'MEDIA', v: d.value },
                  { k: 'MIN', v: d.min },
                ].filter((x) => typeof x.v === 'number');
                return righe.map((x) => `${x.k}: ${formatValue(x.v, unit)}`).join('  •  ');
              }}
            />
            {/* Alone MIN -> MAX, aree IMPILATE: Recharts somma i valori delle
                aree con lo stesso stackId, quindi base(min) + altezza(max-min)
                copre esattamente da min a max. Senza stackId la somma non
                avviene e la banda sarebbe sbagliata. La base e' trasparente
                perché deve solo far partire l'altezza dal min. */}
            <Area dataKey="base" stackId="alone" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area dataKey="altezza" stackId="alone" stroke="none" fill="url(#bandaSd)" isAnimationActive={false} />
            <Line type="monotone" dataKey="value" stroke={colors.primary} strokeWidth={2} dot={{ r: 3, fill: colors.primary }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    };
  }),
  { ssr: false, loading: () => <Skeleton className="h-52 w-full" /> }
);

/** Distribuzione: 10 quantili del range di un tentativo, click apre i nomi. */
const DistribuzioneChart = dynamic<any>(
  () => import('recharts').then((mod) => {
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } = mod;
    return function Chart({ data, colors, unit, onPick }: any) {
      return (
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 10 }} onClick={onPick}>
            <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 8, fill: colors.tick, fontWeight: 900 }}
              interval={0}
              angle={-35}
              textAnchor="end"
              height={48}
            />
            <YAxis tick={{ fontSize: 9, fill: colors.tick, fontWeight: 900 }} width={30} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: colors.cursorFill }}
              contentStyle={{ backgroundColor: colors.tooltipBg, border: `1px solid ${colors.tooltipBorder}`, borderRadius: 12, fontSize: 11, color: colors.tooltipColor }}
              formatter={(v: any) => [v, 'Giocatori']}
            />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
              {data.map((d: any, i: number) => (
                <Cell key={i} fill={colors.primary} fillOpacity={0.75} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      );
    };
  }),
  { ssr: false, loading: () => <Skeleton className="h-52 w-full" /> }
);

type SubTab = 'evoluzione' | 'distribuzione';

export function TestChartsTab({ tests, players }: { tests: PhysicalTest[]; players: Player[] }) {
  const chartColors = useChartColors();
  const [subTab, setSubTab] = useState<SubTab>('evoluzione');

  // Il tentativo selezionato parte dall'ultimo: e' quello su cui si sta
  // lavorando, ed e' il default sensato per la distribuzione.
  const sortedTests = useMemo(() => [...tests].sort((a, b) => b.date.localeCompare(a.date)), [tests]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const attivo = useMemo(
    () => sortedTests.find((t) => t.id === selectedId) ?? sortedTests[0] ?? null,
    [sortedTests, selectedId]
  );
  const [quantileAperto, setQuantileAperto] = useState<number | null>(null);

  const grouped = useMemo(() => {
    const byName = new Map<string, PhysicalTest[]>();
    for (const t of tests) {
      const arr = byName.get(t.name) ?? [];
      arr.push(t);
      byName.set(t.name, arr);
    }
    return Array.from(byName.entries())
      .map(([name, list]) => {
        const ord = [...list].sort((a, b) => a.date.localeCompare(b.date));
        const series = ord.map(t => {
          const vals = t.results.map(r => r.value).filter(v => !isNaN(v));
          const { avg, max, min, n } = statsOf(vals);
          // Per l'area impilata Recharts somma i valori: la base trasparente
          // parte da min e la banda visibile e' alta (max - min), cosi' la
          // superficie copre ESATTAMENTE da min a max. Con un solo valore
          // l'altezza e' zero e la banda non si vede, che e' il comportamento
          // giusto: non c'e' distacco da mostrare.
          return {
            date: t.date,
            value: Number(avg.toFixed(2)),
            max: Number(max.toFixed(2)),
            min: Number(min.toFixed(2)),
            base: Number(min.toFixed(2)),
            altezza: Number((max - min).toFixed(2)),
            n,
          };
        });
        return { name, unit: ord[0]?.unit ?? 'altro', count: ord.length, series };
      })
      .sort((a, b) => b.series[b.series.length - 1]?.date.localeCompare(a.series[a.series.length - 1]?.date ?? '') || 0);
  }, [tests]);

  // playerId -> nome abbreviato ('ROSSI M.'). Una Map, non un find per
  // barra: la ricerca dentro il bucket e' quella che va veloce.
  //
  // In rosa cognome e nome si inseriscono in DUE CAMPI SEPARATI, quindi sono
  // la fonte affidabile: displayStarterName li usa gia' quando presenti.
  // Il fallback sul nome unico serve solo per i giocatori vecchi, salvati
  // prima che i campi esistessero: e' displayStarterName a deciderlo, non un
  // guess fatto qui.
  //
  // Perche' NON conviene un formattatore nuovo che 'corregga' l'ordine dei
  // nomi: 'Rossi Marco' e 'Marco Rossi' sono indistinguibili senza sapere quale
  // dei due sia il cognome, e sbagliare significa mostrare il nome al posto
  // del cognome. Meglio il campo esplicito.
  const nomiPerId = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of players) m.set(p.id, displayStarterName(p));
    return m;
  }, [players]);

  /** Nome del giocatore, o l'id se non e' in rosa (non inventare nulla). */
  const nomeDi = (pid: string) => nomiPerId.get(pid) ?? pid;

  const distribuzione = useMemo(() => {
    if (!attivo) return null;
    const vals = attivo.results.map(r => r.value).filter(v => !isNaN(v));
    if (vals.length === 0) return null;

    // Range sui valori REALI, non un range arbitrario: se i valori sono tutti
    // uguali un range fisso darebbe dieci barre quasi vuote che non dicono
    // nulla. Se min === max il passo e' zero e tutto cade nel primo quantile.
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const step = (max - min) / 10;

    const buckets = Array.from({ length: 10 }, (_, i) => {
      const lo = min + i * step;
      const hi = min + (i + 1) * step;
      return {
        indice: i,
        da: lo,
        a: hi,
        label: step > 0 ? formatValue(lo, attivo.unit) : formatValue(min, attivo.unit),
        giocatori: [] as string[],
        count: 0,
      };
    });

    for (const r of attivo.results) {
      const v = r.value;
      if (isNaN(v)) continue;
      // Il massimo finisce nell'ultimo quantile: col semplice floor chi ha il
      // valore peggiore resterebbe fuori da ogni barra.
      const idx = step > 0 ? (v === max ? 9 : Math.min(9, Math.floor((v - min) / step))) : 0;
      buckets[idx].giocatori.push(r.playerId);
      buckets[idx].count++;
    }

    return { buckets, totale: vals.length };
  }, [attivo]);

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
      {/* Sotto-tab Evoluzione / Distribuzione */}
      <div className="flex gap-2 p-1 rounded-2xl bg-muted/50 dark:bg-black/40 border border-border dark:border-brand-green/20">
        {([
          { id: 'evoluzione' as SubTab, label: 'Evoluzione', icon: TrendingUp },
          { id: 'distribuzione' as SubTab, label: 'Distribuzione', icon: BarChart3 },
        ]).map((t) => {
          const attiva = subTab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setSubTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all border ${
                attiva
                  ? 'bg-primary text-white dark:bg-brand-green/20 dark:text-brand-green border-primary/60 dark:border-brand-green'
                  : 'text-muted-foreground border-transparent hover:bg-primary/5 dark:hover:bg-brand-green/5'
              }`}
            >
              <Icon className="h-3 w-3" />
              {t.label}
            </button>
          );
        })}
      </div>

      {subTab === 'evoluzione' ? (
        <>
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
                  Alone: minimo e massimo squadra attorno alla media
                </p>
              </CardHeader>
              <CardContent className="px-2 pb-3 pt-1">
                {g.series.length > 0 ? (
                  <EvoluzioneChart data={g.series} colors={chartColors} unit={g.unit} />
                ) : (
                  <div className="h-44 flex items-center justify-center text-[10px] font-bold uppercase text-muted-foreground/40">
                    Nessun dato
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      ) : (
        <>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50 px-1 flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" /> Distribuzione risultati per tentativo
          </p>

          {sortedTests.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {sortedTests.map((t) => {
                const sel = attivo?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { setSelectedId(t.id); setQuantileAperto(null); }}
                    className={`px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border ${
                      sel
                        ? 'bg-primary text-white dark:bg-brand-green/20 dark:text-brand-green border-primary/60 dark:border-brand-green'
                        : 'bg-card dark:bg-black/40 text-muted-foreground border-border dark:border-white/10'
                    }`}
                  >
                    {formatDate(t.date)}
                  </button>
                );
              })}
            </div>
          )}

          {attivo && distribuzione ? (
            <Card className="rounded-2xl bg-card dark:bg-black/40 border border-border dark:border-brand-green/20 overflow-hidden">
              <CardHeader className="pb-0 px-4 pt-4">
                <CardTitle className="text-xs font-black uppercase tracking-tight text-foreground dark:text-white flex items-center justify-between">
                  <span className="truncate">{attivo.name}</span>
                  <span className="text-[9px] font-bold text-muted-foreground/50 shrink-0 ml-2">
                    {distribuzione.totale} rilevamenti
                  </span>
                </CardTitle>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground/40">
                  10 quantili — clicca una barra per i nomi
                </p>
              </CardHeader>
              <CardContent className="px-2 pb-3 pt-1">
                <DistribuzioneChart
                  data={distribuzione.buckets}
                  colors={chartColors}
                  unit={attivo.unit}
                  onPick={(payload: any) => {
                    const i = payload?.activePayload?.[0]?.payload?.indice;
                    if (typeof i === 'number') setQuantileAperto(i);
                  }}
                />

                {/* Finestra trasparente con chi compone il quantile cliccato */}
                {quantileAperto !== null && distribuzione.buckets[quantileAperto] && (
                  <div className="mt-2 rounded-xl border border-brand-green/30 dark:border-brand-green/40 bg-brand-green/5 backdrop-blur-sm p-3">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green">
                        Quantile {quantileAperto + 1} / 10
                      </p>
                      <button
                        type="button"
                        onClick={() => setQuantileAperto(null)}
                        className="text-[10px] font-black uppercase text-muted-foreground hover:text-foreground"
                      >
                        Chiudi
                      </button>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground/70 mb-2">
                      da {formatValue(distribuzione.buckets[quantileAperto].da, attivo.unit)} a{' '}
                      {formatValue(distribuzione.buckets[quantileAperto].a, attivo.unit)}
                    </p>
                    {distribuzione.buckets[quantileAperto].giocatori.length === 0 ? (
                      <p className="text-[10px] font-bold text-muted-foreground/40">Nessun giocatore in questo intervallo</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {distribuzione.buckets[quantileAperto].giocatori.map((pid, i) => (
                          <span
                            key={`${pid}-${i}`}
                            className="px-2 py-1 rounded-lg bg-background/60 dark:bg-black/60 border border-border dark:border-white/10 text-[10px] font-black text-foreground dark:text-white"
                          >
                            {nomeDi(pid)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="h-44 flex items-center justify-center text-[10px] font-bold uppercase text-muted-foreground/40">
              Nessun dato
            </div>
          )}
        </>
      )}
    </div>
  );
}
