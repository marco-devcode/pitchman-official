/**
 * Utility per la gestione degli errori comuni dell'applicazione.
 * Mappa gli errori tecnici in messaggi chiari e user-friendly in italiano.
 */

export type AppErrorType =
  | 'offline'
  | 'unauthorized'
  | 'missing-season'
  | 'not-found'
  | 'firestore-error'
  | 'unknown';

export interface AppError {
  type: AppErrorType;
  message: string;
  /** Testo per il pulsante di azione (es. "Riprova", "Vai alle Stagioni") */
  actionLabel?: string;
  /** Route di navigazione opzionale per l'azione */
  actionHref?: string;
}

const ERROR_MESSAGES: Record<AppErrorType, Omit<AppError, 'type'>> = {
  offline: {
    message: 'Sembra che tu sia offline. Controlla la tua connessione e riprova.',
    actionLabel: 'Riprova',
  },
  unauthorized: {
    message: 'La tua sessione è scaduta. Effettua nuovamente l\'accesso.',
    actionLabel: 'Accedi',
    actionHref: '/login',
  },
  'missing-season': {
    message: 'Nessuna stagione attiva configurata. Creane una o selezionane una esistente.',
    actionLabel: 'Gestisci Stagioni',
  },
  'not-found': {
    message: 'La risorsa richiesta non è stata trovata.',
    actionLabel: 'Torna Indietro',
  },
  'firestore-error': {
    message: 'Impossibile recuperare i dati richiesti. Riprova tra poco.',
    actionLabel: 'Riprova',
  },
  unknown: {
    message: 'Si è verificato un errore imprevisto. Riprova.',
    actionLabel: 'Riprova',
  },
};

/**
 * Analizza un errore JavaScript generico e restituisce un AppError strutturato.
 */
export function parseError(error: unknown): AppError {
  if (!navigator.onLine) {
    return { type: 'offline', ...ERROR_MESSAGES.offline };
  }

  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    const code = (error as { code?: string }).code?.toLowerCase() ?? '';

    // ─── Permessi ────────────────────────────────────────────────────────────
    //
    // Il messaggio del Firestore web SDK moderno e' "Missing or insufficient
    // permissions." — NON contiene 'permission-denied' ne' 'unauthorized'.
    // Cercando solo quelle due stringhe, ogni denial finiva in 'unknown' con
    // "errore imprevisto", che e' esattamente cio' che rendeva questo bug
    // impossibile da diagnosticare. La variante col punto fermo e' quella
    // reale: e' quella che si vede a schermo.
    const permessoNegato =
      code === 'permission-denied' ||
      msg.includes('permission-denied') ||
      // Firestore web SDK: "Missing or insufficient permissions."
      msg.includes('missing or insufficient permissions') ||
      msg.includes('insufficient permissions') ||
      // Formato dei client non-web / admin: "PERMISSION_DENIED: Permission denied"
      msg.includes('permission_denied') ||
      msg.includes('permission denied') ||
      msg.includes('unauthorized') ||
      msg.includes('unauthenticated');

    if (permessoNegato) {
      return { type: 'unauthorized', ...ERROR_MESSAGES.unauthorized };
    }

    // ─── Codice di invito / join stagione ────────────────────────────────────
    // Arriva dal repository con un messaggio gia' in italiano e senza `code`,
    // quindi va lasciato passare: sostituirlo con un messaggio generico
    // ("errore imprevisto") cancella l'unica informazione utile.
    const messaggioUtente = (error as { userFacing?: boolean }).userFacing;
    if (messaggioUtente && msg.length > 0) {
      return { type: 'unknown', message: error.message, actionLabel: 'Riprova' };
    }

    if (
      msg.includes('not-found') ||
      msg.includes('not_found') ||
      // "5 NOT_FOUND: no entity to update" — Firestore usa il codice numerico
      // come prefisso, quindi il messaggio contiene 'not_found' con underscore.
      msg.includes('no entity to update') ||
      msg.includes('no document')
    ) {
      return { type: 'not-found', ...ERROR_MESSAGES['not-found'] };
    }

    if (
      msg.includes('firestore') ||
      msg.includes('firebase') ||
      msg.includes('network') ||
      msg.includes('unavailable')
    ) {
      return { type: 'firestore-error', ...ERROR_MESSAGES['firestore-error'] };
    }
  }

  return { type: 'unknown', ...ERROR_MESSAGES.unknown };
}

/**
 * Crea un AppError di tipo "missing-season" pronto all'uso.
 */
export function missingSeasonError(): AppError {
  return { type: 'missing-season', ...ERROR_MESSAGES['missing-season'] };
}

/**
 * Restituisce il messaggio di errore come stringa semplice da salvare nello store.
 */
export function getErrorMessage(error: unknown): string {
  return parseError(error).message;
}
