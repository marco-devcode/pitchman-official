import { toPng } from 'html-to-image';

import type { Player } from '@/lib/types';
import { displayPlayerName } from '@/lib/utils';

/** Larghezza del campo nell'immagine condivisa. */
const PITCH_WIDTH = 420;

export interface ShareLineupOptions {
  /** ID dei panchinari, in ordine di panchina. */
  substitutes: string[];
  /** Tutti i giocatori, per risolvere gli ID in nomi. */
  allPlayers: Player[];
  /** Modulo, mostrato nell'intestazione. */
  formation: string;
  /** Nome squadra, mostrato nell'intestazione. */
  teamName?: string;
}

/**
 * Neutralizza le animazioni di ingresso nel nodo catturato.
 *
 * Il campo e' avvolto in `animate-in fade-in zoom-in-95`: la classe
 * `.animate-in` di tailwindcss-animate imposta `--tw-enter-opacity: initial`
 * (= 0) e i keyframe `enter` partono da opacity 0 / scale 0.95. Sul clono
 * l'animazione RIPARTE da capo e html-to-image cattura subito, senza
 * attendere: il campo verrebbe fotografato a opacita' ~0, cioe' assente.
 *
 * Serve `!important`: un'animazione CSS vince sulle dichiarazioni normali,
 * quindi un `style.opacity = 1` inline verrebbe ignorato finche' l'animazione
 * e' attiva. Lo `<style>` e' dentro il nodo, quindi html-to-image lo embedded
 * nel PNG.
 */
function freezeAnimations(root: HTMLElement) {
  const stile = document.createElement('style');
  stile.textContent = `
    [data-lineup-share], [data-lineup-share] * {
      animation: none !important;
      transition: none !important;
      opacity: 1 !important;
      transform: none !important;
    }
  `;
  root.appendChild(stile);
  root.setAttribute('data-lineup-share', '');
}

/**
 * I pallini hanno un glow colorato che finisce nell'immagine: si legge come un
 * duplicato sfocato spostato a destra, non come un'ombra. Per un'immagine da
 * condividere si vuole un'immagine piatta, quindi il glow viene azzerato SOLO
 * per la cattura, senza toccare l'app.
 *
 * Non basta una regola CSS sugli shadow: sono inline, quindi vanno rimossi
 * passando per gli elementi stili.
 */
function stripGlows(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('*').forEach((el) => {
    if (el.style.boxShadow) el.style.boxShadow = 'none';
    if (el.style.filter) el.style.filter = '';
    if (el.style.textShadow) el.style.textShadow = 'none';
  });
  if (root.style.boxShadow) root.style.boxShadow = 'none';
}

function panchinaColonna(opts: ShareLineupOptions): HTMLElement {
  const col = document.createElement('div');
  col.style.cssText =
    'flex:1 1 auto;min-width:170px;color:#fff;' +
    'font-family:system-ui,-apple-system,Segoe UI,sans-serif;';

  const ids = opts.substitutes.filter(Boolean);
  const intestazione = document.createElement('div');
  intestazione.style.cssText =
    'font-size:10px;font-weight:800;color:rgba(255,255,255,0.4);' +
    'letter-spacing:0.1em;text-transform:uppercase;white-space:nowrap;' +
    'padding-bottom:6px;border-bottom:1px solid rgba(255,255,255,0.12);margin-bottom:8px;';
  intestazione.textContent = `Panchina (${ids.length})`;
  col.appendChild(intestazione);

  if (ids.length === 0) {
    const vuoto = document.createElement('div');
    vuoto.style.cssText = 'font-size:10.5px;color:rgba(255,255,255,0.35);';
    vuoto.textContent = 'Nessun panchinaro';
    col.appendChild(vuoto);
    return col;
  }

  // Lista verticale, uno per riga: richiesta esplicita.
  ids.forEach((id, i) => {
    const player = opts.allPlayers.find((p) => p.id === id);
    if (!player) return;
    const riga = document.createElement('div');
    riga.style.cssText =
      'font-size:11px;font-weight:700;color:#fff;line-height:1.5;' +
      'display:flex;gap:8px;align-items:baseline;padding:1.5px 0;';
    const numero = document.createElement('span');
    numero.style.cssText = 'color:rgba(255,255,255,0.35);font-size:9.5px;min-width:16px;';
    numero.textContent = String(i + 12); // R1 = maglia 12, come in partita
    const nome = document.createElement('span');
    nome.style.cssText = 'white-space:nowrap;';
    // displayPlayerName restituisce gia' "COGNOME NOME".
    nome.textContent = displayPlayerName(player);
    riga.appendChild(numero);
    riga.appendChild(nome);
    col.appendChild(riga);
  });

  return col;
}

