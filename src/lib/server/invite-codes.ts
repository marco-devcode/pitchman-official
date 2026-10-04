import { randomInt } from 'node:crypto';

/**
 * Codici invito.
 *
 * ALFABETO SENZA AMBIGUI: via 0/O, 1/I/l. Il codice va letto e detto ad alta
 * voce o copiato da uno screenshot: `0` e `O` in un font sans-serif sono la
 * stessa macchia, e chi sbaglia a digitare riceve un "codice non valido" senza
 * capire perche'. Sono 32 caratteri invece di 36: il codice passa da ~60
 * milioni a ~1,1 miliardi di combinazioni, quindi piu' corto a parita' di
 * sicurezza.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const CODE_LENGTH = 8;

/**
 * Genera un codice con `crypto.randomInt`, mai `Math.random`.
 *
 * `Math.random()` e' un PRNG: il suo stato si ricava dai suoi output, quindi chi
 * vede due codici puo' ricavare lo stato e predire i successivi. Su un codice
 * che autorizza l'accesso alla squadra di qualcuno, questo e' il punto in cui la
 * casualita' deve essere vera.
 */
export function generateInviteCode(length = CODE_LENGTH): string {
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[randomInt(0, ALPHABET.length)];
  }
  return out;
}

/**
 * Il messaggio per un codice non valido.
 *
 * UN SOLO MESSAGGIO per i quattro casi (inesistente, scaduto, revocato,
 * esaurito). Distinguerli sarebbe un oracolo per chi prova a indovinare: con
 * messaggi diversi si puo' scoprire quali codici esistono provandoli. Chi ha
 * un codice valido non ci rimette: gli si dice anche che e' valido.
 */
export const GENERIC_INVITE_ERROR = 'Il codice non e\' valido o e\' scaduto.';

export const DEFAULT_EXPIRES_IN_DAYS = 7;
export const DEFAULT_MAX_USES = 1;