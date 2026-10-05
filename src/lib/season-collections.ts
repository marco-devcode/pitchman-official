/**
 * Registro unico delle collection di stagione.
 *
 * Esiste perche' EXPORT e health-check devono sapere TUTTO dove stanno i dati
 * di una squadra, e la cosa si dimentica: si aggiunge una collection nuova,
 * l'export continua a funzionare senza errori e lascia fuori quei dati, e
 * l'utente che scarica il proprio account non li trova.
 *
 * `season-collections.test.ts` confronta questo elenco con le collection usate
 * nel codice e fallisce se ne compare una che non e' qui. Il test e' il
 * meccanismo: il commento da solo non ferma nessuno.
 *
 * NOTA SULLA CANCELLAZIONE. Qui non c'entra: `account/delete` usa
 * `recursiveDelete` sul documento `teams/{seasonId}`, che porta via ogni
 * sottocollection registrata o no. Il registro protegge l'EXPORT, che invece
 * legge una collection alla volta e non puo' sapere cosa non sta guardando.
 *
 * NOTA SULLE SOTTOCOLLECTION. `matches` contiene `lineup`, `events` e `stats`
 * a due livelli; `sessions` contiene `attendance`. Sono elencate sotto
 * `subcollections` perche' l'export le appiattisce sotto il documento padre:
 * non possono stare altrove e perdere il legame con la partita a cui
 * appartengono. `recursiveDelete` le cancella da solo, quindi qui sono
 * necessarie per l'integrita' dell'export, non per decidere se una
 * cancellazione e' completa.
 */

/**
 * Una voce del registro.
 *
 * `legacyDaVerificare` non e' un modo per dire "questa non la usa nessuno e
 * non importa": e' una voce che il CODICE non raggiunge ma che si tiene
 * perché non si può escludere, senza accesso ai dati, che qualche account
 * abbia ancora documenti dentro. Toglierla ometterebbe quei documenti
 * dall'export, e nessuno se ne accorgerebbe.
 *
 * La condizione per rimuoverla è scritta nella nota: un comando da eseguire
 * con l'Admin SDK che restituisca zero documenti. Il test verifica che la
 * condizione ci sia, non che sia stata eseguita.
 */
export interface SeasonCollectionEntry {
  /** Path della collection, relativo a `teams/{seasonId}` */
  path: string;
  /** Sottocollection annidate dentro questa, appiattinate dal nell'export */
  subcollections?: string[];
  /** Perche' esiste: cosa si perde se non viene elencata */
  note: string;
  /**
   * Il codice non la raggiunge piu', ma non e' stata verificata la sua
   * vuotita. Vedi `season-collections.test.ts`.
   */
  legacyDaVerificare?: boolean;
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
  {
    path: 'events',
    note: "Gli eventi vivono sotto matches/{matchId}/events, che e' gia' elencato fra le sottocollection di matches: questa voce copre gli eventi di squadra di una versione precedente. Il codice non la scrive piu'. Da rimuovere dopo aver verificato con l'Admin SDK che la collection non contiene documenti.",
    legacyDaVerificare: true,
  },
  {
    path: 'trainings',
    note: "Percorso parallelo degli allenamenti, superato da sessions. Il codice non lo scrive piu': useTrainingStore usa solo sessions. Da rimuovere dopo aver verificato con l'Admin SDK che la collection non contiene documenti.",
    legacyDaVerificare: true,
  },
  { path: 'physicalTests', note: 'Test fisici dei giocatori' },
  {
    path: 'scouts',
    note: 'Osservati: dati di squadra, condivisi col direttore sportivo',
  },
  {
    path: 'scoutCategories',
    note: 'Etichette degli osservati (prima sotto users/{uid})',
  },
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
  'trainingSessions',
  'physicalTests',
  'settings',
] as const;

/**
 * Sottocollection sotto `users/{uid}` che sono state SPOSTATE su
 * `teams/{seasonId}` e che qui restano solo perche' qualche account puo' avere
 * ancora documenti al vecchio path.
 *
 * Il client non le legge piu': scout-repository scrive e legge solo
 * `teams/{seasonId}/scouts`. Restano in questo elenco perche' i documenti al
 * vecchio path sono invisibili all'app ma non smettono di esistere: toglierli
 * da qui prima di averli spostati lascerebbe dati che "Elimina account" non
 * puo' piu' cancellare, e il pulsante direbbe una falsita'.
 *
 * NOTA: lo script di migrazione `scripts/migrate-scout-to-season.ts` citato
 * qui in passato NON e' mai esistito in questo repo (verificato su tutti i
 * branch: nessun commit lo ha mai aggiunto o rimosso). Se un account ha
 * ancora osservati sotto `users/{uid}/scoutPlayers`, va spostato a mano con
 * l'Admin SDK, e poi questo elenco si puo' accorciare.
 */
export const LEGACY_USER_SUBCOLLECTIONS = [
  'scoutPlayers',
  'scoutCategories',
] as const;

/** True se `path` e' una collection di stagione registrata. */
export function isSeasonCollection(path: string): boolean {
  return SEASON_COLLECTION_PATHS.includes(path);
}