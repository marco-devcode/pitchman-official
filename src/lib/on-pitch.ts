/**
 * Gol fatti e subiti mentre un giocatore era in campo.
 *
 * Questo calcolo stava in due copie quasi identiche — nella scheda giocatore
 * (`src/app/membri/[id]/page.tsx`) e nel confronto
 * (`src/app/membri/confronto/page.tsx`) — che avevano gia' divergito:
 *
 * - la copia del confronto ordinava gli eventi con `a.minute - b.minute`,
 *   che fa `NaN` (non "crasha", peggio: ordina in modo arbitrario) quando un
 *   evento ha `minute: null`;
 * - e impostava `exitMin = subOut.minute` senza fallback, quindi con un minuto
 *   nullo la fine presenza diventava `null` e il confronto `e.minute <= exitMin`
 *   era sempre falso: i gol subiti nel recupero non venivano contati.
 *
 * Due definizioni che divergono in silenzio sono la stessa classe di difetto di
 * `hasPlayed`, che aveva fatto registrare presenze ai giocatori rimasti in
 * panchina. Qui la divergenza non si vedeva, ma era lo stesso meccanismo.
 */

import type { MatchEvent } from '@/lib/types';

export type OnPitchGoals = {
  /** Gol della propria squadra mentre il giocatore era in campo. */
  goalsScoredOnPitch: number;
  /** Gol subiti dalla squadra avversaria mentre era in campo. */
  goalsConcededOnPitch: number;
  /** Subiti in QUESTA partita: serve al clean sheet del portiere. */
  matchGoalsConcededCount: number;
  enterMin: number;
  exitMin: number;
};

/**
 * @param events       eventi della partita, gia' filtrati per squadra
 * @param playerId     il giocatore di cui contare i gol in campo
 * @param isHome       se la nostra squadra in questa partita e' in casa
 * @param isStarter    se il giocatore ha iniziato titolare
 * @param statMinutes  minuti giocati registrati nella partita
 * @param duration     durata della partita, per il fallback di fine presenza
 */
export function computeOnPitchGoals(
  events: MatchEvent[],
  playerId: string,
  isHome: boolean,
  isStarter: boolean,
  statMinutes: number | undefined,
  duration: number | undefined,
): OnPitchGoals {
  const end = duration || 90;
  const myTeam = isHome ? 'home' : 'away';
  const oppTeam = isHome ? 'away' : 'home';

  // `minute` puo' essere null (evento senza minuto): metterlo a 0 lo mette in
  // testa all'elenco ordinato, il che e' il comportamento di prima, ma senza
  // far saltare il confronto.
  const chrono = [...events].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

  let enterMin = 0;
  let exitMin = end;

  // Un subentrato entra quando entra: il suo primo evento di sostituzione.
  // Senza evento, 0 non sarebbe la sua entrata — ma con `statMinutes` a zero
  // non e' nemmeno entrato, quindi resta fuori.
  if (!isStarter && statMinutes && statMinutes > 0) {
    const subIn = chrono.find((e) => e.type === 'substitution' && e.playerId === playerId);
    enterMin = subIn?.minute ?? 0;
  }
  const subOut = chrono.find((e) => e.type === 'substitution' && e.subOutPlayerId === playerId);
  // Il fallback al valore precedente e' la correzione del difetto: `?? end`, non
  // un'assegnazione diretta che puo' valere null.
  if (subOut) exitMin = subOut.minute ?? end;

  let goalsScoredOnPitch = 0;
  let goalsConcededOnPitch = 0;
  let matchGoalsConcededCount = 0;

  for (const e of chrono) {
    if (e.minute === null) continue;
    if (e.minute < enterMin || e.minute > exitMin) continue;

    if (e.type === 'goal') {
      if (e.team === myTeam) goalsScoredOnPitch++;
      if (e.team === oppTeam) {
        goalsConcededOnPitch++;
        matchGoalsConcededCount++;
      }
    } else if (e.type === 'own_goal') {
      // Autogol: della mia squadra e' gol subito, dell'avversario e' gol fatto.
      if (e.team === myTeam) {
        goalsConcededOnPitch++;
        matchGoalsConcededCount++;
      }
      if (e.team === oppTeam) goalsScoredOnPitch++;
    }
  }

  return { goalsScoredOnPitch, goalsConcededOnPitch, matchGoalsConcededCount, enterMin, exitMin };
}