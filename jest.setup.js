import '@testing-library/jest-dom';

// Firebase non deve iniziare a parlare NEI TEST.
//
// `useAuthStore` chiama `initializeFirebase()` a livello di modulo e, senza
// chiavi nelle env, `getAuth()` solleva `auth/invalid-api-key`: qualunque suite
// che importi uno store (useStatsStore, useMatchDetailStore, ...) muore prima
// di un solo test, con un errore che parla di Firebase e non del codice sotto
// test.
//
// Si mocka solo l'inizializzazione degli SDK: gli store restano quelli veri,
// che e' il punto. Le suite che vogliono davvero Firebase (nessuna, al
// momento) possono fare `jest.unmock('@/firebase')`.
jest.mock('@/firebase', () => {
    // auth finto ma con l'interfaccia che onAuthStateChanged si aspetta.
    const auth = { currentUser: null, onAuthStateChanged: () => {} };
    const sdks = { firebaseApp: {}, auth, firestore: {} };
    return {
        initializeFirebase: () => sdks,
        getSdks: () => sdks,
        firebaseApp: sdks.firebaseApp,
        auth: sdks.auth,
        db: sdks.firestore,
    };
});

// Mock matchMedia.
//
// La guardia `typeof window` serve perche' i test delle route API dichiarano
// `@jest-environment node` (le Web API del fetch in jsdom tirano una catena di
// ReferenceError), e li' `window` non esiste. Questo file gira per entrambi gli
// ambienti: fallire qui ucciderebbe anche le suite di API.
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(), // deprecated
      removeListener: jest.fn(), // deprecated
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}
