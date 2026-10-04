/**
 * Costanti della cancellazione account.
 *
 * VIVONO QUI e non nella route perche' Next.js vieta alle route di esportare
 * simboli che non siano i suoi campi (`runtime`, `dynamic`, `revalidate`, i
 * metodi HTTP): `export const DELETE_CONFIRMATION` dentro `route.ts` fa
 * fallire il build con "not a valid Route export field". Il primo tentativo
 * della rotta di cancellazione e' fallito per esattamente questo, su Vercel,
 * mentre `tsc` era pulito: nessuno dei due controlli in locale guarda i campi
 * ammessi in una route.
 */

/** La stringa che l'utente deve digitare. Scelta corta e non ambigua. */
export const DELETE_CONFIRMATION = 'ELIMINA';

/**
 * Token meno vecchio di questo per poter cancellare l'account.
 *
 * Un token rubato resta valido un'ora: senza questo controllo, trovare una
 * sessione aperta sul telefono di qualcuno basta per cancellargli l'account.
 */
export const REAUTH_MAX_AGE_SECONDS = 5 * 60;
