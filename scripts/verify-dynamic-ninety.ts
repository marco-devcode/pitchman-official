/**
 * Verifica che il denominatore delle metriche per "90'" venga dalle
 * IMPOSTAZIONI (Gestione Squadra) e ricalcoli quando l'impostazione cambia.
 *
 * Il difetto che questo file chiude: il denominatore era la MEDIA delle
 * `match.duration`. Con partite tutte da 60 dava 60, ma con durate miste
 * dava un numero che non corrispondeva a nessuna impostazione — e, sopratutto,
 * non cambiava quando l'utente cambiava i minuti in Gestione Squadra.
 */

function resolveMatchDuration(setting: number | undefined | null): number {
  return typeof setting === 'number' && setting > 0 ? Math.round(setting) : 90;
}

function metrics(duration: number, totalMinutes: number, presenze: number, goals: number, assists: number) {
  const ninety = totalMinutes > 0 ? totalMinutes / duration : 0;
  return {
    // Minuti per PRESENZA: media dei minuti realmente giocati. Non divide per
    // la durata della partita, quindi non cambia al cambiare l'impostazione.
    minutesPerAppearance: presenze > 0 ? Math.round(totalMinutes / presenze) : 0,
    goalsPer90: ninety > 0 ? Math.round((goals / ninety) * 100) / 100 : 0,
    assistsPer90: ninety > 0 ? Math.round((assists / ninety) * 100) / 100 : 0,
    gaPer90: ninety > 0 ? Math.round(((goals + assists) / ninety) * 100) / 100 : 0,
  };
}

let fail = 0;
function check(nome: string, got: any, want: any) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) console.log(`ok   ${nome}`);
  else { console.error(`FAIL ${nome}: atteso ${JSON.stringify(want)}, ottenuto ${JSON.stringify(got)}`); fail++; }
}

// ─── lettura dell'impostazione ───
check('80 impostato -> 80', resolveMatchDuration(80), 80);
check('90 impostato -> 90', resolveMatchDuration(90), 90);
check('40 impostato -> 40', resolveMatchDuration(40), 40);
check('60 impostato -> 60', resolveMatchDuration(60), 60);
check('impostazione assente -> 90', resolveMatchDuration(undefined), 90);
check('impostazione 0 -> 90 (non si divide per zero)', resolveMatchDuration(0), 90);
check('impostazione negativa -> 90', resolveMatchDuration(-10), 90);
check('impostazione float -> arrotondata', resolveMatchDuration(79.6), 80);

// ─── ricalcolo al cambio: stessi minuti, denominatore diverso ───
// 240 minuti su 6 presenze, 4 gol e 2 assist. Cambia SOLO l'impostazione.
const con80 = metrics(resolveMatchDuration(80), 240, 6, 4, 2);
const con90 = metrics(resolveMatchDuration(90), 240, 6, 4, 2);
const con60 = metrics(resolveMatchDuration(60), 240, 6, 4, 2);

// 240/80 = 3 partite piene da 80'   -> 4 gol / 3 = 1.33
check('80: 4 gol in 240 min su 6 presenze', con80, { minutesPerAppearance: 40, goalsPer90: 1.33, assistsPer90: 0.67, gaPer90: 2 });
// 240/90 = 2.67                    -> 4 gol / 2.67 = 1.50
check('90: stessi minuti, 4 gol', con90, { minutesPerAppearance: 40, goalsPer90: 1.5, assistsPer90: 0.75, gaPer90: 2.25 });
// 240/60 = 4 partite piene da 60'  -> 4 gol / 4 = 1.
// I minuti per presenza restano 240/6 = 40', quindi 40/60 = 0.67 di partita:
// le due scale dicono cose diverse ed e' giusto che dicano cose diverse.
check('60: stessi minuti, 4 gol', con60, { minutesPerAppearance: 40, goalsPer90: 1, assistsPer90: 0.5, gaPer90: 1.5 });

// Il ricalcolo produce DAVVERO numeri diversi: non e' una copia stanca.
// Le tre metriche per N' cambiano con l'impostazione...
check('80 -> 90 cambia gol/N', con80.goalsPer90 !== con90.goalsPer90, true);
// ...ma i minuti per presenza NO: sono una media dei minuti giocati, quindi
// non hanno niente a che fare con la durata della partita.
check('80 -> 90 NON cambia minuti/presenza', con80.minutesPerAppearance === con90.minutesPerAppearance, true);
check('60 -> 90 NON cambia minuti/presenza', con60.minutesPerAppearance === con90.minutesPerAppearance, true);
check('60 -> 90 cambia il risultato', con60.goalsPer90 !== con90.goalsPer90, true);

// ─── casi limite ───
check('zero minuti -> tutto 0', metrics(resolveMatchDuration(80), 0, 0, 4, 2), { minutesPerAppearance: 0, goalsPer90: 0, assistsPer90: 0, gaPer90: 0 });
check('sub da 5 min su 80 = 5 minuti di media', metrics(resolveMatchDuration(80), 5, 1, 0, 0), { minutesPerAppearance: 5, goalsPer90: 0, assistsPer90: 0, gaPer90: 0 });
check('media non arrotonda per difetto: 200 min su 3 presenze', metrics(resolveMatchDuration(90), 200, 3, 0, 0).minutesPerAppearance, 67);

console.log(fail === 0 ? 'IMPOSTAZIONI: TUTTI I CASI PASSANO' : `IMPOSTAZIONI: ${fail} FALLITI`);