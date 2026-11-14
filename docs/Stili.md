# Gestione degli Stili e Colori

Dove stanno i colori, i font e gli stili, e quali regole valgono per non
introdurre un colore che non esiste.

> Percorsi relativi, non assoluti: i link Windows `file:///d:/...` che c'erano
> prima non valevano su nessun ambiente di lavoro.

## 🎨 Colori

Il tema è definito da **variabili CSS in HSL** dentro
[src/app/globals.css](../src/app/globals.css), con un blocco per il tema chiaro
e uno per quello scuro. Sono i colori che Tailwind espone come utility.

**I colori del brand** (quelli che identificano PitchMan):

| Token | Uso |
|---|---|
| `brand-green` | **Il verde PitchMan.** Non è `emerald-500`: quello è un verde di Tailwind e non è il verde del brand. |
| `brand-lime` | **Verde lime PitchMan** (`hsl(74 96% 46%)`), definito in `:root` e `.dark` dentro `src/app/globals.css`. |
| `brand-yellow`, `brand-cyan`, `brand-pink` | Accenti, gradienti |
| `win`, `win-deep` | Esito positivo |
| `loss`, `loss-deep` | Esito negativo |
| `draw`, `draw-deep` | Pareggio |
| `card-yellow`, `card-red` | Colori dei cartellini |

**Il verde del brand in pratica**: per un riempimento,
`bg-primary dark:bg-brand-green text-white dark:text-black`.

**Attenzione**: `emerald-500` NON è il verde PitchMan. Sostituirlo per abitudine
porta un colore che non esiste nel tema.

### `--win-deep` non è un colore con nome Tailwind

`tailwind.config.ts` espone i colori sotto `colors.brand.*` (`brand.win-deep`,
non `win-deep` da solo). Una classe come `bg-win-deep` non esiste e non dà
errore.

## 🔠 Tipografia e Layout

- **[src/app/layout.tsx](../src/app/layout.tsx)** — font PT Sans
  (`--font-pt-sans`) e `ThemeProvider`.
- **[tailwind.config.ts](../tailwind.config.ts)** — mappa le variabili CSS sui
  nomi delle utility.
- **[components.json](../components.json)** — configurazione di shadcn/ui.

## 💡 Gradienti e bordi

Definiti in `globals.css`, non con classi arbitrarie:

- `.text-neon-gradient`, `.bg-neon-gradient` — gradiente giallo → verde → ciano.
- `.border-neon-gradient` — bordo a gradiente (usa `border-box`).
- `.border-theme`, `.border-theme-thick`, `.border-theme-dim` — bordo a
  gradiente derivato dal tema corrente.
- `.shadow-theme`, `.shadow-theme-soft`, `.shadow-theme-strong`,
  `.shadow-theme-bright` — i quattro livelli di alone.

**Gli aloni verdi scritti a mano sono vietati.** Un tempo c'erano 173
occorrenze di `shadow-[0_0_10px_rgba(172,229,4,0.15)]` sparse su 12 intensità,
che il tema non poteva governare: con il tema scuro cambiavano significato.
Ora si usa `shadow-theme*`. Il verde in codice è sempre un indicatore di
"colore scritto a mano": se ne serve uno diverso dal verde, va segnalato.

Restano 13 occorrenze di `rgba(172,229,4,…)` in file che **non sono Tailwind**:
stili inline in `global-error.tsx`, attributi SVG Konva in
`exercise-player-inner.tsx`, e le stringhe in `design-tokens.ts`, che sono la
fonte dei colori del tema e devono restare letterali.

## 📏 Token del tema in TypeScript

I colori dinamici del tema personalizzabile (`--a1` e `--a2`) vengono scritti a
runtime su `document.documentElement` dal motore del tema tramite il selettore
in **[src/components/theme/theme-color-panel.tsx](../src/components/theme/theme-color-panel.tsx)**
(collegato a `useThemeStore` e `src/lib/theme-engine.ts`).

I colori che il tema non può esprimere solo con utility CSS (lo slider del
minutaggio, le serie e i riempimenti dei grafici) stanno in
**[src/lib/design-tokens.ts](../src/lib/design-tokens.ts)**, che legge `--a1` e
`--a2` a runtime costruendo gli `rgba` dal tema ed espone:

- `useChartColors()` — espone `series1`, `series2`, `halo1`, `halo2`, `gradient`, `textColor`, `dotColor`, `glowColor` reagendo ai cambi tema tramite `MutationObserver`;
- `useThemeCharts()` — versione reattiva di `COLORS.charts` per i grafici (es. Recharts);
- `useThemeChartPalette()` — palette completa (`primary`, `primaryFill`, `accent`, `accentFill`, tooltip, griglia) aggiornata automaticamente al cambio tema;
- `readThemeChartPalette(isDark)` — lettura puntuale (con fallback SSR) per componenti che non devono osservare cambi dinamici.

Le classi costruite a runtime (`dark:shadow-${x}`) **non entrano nel CSS**:
Tailwind le scansiona come sorgente, e una classe che esiste solo al runtime
non viene generata. Vedi `src/lib/score-box.ts:78`.
