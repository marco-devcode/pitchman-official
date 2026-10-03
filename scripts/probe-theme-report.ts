import { buildTheme, themeVariables, contrastRatio, hexToRgb, backgroundFor } from '../src/lib/theme-engine';
const COPPIE: [string,string][] = [['entrambi scuri','#1a1a6e','#3a0ca3'],['entrambi chiari','#ffffff','#9ca3af'],['nero','#000000','#000000'],['saturi e opposti','#ff0000','#00ff00']];
for (const modo of ['dark','light'] as const) {
  const bg = backgroundFor(modo);
  console.log(`\n=== ${modo.toUpperCase()} (sfondo #${[bg.r,bg.g,bg.b].map(v=>v.toString(16).padStart(2,'0')).join('')})`);
  for (const [n,a1,a2] of COPPIE) {
    const t = buildTheme({a1,a2,mode:modo}); const v = themeVariables(t, modo);
    const r1 = contrastRatio(hexToRgb(v['--a1']), bg).toFixed(2);
    const r2 = contrastRatio(hexToRgb(v['--a2']), bg).toFixed(2);
    console.log(`${n.padEnd(18)} ${a1}+${a2} -> a1 ${v['--a1']} (${r1}:1, ${t.steps.a1} passi)  a2 ${v['--a2']} (${r2}:1, ${t.steps.a2} passi)  testo-su-riempimento ${v['--primary-foreground']}`);
  }
}
