/**
 * Minuti EFFETTIVI giocati da un giocatore.
 *
 * ── Il modello ────────────────────────────────────────────────────────────────
 * I minuti di recupero NON contano nel minutaggio dei giocatori.
 *   Partita da 80' con 5' di recupero: chi sta in campo fino alla fine ha
 *   giocato 80', non 85'.
 *
 * Chi entra nel recupero vale 1 minuto per default, e quei 2 minuti vengono
 * presi al giocatore che esce:
 *   - sub nel 2TS (recupero del secondo tempo), partita da 80':
 *       entrante  = 1'   (80 - 79)
 *       uscente   = 79'  (ha perso l'ultimo minuto)
 *   - sub nel 1TS (recupero del primo tempo), partita da 80':
 *       entrante  = 41'  (1' + i 40 minuti che gli restano da giocare)
 *       uscente   = 39'
 *
 * Perche' "1 minuto": il minuto di recupero e' un minuto che nella partita
 * "regolare" non esiste, ma il subentrato ha comunque toccato il campo e
 * l'uscente ha comunque perso tempo. Senza questo, un subentrato nell'ultimo
 * istante avrebbe 0 minuti e sparisca dalle presenze, e un titolare
 * schiacciato avrebbe un minuto in piu' senza motivo.
 *
 * ── Una sola funzione, non percorso ──────────────────────────────────────────
 * Il precedente calcolo usava `getAbsoluteMinute`, che mappava il recupero su
 * minuti assoluti e poi sottraeva due numeri assoluti: funzionava, ma si
 * reggeva su `endOfMatch = durata + recupero`. Bastava toccare quel valore per
 * far rientrare il recupero nel minutaggio, senza che nessun test lo
 * notasse. Qui il recupero non entra da nessuna parte: finisce in
 * `getEffectiveMinute`, che satura al confine regolare del tempo.
 */

import type { MatchEvent } from '@/lib/types';

/** Periodo di un evento. `1TS`/`2TS` sono i recuperi. */
export type Period = '1T' | '2T' | '1TS' | '2TS';

export interface SubstitutionLike {
    period: Period;
    minute: number | null;
}

export interface PlayerMinutesInput {
    /** Durata regolare della partita (80 = due tempi da 40). Niente recupero. */
    duration: number;
    isStarter: boolean;
    /** events: SOLO quelli della squadra gestita da PitchMan. */
    events: Pick<MatchEvent, 'type' | 'period' | 'minute' | 'playerId' | 'subOutPlayerId'>[];
    playerId: string;
}

/** Meta' della partita: fine del primo tempo. */
export function halfTimeOf(duration: number): number {
    return Math.floor(duration / 2);
}

/**
 * Minuto ASSOLUTO ma REGOLARE di un evento: il recupero non sposta il clock.
 *
 * Per un evento in 1TS/2TS il minuto non e' "il minuto assoluto": e' un
 * ingresso nel recupero, che vale esattamente 1 minuto e viene tolto a chi
 * esce. Per questo l'1TS finisce all'ultimo minuto del primo tempo e il 2TS
 * all'ultimo della partita — non "dopo", che e' il modello vecchio.
 */
export function getEffectiveMinute(event: SubstitutionLike, duration: number): number {
    const halfTime = halfTimeOf(duration);
    const min = Math.max(0, event.minute ?? 0);

    switch (event.period) {
        case '1T':
            return Math.min(min, halfTime);
        case '2T':
            return halfTime + Math.min(min, halfTime);
        // Entrata nel recupero del PRIMO tempo: vale 1 minuto, preso
        // dall'ultimo minuto del primo tempo.
        case '1TS':
            return Math.max(0, halfTime - 1);
        // Entrata nel recupero del SECONDO tempo: vale 1 minuto, preso
        // dall'ultimo minuto della partita.
        case '2TS':
            return Math.max(0, duration - 1);
        default:
            return min;
    }
}

/**
 * Minuti giocati da un giocatore in una partita.
 *
 * Titolare: esce all'evento di sostituzione, o gioca fino alla fine regolare.
 * Subentrato: entra all'evento che lo introduce, esce al successivo che lo
 * riguarda, o gioca fino alla fine.
 * Chi non entra mai: 0 — e NON e' una presenza (vedi player-usage.ts).
 */
export function computeMinutesPlayed(input: PlayerMinutesInput): number {
    const { duration, isStarter, events, playerId } = input;
    if (!isStarter) {
        const subIn = events.find((e) => e.type === 'substitution' && e.playerId === playerId);
        if (!subIn) return 0;

        const enterMin = getEffectiveMinute(subIn, duration);
        // "Esce dopo che e' entrato" va letto sull'ORDINE CRONOLOGICO degli
        // eventi, non sui minuti effettivi: nel recupero tutti gli eventi
        // condividono lo stesso minuto effettivo (il confine), e un sub che
        // entra ed esce nello stesso recupero apparirebbe altrimenti uscire
        // "prima" di essere entrato — prendendosi i minuti di un altro.
        const enterIdx = events.indexOf(subIn);
        const subOutLater = events.find(
            (e, idx) =>
                e.type === 'substitution' &&
                e.subOutPlayerId === playerId &&
                idx > enterIdx,
        );
        const endMin = subOutLater ? getEffectiveMinute(subOutLater, duration) : duration;
        return Math.max(0, endMin - enterMin);
    }

    const subOutEvent = events.find(
        (e) => e.type === 'substitution' && e.subOutPlayerId === playerId,
    );
    // Fine partita REGOLARE: qui il recupero non esiste, e' il punto del modello.
    return subOutEvent ? Math.max(0, getEffectiveMinute(subOutEvent, duration)) : duration;
}