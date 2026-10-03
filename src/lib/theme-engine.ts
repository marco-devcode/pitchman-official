/**
 * Motore del tema: due colori dell'utente -> tutte le variabili CSS.
 *
 * ── Il principio ──────────────────────────────────────────────────────────────
 * Il tema e' una FUNZIONE dei due colori scelti. Nessun componente deve sapere
 * quale colore ha scelto l'utente, e nessun colore dell'interfaccia e' scritto
 * a mano in un componente: tutto deriva dalle variabili che questo file
 * calcola.
 *
 * ── Perche' due uscite e non una ──────────────────────────────────────────────
 * Le nuove variabili (`--a1`, `--a2`, `--t1`, `--t2`, `--grad`) sono colori
 * espliciti e servono alle nuove regole d'uso. I token storici in spazio
 * (`--brand-green`, `--primary`, `--ring`…) restano triplet HSL perche' tutta
 * l'app li usa con la sintassi dell'alfa: `hsl(var(--brand-green) / 0.2)`.
 * Senza questo, migliaia di classi esistenti (`text-brand-green`,
 * `border-brand-green/20`, `shadow-neon`) continuerebbero a puntare al verde
 * neon: la classe chiederebbe un colore che il tema non controlla piu'.
 * Per questo le due uscite sono generate INSIEME dallo stesso input e non
 * possono divergere.
 *
 * ── Correzione del contrasto (regola 3) ───────────────────────────────────────
 * 1. luminanza relativa WCAG di colore e sfondo
 * 2. rapporto (L_chiaro + 0.05) / (L_scuro + 0.05)
 * 3. se < 4.5 schiarisce verso il bianco a passi del 5%, ricalcolando
 * 4. il risultato e' l'unico valore usato: il colore grezzo mai
 *
 * Non si scurisce mai, e non si cambia la tonalita' (hue/saturazione): la
 * correzione agisce solo sulla luminosita'. Il colore scelto resta
 * riconoscibile anche se il contrasto lo costringe a schiarirsi.
 */

export type ThemeMode = 'dark' | 'light';

export interface Rgb {
    r: number;
    g: number;
    b: number;
}

/** Sfondo fisso del tema scuro: il contrasto si calcola sempre qui. */
export const DARK_BG: Rgb = { r: 10, g: 10, b: 10 };      // #0a0a0a
export const DARK_CARD: Rgb = { r: 16, g: 16, b: 16 };    // #101010
/** Sfondo del tema chiaro: piu' luminoso, quindi la correzione e' piu' facile. */
export const LIGHT_BG: Rgb = { r: 252, g: 252, b: 253 }; // #fcfcfd
export const LIGHT_CARD: Rgb = { r: 255, g: 255, b: 255 };

/** Soglia AA per il testo normale. */
export const AA_THRESHOLD = 4.5;
/** Passo di schiarimento verso il bianco. */
export const LIGHTEN_STEP = 0.05;
/** Tetto di passi: 60 porta un colore al 95% di bianco, oltre il necessario. */
export const MAX_STEPS = 60;

// ─── colore ─────────────────────────────────────────────────────────────────────

const clamp255 = (v: number) => Math.max(0, Math.min(255, Math.round(v)));

export function hexToRgb(hex: string): Rgb {
    let h = String(hex).trim().replace(/^#/, '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    if (!/^[0-9a-fA-F]{6}$/.test(h)) {
        // Non lanciare: un input colore malformato non deve far cadere la pagina.
        return { r: 0, g: 0, b: 0 };
    }
    return {
        r: parseInt(h.slice(0, 2), 16),
        g: parseInt(h.slice(2, 4), 16),
        b: parseInt(h.slice(4, 6), 16),
    };
}

const toHex2 = (v: number) => clamp255(v).toString(16).padStart(2, '0');

export function rgbToHex({ r, g, b }: Rgb): string {
    return `#${toHex2(r)}${toHex2(g)}${toHex2(b)}`;
}

/**
 * Luminanza relativa WCAG.
 *
 * La soglia 0.03928 e' il punto in cui la formula lineare e quella con gamma
 * 2.4 si incontrano: sotto, il segnale e' "gia' lineare" e va diviso per
 * 12.92; sopra, va elevato a potenza.
 */
