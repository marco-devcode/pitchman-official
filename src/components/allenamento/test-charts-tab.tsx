'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { useThemeStore } from '@/store/useThemeStore';
import { formatValue, formatDate, isDescendingUnit } from '@/lib/test-utils';
import { displayStarterName } from '@/lib/utils';
import { readThemeChartPalette } from '@/lib/design-tokens';
import type { PhysicalTest, Player } from '@/lib/types';
import { Activity, Users, BarChart3, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * I colori dei grafici dei test.
 *
 * Era una copia locale con il verde neon e il ciano scritti a mano: con un
 * tema rosso e blu le barre restavano verdi e l'alone restava verde acqua,
 * quindi il secondo colore dell'utente non compariva mai. Ora `primary` e
 * `accent` sono i due colori del tema, cosi' media e alone non si confondono.
 *
 * `danger` resta rosso: segnala la linea della media, non e' un colore di tema.
 */
function useChartColors() {
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const palette = useMemo(() => readThemeChartPalette(isDark), [isDark]);
  return {
    ...palette,
    danger: isDark ? '#ff4d4f' : 'hsl(0 78% 48%)',
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

/** Colore del pallino per tipo di test: blu = velocita', verde = resistenza. */
const COLORE_TIPO: Record<string, string> = {
  velocita: '#3b82f6',
  resistenza: '#22c55e',
};
const coloreTipo = (t: string) => COLORE_TIPO[t] ?? '#a1a1aa';

/**
 * Nome test abbreviato a 10 caratteri.
 *
 * 10 e' il limite del chip stretto: i nomi reali sono lunghi ("100 METRI
 * CAMPO", "SALITA ALBERO STORTO") e troncati oltre diventano indistinguibili,
 * perche' "100 METRI..." e "1000 METRI..." hanno lo stesso inizio. Il taglio
 * pero' cade su una parola intera quando possibile, altrimenti "SALITA ALB..."
 * si legge come una parola troncata a caso invece che come un abbreviazione.
 */
function nomeBreve(nome: string): string {
  const s = nome.trim();
  if (s.length <= 10) return s;
  // 9 caratteri piu' il puntini di sospensione = 10. Non 10 piu' il puntini:
  // cosi' il chip resta entro il limite ANCHE quando il taglio cade su una
  // parola intera. Con 10 ('AVANTI-IND') + puntini si arrivava a 11 e il chip
  // sfondava, proprio per i nomi con trattini come AVANTI-IND-AVANTI.
  const meta = s.slice(0, 9);
  const spazio = meta.lastIndexOf(' ');
  return (spazio > 3 ? meta.slice(0, spazio) : meta) + '…';
}

/**
 * Popup del grafico evoluzione: MAX, MEDIA e MIN uno sotto l'altro.
 *
 * Serve un componente dedicato invece di `formatter`, perche' Recharts chiama
 * formatter una volta PER OGNI SERIE del grafico: la banda e' fatta di piu'
 * serie (base, altezza, max, min, media) e il formatter veniva quindi chiamato
 * cinque volte, stampando gli stessi valori cinque volte. Con `content` si
 * controlla una volta sola cosa appare.
 */
function EvoluzioneTooltip({ active, payload, label, unit, colors }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload ?? {};
  const righe = [
    { k: 'MAX', v: d.max, colore: colors.accent },
    { k: 'MEDIA', v: d.value, colore: colors.primary },
    { k: 'MIN', v: d.min, colore: colors.accent },
  ];
  return (
    <div
      style={{
        backgroundColor: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
        borderRadius: 12,
        fontSize: 11,
        color: colors.tooltipColor,
        padding: '8px 10px',
        minWidth: 118,
      }}
    >
      <p
        style={{
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.55,
          marginBottom: 4,
        }}
      >
        {formatDate(String(label))}
      </p>
      {righe.map((r) => (
        <div key={r.k} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, lineHeight: 1.5 }}>
          <span style={{ fontWeight: 900, letterSpacing: '0.04em', color: r.colore }}>{r.k}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatValue(r.v, unit)}</span>
        </div>
      ))}
      <p style={{ fontSize: 9, opacity: 0.45, marginTop: 4 }}>{d.n} rilevamenti</p>
    </div>
  );
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
                <stop offset="0%" stopColor={colors.accent} stopOpacity={0.30} />
                <stop offset="100%" stopColor={colors.accent} stopOpacity={0.08} />
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
              content={<EvoluzioneTooltip unit={unit} colors={colors} />}
              cursor={{ stroke: colors.primary, strokeOpacity: 0.35, strokeDasharray: '3 3' }}
            />
            {/* Alone MIN -> MAX, aree IMPILATE: Recharts somma i valori delle
                aree con lo stesso stackId, quindi base(min) + altezza(max-min)
                copre esattamente da min a max. La base e' trasparente perche'
                deve solo far partire l'altezza dal min.
                Le due AreeLine tracciano i bordi delalone: senza di loro la
                banda si perde nello sfondo e non si capisce dove comincia e
                finisce. Sono opache per non gareggiare con la media. */}
            <Area dataKey="base" stackId="alone" stroke="none" fill="transparent" isAnimationActive={false} />
            <Area dataKey="altezza" stackId="alone" stroke="none" fill="url(#bandaSd)" isAnimationActive={false} />
            <Area dataKey="max" stroke={colors.accent} strokeWidth={1.5} strokeOpacity={0.7} fill="none" isAnimationActive={false} />
            <Area dataKey="min" stroke={colors.accent} strokeWidth={1.5} strokeOpacity={0.7} fill="none" isAnimationActive={false} />
            <Line type="monotone" dataKey="value" stroke={colors.primary} strokeWidth={2} dot={{ r: 3, fill: colors.primary }} connectNulls={false} />
          </ComposedChart>
        </ResponsiveContainer>
      );
    };
  }),
  { ssr: false, loading: () => <Skeleton className="h-52 w-full" /> }
);

