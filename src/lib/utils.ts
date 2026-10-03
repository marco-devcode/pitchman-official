import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * I ruoli di un giocatore, come stringa.
 *
 * Esiste perche' il campo `role` e' deprecato ma e' ancora quello che la
 * maggior parte del codice legge, e perche' `roles` non e' l'unico posto
 * dove vivono: alcuni documenti hanno `roles`, altri solo `role` o
 * `secondaryRoles`. Leggendo solo `role`, una scheda mostrava "DC" a un
 * giocatore che nella rosa risultava "DC, CDC, TRQ": due schermate che
 * dicevano cose diverse sullo stesso giocatore.
 *
 * Un campo `roles` vuoto non deve far fallire la riga: si ripiega su `role`,
 * poi sui secondari. Se non c'e' niente, stringa vuota.
 */
export function displayPlayerRoles(player: { roles?: string[]; role?: string; secondaryRoles?: string[] } | undefined | null): string {
  if (!player) return '';
  if (player.roles && player.roles.length > 0) return player.roles.join(', ');
  const legacy = [player.role, ...(player.secondaryRoles ?? [])].filter(Boolean);
  return legacy.length > 0 ? legacy.join(', ') : '';
}

/**
 * Restituisce il nome del giocatore nell'ordine COGNOME NOME per le liste.
 * Se il giocatore ha firstName e lastName separati li usa direttamente,
 * altrimenti inverte le parti del fullName.
 */
export function displayPlayerName(player: { firstName?: string; lastName?: string; name: string } | undefined | null): string {
  // Tollera undefined: i chiamanti passano quasi sempre `find(...)` che puo'
  // non trovare nulla, e il fallback "GIOCATORE" va gestito nel chiamante.
  if (!player) return '';
  if (player.lastName && player.firstName) {
    return `${player.lastName} ${player.firstName}`.trim().toUpperCase();
  }
  // Fallback: inverte le parti del nome completo
  const parts = player.name.trim().split(/\s+/);
  if (parts.length <= 1) return player.name.toUpperCase();
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return `${lastName} ${firstName}`.trim().toUpperCase();
}

/**
 * Restituisce il nome del giocatore come "COGNOME N." (iniziale del nome + punto).
 * Usato sotto ai cerchi dei TITOLARI sul campo, dove lo spazio è poco e
 * COGNOME NOME intero non ci sta.
 */
export function displayStarterName(player: { firstName?: string; lastName?: string; name: string }): string {
  // Usa displayPlayerName per estrarre le parti (gestisce lastName/firstName separati e il fallback inversione)
  const full = displayPlayerName(player);
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return full;
  // parts: [COGNOME, NOME] (displayPlayerName restituisce già COGNOME NOME)
  const lastName = parts[0];
  const firstName = parts[1];
  return `${lastName} ${firstName.charAt(0).toUpperCase()}.`;
}

/**
 * Formatta il nome come 'N. COGNOME' (iniziale del nome + cognome).
 *
 * L'ordine atteso in ingresso è "COGNOME NOME", che è quello che produce
 * displayPlayerName — la funzione con cui tutti gli eventi vengono salvati.
 * Ma gli eventi già scritti prima del fix possono avere l'ordine inverso:
 * il dialog salvava il campo `name` grezzo del giocatore, che nell'import
 * può essere "Nome Cognome". In quel caso l'iniziale verrebbe presa dal nome
 * e il nome per esteso al posto del cognome.
 *
 * Non si può distinguere "LEVI CARLO" da "CARLO LEVI" con certezza, quindi qui
 * si affianca displayPlayerName che conosce i campi firstName/lastName: se il
 * chiamante ha il giocatore completo, formatPlayerInitial va su quello. Il
 * fallback a stringa resta per l'avversario e i nomi libi.
 */

/**
 * E' un nome squadra, non un nome di giocatore?
 *
 * Serve perche' "Real Milano" passato a formatPlayerInitial diventerebbe
 * "M. REAL": prenderebbe l'iniziale di "Milano" come nome e "Real" come
 * cognome. Un nome squadra va mostrato per intero.
 *
 * Non si puo' basare sul numero di parole (squadre e giocatori hanno entrambi
 * due parole), quindi si cerca un indizio: sigla societaria iniziale o finale
 * (AC, AS, FC, SS, US...) oppure un toponimo noto che non e' un nome di
 * persona. Elenco minimale: nessun club ci mette dentro se il nome non e' uno
 * di questi, e in quel caso resta un nome di persona.
 */
export function isTeamName(testo: string): boolean {
  const t = (testo || '').trim();
  if (!t) return false;
  // Sigla societaria: iniziale ("AC Milan") o finale ("Milan AC", "AC", "AS").
  if (/^(AC|A\.C\.|AS|FC|SS|US|SSD|GS|ASD|AC[SD])\b/i.test(t)) return true;
  if (/\b(AC|A\.C\.|AS|FC|SS|US|SSD|GS|ASD)\b\.?$/i.test(t)) return true;
  // Toponimi e nomi propri tipici dei club italiani, che non sono cognomi.
  const club = /\b(Real|Inter|Intercalcio|Milan|Juventus|Juve|Roma|Napoli|Lazio|Fiorentina|Torino|Bologna|Sampdoria|Genoa|Como|Venezia|Palermo|Sassuolo|Empoli|Spezia|Cagliari|Verona|Parma|Lecco|Lecce|Brescia|Salernitana|Pisa|Cremonese|Sudtirol|Juvestus|Volvera|AlbinoLeffe|Alb|Leffe|Treviso|Foggia|Reggina|Spal|Sirenesse|Pescara|Cittadella|Cesena|Modena|Sassuolo|Ascoli|Sudtirol|Carpi|Alessandria|Pistoiese|Ferrarese|Reggiana|Albatro|Manciano|Vis Pesaro|Gubbio|Lucchese|Torinese|Siracusa)\b/i;
  return club.test(t);
}

export function formatPlayerInitial(fullName: string): string {
  const raw = (fullName || '').trim();
  if (!raw) return '';
  // Etichette speciali: sono già nomi, non "cognome nome" da abbreviare.
  if (/^(GIOCATORE|AVVERSARIO|AUTOGOL)$/i.test(raw)) return raw.toUpperCase();

  const parts = raw.split(/\s+/);
  // Una sola parola: non c'è un cognome da abbreviare, si lascia intatta.
  if (parts.length <= 1) return raw.toUpperCase();

  const lastName = parts[0];
  // Il resto è il nome; se è composto ("MARCO MARIO ROSSI" salvato come
  // "ROSSI MARCO MARIO") l'iniziale è comunque quella del primo nome.
  const firstName = parts.slice(1).join(' ');
  return `${firstName.charAt(0).toUpperCase()}. ${lastName.toUpperCase()}`;
}
