"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut, 
  onAuthStateChanged,
  updateProfile,
  sendEmailVerification,
  GoogleAuthProvider,
  signInWithPopup,
  type User as FirebaseUser 
} from 'firebase/auth';
import { initializeFirebase } from '@/firebase';
import { useSettingsStore } from './useSettingsStore';
import { AccountRole } from '@/lib/types';

/**
 * Returns a Firebase Auth instance, ensuring the Firebase app is initialized
 * first. Calling the bare getAuth() requires a default app to already exist;
 * that is not guaranteed here because this store module can load before the
 * React FirebaseClientProvider mounts. initializeFirebase() is idempotent
 * (guarded by getApps()), so this is safe to call on every access.
 */
function ensureAuth() {
  return initializeFirebase().auth;
}

interface User {
  id: string;
  username: string;
  email: string;
  role: AccountRole | null;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  isInitialized: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signUp: (email: string, password: string, username?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setAuth: (user: FirebaseUser | null) => Promise<void>;
}

if (typeof window !== 'undefined') {
  initializeFirebase();
}

/**
 * Formatta un errore Firebase Auth in modo leggibile ma includendo il codice
 * tecnico per il debug (es. "Credenziali non valide (auth/invalid-credential)").
 * I codici più comuni vengono tradotti; gli altri vengono mostrati così come sono.
 */
function formatAuthError(error: any, fallbackMessage: string): string {
  const code: string = error?.code || 'auth/unknown';
  const customMessage: string | undefined = error?.message;

  const translations: Record<string, string> = {
    'auth/invalid-credential': 'Credenziali non valide. Email o password errate.',
    'auth/user-not-found': 'Utente non trovato.',
    'auth/wrong-password': 'Password errata.',
    'auth/invalid-email': 'Formato email non valido.',
    'auth/user-disabled': 'Account disabilitato. Contatta il supporto.',
    'auth/too-many-requests': 'Troppi tentativi. Riprova più tardi.',
    'auth/network-request-failed': 'Errore di rete. Verifica la connessione.',
    'auth/email-already-in-use': 'Email o nome utente già registrato. Usa il Login.',
    'auth/weak-password': 'Password troppo debole (almeno 6 caratteri).',
    'auth/operation-not-allowed': 'Provider non abilitato. Contatta il supporto (Firebase Console → Authentication → Sign-in method).',
    'auth/unauthorized-domain': 'Dominio non autorizzato. Aggiungi questo dominio in Firebase Console → Authentication → Settings → Authorized domains.',
    'auth/popup-closed-by-user': 'Finestra di accesso chiusa prima del completamento.',
    'auth/popup-blocked': 'Popup bloccato dal browser. Abilita i popup per questo sito.',
    'auth/cancelled-popup-request': 'Richiesta popup annullata. Riprova.',
    'auth/invalid-api-key': 'API key Firebase non valida o mancante (env NEXT_PUBLIC_FIREBASE_API_KEY).',
    'auth/app-not-authorized': 'App non autorizzata. Verifica la configurazione Firebase.',
    'auth/account-exists-with-different-credential': 'Esiste già un account con la stessa email ma provider diverso. Prova a fare login con quel provider.',
    'auth/credential-already-in-use': 'Queste credenziali sono già associate a un altro account.',
    'auth/internal-error': 'Errore interno Firebase. Riprova o controlla la configurazione.',
  };

  const friendly = translations[code] || fallbackMessage;
  return `${friendly} [${code}]${customMessage ? ` — ${customMessage}` : ''}`;
}

export { formatAuthError };

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      isInitialized: false,
      login: async (usernameOrEmail, password) => {
        try {
          const email = usernameOrEmail.includes('@') ? usernameOrEmail : `${usernameOrEmail.toLowerCase()}@pitchman.app`;
          const auth = ensureAuth();
          const userCredential = await signInWithEmailAndPassword(auth, email, password);

          if (!userCredential.user.emailVerified && !email.endsWith('@pitchman.app')) {
            await signOut(auth);
            return { success: false, error: "Per favore, conferma la tua email prima di effettuare l'accesso." };
          }

          return { success: true };
        } catch (error: any) {
          console.error("Login error [DEBUG]:", {
            code: error?.code,
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
          });
          return { success: false, error: formatAuthError(error, "Errore durante l'accesso.") };
        }
      },
      signUp: async (email, password, username) => {
        try {
          const finalEmail = email.includes('@') ? email : `${email.toLowerCase()}@pitchman.app`;
          const auth = ensureAuth();
          const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
          if (username) {
            await updateProfile(userCredential.user, { displayName: username });
          }
          await sendEmailVerification(userCredential.user);

          // Inizializza ruolo e documento Firestore
          const idToken = await userCredential.user.getIdToken(true);
          await fetch('/api/auth/init-user', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` }
          });

          await signOut(auth);
          return { success: true };
        } catch (error: any) {
          console.error("SignUp error [DEBUG]:", {
            code: error?.code,
            name: error?.name,
            message: error?.message,
            stack: error?.stack,
          });
          return { success: false, error: formatAuthError(error, "Errore durante la registrazione.") };
        }
      },
      loginWithGoogle: async () => {
        try {
          const auth = ensureAuth();
          const provider = new GoogleAuthProvider();
          provider.setCustomParameters({ prompt: 'select_account' });

          const result = await signInWithPopup(auth, provider);

          // Inizializza ruolo e documento se nuovo utente
          const idToken = await result.user.getIdToken(true);
          await fetch('/api/auth/init-user', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` }
          });

          // Force immediate state update to prevent race conditions during navigation
          await useAuthStore.getState().setAuth(result.user);

          return { success: true };
        } catch (error: any) {
          console.error("Google Login error [DEBUG]:", {
            code: error?.code,
            name: error?.name,
            message: error?.message,
            customData: error?.customData,
            stack: error?.stack,
          });
          return { success: false, error: formatAuthError(error, "Errore durante l'accesso con Google.") };
        }
      },
      logout: async () => {
        try {
          const auth = ensureAuth();
          await signOut(auth);
          set({ isAuthenticated: false, user: null });
          // Clear settings to prevent data leaking to the next user
          useSettingsStore.getState().resetSettings();
        } catch (error) {
          console.error("Logout error:", error);
        }
      },
      setAuth: async (firebaseUser) => {
        if (firebaseUser) {
          const username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Utente';
          try {
            const tokenResult = await firebaseUser.getIdTokenResult(true);
            const role = (tokenResult.claims.role as AccountRole) || 'coach';
            set({ 
              isAuthenticated: true, 
              isInitialized: true,
              user: { 
                id: firebaseUser.uid, 
                username,
                email: firebaseUser.email || '',
                role
              } 
            });
          } catch (error) {
            console.error('Error fetching token result:', error);
            set({ isAuthenticated: false, isInitialized: true, user: null });
          }
        } else {
          set({ isAuthenticated: false, isInitialized: true, user: null });
        }
      }
    }),
    {
      name: 'pitchman-auth-cloud-v3',
      partialize: (state) => ({ isAuthenticated: state.isAuthenticated, user: state.user }),
    }
  )
);

if (typeof window !== 'undefined') {
  const auth = ensureAuth();
  onAuthStateChanged(auth, (user) => {
    useAuthStore.getState().setAuth(user);
  });
}
