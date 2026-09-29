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

    // L’ordine è quello del campo: CASA a sinistra, TRASFERTA a destra,
    // sempre. La riga dice già se la mia squadra gioca in casa o fuori, quindi
    // non serve — e non deve — invertirlo in base a isHome.
    //
    // Applicata alla lettera, la regola richiesta dice esattamente questo: in
    // casa la mia squadra sta a sinistra (home), in trasferta sta a destra
    // (away), quindi il numero di sinistra è SEMPRE home. La versione
    // precedente invertiva la riga in trasferta ([away, home]) ed è per questo
    // che una vittoria in trasferta finiva col punteggio capovolto.
    const pair: [number, number] = [home, away];

    const c = (() => {
        switch (esitoDi(isHome, home, away)) {
            case 'V': return {
                // Verde SCURO, non il neon del brand: su un bordo sottile il
                // neon e' illeggibile e sul nero non stacca dal pannello.
                bordo: 'border-brand-win-deep',
                // Le tre stringhe sono SCRITTE PER INTERO: Tailwind scansiona
                // i sorgenti per pattern letterali, quindi una classe
                // assemblata a runtime (`dark:shadow-${x}`) non entra nel CSS
                // generato e il bagliore sparisce senza alcun errore.
                //
                // hsl(var(--win-deep)/0.55) e non rgba(172,229,4,...): il tema
                // e' in variabili CSS, un rgba fisso non segue il tema e -
                // peggio - il mio verde rgba non coincideva con il verde
                // dichiarato, quindi bordo e bagliore erano due verdi diversi.
                bagliore: 'dark:shadow-[0_0_14px_hsl(var(--win-deep)/0.6)]',
            };
            case 'S': return {
                bordo: 'border-brand-loss-deep',
                bagliore: 'dark:shadow-[0_0_14px_hsl(var(--loss-deep)/0.6)]',
            };
            default: return {
                bordo: 'border-brand-draw-deep',
                bagliore: 'dark:shadow-[0_0_14px_hsl(var(--draw-deep)/0.6)]',
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
