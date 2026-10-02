/**
 * Minuti giocati da un giocatore.
 *
 * ── I supplementari NON sono sempre presenti ───────────────────────────────────
 * I tempi supplementari (1TS/2TS) esistono solo se attivati, e si attivano
 * solo nelle partite di TORNEO. Una partita di campionato o amichevole non ha
 * tempi supplementari: la sua fine partita e' la durata regolamentare.
 *
 *   `stoppagePeriodsActive(match)` e' l'unico punto che decide.
 *
 * ── La timeline quando sono attivi ────────────────────────────────────────────
 * Ogni blocco supplementare dura 15 minuti e si SOMMA in coda ai due tempi
 * regolamentari, nell'ordine in cui si giocano:
 *
 *   1T   0 .............. meta'          (= durata / 2)
 *   2T   meta' ........... durata
 *   1TS  durata ......... durata + 15
 *   2TS  durata + 15 .... durata + 30
 *
 * Su una partita da 80': 1T 0-40, 2T 40-80, 1TS 80-95, 2TS 95-110, fine 110'.
 *
 * Sono IN CODA, non alternati: se il 2T partisse a meta'+15, il 3' del 1TS
 * cadrebbe assolutamente sul 43' — lo stesso minuto del 3' del 2T — e non si
 * saprebbe quale dei due eventi sia avvenuto prima.
 *
 * ── Il minuto dentro il blocco ─────────────────────────────────────────────────
 * In 1TS/2TS il minuto e' RELATIVO al blocco: il 3' del 1TS di una partita da
 * 80' e' il minuto assoluto 83.
 *
 * ── Perche' non esiste piu' il "minuto forzato a 1" ────────────────────────────
 * Era una regola pensata per quando il recupero non contava: un ingresso al
 * fischio valeva 1' e quel minuto si toglieva all'uscente, perche' 0 minuti
 * avrebbe fatto sparire il sub dalle presenze. Ora i TS sono tempo giocato,
 * quindi un ingresso nel supplementare vale tutto quello che resta.
 *
 * ── Una sola funzione, non percorso ───────────────────────────────────────────
 * Il calcolo precedente stava inline in `syncAndPersistMinutes` e si reggeva
 * su `endOfMatch = durata + recupero`: bastava toccare quel valore per far
 * rientrare (o uscire) il recupero dal minutaggio senza che nessun test lo
 * notasse. Qui c'e' un solo posto in cui la timeline e' scritta.
 */

import type { MatchEvent, MatchType } from '@/lib/types';
import type { StoppageByPeriod } from '@/lib/stoppage-time';

/** Periodo di un evento. `1TS`/`2TS` sono i tempi supplementari. */
export type Period = '1T' | '2T' | '1TS' | '2TS';

/** Durata di ogni blocco supplementare, in minuti. */
export const STOPPAGE_BLOCK = 15;

/** Tipo di partita in cui i tempi supplementari esistono. */
export const STOPPAGE_MATCH_TYPE: MatchType = 'Torneo';

/** Il minimo necessario per decidere se i supplementari sono attivi. */
export interface StoppageMatchLike {
    type: MatchType;
    addedTime?: StoppageByPeriod;
}

/**
 * I tempi supplementari sono attivi?
 *
 * Tre condizioni, tutte necessarie:
 *   1. la partita e' di torneo (in campionato e amichevole non esistono);
 *   2. la partita ha almeno un supplementare dichiarato in `addedTime`;
 *   3. il valore dichiarato e' un numero positivo.
 *
 * La dichiarazione e' l'attivazione: si dichiara il 1TS/2TS quando la partita
 * li ha, e allora contano 15 minuti ciascuno. Quanto e' stato dichiarato non
 * cambia la durata del blocco, che e' fissa: dichiarare 3 o 30 non cambia la
 * fine partita, evita che il minutaggio dipenda da un dato inserito a mano.
 */
export function stoppagePeriodsActive(match: StoppageMatchLike | null | undefined): boolean {
    if (!match || match.type !== STOPPAGE_MATCH_TYPE) return false;
    const added = match.addedTime;
    if (!added) return false;
    return isPositive(added['1TS']) || isPositive(added['2TS']);
}

