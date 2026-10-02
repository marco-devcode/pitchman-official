/**
 * Verifica del denominatore dinamico delle metriche per "90'".
 *
 * Il punto: se in Gestione Squadra la partita e' da 40 minuti, "Gol / 90'"
 * non puo' continuare a dividere per 90. Qui si controlla che il denominatore
 * sia la durata MEDIA REALE delle partite, e che le formule diano i numeri
 * attesi a 40, 60 e 90 minuti.
 */

type M = { duration: number };

function averageMatchDuration(matches: M[]): number {
  const durate = matches.map((m) => m.duration).filter((d) => typeof d === 'number' && d > 0);
  if (!durate.length) return 90;
  return Math.round(durate.reduce((a, b) => a + b, 0) / durate.length);
}

let fail = 0;
function check(nome: string, got: any, want: any) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) console.log(`ok   ${nome}`);
  else { console.error(`FAIL ${nome}: atteso ${JSON.stringify(want)}, ottenuto ${JSON.stringify(got)}`); fail++; }
}

// ─── denominatore ───
check('tutte 90 -> 90', averageMatchDuration([{ duration: 90 }, { duration: 90 }, { duration: 90 }]), 90);
check('tutte 40 (futsal/indoor) -> 40', averageMatchDuration([{ duration: 40 }, { duration: 40 }]), 40);
check('miste 90 e 60 -> media 75', averageMatchDuration([{ duration: 90 }, { duration: 60 }]), 75);
check('durate mancanti/0 ignorate', averageMatchDuration([{ duration: 0 }, { duration: 60 }]), 60);
check('nessuna durata -> fallback 90', averageMatchDuration([{ duration: 0 }]), 90);

// ─── le formule, con lo stesso ragionamento della pagina ───
function metrics(duration: number, totalMinutes: number, presenze: number, goals: number, assists: number) {
  const avg = duration;
  const ninety = totalMinutes > 0 ? totalMinutes / avg : 0;
  const minutesPer90 = presenze > 0 ? Math.round((totalMinutes / presenze) / avg * 100) / 100 : 0;
  return {
    minutesPer90,
    goalsPer90: ninety > 0 ? Math.round((goals / ninety) * 100) / 100 : 0,
    assistsPer90: ninety > 0 ? Math.round((assists / ninety) * 100) / 100 : 0,
    gaPer90: ninety > 0 ? Math.round(((goals + assists) / ninety) * 100) / 100 : 0,
  };
}

// 90 minuti, 3 partite da 90', 3 gol 2 assist: 1 gol per partita piena.
// (Le prime aspettative qui erano sbagliate: 3 gol in 3 partite = 1.0, non 0.33 —
// e' stato proprio il test a farmi ricontrollare la formula.)
check('90min: 3 gol in 3 partite', metrics(90, 270, 3, 3, 2), { minutesPer90: 1, goalsPer90: 1, assistsPer90: 0.67, gaPer90: 1.67 });

// Stessi 3 gol ma su 6 partite da 40: 1 gol ogni 2 partite = 0.5. Il numero
// scala con la durata impostata, ed e' questo il punto.
check('40min: 3 gol in 6 partite', metrics(40, 240, 6, 3, 2), { minutesPer90: 1, goalsPer90: 0.5, assistsPer90: 0.33, gaPer90: 0.83 });

// Stessi minuti giocati ma durata partita diversa: 120 minuti sono 1.33 partite
// da 90 oppure 3 partite da 40, quindi la stessa produzione vale di piu' nel
// modulo corto. E' esattamente il comportamento atteso da un denominatore
// che segue l'impostazione.
check('90min: 3 gol in 120 minuti', metrics(90, 120, 3, 3, 2), { minutesPer90: 0.44, goalsPer90: 2.25, assistsPer90: 1.5, gaPer90: 3.75 });
check('40min: stessi 120 minuti', metrics(40, 120, 3, 3, 2), { minutesPer90: 1, goalsPer90: 1, assistsPer90: 0.67, gaPer90: 1.67 });

// caso limite: un subentrato da 10 min su partita da 40 -> 0.25 di partita
check("40min: sub da 10 min -> 0.25", metrics(40, 10, 1, 0, 0), { minutesPer90: 0.25, goalsPer90: 0, assistsPer90: 0, gaPer90: 0 });

// zero minuti: non deve dividere per zero
check('zero minuti -> tutto 0', metrics(90, 0, 0, 5, 5), { minutesPer90: 0, goalsPer90: 0, assistsPer90: 0, gaPer90: 0 });

console.log(fail === 0 ? 'DURATA DINAMICA: TUTTI I CASI PASSANO' : `DURATA DINAMICA: ${fail} FALLITI`);