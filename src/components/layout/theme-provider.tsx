"use client";

import { useThemeStore, themeModeOf } from "@/store/useThemeStore";
import { buildTheme, themeVariables } from "@/lib/theme-engine";
import { useEffect, useState } from "react";

/**
 * Applica il tema al documento: la classe `.dark`/`.light` E le variabili
 * derivate dai due colori dell'utente.
 *
 * Le variabili sono qui e non dentro il pannello dei colori perche' il tema e'
 * una proprieta' dell'app, non del pannello: se l'applicazione vivesse dentro
 * il pannello, chiuderlo o ricaricare la pagina lascerebbe indietro meta'
 * dell'app con il verde neon.
 *
 * Si scrive via CSSOM (`setProperty`) su `documentElement`, che ha precedenza
 * su `:root` e `.dark` di globals.css: e' quello che serve, il valore scelto
 * dall'utente deve vincere sul default finche' non lo cambia.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useThemeStore((s) => s.theme);
  const accentA = useThemeStore((s) => s.accentA);
  const accentB = useThemeStore((s) => s.accentB);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme, mounted]);

  useEffect(() => {
    if (!mounted) return;
    const mode = themeModeOf(theme);
    const vars = themeVariables(buildTheme({ a1: accentA, a2: accentB, mode }), mode);
    const root = window.document.documentElement;
    for (const [nome, valore] of Object.entries(vars)) {
      root.style.setProperty(nome, valore);
    }
    root.dataset.themeMode = mode;
  }, [theme, accentA, accentB, mounted]);

  // Prevents hydration mismatch by not rendering theme-specific classes on server
  if (!mounted) {
    return <>{children}</>;
  }

  return <>{children}</>;
}
