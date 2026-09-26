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
 * Formatta il nome come 'N. Cognome' (Iniziale. Cognome)
 */
export function formatPlayerInitial(fullName: string): string {
  if (!fullName || fullName === 'GIOCATORE' || fullName === 'AVVERSARIO' || fullName === 'Autogol') return fullName || "";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName.toUpperCase();
  
  // Se abbiamo "Mario Rossi" -> "M. ROSSI"
  // Se abbiamo "Rossi Mario" -> assumiamo il primo sia il nome se non sappiamo altro, 
  // ma solitamente l'input utente è Nome Cognome.
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  return `${firstName.charAt(0).toUpperCase()}. ${lastName.toUpperCase()}`;
}
