import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Restituisce il nome del giocatore nell'ordine COGNOME NOME per le liste.
 * Se il giocatore ha firstName e lastName separati li usa direttamente,
 * altrimenti inverte le parti del fullName.
 */
export function displayPlayerName(player: { firstName?: string; lastName?: string; name: string }): string {
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
 * L'ordine di ingresso è "COGNOME NOME", non "Nome Cognome": tutto cio' che
 * salva un evento (displayPlayerName, chiamata dal flusso live per gol,
 * assist e sostituzioni) produce gia' "COGNOME NOME" e finisce in
 * playerName / assistPlayerName / subIn / subOut.
 *
 * La versione precedente assumeva l'inverso e produceva "D. GIOVANNI" per
 * "DESOLEI GIOVANNI": l'iniziale del cognome al posto del nome, e il nome
 * per esteso al posto del cognome. Visibile in cronaca ma anche in ogni
 * punto che riformatta un evento.
 */
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