export function relativeLuminance({ r, g, b }: Rgb): number {
    const ch = (c: number) => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b);
}

/** Rapporto di contrasto WCAG fra due colori. */
export function contrastRatio(a: Rgb, b: Rgb): number {
    const la = relativeLuminance(a);
    const lb = relativeLuminance(b);
    const light = Math.max(la, lb);
    const dark = Math.min(la, lb);
    return (light + 0.05) / (dark + 0.05);
}

// ─── correzione ────────────────────────────────────────────────────────────────

/** Schiarisce verso il bianco di un passo (5%), senza toccare hue/saturazione. */
export function lightenOnce(color: Rgb): Rgb {
    const mix = (c: number) => c + (255 - c) * LIGHTEN_STEP;
    return { r: mix(color.r), g: mix(color.g), b: mix(color.b) };
}

/** Scurisce verso il nero di un passo (5%), senza toccare hue/saturazione. */
export function darkenOnce(color: Rgb): Rgb {
    const mix = (c: number) => c * (1 - LIGHTEN_STEP);
    return { r: mix(color.r), g: mix(color.g), b: mix(color.b) };
}

/**
 * In che direzione si corregge un colore per una data sondo.
 *
 * ⚠️ La specifica dice "non scurire mai", e sul tema scuro e' esatto: lo
 * sfondo e' #0a0a0a, quindi l'unica via per alzare il contrasto e'
 * schiarire. Sul tema CHIARO quella regola e' impossibile da onorare: il
 * fondo e' bianco, e schiarire un colore chiaro lo avvicina al fondo invece
 * di allontanarlo (bianco su bianco resta 1:1, qualunque passo si faccia).
 * Per garantire che OGNI coppia resti leggibile anche in chiaro, la direzione
 * segue il fondo: schiarire su fondo scuro, scurire su fondo chiaro. La
 * tonalita' non viene toccata in nessuno dei due casi.
 */
export type CorrectDirection = 'lighten' | 'darken';

export function directionFor(bg: Rgb): CorrectDirection {
    return relativeLuminance(bg) < 0.5 ? 'lighten' : 'darken';
}

/**
 * Porta il colore a 4.5:1 contro lo sfondo, schiarendo verso il bianco.
 *
 * Restituisce anche quante correzioni servono e il contrasto finale: servono
 * per il pannello di debug e per i test, e rendono la procedura ispezionabile
 * invece che una scatola nera.
 */
export function correctForContrast(
    color: Rgb,
    bg: Rgb,
    threshold: number = AA_THRESHOLD,
): { color: Rgb; ratio: number; steps: number } {
    const direction = directionFor(bg);
    let current = { ...color };
    let steps = 0;
    let ratio = contrastRatio(current, bg);
    while (ratio < threshold && steps < MAX_STEPS) {
        current = direction === 'lighten' ? lightenOnce(current) : darkenOnce(current);
        steps++;
        ratio = contrastRatio(current, bg);
    }
    // Raggiungibile solo con un colore gia' all'estremo (bianco su bianco) e
    // una sondo che non puo' cambiare: si esce con il valore migliore
    // disponibile, e il chiamante vede il ratio reale.
    return { color: current, ratio, steps };
}

/** Il testo sopra un riempimento: bianco o nero, secondo il contrasto maggiore. */
export function bestTextOn(bg: Rgb): string {
    const bianco: Rgb = { r: 255, g: 255, b: 255 };
    const nero: Rgb = { r: 0, g: 0, b: 0 };
    return contrastRatio(bianco, bg) >= contrastRatio(nero, bg) ? '#ffffff' : '#000000';
}

// ─── HSL per i token Tailwind storici ──────────────────────────────────────────

