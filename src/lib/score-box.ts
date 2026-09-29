/**
 * Stile e ordine del box del punteggio.
 *
 * Due cose da decidere, e vanno decise INSIEME perche' stanno nello stesso
 * box:
 *
 * 1. L'ORDINE dei due numeri dipende da dove gioca la squadra, e la regola e'
 *    "la mia squadra e' sempre quella che leggo per prima":
 *      - in casa   -> [mia, avversario]
 *      - in trasferta -> [avversario, mia]
 *    Il documento Firestore ha sempre result.home / result.away, dove "home"
 *    e' la parte che gioca in casa, NON la mia squadra. Il codice precedente
 *    scriveva `isHome ? home : away` come numero di sinistra, cioe' metteva i
 *    miei gol a sinistra anche in trasferta: la riga sembrava una vittoria in
 *    casa quando era una sconfita in trasferta. Da qui il helper.
 *
 * 2. Il COLORE dice l'esito della partita dal punto di vista della mia squadra,
 *    non dal punteggio grezzo: verde per la vittoria, giallo per il pareggio,
 *    rosso per la sconfitta. Verde neon (brand-green), non emerald: e' il verde
 *    del brand.
 */

export interface ScoreBoxStyle {
    /** I due numeri, gia' nell'ordine giusto per la posizione in campo. */
    pair: [number, number];
    /** Classi del bordo + glow. */
    box: string;
    /** Classe del testo dei numeri. */
    text: string;
}

export function scoreBoxStyle(opts: {
    isHome: boolean;
    home: number;
    away: number;
    /** 'glow' per il box della lista, 'plain' per il riquadro 'Ultimi incontri'. */
    variant?: 'glow' | 'plain';
}): ScoreBoxStyle {
    const { isHome, home, away, variant = 'glow' } = opts;

    // home/away sono le posizioni fisiche; la mia squadra e' dalla parte di casa
    // solo se isHome. Da li' l'ordine di lettura.
    const pair: [number, number] = isHome ? [home, away] : [away, home];

    const mio = isHome ? home : away;
    const loro = isHome ? away : home;
    const esito = mio > loro ? 'V' : mio < loro ? 'S' : 'N';

    const colore = esito === 'V'
        ? {
            bordo: 'border-brand-green',
            glow: 'dark:shadow-[0_0_10px_rgba(172,229,4,0.35)]',
            testo: 'text-brand-green',
        }
        : esito === 'S'
        ? {
            bordo: 'border-rose-500',
            glow: 'dark:shadow-[0_0_10px_rgba(244,63,94,0.35)]',
            testo: 'text-rose-500',
        }
        : {
            bordo: 'border-amber-400',
            glow: 'dark:shadow-[0_0_10px_rgba(251,191,36,0.35)]',
            testo: 'text-amber-400',
        };

    // Nel tema chiaro il glow di una box-border non si vede: si usa un'ombra
    // morbida dello stesso colore, altrimenti in light mode il box sembra
    // identico a quello neutro.
    const box = variant === 'glow'
        ? `border ${colore.bordo} ${colore.glow} shadow-[0_0_8px] shadow-current/20`
        : `border ${colore.bordo} ${colore.glow}`;

    return { pair, box, text: colore.testo };
}
