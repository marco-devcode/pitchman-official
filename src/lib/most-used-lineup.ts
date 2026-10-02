/**
 * Formazione tipo: il modulo piu' usato nella stagione e, per ogni slot, il
 * giocatore piu' presente.
 *
 * Estratto dal componente in una funzione pura perche' il calcolo sia
 * verificabile fuori dalla UI: la regola "un giocatore una volta sola" e'
 * quella che si rompe silenziosamente (restituisce undici slot senza errori,
 * solo con lo stesso nome due volte e un indolo vuoto).
 */

import type { Match, MatchLineup } from '@/lib/types';

export interface MostUsedLineup {
    formation: string;
    /** 11 slot, stesso ordine di lineup.starters */
    starters: { playerId: string; name: string }[];
    /** Quante partite hanno usato quel modulo */
    apps: number;
}

export function computeMostUsedLineup(
    completedMatches: Match[],
    lineupOf: (match: Match) => MatchLineup | undefined,
    nameOf: (playerId: string) => string | undefined,
    fallbackFormation = '4-4-2',
): MostUsedLineup | null {
    // 1. Modulo piu' usato
    const formationCounts: Record<string, number> = {};
    for (const m of completedMatches) {
        const formation = lineupOf(m)?.formation;
        if (formation) formationCounts[formation] = (formationCounts[formation] || 0) + 1;
    }
    if (!Object.keys(formationCounts).length) return null;

    const mostUsedFormation =
        Object.entries(formationCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || fallbackFormation;
    const formationApps = formationCounts[mostUsedFormation] || 0;

    // 2. Presenze per slot
    const positionPlayerCounts: Record<number, Record<string, number>> = {};
    for (let i = 0; i <= 10; i++) positionPlayerCounts[i] = {};

    for (const m of completedMatches) {
        const lineup = lineupOf(m);
        if (!lineup || lineup.formation !== mostUsedFormation) continue;
        lineup.starters.forEach((p, idx) => {
            if (idx > 10) return;
            const pid = typeof p === 'string' ? p : p.playerId;
            if (pid) positionPlayerCounts[idx][pid] = (positionPlayerCounts[idx][pid] || 0) + 1;
        });
    }

    // 3. Assegnazione senza duplicati.
    // Il DC puo' LEGGERMENTE comparire come slot due volte (un 3-5-2 ha tre
    // centrali: e' il modulo, non un errore), ma lo stesso GIOCATORE no: se e'
    // il piu' presente in due slot diversi deve finire in uno solo e lo slot
    // successivo prende il secondo piu' presente. Prima si sceglieva slot per
    // slot indipendentemente, quindi lo stesso nome finiva due volte.
    const starters: { playerId: string; name: string }[] = [];
    const assigned = new Set<string>();
    for (let i = 0; i <= 10; i++) {
        const topPlayerId = Object.entries(positionPlayerCounts[i])
            .filter(([pid]) => !assigned.has(pid))
            .sort((a, b) => b[1] - a[1])[0]?.[0];
        if (topPlayerId) assigned.add(topPlayerId);
        starters.push({
            playerId: topPlayerId || '',
            name: topPlayerId ? nameOf(topPlayerId) || '---' : '---',
        });
    }

    return { formation: mostUsedFormation, starters, apps: formationApps };
}