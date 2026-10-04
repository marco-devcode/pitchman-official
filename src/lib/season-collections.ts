/**
 * Registro unico delle collection di stagione.
 *
 * Esiste perche' cancellazione account ed export devono sapere TUTTO dove
 * stanno i dati di una squadra, e la cosa si dimentica: si aggiunge una
 * collection nuova, il pulsante "Elimina account" continua a funzionare senza
 * errori e lascia i dati di quella stagione a terra. Nessun errore, nessun
 * sintomo: semplicemente la promessa fatta all'utente ("cancello tutto")
 * non e' vera.
 *
 * `season-collections.test.ts` confronta questo elenco con le collection usate
 * nel codice e fallisce se ne compare una che non e' qui. Il test e' il
 * meccanismo: il commento da solo non ferma nessuno.
 *
 * NOTA SULLE SOTTOCOLLECTION. `matches` contiene `lineup`, `events` e `stats`
 * a due livelli; `sessions` contiene `attendance`. Sono elencate sotto
 * `subcollections` perche' `recursiveDelete` le cancella da sole: sono
 * necessarie per l'integrita' dei dati, ma non per decidere se una
 * cancellazione e' completa (il test verifica quindi solo il primo livello).
 */
export interface SeasonCollectionEntry {
  /** Path della collection, relativo a `teams/{seasonId}` */
  path: string;
  /** Sottocollection annidate dentro questa, cancellate ricorsivamente */
  subcollections?: string[];
  /** Perche' esiste: cosa si perde se non viene elencata */
  note: string;
}

export const SEASON_COLLECTIONS: SeasonCollectionEntry[] = [
  { path: 'players', note: 'Rosa: nome, cognome, data di nascita' },
  {
    path: 'matches',
    subcollections: ['lineup', 'events', 'stats'],
    note: 'Partite, formazioni, eventi e statistiche per gara',
  },
  {
    path: 'sessions',
    subcollections: ['attendance'],
    note: 'Allenamenti e presenze',
  },
  { path: 'events', note: 'Eventi di squadra (calendario)' },
  { path: 'trainings', note: 'Allenamenti (percorso parallelo)' },
  { path: 'physicalTests', note: 'Test fisici dei giocatori' },
  { path: 'aggregates', note: 'Aggregati precalcolati usati dalla dashboard' },
  { path: 'presence', note: 'Battito di presenza, nessun dato di squadra' },
];

/** Elenco dei soli path del primo livello. */
export const SEASON_COLLECTION_PATHS: string[] = SEASON_COLLECTIONS.map((c) => c.path);

/**
 * Collection TOP-LEVEL che non sono sotto `users/{uid}` ma sono comunque
 * dati dell'utente. Vanno cancellate con l'account.
 */
export const USER_TOP_LEVEL_COLLECTIONS = ['exercises'] as const;

/**
 * Sottocollection sotto `users/{uid}` che contengono dati personali. Esistono
 * ancora nelle rules (scoutPlayers, scoutCategories, trainingSessions) per
 * compatibilita': non sono piu' usate dal codice client, ma se qualcuno ha
 * ancora dei documenti li devono vedere, e toglierle lascerebbe dati orfani
 * che nessuno puo' piu' cancellare.
 */
export const USER_SUBCOLLECTIONS = [
  'scoutPlayers',
  'scoutCategories',
  'trainingSessions',
  'physicalTests',
  'settings',
] as const;

/** True se `path` e' una collection di stagione registrata. */
export function isSeasonCollection(path: string): boolean {
  return SEASON_COLLECTION_PATHS.includes(path);
}