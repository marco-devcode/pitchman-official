/**
 * Errore pensato per l'utente.
 *
 * PERCHE' ESISTE. Le rotte API intercettano gli errori dei flussi AI e li
 * sostituiscono con un messaggio generico ("L'analisi non e' riuscita.
 * Riprova fra poco."), perche' la stringa grezza del provider puo' contenere
 * il testo del prompt, cioe' i dati della squadra. Risultato: l'errore vero
 * — chiave API assente, modello saturo, testo non riconosciuto — sparisce
 * e l'utente vede solo un messaggio che non dice cosa fare.
 *
 * `userError()` marca un errore il cui messaggio e' GIA' scritto per
 * l'utente e non contiene dati sensibili. Le rotte lo propagano tale e
 * quale; tutto il resto continua a diventare il messaggio generico.
 *
 * Come si usa: solo per errori che descrivono il PROBLEMA in italiano
 * (configurazione mancante, formato non valido, servizio non
 * disponibile), mai con dentro testo dell'utente o dati della squadra.
 */
export class AiUserError extends Error {
  /** Marcatore riconosciuto dalle rotte. */
  readonly userMessage = true;
}

export function userError(message: string): AiUserError {
  return new AiUserError(message);
}
