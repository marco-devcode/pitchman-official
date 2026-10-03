/**
 * Minuti di recupero (added time) per singolo periodo.
 *
 * Non esiste un "recupero" generico: ogni tempo ha il suo. Il 1TS non e'
 * l'unico recupero della partita, esattamente come il 2TS non e' l'unico: se
 * si archiviasse un solo totale si perderebbe quale periodo riguarda.
 *
 * Qui sopravvivono solo i tipi e `getStoppage`.
 *
 * Questo file conteneva anche cinque funzioni — `getTotalStoppage`,
 * `getPeriodDuration`, `getRegularDuration`, `getMatchEndAbsolute` e
 * `getAbsoluteMinute` — senza un solo chiamante in tutto `src/`: erano il
 * modello di minutaggio precedente a `player-minutes.ts`.
 *
 * Una in particolare era pericolosa. `getAbsoluteMinute` esisteva ANCHE in
 * `player-minutes.ts`, con lo stesso nome e semantica opposta: questa proietta
 * il recupero dopo la fine regolamentare, quella lavora sulla timeline somma.
 * Un `import { getAbsoluteMinute } from '@/lib/stoppage-time'` in un file
 * nuovo sarebbe passato dal type-checker, avrebbe compilato, e avrebbe
 * prodotto minuti sbagliati senza segnalare niente.
 *
 * Idem `getMatchEndAbsolute`, che restituiva `durata + recupero`, cioe' il
 * valore opposto di quello che il minutaggio usa adesso.
 *
 * Il file conserva la nota perche' il nome ricompaia in due commenti
 * (`match-events.tsx` e `types.ts`): senza questa nota qualcuno potrebbe
 * reimportarlo credendolo vivo.
 */
export type StoppagePeriod = '1TS' | '2TS';

export type StoppageByPeriod = Partial<Record<StoppagePeriod, number>>;

/**
 * Recupero per periodo, con fallback a 0.
 * `addedTime` e' il dato grezzo che arriva dal form: se manca, il periodo non
 * ha recupero — e NON si deve dedurre da quanti eventi sono stati registrati in
 * 1TS/2TS, perche' un allenatore che registra un evento nel recupero non sta
 * dichiarando quanto recupero c'era.
 */
export function getStoppage(addedTime: StoppageByPeriod | undefined, period: StoppagePeriod): number {
  const value = addedTime?.[period];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}