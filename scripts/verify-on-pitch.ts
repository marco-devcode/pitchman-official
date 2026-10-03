/**
 * Verifica di `computeOnPitchGoals`.
 *
 * I due casi che sono regressioni vere, non casi limite accettati:
 *
 * 1. evento con `minute: null`. La copia che era in `membri/confronto`
 *    ordinava con `a.minute - b.minute`: `null` diventa 0 in un sort di
 *    numeri, quindi il risultato non era un crash ma un ORDINAMENTO SBAGLIATO
 *    e silenzioso. Nessun errore, numeri fuori posto.
 *
 * 2. sostituzione fuori con `minute: null`. Quella copia faceva
 *    `exitMin = subOut.minute` senza fallback: `exitMin` diventava `null`, e
 *    `e.minute <= null` e' sempre falso, quindi i gol subiti DOPO l'uscita
 *    venivano contati come subiti in campo. Il portiere risultava con clean
 *    sheet su partite perse.
 */
import { computeOnPitchGoals } from '../src/lib/on-pitch';
import type { MatchEvent } from '../src/lib/types';

let falliti = 0;
let totale = 0;

function check(nome: string, condizione: boolean, dettaglio = '') {
  totale++;
  if (!condizione) {
    falliti++;
    console.log(`FAIL  ${nome}${dettaglio ? ' — ' + dettaglio : ''}`);
  }
}

const ev = (over: Partial<MatchEvent>): MatchEvent =>
  ({
    id: 'e', type: 'goal', minute: 10, team: 'home', playerId: 'p1',
    matchId: 'm1', seasonId: 's1', ...over,
  }) as MatchEvent;

// ── caso base ────────────────────────────────────────────────────────────────
{
  const r = computeOnPitchGoals(
    [ev({ minute: 10, team: 'home' }), ev({ minute: 20, team: 'away' }), ev({ minute: 30, team: 'home' })],
    'p1', true, true, 90, 90,
  );
  check('titolare in campo per tutta la partita: 2 gol fatti, 1 subito',
    r.goalsScoredOnPitch === 2 && r.goalsConcededOnPitch === 1 && r.matchGoalsConcededCount === 1,
    JSON.stringify(r));
  check('il titolare entra a 0', r.enterMin === 0, `enterMin=${r.enterMin}`);
  check('senza uscita, esce a fine partita', r.exitMin === 90, `exitMin=${r.exitMin}`);
}

// ── 1. evento con minuto null ────────────────────────────────────────────────
{
  const eventi = [
    ev({ minute: null, team: 'away' }),   // senza minuto
    ev({ minute: 5, team: 'home' }),
  ];
  const r = computeOnPitchGoals(eventi, 'p1', true, true, 90, 90);
  check('un evento senza minuto non fa esplodere il calcolo', Number.isFinite(r.goalsScoredOnPitch),
    JSON.stringify(r));
  check('un evento senza minuto non e\' contato come gol in campo',
    r.goalsScoredOnPitch === 1 && r.goalsConcededOnPitch === 0,
    JSON.stringify(r));
}

// ── 2. sostituzione fuori con minuto null: il difetto del clean sheet ─────────
{
  const eventi = [
    ev({ minute: 60, team: 'home' }),
    // esce al minuto 60 ma senza minuto registrato
    ev({ type: 'substitution', minute: null, team: 'home', playerId: 'altro', subOutPlayerId: 'p1' }),
    ev({ minute: 80, team: 'away' }),   // gol subito DOPO l'uscita
  ];
  const r = computeOnPitchGoals(eventi, 'p1', true, true, 90, 90);
  check('uscita senza minuto: si usa la fine partita, non null',
    r.exitMin === 90, `exitMin=${r.exitMin} (null farebbe fallire ogni confronto)`);
  check('uscita senza minuto: il gol dopo l\'uscita non e\' subito in campo',
    r.goalsConcededOnPitch === 1 && r.matchGoalsConcededCount === 1,
    JSON.stringify(r));
}

// ── subentrato: conta solo da quando entra ───────────────────────────────────
{
  const eventi = [
    ev({ minute: 10, team: 'home' }),   // prima che entri
    ev({ type: 'substitution', minute: 55, team: 'home', playerId: 'p1' }),
    ev({ minute: 70, team: 'home' }),   // dopo che entra
    ev({ minute: 75, team: 'away' }),
  ];
  const r = computeOnPitchGoals(eventi, 'p1', true, false, 35, 90);
  check('il subentrato entra quando entra', r.enterMin === 55, `enterMin=${r.enterMin}`);
  check('il subentrato non conta i gol precedenti all\'entrata',
    r.goalsScoredOnPitch === 1, JSON.stringify(r));
  check('il subentrato conta i gol successivi all\'entrata',
    r.goalsConcededOnPitch === 1, JSON.stringify(r));
}

// ── uscita a meta' partita ──────────────────────────────────────────────────
{
  const eventi = [
    ev({ minute: 30, team: 'away' }),
    ev({ type: 'substitution', minute: 40, team: 'home', playerId: 'altro', subOutPlayerId: 'p1' }),
    ev({ minute: 60, team: 'away' }),
  ];
  const r = computeOnPitchGoals(eventi, 'p1', true, true, 90, 90);
  check('esce al 40: conta il gol delle 30, non quello delle 60',
    r.goalsConcededOnPitch === 1, JSON.stringify(r));
}

// ── autogol ──────────────────────────────────────────────────────────────────
{
  const eventi = [
    ev({ type: 'own_goal', minute: 20, team: 'home' }),   // della nostra = subito
    ev({ type: 'own_goal', minute: 25, team: 'away' }),   // dell'avversario = fatto
  ];
  const r = computeOnPitchGoals(eventi, 'p1', true, true, 90, 90);
  check('autogol: della mia squadra e\' gol subito',
    r.goalsConcededOnPitch === 1, JSON.stringify(r));
  check('autogol: dell\'avversario e\' gol fatto',
    r.goalsScoredOnPitch === 1, JSON.stringify(r));
}

// ── in trasferta la squadra e\' scambiata ─────────────────────────────────────
{
  const eventi = [
    ev({ minute: 20, team: 'home' }),
    ev({ minute: 25, team: 'away' }),
  ];
  const r = computeOnPitchGoals(eventi, 'p1', false, true, 90, 90);
  check('in trasferta il gol in casa e\' subito, quello fuori e\' fatto',
    r.goalsConcededOnPitch === 1 && r.goalsScoredOnPitch === 1, JSON.stringify(r));
}

// ── partita corta: il fallback dei 90 non deve dominare ──────────────────────
{
  const r = computeOnPitchGoals(
    [ev({ minute: 70, team: 'away' })], 'p1', true, true, 80, 80,
  );
  check('su una partita da 80 il gol al 70 e\' in campo',
    r.goalsConcededOnPitch === 1, JSON.stringify(r));
  check('su una partita da 80 la fine presenza e\' 80, non 90',
    r.exitMin === 80, `exitMin=${r.exitMin}`);
}

console.log(`\nON-PITCH: ${totale - falliti}/${totale} casi, ${falliti} falliti`);
if (falliti > 0) process.exit(1);