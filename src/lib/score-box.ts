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
 * 2. Il COLORE del BORDO dice l'esito dal punto di vista della mia squadra:
 *    verde brand per la vittoria, giallo per il pareggio, rosso per la sconfitta.
 *    Verde neon (brand-green = #ace504), non emerald: è il verde del brand.
 *
 * 3. I NUMERI restano BIANCHI. Il colore lo porta il bordo, non il testo:
 *    numeri colorati e bordo dello stesso colore si leggono male, soprattutto
 *    il giallo su nero. Il bianco tiene su tutti e tre i fondi.
 */

export interface ScoreBoxStyle {
    /** I due numeri, gia' nell'ordine giusto per la posizione in campo. */
    pair: [number, number];
    /** Bordo + glow per il box stretto intorno ai numeri. Vuoto in variant 'card'. */
    box: string;
    /** Bordo + glow della CARD intera. Vuoto in variant 'tight'. */
    card: string;
    /** Numeri: bianchi in entrambi i temi. */
    text: string;
}

type Esito = 'V' | 'S' | 'N';

function esitoDi(isHome: boolean, home: number, away: number): Esito {
    const mio = isHome ? home : away;
    const loro = isHome ? away : home;
    return mio > loro ? 'V' : mio < loro ? 'S' : 'N';
}

export function scoreBoxStyle(opts: {
    isHome: boolean;
    home: number;
    away: number;
    /** 'tight' = box stretto; 'card' = il colore va sul bordo della scheda intera. */
    variant?: 'tight' | 'card';
}): ScoreBoxStyle {
    const { isHome, home, away, variant = 'tight' } = opts;

    // home/away sono le posizioni fisiche; la mia squadra e' dalla parte di casa
    // solo se isHome. Da li' l'ordine di lettura.
    const pair: [number, number] = isHome ? [home, away] : [away, home];

    const c = (() => {
        switch (esitoDi(isHome, home, away)) {
            case 'V': return {
                bordo: 'border-brand-green',
                // Classi SCRITTE PER INTERO, non costruite a runtime.
                // Tailwind scansiona i sorgenti per pattern letterali: una
                // classe assemblata per interpolazione (`dark:shadow-${x}`)
                // non esiste nel CSS generato, e il bagliore sparisce senza
                // nessun errore. Per questo la stringa completa e' qui.
                bagliore: 'dark:shadow-[0_0_12px_rgba(172,229,4,0.45)]',
            };
            case 'S': return {
                bordo: 'border-rose-500',
                bagliore: 'dark:shadow-[0_0_12px_rgba(244,63,94,0.45)]',
            };
            default: return {
                bordo: 'border-amber-400',
                bagliore: 'dark:shadow-[0_0_12px_rgba(251,191,36,0.45)]',
            };
        }
    })();

    if (variant === 'card') {
        return {
            pair,
            card: `${c.bordo} ${c.bagliore}`,
            box: '',
            text: 'text-white dark:text-white',
        };
    }

    return {
        pair,
        box: `${c.bordo} ${c.bagliore}`,
        card: '',
        text: 'text-white dark:text-white',
    };
}
