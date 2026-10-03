"use client";

import { useMemo } from "react";
import { useThemeStore, DEFAULT_ACCENT_A, DEFAULT_ACCENT_B, themeModeOf } from "@/store/useThemeStore";
import { buildTheme, contrastRatio, hexToRgb, rgbToHex, backgroundFor, AA_THRESHOLD } from "@/lib/theme-engine";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { RotateCcw, Check } from "lucide-react";

/**
 * Preset: coppie pensate per coprire i casi limite, non per essere belle.
 *
 * Il bianco-grigio e' il caso che rompe: una coppia chiara su fondo scuro e'
 * gia' leggibile, ma il testo sopra il riempimento deve diventare nero, non
 * bianco. Il nero e' il caso opposto: due colori che non hanno nessun
 * contrasto e vengono entrambi schiariti.
 */
const PRESET: { nome: string; a: string; b: string }[] = [
  { nome: "Neon (default)", a: DEFAULT_ACCENT_A, b: DEFAULT_ACCENT_B },
  { nome: "Olimpico", a: "#22c55e", b: "#15803d" },
  { nome: "Notte", a: "#6366f1", b: "#a855f7" },
  { nome: "Oceano", a: "#0ea5e9", b: "#1e3a8a" },
  { nome: "Fucsia", a: "#ec4899", b: "#7c3aed" },
  { nome: "Molto scuro", a: "#1a1a6e", b: "#3a0ca3" },
  { nome: "Bianco/grigio", a: "#ffffff", b: "#9ca3af" },
  { nome: "Nero", a: "#000000", b: "#000000" },
  { nome: "Saturi", a: "#ff0000", b: "#00ff00" },
];

/** Etichetta corta del contrasto raggiunto, per rendere ispezionabile la regola 3. */
function ratioLabel(ratio: number): { testo: string; ok: boolean } {
  return ratio >= 7
    ? { testo: `${ratio.toFixed(1)}:1 AAA`, ok: true }
    : ratio >= AA_THRESHOLD
      ? { testo: `${ratio.toFixed(1)}:1 AA`, ok: true }
      : { testo: `${ratio.toFixed(1)}:1`, ok: false };
}

export function ThemeColorPanel() {
  const theme = useThemeStore((s) => s.theme);
  const accentA = useThemeStore((s) => s.accentA);
  const accentB = useThemeStore((s) => s.accentB);
  const setAccents = useThemeStore((s) => s.setAccents);

  const mode = themeModeOf(theme);
  const bg = backgroundFor(mode);
  const built = useMemo(() => buildTheme({ a1: accentA, a2: accentB, mode }), [accentA, accentB, mode]);

  const rA = contrastRatio(hexToRgb(rgbToHex(built.a1)), bg);
  const rB = contrastRatio(hexToRgb(rgbToHex(built.a2)), bg);

  return (
    <>
      {/* I due selettori. Cambiano il tema mentre si sceglie: ogni `onChange`
          chiama setAccents, che riscrive le variabili. */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Colore 1", valore: accentA, onChange: (v: string) => setAccents(v, accentB) },
          { label: "Colore 2", valore: accentB, onChange: (v: string) => setAccents(accentA, v) },
        ].map((campo) => (
          <label key={campo.label} className="flex flex-col gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">
              {campo.label}
            </span>
            <input
              type="color"
              value={campo.valore}
              onChange={(e) => campo.onChange(e.target.value)}
              className="w-full h-12 rounded-2xl border border-border bg-card cursor-pointer"
            />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {campo.valore}
            </span>
          </label>
        ))}
      </div>

      {/* Anteprima del gradiente, con i numeri del contrasto sotto. */}
      <div
        className="h-16 rounded-2xl border-2"
        style={{
          backgroundImage: "var(--grad)",
          borderColor: "var(--a1)",
        }}
      />
      <div className="grid grid-cols-2 gap-3 text-[10px] font-black uppercase tracking-widest">
        <span className={ratioLabel(rA).ok ? "text-theme" : "text-destructive"}>
          C1 {ratioLabel(rA).testo}
        </span>
        <span className={ratioLabel(rB).ok ? "text-theme" : "text-destructive"}>
          C2 {ratioLabel(rB).testo}
        </span>
      </div>

      {/* Come verranno usati davvero: testo colorato e riempimento mescolato.
          Serve a vedere subito un testo illeggibile invece di scoprirlo in
          una card della partita. */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-theme-fill rounded-2xl border border-border p-3 flex flex-col gap-1">
          <span className="text-theme text-xs font-black uppercase">Numero giornata</span>
          <span className="text-[10px] text-foreground/70">testo sopra riempimento</span>
        </div>
        <div className="border-theme rounded-2xl p-3 flex flex-col gap-1">
          <span className="text-theme text-xs font-black uppercase">Programmata</span>
          <span className="text-[10px] text-foreground/70">bordo a gradiente</span>
        </div>
      </div>

      {/* Preset. */}
      <div className="grid grid-cols-3 gap-2">
        {PRESET.map((p) => {
          const attivo = p.a.toLowerCase() === accentA.toLowerCase() && p.b.toLowerCase() === accentB.toLowerCase();
          return (
            <button
              key={p.nome}
              type="button"
              onClick={() => setAccents(p.a, p.b)}
              className={`flex flex-col gap-2 rounded-xl border p-2 transition-colors ${
                attivo ? "border-theme" : "border-border"
              }`}
            >
              <span
                className="h-6 rounded-lg"
                style={{ backgroundImage: `linear-gradient(135deg, ${p.a}, ${p.b})` }}
              />
              <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-foreground/70">
                {attivo && <Check className="h-3 w-3 shrink-0" />}
                {p.nome}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setAccents(DEFAULT_ACCENT_A, DEFAULT_ACCENT_B)}
        className="flex items-center justify-center gap-2 rounded-2xl border border-border bg-card py-3 text-[10px] font-black uppercase tracking-widest text-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Ripristina il verde neon
      </button>
    </>
  );
}

/** Il Dialog che il pannello usa, aperto dalla card "Tema" di Impostazioni. */
export function ThemeColorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Colori del tema</DialogTitle>
          <DialogDescription>
            Due colori qualsiasi. Il contrasto viene controllato da solo: nessuna combinazione
            risulta illeggibile.
          </DialogDescription>
        </DialogHeader>
        <ThemeColorPanel />
      </DialogContent>
    </Dialog>
  );
}