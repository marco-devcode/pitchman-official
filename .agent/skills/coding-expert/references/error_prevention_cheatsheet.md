# Cheatsheet Prevenzione Errori & Anti-Pattern

## 1. Next.js 15 & React 19 Pitfalls

| Errore Comune | Causa | Soluzione Corretta |
|---|---|---|
| `params.id is undefined` | In Next.js 15 `params` e `searchParams` sono `Promise`. | Usa `const { id } = await params;` nei Server Components o `use(params)` nei Client Components. |
| `"window is not defined"` | Codice browser eseguito in Server Component o durante SSR. | Aggiungi `'use client';` oppure esegui il codice in `useEffect` o dietro controllo `typeof window !== 'undefined'`. |
| Re-render infinito in `useEffect` | Dipendenze instabili (oggetti o funzioni create a ogni render). | Usa primitive, `useCallback`, o estrai la funzione all'esterno dell'effetto. |
| Hydration Mismatch | Date, numeri casuali o estensioni browser che modificano il DOM prima dell'idratazione. | Usa `suppressHydrationWarning` dove strettamente necessario o sincronizza dopo il mount (`useEffect`). |

---

## 2. TypeScript & Type Safety Pitfalls

| Errore Comune | Rischio | Soluzione Corretta |
|---|---|---|
| Uso di `any` | Perdita totale di sicurezza a compile-time. | Usa `unknown` + type guard, oppure definisci un'interfaccia/tipo specifico. |
| Non-null assertion cieca (`value!.field`) | Runtime crash (`Cannot read properties of undefined`). | Usa optional chaining (`value?.field`) con valore di fallback (`?? defaultVal`). |
| Type check saltato alla creazione di tipi | Regressioni a catena nel codice chiamante. | Esegui sempre `npm run typecheck` o analisi statica rigorosa. |
| Switch case non esaustivo | Dimenticanza di gestire nuovi casi di un'unione discriminata. | Usa il pattern `const _exhaustive: never = action;` nel ramo `default`. |

---

## 3. Firebase & Firestore Pitfalls

| Errore Comune | Rischio | Soluzione Corretta |
|---|---|---|
| Listener Firestore non disiscritto | Memory leak e letture non necessarie che consumano quota. | Salva la funzione restituita da `onSnapshot` ed eseguila nella callback di cleanup di `useEffect`. |
| Scritture concorrenti senza transazione | Race conditions e dati corrotti. | Usa `runTransaction` o `writeBatch` per aggiornamenti atomici. |
| Query senza indice composto | Errore Firestore a runtime (`The query requires an index`). | Controlla gli indici in `firestore.indexes.json` prima di aggiungere clausole `.where()` multiple. |

