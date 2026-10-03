/**
 * Sostituisce gli aloni con il verde neon scritto a mano nelle classi Tailwind
 * con i quattro livelli che derivano dal tema.
 *
 * Non lo rifaccio a mano: erano 173 occorrenze su 12 intensita' diverse, sparse
 * A mano sarebbe lentissimo e divergerebbe.
 *
 * Il verde qui dentro non e' un colore: e' un indicatore di "colore scritto a
 * mano". Se qualcuno usa un verde diverso per un glow, non viene toccato e va
 * segnalato a mano.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = 'src';

/** rgba(172,229,4,A) -> livello. I valori sono quelli misurati sul progetto. */
function level(alpha) {
  if (alpha <= 0.07) return 'soft';
  if (alpha <= 0.18) return '';
  if (alpha <= 0.38) return '-strong';
  return '-bright';
}

/**
 * `shadow-[0_0_10px_rgba(172,229,4,0.15)]` e anche dentro una lista di classi
 * con altri valori: si sostituisce solo l'alone.
 */
const SHADOW_RE = /shadow-\[[^\]]*rgba\(172,\s*229,\s*4,\s*([0-9.]+)\)[^\]]*\]/g;

/** I file toccati, per il report. */
const changed = [];
/** Le classi non riconosciute, da guardare a mano. */
const skipped = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path);
      continue;
    }
    if (!/\.(tsx|ts)$/.test(name)) continue;

    const before = readFileSync(path, 'utf8');
    let after = before.replace(SHADOW_RE, (whole, alpha) => {
      const suffix = level(parseFloat(alpha));
      return suffix ? `shadow-theme${suffix}` : 'shadow-theme';
    });

    // Segnala gli aloni verdi rimasti: non sono della forma attesa.
    const leftover = after.match(/shadow-\[[^\]]*rgba\(172,\s*229,\s*4[^\]]*\]/g);
    if (leftover) skipped.push([path, leftover]);

    if (after !== before) {
      writeFileSync(path, after);
      changed.push(path);
    }
  }
}

walk(SRC);

console.log(`file modificati: ${changed.length}`);
for (const f of changed) console.log('  ' + f);
if (skipped.length) {
  console.log(`\nNON riconosciuti (${skipped.length}):`);
  for (const [f, l] of skipped) console.log(`  ${f}: ${l.join(' ')}`);
}