/**
 * Popup della distribuzione: l'intervallo del quantile e i nomi di chi ci sta.
 *
 * Stessa ragione di EvoluzioneTooltip: `formatter` viene chiamato una volta per
 * serie, e su un BarChart la unica serie e' count, quindi mostrava solo
 * "Giocatori: N" e basta. Il nome dei giocatori e' dentro il bucket, non
 * fra le serie, quindi serve `content`.
 */
function DistribuzioneTooltip({ active, payload, colors, unit }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload ?? {};
  return (
    <div
      style={{
        backgroundColor: colors.tooltipBg,
        border: `1px solid ${colors.tooltipBorder}`,
        borderRadius: 12,
        fontSize: 11,
        color: colors.tooltipColor,
        padding: '8px 10px',
        minWidth: 128,
      }}
    >
      <p
        style={{
          fontSize: 9,
          fontWeight: 900,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.55,
          marginBottom: 2,
        }}
      >
        Quantile {d.indice + 1} / 10
      </p>
      <p style={{ fontWeight: 900, fontVariantNumeric: 'tabular-nums', marginBottom: 4 }}>
        {formatValue(d.da, unit)} – {formatValue(d.a, unit)}
      </p>
      {d.count === 0 ? (
        <p style={{ fontSize: 10, opacity: 0.45 }}>Nessun giocatore</p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 168 }}>
          {d.nomi.map((n: string, i: number) => (
            <span
              key={i}
              style={{
                padding: '1px 5px',
                borderRadius: 6,
                background: 'rgba(0,212,200,0.14)',
                fontSize: 10,
                fontWeight: 900,
                whiteSpace: 'nowrap',
              }}
            >
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Distribuzione: 10 quantili del range di un tentativo, media come linea. */
const DistribuzioneChart = dynamic<any>(
  () => import('recharts').then((mod) => {
    const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine } = mod;
    return function Chart({ data, colors, unit, media, mediaLabel }: any) {
      return (
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={data} margin={{ top: 5, right: 12, bottom: 5, left: 10 }}>
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
            {/* Linea sulla MEDIA CAMPIONARIA: dice in un colpo d'occhio se i
                giocatori stanno concentrating sopra o sotto la media. Rosso,
                cosi' non si confonde con le barre verdi.
                x NON puo' essere il numero della media: questo e' un asse
                categoriale (le barre sono etichette di testo), quindi su questo
                asse una x numerica non aggancia niente. Va passata
                l'etichetta della barra in cui cade la media. */}
            {mediaLabel && (
              <ReferenceLine
                x={mediaLabel}
                stroke={colors.danger}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                label={{
                  value: `media ${formatValue(media, unit)}`,
                  position: 'top',
                  fill: colors.danger,
                  fontSize: 9,
                  fontWeight: 900,
                }}
              />
            )}
            <Tooltip
              cursor={{ fill: colors.cursorFill }}
              content={<DistribuzioneTooltip colors={colors} unit={unit} />}
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

  /**
   * DISTRIBUZIONE: due livelli di selezione.
   *
   * Livello 1: il TEST, in chip brevi con il pallino del tipo.
   * Livello 2: le DATE, e solo di quel test.
   *
   * Il livello 2 nasce perche' mettendo tutte le date insieme due tentativi
   * diversi dello stesso test mostravano la stessa etichetta ("24 SET"), e non
   * si capiva quale dei due fosse. Filtrando per test l'ambiguita' sparisce da
   * sola: dentro un test due date diverse sono due giorni diversi.
   */
  const perTest = useMemo(() => {
    const byName = new Map<string, { name: string; type: string; unit: string; date: string; tentativi: PhysicalTest[] }>();
    for (const t of tests) {
      const g = byName.get(t.name) ?? { name: t.name, type: t.type, unit: t.unit, date: t.date, tentativi: [] };
      g.tentativi.push(t);
      // Tipo e unita' li prendo dall'ultimo tentativo: l'utente puo' aver
      // cambiato l'unita' in edit (per es. da secondi a secondi discendente),
      // e il grafico deve mostrare quella corrente, non la prima.
      g.type = t.type;
      g.unit = t.unit;
      if (t.date > g.date) g.date = t.date;
      byName.set(t.name, g);
    }
    return Array.from(byName.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [tests]);

  // Il test selezionato parte dall'ultimo eseguito: e' quello su cui si sta
  // lavorando, ed e' il default sensato.
  const [testSelezionato, setTestSelezionato] = useState<string | null>(null);
  const gruppoAttivo = useMemo(
    () => perTest.find((g) => g.name === testSelezionato) ?? perTest[0] ?? null,
    [perTest, testSelezionato]
  );

  // Le date del test scelto, dalla piu' recente: di nuovo, l'ultima e' quella
  // su cui si lavora.
  const tentativiDelTest = useMemo(
    () => (gruppoAttivo ? [...gruppoAttivo.tentativi].sort((a, b) => b.date.localeCompare(a.date)) : []),
    [gruppoAttivo]
  );

  const [tentativoSelezionato, setTentativoSelezionato] = useState<string | null>(null);
  const attivo = useMemo(
    () => tentativiDelTest.find((t) => t.id === tentativoSelezionato) ?? tentativiDelTest[0] ?? null,
    [tentativiDelTest, tentativoSelezionato]
  );
  // NB: nessuno stato per il quantile selezionato. Il click su una barra non
  // serve piu': l'informazione sta nel tooltip Recharts, che compare passando
  // sulla barra. Lo stato qui sarebbe una seconda copia di quegli stessi dati.

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
        nomi: [] as string[],
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
      buckets[idx].nomi.push(nomeDi(r.playerId));
      buckets[idx].count++;
    }

    // MEDIA CAMPIONARIA (n-1), non di popolazione: e' la stima corretta della
    // media della squadra su un campione di giocatori, ed e' la stessa
    // convenzione della linea nel grafico Evoluzione, cosi' i due grafici
    // parlano della stessa quantita'. Con un solo rilevamento non e' definita e
    // la linea non viene disegnata.
    const media = vals.length >= 2
      ? vals.reduce((s, v) => s + v, 0) / vals.length
      : null;

    // Su quale barra cade la media: l'asse X del grafico e' categoriale, quindi
    // la linea va ancorata a un'etichetta, non a un numero.
    const idxMedia = media === null || step <= 0
      ? -1
      : (media === max ? 9 : Math.min(9, Math.max(0, Math.floor((media - min) / step))));

    return {
      buckets,
      totale: vals.length,
      media,
      mediaLabel: idxMedia >= 0 ? buckets[idxMedia].label : null,
    };
  }, [attivo]);

  if (tests.length === 0) {
    return (
      <div className="py-12 text-center bg-card dark:bg-black/20 border border-dashed border-border dark:border-white/10 rounded-3xl">
        <Activity className="h-12 w-12 text-muted-foreground/20 mx-auto mb-4" />
        <p className="text-sm font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/40 mb-4">Nessun test da visualizzare</p>
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
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/50 px-1 flex items-center gap-1.5">
            <Users className="h-3 w-3" /> Andamento media squadra per test
          </p>
          {grouped.map(g => (
            <Card key={g.name} className="rounded-2xl bg-card dark:bg-black/40 border border-border dark:border-brand-green/20 overflow-hidden">
              <CardHeader className="pb-0 px-4 pt-4">
                <CardTitle className="text-xs font-black uppercase tracking-tight text-foreground dark:text-white flex items-center justify-between">
                  <span className="truncate">{g.name}</span>
                  <span className="text-[9px] font-bold text-muted-foreground dark:text-muted-foreground/50 shrink-0 ml-2">
                    {g.count} {g.count === 1 ? 'sessione' : 'sessioni'}
                  </span>
                </CardTitle>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/40">
                  Alone: minimo e massimo squadra attorno alla media
                </p>
              </CardHeader>
              <CardContent className="px-2 pb-3 pt-1">
                {g.series.length > 0 ? (
                  <EvoluzioneChart data={g.series} colors={chartColors} unit={g.unit} />
                ) : (
                  <div className="h-44 flex items-center justify-center text-[10px] font-bold uppercase text-muted-foreground dark:text-muted-foreground/40">
                    Nessun dato
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </>
      ) : (
        <>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/50 px-1 flex items-center gap-1.5">
            <BarChart3 className="h-3 w-3" /> Distribuzione risultati per tentativo
          </p>

          {/* LIVELLO 1 — il test, in chip brevi con il pallino del tipo.
              Il nome intero sta nel title, perche' il chip e' troncato a 10
              caratteri e da solo non basta a distinguere due test. */}
          <div className="flex flex-wrap gap-1.5">
            {perTest.map((g) => {
              const sel = gruppoAttivo?.name === g.name;
              return (
                <button
                  key={g.name}
                  type="button"
                  title={g.name}
                  onClick={() => { setTestSelezionato(g.name); setTentativoSelezionato(null); }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all border ${
                    sel
                      ? 'bg-primary/15 text-foreground dark:bg-brand-green/15 dark:text-white border-primary/60 dark:border-brand-green/60'
                      : 'bg-card dark:bg-black/40 text-muted-foreground border-border dark:border-white/10'
                  }`}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: coloreTipo(g.type) }}
                  />
                  {nomeBreve(g.name)}
                </button>
              );
            })}
          </div>

          {/* LIVELLO 2 — le date, e SOLO di quel test. Con una sola data non
              si mostra niente: il grafico non cambierebbe e il livello
              sarebbe rumore. */}
          {tentativiDelTest.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {tentativiDelTest.map((t) => {
                const sel = attivo?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTentativoSelezionato(t.id)}
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
                  <span className="text-[9px] font-bold text-muted-foreground dark:text-muted-foreground/50 shrink-0 ml-2">
                    {distribuzione.totale} rilevamenti
                  </span>
                </CardTitle>
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/40">
                  10 quantili — clicca una barra per i nomi
                </p>
              </CardHeader>
              <CardContent className="px-2 pb-3 pt-1">
                <DistribuzioneChart
                  data={distribuzione.buckets}
                  colors={chartColors}
                  unit={attivo.unit}
                  media={distribuzione.media}
                  mediaLabel={distribuzione.mediaLabel}
                />

                {/* La finestra che compariva sotto il grafico e' stata tolta:
                    ripeteva le stesse informazioni del popup della barra, che
                    ora mostra intervallo e nomi insieme. Due copie degli stessi
                    dati in due posti diversi era rumore. */}
              </CardContent>
            </Card>
          ) : (
            <div className="h-44 flex items-center justify-center text-[10px] font-bold uppercase text-muted-foreground dark:text-muted-foreground/40">
              Nessun dato
            </div>
          )}
        </>
      )}
    </div>
  );
}
