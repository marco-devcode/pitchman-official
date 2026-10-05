/**
 * Elenco canonico dei moduli — UNICA fonte di verita per tutta l'app.
 *
 * Vive in un file dedicato e senza dipendenze perche' e' importato sia da
 * types.ts (rosa) sia da lineup-mapping.ts (partita), che a loro volta si
 * referenziano fra loro: mettere la lista in uno dei due creerebbe un ciclo
 * di import, e l'assertion cross-map (che usa require lazy) salterebbe in
 * silenzio quando il modulo non e' ancora inizializzato.
 *
 * Prima di questo refactor la lista viveva in quattro posti indipendenti:
 *   - hardcoded in TRE componenti di partita (match-lineup-tab,
 *     un dialog di lineup rimosso, smart-lineup-dialog)
 *   - FORMATIONS in types.ts per la rosa
 *   - FORMATION_ROWS in statistiche/squad-formation-view.tsx
 * e le copie divergevano: il 3-4-3 mancava in partita e nelle statistiche, il
 * 4-3-1-2 mancava in rosa. Bastava dimenticarsi un file per avere un modulo
 * disponibile in meta' dell'app, o con righe sbagliate.
 *
 * Il tipo dell'elenco e' dichiarato qui (invece che in types.ts) per evitare
 * l'import circolare: types.ts re-esporta questi simboli, quindi dichiarare
 * qui FormationModule che importa da types.ts significherebbe un ciclo solo
 * di tipi — che tsc spesso non segnala ma che rompe la risoluzione dei moduli.
 */
export type MatchFormation =
  | '4-4-2'
  | '4-3-3'
  | '4-2-3-1'
  | '3-5-2'
  | '3-4-3'
  | '3-4-2-1'
  | '3-4-1-2'
  | '4-3-1-2';

/**
 * Riferimento condiviso e non una copia: `[...MATCH_FORMATIONS]` o
 * `.filter(...)` produrrebbero un array separato che puo' divergere in
 * silenzio, che e' esattamente il difetto che questo refactor elimina.
 * `Object.freeze` perche' nessuno deve poterlo mutare per sbaglio; il tipo
 * resta FormationModule[], compatibile con i consumatori che lo trattano
 * come lista modificabile.
 */
export const MATCH_FORMATIONS: MatchFormation[] = Object.freeze([
  '4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3', '3-4-2-1', '3-4-1-2', '4-3-1-2',
]) as MatchFormation[];