function isPositive(v: unknown): boolean {
    return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

export interface SubstitutionLike {
    period: Period;
    minute: number | null;
}

export interface PlayerMinutesInput {
    /** Durata REGOLAMENTARE della partita (80 = due tempi da 40). */
    duration: number;
    /** I tempi supplementari sono attivi per questa partita? */
    stoppageActive: boolean;
    isStarter: boolean;
    /** events: SOLO quelli della squadra gestita da PitchMan, in ordine cronologico. */
    events: Pick<MatchEvent, 'type' | 'period' | 'minute' | 'playerId' | 'subOutPlayerId'>[];
    playerId: string;
}

/** Meta' della partita: fine del primo tempo regolamentare. */
export function halfTimeOf(duration: number): number {
    return Math.floor(duration / 2);
}

/**
 * Minuto ASSOLUTO di fine partita.
 *
 * Supplementari attivi: durata + 15 + 15. Non attivi: solo la durata
 * regolamentare, perche' quei minuti non si sono giocati.
 */
export function matchEndAbsolute(duration: number, stoppageActive: boolean): number {
    return stoppageActive ? duration + STOPPAGE_BLOCK * 2 : duration;
}

/** Inizio (assoluto) di un periodo, in minuti. */
export function periodStart(period: Period, duration: number, stoppageActive = true): number {
    switch (period) {
        case '1T': return 0;
        case '2T': return halfTimeOf(duration);
        case '1TS': return stoppageActive ? duration : duration;
        case '2TS': return stoppageActive ? duration + STOPPAGE_BLOCK : duration;
    }
}

/** Fine (assoluta) di un periodo. */
export function periodEnd(period: Period, duration: number, stoppageActive = true): number {
    switch (period) {
        case '1T': return halfTimeOf(duration);
        case '2T': return duration;
        // Senza supplementari i due blocchi collassano sulla fine regolamentare:
        // un evento fuori tempo non puo' valere piu' della partita.
        case '1TS': return stoppageActive ? duration + STOPPAGE_BLOCK : duration;
        case '2TS': return stoppageActive ? duration + STOPPAGE_BLOCK * 2 : duration;
    }
}

/**
 * Minuto ASSOLUTO di un evento sulla timeline.
 *
 * In 1TS/2TS il minuto e' relativo al blocco, e il blocco parte dove finisce
 * il periodo precedente.
 */
export function getAbsoluteMinute(
    event: SubstitutionLike,
    duration: number,
    stoppageActive = true,
): number {
    const minute = Math.max(0, event.minute ?? 0);
    return Math.min(
        periodStart(event.period, duration, stoppageActive) + minute,
        periodEnd(event.period, duration, stoppageActive),
    );
}

/**
 * Minuti giocati da un giocatore in una partita.
 *
 * Titolare: esce all'evento di sostituzione, o gioca fino alla fine.
 * Subentrato: entra all'evento che lo introduce, esce al successivo che lo
 * riguarda, o gioca fino alla fine.
 * Chi non entra mai: 0 — e NON e' una presenza (vedi player-usage.ts).
 */
export function computeMinutesPlayed(input: PlayerMinutesInput): number {
    const { duration, stoppageActive, isStarter, events, playerId } = input;
    const matchEnd = matchEndAbsolute(duration, stoppageActive);

    if (!isStarter) {
        const subIn = events.find((e) => e.type === 'substitution' && e.playerId === playerId);
        if (!subIn) return 0;

        const enterMin = getAbsoluteMinute(subIn, duration, stoppageActive);
        // "Esce dopo che e' entrato" va letto sull'ORDINE CRONOLOGICO degli
        // eventi, non sui minuti assoluti: un giocatore puo' essere sostituito,
        // rientrare e uscire di nuovo, e il confronto sui minuti non
        // distinguerebbe i due stinti.
        const enterIdx = events.indexOf(subIn);
        const subOutLater = events.find(
            (e, idx) =>
                e.type === 'substitution' &&
                e.subOutPlayerId === playerId &&
                idx > enterIdx,
        );
        const endMin = subOutLater
            ? getAbsoluteMinute(subOutLater, duration, stoppageActive)
            : matchEnd;
        return Math.max(0, endMin - enterMin);
    }

    const subOutEvent = events.find(
        (e) => e.type === 'substitution' && e.subOutPlayerId === playerId,
    );
    return subOutEvent
        ? Math.max(0, getAbsoluteMinute(subOutEvent, duration, stoppageActive))
        : matchEnd;
}