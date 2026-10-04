/**
 * Limiti di piano.
 *
 * UN SOLO FILE, importato sia dalle route server sia dallo script di
 * migrazione: se i due avessero due copie della tabella, la migrazione
 * potrebbe scrivere un limite e le rules controllarne un altro, e il
 * divario si vedrebbe solo come "il 31° giocatore passa".
 *
 * I limiti vengono COPIATI sul documento stagione al momento della creazione
 * o della migrazione, perche' le rules li leggono con una sola `get()` e non
 * possono fare query su un'altra collection. Quando arrivera' un cambio di
 * piano (webhook pagamenti) si aggiornano `plan` e `limits` da qui.
 *
 * DURANTE LA BETA TUTTO E' 'beta'. Nessun utente esistente deve perdere
 * funzionalita' per l'introduzione di questi limiti.
 *
 * IL LIMITE SUI GIOCATORI E' ASSENTE, PER VOLONTA'. `maxPlayers` vale
 * `Infinity` e le regole Firestore non lo controllano piu'.
 *
 * Il tetto richiedeva un contatore `playerCount` che il client aggiorna in
 * batch con ogni aggiunta e ogni rimozione: un numero che sbaglia in due modi
 * opposti, con due effetti diversi. Se il browser si chiude a meta' di
 * un'aggiunta, il contatore resta indietro e l'allenatore perde il posto per
 * sempre. Se sbaglia in piu', va oltre il tetto e il tetto non blocca piu'
 * nessuno. Il sintomo sarebbe "Missing or insufficient permissions" su
 * un'azione che l'utente ha ogni diritto di fare, senza alcun messaggio che
 * dica che il problema e' il piano.
 *
 * Il limite sui MEMBRI resta, ed e' un tetto vero: vale 5, si controlla dentro
 * una transazione Firestore — quindi e' atomico, non una promessa del client —
 * e il caso e' raro e voluto: l'invito staff e' una decisione dell'owner, non
 * un'azione che si fa per sbaglio.
 */
export type PlanId = 'beta' | 'free' | 'coach' | 'staff';

export interface PlanLimits {
  /**
   * Nessun tetto durante la beta. `Infinity` e non un numero tondo: rende
   * impossibile che il valore venga scambiato per un tetto reale, perche'
   * ogni confronto con `Infinity` dà sempre "c'e' spazio".
   */
  maxPlayers: number;
  maxMembers: number;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  beta: { maxPlayers: Infinity, maxMembers: 5 },
  free: { maxPlayers: Infinity, maxMembers: 1 },
  coach: { maxPlayers: Infinity, maxMembers: 1 },
  staff: { maxPlayers: Infinity, maxMembers: 4 },
};

/** Piano valido, con fallback a beta: un dato corrotto non deve togliere accesso. */
export function normalizePlan(value: unknown): PlanId {
  return typeof value === 'string' && value in PLAN_LIMITS ? (value as PlanId) : 'beta';
}

export function limitsForPlan(plan: unknown): PlanLimits {
  return PLAN_LIMITS[normalizePlan(plan)];
}

/**
 * Messaggio mostrato all'utente quando un limite e' raggiunto.
 *
 * La regola dice "permesso negato" e l'utente vede un errore di permessi: non
 * capisce che il problema e' un tetto del piano, e prova a risolverlo
 * ricaricando la pagina. Il testo nomina il numero e cosa fare.
 */
export function limitMessage(kind: 'players' | 'members', limit: number): string {
  return kind === 'players'
    ? `Hai raggiunto il limite di ${limit} giocatori per il tuo piano.`
    : `Hai raggiunto il limite di ${limit} membri dello staff per il tuo piano.`;
}

/**
 * C'e' un tetto sui giocatori, o il limite e' assente?
 *
 * Serve perche' `Infinity` e' un numero: senza questa funzione un controllo
 * `count >= limits.maxPlayers` passerebbe sempre e sembrerebbe che il tetto
 * funzioni, mentre in realta' non esiste. E' il controllo che rende esplicito
 * lo stato del limite invece di lasciarlo dedurre da un confronto numerico.
 */
export function hasPlayerCap(limits: PlanLimits): boolean {
  return Number.isFinite(limits.maxPlayers);
}

/**
 * Quanti membri conta una stagione: `memberUids` e' la lista per query,
 * `members` il lookup per le rules. Devono coincidere. La funzione sceglie il
 * numero piu' alto fra i due perche' e' il limite che non si puo' superare,
 * ed e' anche il piu' conservativo.
 */
export function memberCount(season: { memberUids?: string[]; members?: Record<string, string> }): number {
  const fromArray = Array.isArray(season.memberUids) ? season.memberUids.length : 0;
  const fromMap = season.members && typeof season.members === 'object' ? Object.keys(season.members).length : 0;
  return Math.max(fromArray, fromMap);
}