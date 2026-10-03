/**
 * Design Tokens per l'applicazione.
 * Questi valori corrispondono alle variabili CSS in globals.css e tailwind.config.ts.
 * Usare questi costanti quando è necessario passare un colore come stringa (es. in Recharts).
 */

/** Legge una variabile CSS del tema; su server (SSR) ricade sul fallback. */
function readThemeVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export const COLORS = {
  brand: {
    yellow: "#FFFD66", // hsl(59 100% 70%)
    green: "#ACE504",  // hsl(74 96% 46%)
    cyan: "#005A71",   // hsl(192 100% 22%)
    pink: "#EC4899",   // hsl(340 73% 55%)
  },
  functional: {
    win: "#ACE504",
    loss: "#f43f5e",
    draw: "#94a3b8",
    cardYellow: "#FAC815",
    cardRed: "#DC2626",
  },
  charts: {
    /**
     * Il primo colore della serie, letto dal tema.
     *
     * Prima era `#ACE504` scritto a mano: i grafici restavano verdi con
     * qualunque tema, quindi "usa entrambi i colori" non poteva funzionare.
     * Ora legge `--a1`, che il motore del tema scrive gia' corretto per il
     * contrasto, e ricade sul verde di base solo se il tema non c'e'.
     */
    primary: (isDark: boolean) => readThemeVar("--a1", isDark ? COLORS.brand.green : "#0080FF"),
    /** Il secondo colore della serie: cosi' i grafici hanno due colori. */
    secondary: (isDark: boolean) => readThemeVar("--a2", isDark ? COLORS.brand.cyan : "#7c3aed"),
    /** Alone della prima serie. */
    primaryGlow: (isDark: boolean) => withAlpha(readThemeVar("--a1", COLORS.brand.green), 0.4),
    /** Alone della seconda serie. */
    secondaryGlow: (isDark: boolean) => withAlpha(readThemeVar("--a2", COLORS.brand.cyan), 0.4),
    /** Gradiente per i bordi dei contenitori dei grafici. */
    gradient: () => `linear-gradient(135deg, ${readThemeVar("--a1", COLORS.brand.green)}, ${readThemeVar("--a2", COLORS.brand.cyan)})`,
    text: (isDark: boolean) => isDark ? "#ffffff" : "#000000",
    grid: (isDark: boolean) => isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
  }
};

import { useEffect, useState } from "react";

/** I due colori del tema nel grafico: serie, aloni e gradiente. */
export type ChartThemeColors = {
  /** Primo colore dell'utente, gia' corretto per il contrasto. */
  series1: string;
  /** Secondo colore dell'utente, gia' corretto per il contrasto. */
  series2: string;
  /** Alone della prima serie. */
  halo1: string;
  /** Alone della seconda serie. */
  halo2: string;
  textColor: string;
  /** Gradiente dei bordi: `linear-gradient(135deg, series1, series2)`. */
  gradient: string;
};

/**
 * I colori dei grafici, letti dal tema corrente.
 *
 * Non tornano ai token del brand: leggono le variabili che il motore del tema
 * scrive a runtime, cosi' i grafici seguono i due colori scelti dall'utente
 * senza sapere nulla di come siano stati corretti per il contrasto.
 *
 * `series1` e `series2` sono i due colori: un grafico con piu' di una serie
 * li alterna, e tutti i bordi e gli aloni prendono il gradiente.
 *
 * Nota: questo hook esisteva in QUATTRO copie identiche — qui, in
 * `app/membri/[id]/page.tsx`, in `components/allenamento/physical-tab.tsx` e
 * in `components/statistiche/squad-usage-chart.tsx`. Ogni copia aveva i suoi
 * colori hardcoded, quindi correggerne una non correggeva le altre tre.
 */
export function useChartColors() {
  const [isDark, setIsDark] = useState(false);
  const [theme, setTheme] = useState<ChartThemeColors>({
    series1: COLORS.brand.green,
    series2: COLORS.brand.cyan,
    halo1: "rgba(172,229,4,0.4)",
    halo2: "rgba(0,90,113,0.4)",
    textColor: "#ffffff",
    gradient: "",
  });

  const read = () => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const v = (k: string, fallback: string) => (cs.getPropertyValue(k).trim() || fallback);
    const a1 = v("--a1", COLORS.brand.green);
    const a2 = v("--a2", COLORS.brand.cyan);
    setTheme({
      series1: a1,
      series2: a2,
      halo1: withAlpha(a1, 0.4),
      halo2: withAlpha(a2, 0.4),
      textColor: v("--theme-bg", "#ffffff") === "#fcfcfd" ? "#000000" : "#ffffff",
      gradient: `linear-gradient(135deg, ${a1}, ${a2})`,
    });
  };

  useEffect(() => {
    const check = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
      read();
    };
    check();
    // `data-theme-mode` e lo `style` inline cambiano quando l'utente sceglie i
    // colori: senza `style` gli aloni e il gradiente resterebbero indietro.
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme-mode", "style"],
    });
    return () => observer.disconnect();
  }, []);

  return {
    isDark,
    dotColor: theme.series1,
    glowColor: theme.halo1,
    ...theme,
  };
}

/**
 * I due colori del tema, letti una volta sola e subito.
 *
 * Serve ai grafici che non hanno bisogno di reagire ai cambi di tema nel
 * tempo: la scheda giocatore e i tab fisici ne avevano una copia locale con
 * il verde neon scritto a mano, che non seguiva i colori dell'utente.
 * Chiamarlo dentro un `useMemo` evita di rileggere a ogni render.
 */
export function readThemeChartPalette(isDark: boolean) {
  if (typeof window === "undefined") {
    return {
      primary: COLORS.brand.green,
      primaryFill: "rgba(172,229,4,0.15)",
      accent: COLORS.brand.cyan,
      accentFill: "rgba(0,90,113,0.15)",
      gradient: "",
      grid: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)",
      tick: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.4)",
      tooltipBg: isDark ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.97)",
      tooltipBorder: isDark ? "rgba(172,229,4,0.3)" : "rgba(0,128,255,0.25)",
      tooltipColor: isDark ? "#fff" : "#000",
      cursorFill: "rgba(172,229,4,0.05)",
      muted: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
    };
  }
  const cs = getComputedStyle(document.documentElement);
  const a1 = cs.getPropertyValue("--a1").trim() || COLORS.brand.green;
  const a2 = cs.getPropertyValue("--a2").trim() || COLORS.brand.cyan;
  return {
    primary: a1,
    primaryFill: withAlpha(a1, 0.15),
    accent: a2,
    accentFill: withAlpha(a2, 0.15),
    gradient: `linear-gradient(135deg, ${a1}, ${a2})`,
    grid: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.07)",
    tick: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.4)",
    tooltipBg: isDark ? "rgba(0,0,0,0.92)" : "rgba(255,255,255,0.97)",
    tooltipBorder: withAlpha(a1, 0.3),
    tooltipColor: isDark ? "#fff" : "#000",
    cursorFill: withAlpha(a1, 0.05),
    muted: isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)",
  };
}

/** #rrggbb + alfa -> rgba(). Serve per gli aloni, che CSS non accetta in esadecimale. */
function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(172,229,4,${alpha})`;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
