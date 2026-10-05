# PitchMan — Architettura

> Documento di riferimento per l'orientamento nel codebase. Descrive la
> struttura **reale** (non quella semplificata del README marketing).

## Stack
- Next.js 15 (App Router) + React 19 + TypeScript
- Firebase: Firestore (DB), Auth, Storage/Blob
- Genkit + Gemini 2.5 Flash (AI)
- Tailwind + shadcn/ui + Framer Motion
- Zustand (state), Dexie/IndexedDB (offline PWA)
- Recharts (grafici)

## Convenzioni — "chi possiede cosa"

### Dati di dominio → per-feature store (single owner per collection)
Ogni store è l'unico proprietario della sua collection Firestore e delle sue
query. Non duplicare query tra store.

| Store | Path Firestore |
|---|---|
| `usePlayersStore` | `teams/{seasonId}/players` |
| `useMatchesStore` | `teams/{seasonId}/matches` (+ `lineup`, `events`, `stats`) |
| `useMatchDetailStore` | partita aperta: eventi, formazione e minute del singolo match |
| `useTrainingStore` | `teams/{seasonId}/sessions` (+ `attendance`) |
| `useStatsStore` | `teams/{seasonId}/aggregates` |
| `useSettingsStore` | `settings/{uid}` |
| `useTestsStore` | `teams/{seasonId}/physicalTests` |
| `useExerciseStore` | `exercises` (libreria esercizi, per utente) |
| `usePresenceStore` | `teams/{seasonId}/presence` |

Gli **osservati non hanno uno store**: `scout-repository` li legge e scrive
direttamente nelle schermate che li mostrano (`/scout`, il riepilogo in
`/rosa`). `teams/{seasonId}/scouts` e `scoutCategories`.

I path non sono qui per documentazione: `src/lib/season-collections.ts` e' il
registro unico di tutte le collection di stagione, con un test che lo
confronta con quelle usate nel codice e **fallisce se ne compare una che non e'
li'**. E' il meccanismo che impedisce a "Elimina account" di promettere una
cancellazione che non cancella.

### Contesto di squadra trasversale → due store, non uno
Non esiste un store di contesto unico. Lo stato trasversale e' diviso cosi':

- **`useSeasonsStore`** — la stagione attiva e l'elenco delle stagioni.
  E' quello che leggono le schermate (102 riferimenti): ogni pagina prende
  `activeSeason` da qui per decidere QUALE stagione interrogare.
- **`useAuthStore`** — utente autenticato e `AccountRole`, letto dal claim
  del token (`tokenResult.claims.role`).

Esisteva anche `useTeamStore`, che centralizzava le due cose in un posto
solo: non lo importava nessuno ed e' stato rimosso. Un modello di questo
genere si riconosce da un sintomo preciso — un store documentato come "fonte
di verita" che nessun file legge — e va verificato con `grep` prima di
aggiungere il prossimo.

I dati di dominio restano nei rispettivi store.

### Ruoli → `useUserRole` (non `usePermissions`)
`useUserRole()` derivi i permessi dal ruolo letto in `useAuthStore`
(`isDeveloper`, `isDirectorOrAbove`, `isCoachOrAbove`, …). Esisteva
`usePermissions`, che ne era un involucro (`canImportTuttocampo`,
`canEditRoster`, …): zero import, rimosso. Chi autorizza una scrittura e'
`requireAuth(request, ['coach', 'director', 'developer'])` nella route, con
la lista dei ruoli scritta li': il client non decide niente.

### Logica di servizio → `src/services`
Tutta la logica "use-case" (chiamate AI, aggregazioni, business rules) vive in
`src/services`:
- `ai.service.ts` — astrazione dei flussi Genkit (import Rosa/Calendario,
  suggerimento formazione, chatbot).
- `stats-advanced-service.ts` — calcoli statistici avanzati.

I repository (`src/lib/repositories/*`) sono il livello CRUD Firestore puro,
senza logica di dominio. Le AI flow (`src/ai/flows/*`) sono i prompt Genkit.

## Gestione errori / loading (centralizzata)
Prima ogni dialogo AI gestiva `isLoading`/`isAnalyzing`/`console.error` a modo
suo. Ora c'è un pattern unico:

- Hook `useAsyncAction(action)` → `{ data, error, loading, run, reset }`.
  Cattura l'errore in una stringa uniforme (niente `console.error` nudi).
- Componente `<AsyncFeedback loading error />` (`src/components/ui/async-feedback.tsx`)
  → render coerente di spinner + messaggio di errore in tutti i dialoghi.

Applicato a: `smart-player-dialog`, `smart-lineup-dialog`,
`import-tuttocampo-dialog`, `floating-assistant`.

I limiti di pagina usano ancora `error.tsx` / `global-error.tsx` (Next.js
error boundary) — coprono errori di rendering, non le chiamate async (quelle
sono coperte dal pattern sopra).

## Struttura directory
```
src/
  app/            # routes (App Router) + error.tsx per sezione
  ai/             # flussi Genkit + genkit.ts
  components/
    ui/           # primitivi shadcn + async-feedback
    layout/       # header, bottom-nav, auth/role guard
    ai/ giocatori/ partite/ allenamento/  # componenti di dominio
  lib/
    repositories/ # CRUD Firestore
    hooks/        # useAsyncAction, useUserRole, usePermissions, use-toast
    schemas.ts types.ts utils.ts db.ts firebase-admin.ts
  services/       # logica use-case (ai.service, stats-advanced-service)
  store/          # Zustand: useTeamStore (ctx) + per-feature store
  hooks/          # useUserRole, usePermissions, usePWAInstall
```

## Sicurezza
- Firestore Security Rules (`firestore.rules`) validano il `role` dai Firebase
  Auth custom claims (`getRole()`).
- Gating UI: `RoleGuard` + `useUserRole`/`usePermissions`.
- `middleware.ts` (preventivo): rifiuta le richieste a `/api/admin/*` prive di
  header `Authorization`. La verifica vera del token/ruolo resta nelle route
  handler (es. `set-role` controlla `role === 'developer'`). Le page autenticate
  non sono protette lato server perché l'auth è client-side (onAuthStateChanged,
  nessun session cookie): per farlo serve adottare Firebase session cookies.

## Test
- Unitari (Jest): repository, `stats-advanced-service`, hook `useAsyncAction`,
  componente `AsyncFeedback`, service layer `ai.service` (flussi mockati).
- E2E (Playwright): `e2e/smoke.spec.ts` verifica lo shell dell'app + floating
  assistant; gira su CI (`test:e2e`, richiede `npx playwright install`).
- `npm test` + `npm run test:e2e` nella CI GitHub Actions. Type-check affidato a
  Vercel (`next build`).

## Note di manutenzione
- `next-pwa` è deprecato su Next 15: valutare migrazione a `@serwist/next`
  (verificare la build PWA prima di tagliare). Non ancora fatto.
- `next lint` è deprecato in Next 16: pianificare migrazione a ESLint CLI
  (`@next/codemod next-lint-to-eslint-cli`) prima dell'upgrade.
- `packageManager` è dichiarato in package.json per rendere `npm ci`
  deterministico tra macchine/CI.
- Vulnerabilità residue (npm audit): transitive in Genkit/OpenTelemetry/Firebase
  Admin; richiedono un major upgrade breaking di Genkit → non auto-fixate.