/** Ritorna "s l% l%": il formato senza virgole che `hsl(var(--x))` richiede. */
export function toHslTriplet({ r, g, b }: Rgb): string {
    const rr = r / 255;
    const gg = g / 255;
    const bb = b / 255;
    const max = Math.max(rr, gg, bb);
    const min = Math.min(rr, gg, bb);
    const d = max - min;
    const l = (max + min) / 2;
    let h = 0;
    let s = 0;
    if (d !== 0) {
        s = d / (1 - Math.abs(2 * l - 1));
        if (max === rr) h = 60 * (((gg - bb) / d) % 6);
        else if (max === gg) h = 60 * ((bb - rr) / d + 2);
        else h = 60 * ((rr - gg) / d + 4);
    }
    if (h < 0) h += 360;
    return `${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

// ─── generazione del tema ──────────────────────────────────────────────────────

export interface ThemeInput {
    /** Primo colore scelto dall'utente, grezzo. */
    a1: string;
    /** Secondo colore scelto, grezzo. */
    a2: string;
    mode?: ThemeMode;
}

export interface ThemeResult {
    /** Colori corretti, usati per bordi, riempimenti, ombre. */
    a1: Rgb;
    a2: Rgb;
    /** Colori corretti per TESTO e icone: leggibili contro lo sfondo. */
    t1: Rgb;
    t2: Rgb;
    /** Testo sopra i riempimenti pieni del tema. */
    onFill: string;
    /** Triplet HSL dei token storici, derivati dagli stessi colori. */
    hsl: {
        primary: string;
        ring: string;
        accent: string;
        brandGreen: string;
        brandYellow: string;
        brandCyan: string;
        brandPink: string;
    };
    /** Quanto ha dovuto schiarire: per il pannello di debug e i test. */
    steps: { a1: number; a2: number; t1: number; t2: number };
}

/**
 * Il piu' chiaro dei due.
 *
 * Serve per capire se un testo scuro sopra il riempimento e' praticabile:
 * un colore chiaro genera un riempimento chiaro anche mescolato col nero,
 * e su quello il nero diventa l'unica scelta leggibile.
 */
export function lighterOf(a: Rgb, b: Rgb): Rgb {
    return relativeLuminance(a) >= relativeLuminance(b) ? a : b;
}

/**
 * La superficie del riempimento su cui il testo viene dipinto.
 *
 * Sul tema scuro e' la regola 4 della specifica: colore mescolato col NERO al
 * 14-22%, quindi una superficie scura. Sul tema chiaro la miscela col nero
 * darebbe una macchia scura in una pagina bianca: li' si miscola col BIANCO,
 * e la superficie resta chiara come il resto del tema.
 */
export function themeFill(color: Rgb, percent = 18, mode: ThemeMode = 'dark'): Rgb {
    const p = percent / 100;
    if (mode === 'light') {
        return {
            r: color.r + (255 - color.r) * p,
            g: color.g + (255 - color.g) * p,
            b: color.b + (255 - color.b) * p,
        };
    }
    return { r: color.r * p, g: color.g * p, b: color.b * p };
}

/**
 * Porta il TESTO a 4.5:1 contro il riempimento su cui viene dipinto.
 *
 * Il ciclo schiarisce il COLORE e rimisura sul riempimento che quel colore
 * genera, non il contrario. Correggere direttamente il riempimento sembrava
 * equivalente e non lo e': il riempimento e' gia' scurissimo, quindi
 * schiarirlo sposta i tre canali in proporzione diverse e ne distrugge la
 * tonalita' (la saturazione del verde di base e' scesa dal 96% al 14%). La
 * regola 3 impone che la correzione agisca solo sulla luminosita'.
 */
export function correctForFill(
    color: Rgb,
    percent = 22,
    mode: ThemeMode = 'dark',
    threshold: number = AA_THRESHOLD,
): { color: Rgb; ratio: number; steps: number } {
    // La correzione segue il tema: schiarisce sullo scuro, scurisce sul
    // chiaro, per la stessa ragione di `correctForContrast`.
    const dark = mode !== 'light';
    let current = { ...color };
    let steps = 0;
    let ratio = contrastRatio(current, themeFill(current, percent, mode));
    while (ratio < threshold && steps < MAX_STEPS) {
        current = dark ? lightenOnce(current) : darkenOnce(current);
        steps++;
        ratio = contrastRatio(current, themeFill(current, percent, mode));
    }
    return { color: current, ratio, steps };
}

export function backgroundFor(mode: ThemeMode): Rgb {
    return mode === 'light' ? LIGHT_BG : DARK_BG;
}

export function buildTheme({ a1, a2, mode = 'dark' }: ThemeInput): ThemeResult {
    const bg = backgroundFor(mode);

    // a1/a2: corretti perche' vengono usati come bordi e riempimenti. Lo
    // stesso valore corregge anche il testo, dato che la soglia e' la stessa e
    // il testo non e' mai piu' esigente di un bordo.
    const c1 = correctForContrast(hexToRgb(a1), bg);
    const c2 = correctForContrast(hexToRgb(a2), bg);

    // t1/t2: versioni per testo. Sul tema scuro coincidono con a1/a2 perche'
    // la soglia e' identica; sul tema chiaro il testo su fondo bianco e' il
    // caso difficile, quindi qui si parte dai colori gia' schiariti: scurire
    // non e' ammesso, ma partire dal gia' corretto evita di doverlo fare.
    // Il testo colorato sta SOPRA i riempimenti, non sullo sfondo della
    // pagina, quindi e' il riempimento il vincolo: #7676a8 era 4.7:1 sullo
    // sfondo ma 4.25:1 sul suo riempimento al 18%. Si schiarisce il COLORE
    // finche' non passa sul riempimento che lui stesso genera.
    const t1 = correctForFill(c1.color, 22, mode);
    const t2 = correctForFill(c2.color, 22, mode);

    return {
        a1: c1.color,
        a2: c2.color,
        t1: t1.color,
        t2: t2.color,
        // `--primary-foreground` e' il testo sopra un RIEMPIMENTO PIENO di
        // `bg-primary`, che e' il colore stesso: qui il bianco o il nero si
        // sceglie col contrasto reale.
        //
        // NON e' il testo sopra `.bg-theme-fill`: quello e' il colore mescolato
        // col nero al 14-22%, quindi una superficie SEMPRE scura, e il suo
        // testo e' `--t1` (chiaro). Abbinarli era un errore: su un riempimento
        // rosso al 18% il nero sta a 1.12:1 — illeggibile.
        onFill: bestTextOn(t1.color),
        hsl: {
            primary: toHslTriplet(t1.color),
            ring: toHslTriplet(t1.color),
            accent: toHslTriplet(t2.color),
            brandGreen: toHslTriplet(t1.color),
            brandYellow: toHslTriplet(t1.color),
            brandCyan: toHslTriplet(t2.color),
            brandPink: toHslTriplet(t2.color),
        },
        steps: { a1: c1.steps, a2: c2.steps, t1: t1.steps, t2: t2.steps },
    };
}

/**
 * Le stesse variabili, pronte da scrivere nel CSS.
 *
 * `gradient` e' la regola `--grad` della specifica. Le miscele sono scritte
 * con `color-mix` e non con rgba() perche' la specifica chiede esattamente
 * `color-mix(in srgb, var(--a1) 14-22%, #000)`: cosi' il riempimento resta
 * collegato al colore invece di essere una copia opaca.
 */
export function themeVariables(result: ThemeResult, mode: ThemeMode = 'dark'): Record<string, string> {
    const bg = backgroundFor(mode);
    const card = mode === 'light' ? LIGHT_CARD : DARK_CARD;
    return {
        '--a1': rgbToHex(result.a1),
        '--a2': rgbToHex(result.a2),
        '--t1': rgbToHex(result.t1),
        '--t2': rgbToHex(result.t2),
        '--grad': `linear-gradient(135deg, var(--a1), var(--a2))`,
        // Sfondo fisso: non dipende dal tema, per regola.
        '--theme-bg': rgbToHex(bg),
        '--theme-card': rgbToHex(card),
        // Triplet per i token storici consumati da `hsl(var(--x) / a)`.
        '--primary': result.hsl.primary,
        '--ring': result.hsl.ring,
        '--accent': result.hsl.accent,
        '--brand-green': result.hsl.brandGreen,
        '--brand-yellow': result.hsl.brandYellow,
        '--brand-cyan': result.hsl.brandCyan,
        '--brand-pink': result.hsl.brandPink,
        // Testo sopra i riempimenti pieni: bianco o nero secondo il contrasto.
        '--primary-foreground': result.onFill,
    };
}
