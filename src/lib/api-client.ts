import { initializeFirebase } from '@/firebase';

/**
 * Le intestazioni per una `fetch` verso una route protetta.
 *
 * Le route che scrivono dati controllano il ruolo lato server
 * (`lib/api-auth.ts`), e per farlo hanno bisogno dell'ID token. Senza questo
 * helper ogni chiamante si costruiva la richiesta a mano, e il modo piu'
 * semplice per sbagliare era mandare `Content-Type` e dimenticare
 * `Authorization`: la route rispondeva 401 e il caller mostrava "Errore durante
 * lo scraping", che sembrava un problema di scraping.
 *
 * Il token viene preso con `getIdToken()` senza forzare il refresh: Firebase
 * lo rinnova da solo quando scade, e forzarlo a ogni chiamata farebbe una
 * richiesta di rete in piu' per niente.
 */
export async function authHeaders(): Promise<Record<string, string>> {
  const user = initializeFirebase().auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}
