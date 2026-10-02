/**
 * Uso di un giocatore in UNA partita: titolare / subentrato / rimasto in
 * panchina / non convocato.
 *
 * Vive in un file solo perche' la definizione di "presenza" e' stata
 * reimplementata in quattro aggregatori con nomi diversi, e due erano
 * sbagliati nello stesso modo. `hasPlayed` non puo' guardare "e' nella lista
 * dei subentranti": un sub che non entra MAI e' uno che e' rimasto in
 * panchina, e contarlo come presenza e' falso.
 *
 * La presenza si deriva dall'ingresso in campo, non dai minuti:
 *   - titolare              -> presente (scende in campo al minute 0)
 *   - subentrato            -> presente, anche con 0 minuti (ultimo minuto di
 *                              recupero: ha comunque calpestato il campo)
 *   - in panchina, mai entrato -> NON presente
 *   - non in lineup         -> non convocato
 *
 * I minuti non bastano da soli: l'ultimo aggregatore li usava come unico
 * segnale e un subentrato nell'ultimo recupero spariva dalle presenze.
 */

import type { MatchLineup, MatchEvent, PlayerMatchStats } from '@/lib/types';

export type MatchDetailsLike = {
    events: MatchEvent[];
    lineup?: MatchLineup;
    stats: PlayerMatchStats[];
};

export interface MatchUsage {
    /** Nella formazione titolare */
    isStarter: boolean;
    /** In lista panchina (anche se poi non entra) */
    isOnBench: boolean;
    /** Risulta da una sostituzione in suo favore: questo e' il segnale forte */
    cameOn: boolean;
    /** Presenza reale: titolare o entrato */
    appeared: boolean;
    minutesPlayed: number;
}

/** lineup.starters contiene `string | StarterPlayer`: normalizza. */
function inList(list: (string | { playerId: string })[] | undefined, playerId: string): boolean {
    if (!list) return false;
    return list.some((entry) => (typeof entry === 'string' ? entry : entry.playerId) === playerId);
}

export function getMatchUsage(
    details: MatchDetailsLike | undefined,
    playerId: string,
    /** true = la squadra gestita da PitchMan e' quella di casa */
    isHome: boolean,
): MatchUsage {
    const empty: MatchUsage = {
        isStarter: false,
        isOnBench: false,
        cameOn: false,
        appeared: false,
        minutesPlayed: 0,
    };
    if (!details) return empty;

    const isStarter = inList(details.lineup?.starters, playerId);
    const isOnBench = inList(details.lineup?.substitutes, playerId);

    // Solo gli eventi della nostra squadra: una sostituzione avversaria con lo
    // stesso playerId (o una dalla squadra sbagliata) non e' un ingresso.
    const ourTeam = isHome ? 'home' : 'away';
    const cameOn = details.events.some(
        (e) => e.type === 'substitution' && e.team === ourTeam && e.playerId === playerId,
    );

    const stats = details.stats.find((s) => s.playerId === playerId);
    const minutesPlayed = stats?.minutesPlayed ?? 0;

    // Un documento stats con 0 minuti puo' comunque essere la prova di un
    // ingresso (gol/assist/ammonizione nel recupero): quindi non usare
    // "minuti > 0" come unico segnale, e sufficiente usare l'ingresso.
    const appeared = isStarter || cameOn;

    return { isStarter, isOnBench, cameOn, appeared, minutesPlayed };
}

export interface PlayerUsageCounts {
    /** Presenze = titolari + subentrati. Chi resta in panchina non conta. */
    appearances: number;
    starts: number;
    /** Subentrati: presenze avvenute dalla panchina. */
    subAppearances: number;
    /** In panchina senza mai entrare. */
    bench: number;
    /** Completate senza essere nella lineup. */
    notConvoked: number;
}

export const emptyUsageCounts = (): PlayerUsageCounts => ({
    appearances: 0,
    starts: 0,
    subAppearances: 0,
    bench: 0,
    notConvoked: 0,
});