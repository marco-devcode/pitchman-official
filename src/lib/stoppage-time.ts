/**
 * Minuti di recupero (added time) per singolo periodo.
 *
 * Non esiste un "recupero" generico: ogni tempo ha il suo. Il 1TS non e'
 * l'unico recupero della partita, esattamente come il 2TS non e' l'unico: se
 * si archiviasse un solo totale si perderebbe quale periodo riguarda.
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

/** Recupero totale della partita, per display e per i controlli. */
export function getTotalStoppage(addedTime: StoppageByPeriod | undefined): number {
  return getStoppage(addedTime, '1TS') + getStoppage(addedTime, '2TS');
}

/**
 * Durata REALE di un periodo, recupero compreso.
 *
 * `duration` e' la durata regolare (90 di default, o 2 tempi da 40 min per le
 * giovanili). Il recupero si aggiunge, non sostituisce: un 1T da 45 con 3 di
 * recupero dura 48 minuti reali.
 */
export function getPeriodDuration(matchDuration: number, period: string, addedTime?: StoppageByPeriod): number {
  const base = getRegularDuration(matchDuration, period);
  if (period === '1TS') return base + getStoppage(addedTime, '1TS');
  if (period === '2TS') return base + getStoppage(addedTime, '2TS');
  return base;
}

/** Durata regolare (senza recupero) di un periodo. */
export function getRegularDuration(matchDuration: number, period: string): number {
  const halfTime = Math.floor(matchDuration / 2);
  switch (period) {
    // Il 1TS parte a 0 e finisce alla fine del primo tempo.
    case '1T':
    case '1TS':
      return halfTime;
    // Il 2T e il 2TS partono dalla meta' e vanno fino alla fine partita: la
    // base del 2TS e' il TEMPO INTERO, non la meta'. Restituire 45 qui
    // faceva durare un 2TS da 5 minuti 50 minuti invece di 95.
    case '2T':
    case '2TS':
      return matchDuration;
    default:
      return halfTime;
  }
}

/**
 * Minuto assoluto di fine partita, recupero compreso.
 *
 * Serve al calcolo dei minuti giocati: un titolare che non esce fino alla
 * fine ha giocato i 90 regolari + il recupero, non 90.
 */
export function getMatchEndAbsolute(matchDuration: number, addedTime?: StoppageByPeriod): number {
  return matchDuration + getTotalStoppage(addedTime);
}

/**
 * Minuto assoluto di un evento.
 *
 * Nota il punto delicato: per 1TS/2TS il minuto e' RELATIVO al proprio tempo
 * (un evento al 3' del 2TS e' il 3' di recupero, non il 48'). Il minuto
 * assoluto e' il minuto regolare di fine tempo + quanto e' gia' trascorso nel
 * recupero. Qui si assume la convenzione gia' in uso in match-events.tsx: se il
 * minuto supera i 15, si aggiunge anche il blocco di 15 come "recupero grande"
 * (90+15+3); altrimenti il minuto e' gia' il minuto di recupero.
 */
export function getAbsoluteMinute(
  event: { minute: number | null; period: string },
  matchDuration: number,
  addedTime?: StoppageByPeriod,
): number {
  const min = event.minute ?? 0;
  const halfTime = Math.floor(matchDuration / 2);

  if (event.period === '1T') return Math.min(min, halfTime);
  if (event.period === '2T') return halfTime + Math.min(min, halfTime);
  if (event.period === '1TS') {
    // 1TS: il minuto e' relativo al tempo. 0..recupero = recupero "normale",
    // oltre = blocco aggiuntivo (convenzione 90+15+N).
    const stop = getStoppage(addedTime, '1TS');
    return halfTime + Math.min(min, Math.max(stop, 15));
  }
  if (event.period === '2TS') {
    const stop = getStoppage(addedTime, '2TS');
    return matchDuration + Math.min(min, Math.max(stop, 15));
  }
  return min + matchDuration;
}
