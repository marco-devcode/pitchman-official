'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore';

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  if (!getApps().length) {
    const firebaseApp = initializeApp(firebaseConfig);
    return getSdks(firebaseApp);
  }

  // If already initialized, return the SDKs with the already initialized App
  return getSdks(getApp());
}

let isNetworkEnabled = false;

export function getSdks(firebaseApp: FirebaseApp) {
  // Use regular getFirestore on server (SSR/prerendering) to avoid
  // "initializeFirestore() has already been called with different options" error.
  // On the client, use initializeFirestore with persistentLocalCache once,
  // then getFirestore for subsequent calls (after remount, navigation, etc.)
  const isServer = typeof window === 'undefined';

  let db: Firestore;
  if (isServer) {
    db = getFirestore(firebaseApp);
  } else {
    try {
      db = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({})
      });
    } catch {
      // Already initialized — reuse the existing instance
      db = getFirestore(firebaseApp);
    }
  }

  if (!isServer && !isNetworkEnabled) {
    isNetworkEnabled = true;
    import('firebase/firestore').then(({ enableNetwork }) => {
      enableNetwork(db).catch(() => {});
    });
  }

  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: db
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
