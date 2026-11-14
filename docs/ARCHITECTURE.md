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
| `useScoutStore` | `teams/{seasonId}/scouts` (+ `scoutCategories`) |
| `useExerciseStore` | `exercises` (libreria esercizi, per utente) |
| `usePresenceStore` | `teams/{seasonId}/presence` |

Gli **osservati** usano `useScoutStore` (con persistenza Zustand e
sottoscrizione real-time in `usePrefetch`, come `usePlayersStore`), leggendo e
scrivendo `teams/{seasonId}/scouts` e `scoutCategories` per singola squadra.
Quando il direttore sportivo (in `/director`, tramite `/api/director/seasons`)
o un utente multi-stagione (in `/scout`) accede a più squadre, i profili vengono
presentati anche in **visione unificata cross-squadra** con il tag del nome
della squadra che li tiene in osservazione.

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

### Offline e persistenza (architettura semplificata)
- **Lettura e stato offline**: affidati alla coppia **Firestore `persistentLocalCache`** + **Zustand `persist`** (`localStorage` su store critici come giocatori, osservati e statistiche).
- **Scritture differite**: Dexie/IndexedDB (`src/lib/db.ts`, schema v11) mantiene esclusivamente la tabella `syncQueue` per registrare mutazioni offline puntuali (`matchLineups`, `matchEvents`, update su `players`, `matches`, `scouts` e `playerMatchStats`) e scaricarle automaticamente via `flushQueue` al ritorno online (`src/lib/sync-queue.ts`). Tutte le vecchie tabelle entità duplicate in Dexie sono state rimosse.

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
  app/            # routes (App Router, 25 pagine + 24 API) + error.tsx per sezione
  ai/             # flussi Genkit + genkit.ts
  components/
    ui/           # primitivi shadcn + async-feedback
    layout/       # header, bottom-nav, auth/role guard
    ai/ giocatori/ partite/ allenamento/ calendario/ squadra/ scout/ statistiche/ legal/  # componenti di dominio
  lib/
    repositories/ # CRUD Firestore
    hooks/        # useAsyncAction
    server/       # firebase-admin.ts e helper lato server
    season-collections.ts schemas.ts types.ts plans.ts player-minutes.ts drill.ts utils.ts db.ts
  services/       # logica use-case (ai.service, stats-advanced-service)
  store/          # Zustand: useSeasonsStore + useAuthStore + per-feature store
  hooks/          # useUserRole, usePrefetch, usePresence, usePWAInstall, use-toast
```

## Sicurezza
- Firestore Security Rules (`firestore.rules`) validano i ruoli dai Firebase
  Auth custom claims (`hasAppRole(...)`, `isDeveloper()`, `isAdmin()`) insieme a
  membership/ownership per stagione (`isMember(seasonId)`, `isOwnerOf(seasonId)`,
  `isSeasonDirector(seasonId)`), riservano al server `create`/`delete` su
  `/teams/{seasonId}` e bloccano lato client le collection server-only
  (`invites`, `rateLimits`, `aiUsage`, `aiCache`, `feedback`, e per catch-all
  anche la collection `polls/{pollId}`).
- **Sondaggi Spogliatoio (`polls/{pollId}`)**: gestiti esclusivamente via
  Admin SDK. L'allenatore crea e consulta i sondaggi da Rosa (`/membri` tramite
  `PollsDialog` -> `/api/seasons/[seasonId]/polls`), mentre i giocatori rispondono
  senza account OAuth dalla pagina pubblica `/sondaggio/[pollId]` tramite token di
  gruppo (`?g=...`) o token individuale (`?t=...`) validati server-side da
  `/api/polls/[pollId]`. In modalità anonima `completedPlayerIds` traccia la
  consegna ma `responses` omette `playerId`/`playerName`.
- Gating UI: `RoleGuard` + `useUserRole` (`AuthGuard` lascia pubbliche senza
  login `/login`, `/landing`, `/privacy`, `/termini` e `/sondaggio/*`).
- `middleware.ts` (preventivo): rifiuta le richieste a `/api/admin/*` prive di
  header `Authorization`. La verifica vera del token/ruolo resta nelle route
  handler (es. `set-role` controlla `role === 'developer'`). Le page autenticate
  non sono protette lato server perché l'auth è client-side (onAuthStateChanged,
  nessun session cookie): per farlo serve adottare Firebase session cookies.

## Test
- Unitari e sicurezza (Jest): repository, `season-collections.test.ts`,
  `firestore.rules.test.ts`, `stats-advanced-service`, hook `useAsyncAction`,
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