/**
 * Compone il contenitore da catturare: campo + colonna panchinari.
 *
 * DOM separato e clonato dal campo a schermo: modificarlo produrrebbe uno
 * scatto visibile fra schermo e immagine, che su mobile durante la cattura si
 * vedrebbe come il campo che cambia e torna indietro.
 */
export function buildShareNode(pitch: HTMLElement, opts: ShareLineupOptions): HTMLElement {
  const wrap = document.createElement('div');
  wrap.style.cssText =
    'display:flex;flex-direction:column;gap:12px;background:#000;' +
    'padding:16px;width:max-content;';

  // Intestazione: squadra + modulo. Sta in alto a SINISTRA, sopra il campo, e
  // non nella colonna panchinari: e' l'intestazione dell'immagine, non della
  // lista. Copre l'intera larghezza (campo + panchina) per non restare stretta
  // sopra il solo campo.
  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:baseline;gap:10px;';
  const squadra = document.createElement('div');
  squadra.style.cssText =
    'font-size:18px;font-weight:800;color:#ace504;letter-spacing:0.06em;' +
    'text-transform:uppercase;font-family:system-ui,-apple-system,Segoe UI,sans-serif;';
  squadra.textContent = opts.teamName?.trim() || 'Formazione';
  const modulo = document.createElement('div');
  modulo.style.cssText =
    'font-size:12px;font-weight:700;color:rgba(255,255,255,0.5);' +
    'letter-spacing:0.08em;font-family:system-ui,-apple-system,Segoe UI,sans-serif;';
  modulo.textContent = `Modulo ${opts.formation}`;
  header.appendChild(squadra);
  header.appendChild(modulo);
  wrap.appendChild(header);

  // Riga principale: campo a sinistra, panchinari a destra.
  const body = document.createElement('div');
  body.style.cssText = 'display:flex;gap:18px;align-items:flex-start;';

  const campo = document.createElement('div');
  // Larghezza fissa: senza, flex darebbe al campo solo lo spazio residuo e si
  // stringerebbe per far posto alla colonna.
  campo.style.cssText = `flex:0 0 auto;width:${PITCH_WIDTH}px;`;
  campo.appendChild(pitch.cloneNode(true));
  body.appendChild(campo);

  body.appendChild(panchinaColonna(opts));
  wrap.appendChild(body);

  stripGlows(wrap);
  // va per ULTIMO: imposta opacity/transform !important su tutto, e
  // stripGlows deve poter agire sugli elementi che la regola tocca.
  freezeAnimations(wrap);
  return wrap;
}

/**
 * Cattura il campo come PNG e la condivide via Web Share API (mobile) o la
 * scarica (desktop). `compose` costruisce il nodo effettivamente catturato
 * (campo + panchina): viene montato fuori dal flusso, invisibile, perche'
 * html-to-image misura il layout e un nodo scollegato misurerebbe zero.
 */
export async function shareLineupAsImage(
  pitch: HTMLElement,
  compose: (pitch: HTMLElement) => HTMLElement,
  filename = 'formazione-pitchman.png',
): Promise<void> {
  const target = compose(pitch);
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-10000px;top:0;pointer-events:none;z-index:-1;';
  host.appendChild(target);
  document.body.appendChild(host);

  let dataUrl: string;
  try {
    dataUrl = await toPng(target, {
      pixelRatio: 2,
      cacheBust: true,
      backgroundColor: '#000000',
    });
  } finally {
    host.remove();
  }

  // Try native share sheet (mobile) — lets the user pick WhatsApp/Telegram.
  if (typeof navigator !== 'undefined' && 'share' in navigator && navigator.canShare) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], filename, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Formazione PitchMan',
          text: 'Ecco la formazione',
        });
        return;
      }
    } catch (e) {
      // user cancelled or share failed -> fall through to download
      if ((e as Error)?.name === 'AbortError') return;
    }
  }

  // Fallback: download
  const link = document.createElement('a');
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
