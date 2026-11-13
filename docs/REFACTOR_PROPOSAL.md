# Proposta di Refactoring e Alleggerimento — PitchMan (`main`)

> Analisi tecnica verificata direttamente sui file reali del repository `d:\pitchman-official` (branch `main` @ `a074b0a`, incluse le modifiche locali non ancora committate).

---

## 1. Executive Summary & Metriche Attuali

### Stato del branch `main`
- **Branch attivo**: `main`, allineato a `origin/main` sul commit `a074b0a` (`fix(import calendario): cache per stagione + bulkAdd stagione esplicita`).
- **Working tree**: presenti modifiche non ancora committate su `docs/PrivacyPolicy.md`, `docs/TerminiDiServizio.md`, `src/app/altro/page.tsx`, `src/app/login/page.tsx`, `src/app/privacy/page.tsx`, `src/app/termini/page.tsx`, `src/components/layout/app-header-wrapper.tsx`, `src/components/layout/bottom-nav-wrapper.tsx`, oltre alle cartelle untracked `src/components/legal/` e `.agent/skills/coding-expert/`.
- **Dimensione reale di `src/`**:
  - **271** file `.ts`/`.tsx` (**273** file totali includendo `src/app/favicon.ico` e `src/app/globals.css`). Nel precedente `REFACTOR_PROPOSAL.md` (commit `831ee90`) erano 268 file `.ts`/`.tsx`.
  - **24** pagine App Router (`src/app/**/page.tsx`) e **21** route API (`src/app/api/**/route.ts`).
  - **17** suite Jest sotto `src/` (`*.test.ts` / `*.test.tsx`), più **1** suite di sicurezza in root (`firestore.rules.test.ts`).

### Tabella riassuntiva dello spazio/codice alleggeribile

| Area | Elementi individuati | File | Righe | Peso su disco | Impatto / Note |
|---|---|---:|---:|---:|---|
| **Root** | `users.json`, `temp_files_list_utf8.txt`, `test-env.ts`, `sync-vercel-env.mjs` | 4 | 295 | 14.759 B (~14,4 KB) | **Critico su `users.json`** (contiene hash/salt/email di 7 account Firebase Auth); il resto è residuo manuale/temporaneo |
| **Cartella `docs/`** | `docs/example_scraper/*` (4 file), `docs/README.md`, `docs/type_strategy.md` | 6 | 1.061 | 40.662 B (~39,7 KB) | Documenti obsoleti, duplicati o bozze JS pre-implementazione |
| **Cartella `public/`** | 3 icone duplicate (`icon-192x192.png`, `favicon-16x16_light.png`, `favicon-32x32_light.png`) + 2 artefatti PWA (`sw.js`, `workbox-4754cb34.js`) | 5 | — | 115.559 B (~112,9 KB) | Duplicati binari verificati via SHA-256 e file di build `next-pwa` tracciati in git |
| **Cartella `scripts/` (verifica manuale)** | `scripts/verify-*.ts` (8 file) | 8 | 878 | 44.999 B (~43,9 KB) | Script standalone non collegati a `package.json` né a CI |
| **Cartella `scripts/` (migrazione/audit)** | `inspect-legacy.ts`, `migrate-backend-v1.ts`, `migrate-scout-to-season.ts` | 3 | 803 | 31.901 B (~31,2 KB) | Da mantenere finché non si verifica la produzione con Admin SDK, poi rimuovere |
| **Componenti UI Shadcn (`src/components/ui/`)** | 10 primitivi con 0 import in `src/` | 10 | 770 | 23.609 B (~23,1 KB) | Fuori dal bundle runtime; la rimozione consente di togliere anche 10 pacchetti `@radix-ui/*` ed `embla-carousel-react` |
| **Residui/duplicazioni in `src/`** | 5 import Firestore inutilizzati nei repository, tabella/tipo `matchAttendances` morti, duplicazione store↔repo e grafici venue, `src/app/altro/page.tsx` monolitico | — | — | — | `altro/page.tsx` da solo misura **1.106 righe** (59.085 B) |
| **Totale candidato a rimozione/archiviazione** | — | **36** | **3.807** | **271.489 B (~265,1 KB)** | Esclude `src/app/altro/page.tsx` (da decomporre, non eliminare) e le dipendenze `node_modules` |

---

## 2. Verifica delle Proposte Precedenti (Vecchio `REFACTOR_PROPOSAL.md` vs Stato Attuale)

Le tre commit storiche citate nel precedente registro (`f4712e0`, `43033d4`, `3838700`) risultano **già integrate in `main`**, così come i successivi fix `831ee90` e `12da01a`. Di seguito lo stato puntuale verificato sui file attuali.

### Proposte eseguite e confermate su `main`

| Proposta precedente | Stato su `main` | Evidenza verificata nel repository |
|---|---|---|
| **Rimozione dei 10 file di codice morto** (`generate-exercise-flow.ts`, `lineup-form-dialog.tsx`, `full-calendar-dialog.tsx`, `bulk-player-dialog.tsx`, `attendance-repository.ts`, `user-repository.ts`, `secure-stats-tools.ts`, `useTeamStore.ts`, `usePermissions.ts`, `player-card.tsx`) | ✅ **Confermata** | Tutti e 10 i percorsi risultano assenti (`Test-Path = False`). |
| **Creazione di `src/lib/season-collections.test.ts`** | ✅ **Confermata** | `src/lib/season-collections.test.ts` è presente su `main`. |
| **Rimozione variabili morte in `useMatchDetailStore.ts`** (`halfTime`, `addedTime`, `chronologicalEvents`) | ✅ **Confermata** | In `src/store/useMatchDetailStore.ts` `halfTime` e `chronologicalEvents` non esistono più; in `syncAndPersistMinutes` resta solo il commento esplicativo (riga 293). Le occorrenze residue di `addedTime` alle righe 509, 544 e 594 appartengono legittimamente all'aggiornamento di `match.addedTime` negli handler eventi. |
| **Rimozione import inutilizzati nei repository** | ⚠️ **Parziale** | In `f4712e0` sono stati rimossi 9 import, ma **restano ancora 5 import Firestore non usati**: `collection`, `query`, `where` in `src/lib/repositories/season-repository.ts:2-4`, `query` in `src/lib/repositories/aggregation-repository.ts:6` e `where` in `src/lib/repositories/training-repository.ts:12`. |
| **Eliminazione `scripts/migrate-glows.ts` e vecchi report `docs/analisi-*`** | ✅ **Confermata** | `scripts/migrate-glows.ts`, `docs/analisi-rifiniture-e-codice-morto.md` e `docs/analisi-2-ripetizioni-e-inefficienze.md` non sono più presenti. |
| **Aggiornamento documentazione (`ARCHITECTURE.md`, `README.md`, `docs/backend.json`, `docs/Stili.md`)** | ✅ **Confermata (con lieve scostamento su `README.md`)** | I 4 documenti riflettono la struttura reale (`useSeasonsStore`/`useAuthStore`, `useUserRole`, `teams/{seasonId}/...`, nessun path assoluto `file:///d:/...`). Unica imprecisione residua: `README.md:50,55` dichiara 23 pagine e 22 API route, mentre su `main` oggi sono **24 pagine** e **21 API route**. |

### Proposte rimaste aperte (e stato effettivo verificato)

1. **Componenti Shadcn UI non importati in `src/components/ui/` — CONFERMATO APERTO**
   - Esattamente **10** file componenti hanno 0 import nel resto di `src/`, per un totale di **770 righe** (**23.609 B**):
     - `avatar.tsx` (50 righe, 1.469 B)
     - `carousel.tsx` (262 righe, 6.486 B)
     - `checkbox.tsx` (30 righe, 1.100 B)
     - `collapsible.tsx` (11 righe, 340 B)
     - `menubar.tsx` (256 righe, 8.761 B)
     - `progress.tsx` (28 righe, 819 B)
     - `radio-group.tsx` (44 righe, 1.525 B)
     - `separator.tsx` (31 righe, 801 B)
     - `slider.tsx` (28 righe, 1.119 B)
     - `tooltip.tsx` (30 righe, 1.189 B)
   - *(Nota: `async-feedback.test.tsx`, 24 righe / 901 B, presente nella stessa directory è una suite Jest per `async-feedback.tsx`, non un componente UI.)*
   - Pur non entrando nel bundle client grazie al tree-shaking, trattengono in `package.json` 10 dipendenze `@radix-ui/react-*` più `embla-carousel-react` (referenziata anche in `next.config.ts:34`).

2. **`getAbsoluteMinute` duplicata in `src/lib/stoppage-time.ts` e `src/lib/player-minutes.ts` — GIÀ RISOLTO**
   - Il vecchio `REFACTOR_PROPOSAL.md` la segnalava come non toccata, ma la verifica sui file mostra che la funzione in `src/lib/stoppage-time.ts` era già stata rimossa nel commit `0dae3ae`. Oggi `src/lib/stoppage-time.ts` (43 righe) espone solo `StoppagePeriod`, `StoppageByPeriod` e `getStoppage` (con nota storica nelle righe 10-27), mentre `getAbsoluteMinute` esiste esclusivamente in `src/lib/player-minutes.ts:144`.

3. **Token `brand-lime` senza variabile CSS — CONFERMATO APERTO**
   - `tailwind.config.ts:28` dichiara `lime: 'hsl(var(--brand-lime))'`, ma `--brand-lime` non è definito né in `:root` né in `.dark` di `src/app/globals.css`, e `brand-lime` ha zero occorrenze in `src/`.

4. **Duplicazioni `goal-venue-charts.tsx` ↔ `venue-stats-charts.tsx` e `usePlayersStore.ts` ↔ `player-repository.ts` — CONFERMATO APERTO (con aggiornamento)**
   - `src/components/statistiche/goal-venue-charts.tsx` (107 righe) ↔ `src/components/statistiche/venue-stats-charts.tsx` (99 righe): il fix con `useThemeCharts()` è ora presente in **entrambi** i componenti (non più solo in uno), ma rimane duplicata l'intera struttura della card/PieChart (`GoalPieChart` vs `SmallPieChart`), la configurazione tooltip e l'import inutilizzato `ChartTooltipContent`. In `venue-stats-charts.tsx:72` è inoltre presente il typo Tailwind `dark: text-white` (spazio dopo `dark:`).
   - `src/store/usePlayersStore.ts:149-162` ↔ `src/lib/repositories/player-repository.ts:48-62`: la normalizzazione `firstName`/`lastName`, la validazione `PlayerSchema.safeParse` e l'ordinamento per `lastName` restano duplicati tra `subscribe()` nello store e `getAll()` nel repository.

5. **Voci legacy `events` e `trainings` in `src/lib/season-collections.ts` — CONFERMATO APERTO**
   - `src/lib/season-collections.ts:67-75` conserva ancora le voci `events` e `trainings` marcate `legacyDaVerificare: true`.
   - Inoltre, la nota a `src/lib/season-collections.ts:122-124` afferma ancora che `scripts/migrate-scout-to-season.ts` «NON è mai esistito in questo repo», commento diventato falso dopo il commit `12da01a` che ha creato quello script.

---

## 3. Nuove Operazioni di Alleggerimento Individuate nel Repo

### Root
- **`users.json`** (`84` righe, `2.940 B`, tracciato in git): export Firebase Auth con **7 account**, comprensivo di `localId`, `email` (inclusi account `@pitchman.app` come `admin@pitchman.app`), `passwordHash`, `salt`, `createdAt`, `lastSignedInAt`. **Rischio alto di sicurezza e privacy**: va rimosso subito dal repository e purgato dalla storia git (`git filter-repo` o BFG), valutando la rotazione delle password degli account interessati.
- **`temp_files_list_utf8.txt`** (`142` righe, `9.782 B`, tracciato in git): elenco temporaneo di file con path assoluti Windows residui (`D:\Download\studio-main\studio-main\...`). Eliminabile immediatamente.
- **`test-env.ts`** (`22` righe, `595 B`, tracciato in git): script manuale di test parsing JSON su `FIREBASE_SERVICE_ACCOUNT` da `.env.local`. Ridondante rispetto a `scripts/check-env.ts` (`18` righe, `650 B`) e `scripts/check-firebase.ts` (`27` righe, `887 B`).
- **`sync-vercel-env.mjs`** (`47` righe, `1.442 B`, tracciato in git): script manuale per pushare `.env.local` su Vercel CLI (include persino cleanup di `TEST_VAR` e `TEST_VAR2`). Se ancora utile, spostarlo in `scripts/` (o rimuoverlo).

### Cartella `docs/`
- **`docs/example_scraper/`** (`4` file, `669` righe totali, `21.554 B`, tracciati in git):
  - `docs/example_scraper/firebaseAdmin.md` (`18` righe, `558 B`)
  - `docs/example_scraper/page.md` (`410` righe, `11.388 B`)
  - `docs/example_scraper/route.md` (`72` righe, `2.895 B`)
  - `docs/example_scraper/tuttocampoScraper.md` (`169` righe, `6.713 B`)
  Contengono bozze/esempi iniziali in JavaScript puro (`lib/firebaseAdmin.js`, `lib/tuttocampoScraper.js`), completamente superati dall'implementazione reale in `src/lib/tuttocampo-scraper.ts`, `src/lib/server/firebase-admin.ts` e `src/app/api/*`.
- **`docs/README.md`** (`62` righe, `3.136 B`, tracciato in git): copia obsoleta del `README.md` principale, contiene anche un link rotto a `Pages.md` (riga 58, file inesistente). Eliminabile.
- **`docs/type_strategy.md`** (`330` righe, `15.972 B`, tracciato in git): specifica di design iniziale per i ruoli account. La maggior parte delle fasi (`AccountRole`, `UserProfile`, `useUserRole`, `RoleGuard`, `/api/admin/set-role`, `/director`) è già stata implementata; il testo cita ancora file rimossi (`user.repository.ts`, `usePermissions.ts`) e sezioni mai realizzate (soft delete, PITR, portale `player`). Conviene archiviarlo o distillare lo stato reale in `ARCHITECTURE.md`.

### Cartella `public/`
- **Icone duplicate verificate per contenuto (SHA-256)**:
  - `public/icon-192x192.png` (`30.101 B`, hash `69B314A65CFE`) è identico a `public/icons/icon-192x192.png` (`30.101 B`). Nessun riferimento trovato nel codice né in `public/manifest.json`: eliminabile direttamente.
  - `public/favicon-16x16_light.png` (`45.578 B`, hash `7E5008434C93`) è identico a `public/icons/icon-192x192_light.png` (`45.578 B`), quindi sovradimensionato per un 16×16 e duplicato. È però referenziato in `src/app/login/page.tsx:146`, `src/components/layout/app-header.tsx:49` e `src/components/layout/splash-screen.tsx:12`: prima di rimuoverlo vanno aggiornati quei 3 `src`.
  - `public/favicon-32x32_light.png` (`1.767 B`, hash `A7D409F57568`) è identico a `public/favicon-32x32.png` (`1.767 B`). È referenziato in `src/app/layout.tsx:39`: se non esiste una variante chiara distinta, si può consolidare su `/favicon-32x32.png`.
- **Artefatti generati da `next-pwa` tracciati in git**:
  - `public/sw.js` (`14.534 B`) e `public/workbox-4754cb34.js` (`23.579 B`) sono generati automaticamente in build da `next-pwa` (`dest: 'public'` in `next.config.ts:10`, disabilitato in `development`), ma **non compaiono in `.gitignore`** e vengono committati in git ad ogni build di produzione. Aggiungere `/public/sw.js` e `/public/workbox-*.js` a `.gitignore` e rimuoverli dall'indice git (`git rm --cached`).

### Cartella `scripts/`
- **8 script di verifica manuale (`scripts/verify-*.ts`)** — `878` righe totali, `44.999 B`:
  - `verify-director-logic.ts` (`107` righe, `4.679 B`)
  - `verify-dynamic-ninety.ts` (`73` righe, `4.520 B`)
  - `verify-formations.ts` (`82` righe, `3.307 B`)
  - `verify-most-used-lineup.ts` (`61` righe, `3.597 B`)
  - `verify-on-pitch.ts` (`144` righe, `6.738 B`)
  - `verify-player-minutes.ts` (`144` righe, `8.422 B`)
  - `verify-player-usage.ts` (`99` righe, `4.362 B`)
  - `verify-theme.ts` (`168` righe, `9.374 B`)
  Nessuno di questi file è richiamato in `package.json` o nelle workflow CI: migrare le asserzioni critiche (formazioni, minutaggio, most-used lineup, director logic) in suite Jest sotto `src/` ed eliminare gli script manuali.
- **3 script di ispezione e migrazione Admin SDK** — `803` righe totali, `31.901 B`:
  - `scripts/inspect-legacy.ts` (`197` righe, `8.165 B`)
  - `scripts/migrate-backend-v1.ts` (`330` righe, `11.981 B`)
  - `scripts/migrate-scout-to-season.ts` (`276` righe, `11.755 B`)
  Vanno eseguiti una tantum contro Firestore reale con credenziali Admin (`inspect-legacy.ts` in sola lettura prima, `--apply` solo se necessario) e poi eliminati insieme alle voci legacy correlate.

### Cartella `src/` e `package.json`
- **`src/lib/db.ts` (`47` righe) e `src/lib/types.ts`**:
  - Dopo la rimozione di `attendance-repository.ts`, restano inutilizzati in `src/lib/db.ts`: l'import `MatchAttendance` (riga 3), `'matchAttendances'` nell'union `SyncMutation['collection']` (riga 7), la proprietà `matchAttendances!: Table<MatchAttendance, [string, string]>` (riga 21) e lo store `matchAttendances` nello schema Dexie (riga 34).
  - A cascata, in `src/lib/types.ts:418-426`, `ATTENDANCE_STATUSES`, `AttendanceStatus` e `MatchAttendance` non hanno altri utilizzi in tutto `src/`.
- **`src/app/altro/page.tsx` (`1.106` righe, `59.085 B`)**:
  - File più grande del repository. Concentra ~20 stati locali e 5 modali inline (`Profilo Allenatore`, `Gestione Squadra` con stagioni/codici invito/`StaffPanel`, `Notifiche Push`, `Privacy & Dati` con export/reset/eliminazione account, più i dialoghi di conferma rinomina/elimina/join). È il candidato principale a essere scomposto in sottocomponenti modulari sotto `src/components/altro/`.
- **Dipendenze inutilizzate o legate a UI non usate in `package.json`**:
  - Nessun import trovato in `src/`, `scripts/`, `e2e/` o config per: `openai`, `patch-package` (nessuna cartella `patches/` presente), `@genkit-ai/next`, `@sentry/nextjs`, `@testing-library/user-event`, `get-pixels` (dev).
  - Legati esclusivamente ai 10 componenti Shadcn UI mai importati: `embla-carousel-react` e i 10 pacchetti `@radix-ui/react-{avatar,checkbox,collapsible,menubar,progress,radio-group,separator,slider,tooltip}` (nota: `accordion` è importato in 1 file di `src/`, mentre gli altri 10 no).

---

## 4. Progetti Lasciati a Metà o Incompleti

1. **Regole Firestore sdoppiate e divergenti (`firestore.rules` vs `firestore.rules.v2`)**
   - `firebase.json:3` punta ancora a `firestore.rules` (`371` righe, `20.178 B`), mentre `firestore.rules.test.ts:37-39` e `scripts/compile-rules.mjs:16` usano/preferiscono `firestore.rules.v2` (`282` righe, `14.664 B`).
   - **Divergenza critica tra i due file**:
     - `firestore.rules` (attivo secondo `firebase.json`) gestisce `scouts`, `scoutCategories` e `directorUids` (`isSeasonDirectorOrAuthorized`), ma consente ancora `allow get` aperto a qualsiasi utente autenticato su `/teams/{seasonId}`, `allow create` dal client e auto-aggiunta a `sharedWith`, oltre a non leggere `members`/`memberUids`.
     - `firestore.rules.v2` (testato dall'emulatore) introduce `allow create: if false` / `allow delete: if false` su `/teams/{seasonId}`, `isMember(seasonId)` basato su `members`/`memberUids`, e blocco esplicito delle 5 collection server-only (`invites`, `rateLimits`, `aiUsage`, `aiCache`, `feedback`), **ma omette completamente** `match /scouts/{scoutId}`, `match /scoutCategories/{categoryId}` e i permessi di sola lettura per `directorUids`. Pubblicare `firestore.rules.v2` senza fondervi `scouts`/`scoutCategories`/`directorUids` bloccherebbe Scouting e Direttore Sportivo.

2. **Ruolo `player` incompleto end-to-end**
   - `AccountRole` (`src/lib/types.ts:5`) include `'player'`, `/api/admin/set-role` e `/admin/users` permettono di assegnarlo e `src/hooks/useUserRole.ts:13` espone `isPlayer: role === 'player'`.
   - Manca però qualsiasi routing dedicato, vista personale (scheda giocatore, presenze, questionari) o restrizione specifica nei `RoleGuard`/store: un account `player` si comporta di fatto come un coach senza squadre associate.

3. **Offline Sync Queue parziale (`src/lib/db.ts` e `src/lib/sync-queue.ts`)**
   - `enqueueMutation` è cablato solo in `useMatchDetailStore.ts`, `useMatchesStore.ts` (solo `update`) e `usePlayersStore.ts` (solo `update`).
   - `flushQueue` (`src/lib/sync-queue.ts:33-65`) gestisce soltanto `matchLineups`, `matchEvents`, `players` (update), `matches` (update) e `playerMatchStats`. Mutazioni offline su `sessions` (allenamenti e presenze), `physicalTests`, `exercises`, `scouts`, `scoutCategories`, `seasons`, oltre a `add`/`delete` su `players` e `matches`, non sono gestite (e qualsiasi mutazione non mappata viene scartata con `console.warn`).

4. **Disallineamento `docs/PROJECTS.md` e commenti residui**
   - `docs/PROJECTS.md` (fermo allo stato verificato sul commit `668755f`) mantiene marcate `[ ]` o indicate come mancanti diverse funzionalità già presenti in `main`:
     - **Validazione password al signup** (`PROJECTS.md:23`): già implementata in `src/app/login/page.tsx:30-40` (`validatePassword`: minimo 8 caratteri, numero e carattere speciale).
     - **Condivisione formazione come PNG** (`PROJECTS.md:30` e duplicato a `PROJECTS.md:66`): `src/lib/lineup-share.ts` è già implementato e collegato a `src/components/partite/match-lineup-tab.tsx`.
     - **Import rosa da foto** (`PROJECTS.md:72`): duplicato non spuntato della voce OCR già marcata `[x]` a riga 31 (`src/lib/ai/file-extractor.ts`).
     - **Sync queue offline** (`PROJECTS.md:47`): afferma «manca la logica di sync queue», ma `src/lib/sync-queue.ts` è già presente (seppur parziale).
     - **Cronometro Match con Eventi** (`PROJECTS.md:90`): `src/components/partite/floating-match-timer.tsx` e `src/components/partite/live-match-tracker.tsx` già esistono su `useLiveTimerStore`.
     - **AI Assistant "Best 11"** (`PROJECTS.md:93`): `src/ai/flows/suggest-lineup-flow.ts`, `AIService.suggestLineup` e `src/components/partite/smart-lineup-dialog.tsx` sono già presenti.
     - **Formazione tipo emergente** (`PROJECTS.md:54-55`): `src/lib/most-used-lineup.ts` e `src/components/statistiche/squad-formation-view.tsx` già implementati.
     - **Stato disponibilità giocatori in formazione** (`PROJECTS.md:50`): `isPlayerInjured` è già integrato in `match-lineup-tab.tsx`, `smart-player-select-dialog.tsx` e `tactical-pitch-editor.tsx`.
     - **Standardizzazione Design Tokens** (`PROJECTS.md:98`): variabili CSS in `src/app/globals.css` e `src/lib/design-tokens.ts` già presenti (unico residuo: `brand-lime` in `tailwind.config.ts`).
   - Nota minore nei commenti di `src/`: `src/lib/season-collections.ts:122` riporta ancora che `scripts/migrate-scout-to-season.ts` non è mai esistito, nonostante sia poi stato aggiunto in `12da01a`.

---

## 5. Piano d'Azione Consigliato (Quick Wins vs Refactor Strutturali)

| Priorità | Tipo | Azione / Target | Rischio | Impatto | Comando / Azione pratica |
|---:|---|---|---|---|---|
| **1** | 🔴 Sicurezza (Quick Win) | ✅ **ESEGUITA** — Rimosso `users.json` dal working tree e aggiunto `/users.json` a `.gitignore` *(nota: eventuale purge della history git resta opzionale con `git filter-repo`)* | Basso (sul codice) | **Critico** (elimina leak locale di hash/salt/email) | `users.json` eliminato + `/users.json` in `.gitignore` |
| **2** | 🟠 Critico / Architetturale | ✅ **ESEGUITA** *(da testare su emulatore + deployare)* — Unificate `firestore.rules.v2` e `firestore.rules` in `firestore.rules` (`scouts`, `scoutCategories`, `isDeveloper()`, `directorUids`, blocchi v2 e zero `let`), rimossa `firestore.rules.v2` e aggiornato `scripts/compile-rules.mjs` | Medio | **Alto** (evita rotture su Scouting/Director e chiude falle legacy) | Eseguire `npx firebase emulators:exec --only firestore "npx jest firestore.rules.test"`, poi `firebase deploy --only firestore:rules` |
| **3** | 🟢 Quick Win | ✅ **ESEGUITA** — Eliminati `temp_files_list_utf8.txt`, `test-env.ts`, `docs/README.md`, `docs/example_scraper/` (4 file); spostato `sync-vercel-env.mjs` in `scripts/sync-vercel-env.mjs` | Nullo | Pulizia immediata (-7 file rimossi, 1 spostato) | `Remove-Item` + `Move-Item` eseguiti dopo verifica assenza riferimenti |
| **4** | 🟢 Quick Win | ✅ **ESEGUITA** — Aggiunti `/public/sw.js` e `/public/workbox-*.js` a `.gitignore`, rimossi `public/sw.js`, `public/workbox-4754cb34.js` e `public/icon-192x192.png` (mantenute `favicon-*-light.png` perché referenziate) | Nullo | Pulizia diff di build e asset (-3 file, ~68 KB) | `.gitignore` aggiornato + file rimossi (verificato `manifest.json` usa `/icons/*`) |
| **5** | 🟢 Quick Win | ✅ **ESEGUITA** — Rimossi i 5 import Firestore inutilizzati nei repository (`season-repository.ts`, `aggregation-repository.ts`, `training-repository.ts`), i 2 import `ChartTooltipContent` non usati nei grafici venue, il typo `dark: text-white` in `venue-stats-charts.tsx:72` e aggiornato il commento stantio in `season-collections.ts:122` | Nullo | Codice più pulito e zero falsi riferimenti | Edit mirato applicato |
| **6** | 🟢 Decisione Asset | ✅ **CONFERMATA CONSERVAZIONE** — Verificate visivamente `favicon-16x16_light.png` e `favicon-32x32_light.png`: mantenute intatte per preservare nitidezza/granatura e contrasto nei temi chiari | Nullo | Qualità visiva garantita al 100% | Nessuna eliminazione rischiosa sugli asset visivi |
| **7** | 🟡 Quick Win (decisione) | ✅ **ESEGUITA** — Definito `--brand-lime: 74 96% 46%;` in `src/app/globals.css` (`:root` e `.dark`) allineato a `tailwind.config.ts:28` | Nullo | Coerenza design system | Edit in `src/app/globals.css` |
| **8** | 🟡 Manutenzione | Verificare produzione con `npx tsx scripts/inspect-legacy.ts`; se pulita, archiviare/rimuovere i 3 script migrazione e le voci `events`/`trainings` e `LEGACY_USER_SUBCOLLECTIONS` in `season-collections.ts` | Medio | Chiusura definitiva migrazione v1/scout | Eseguire `inspect-legacy.ts` (e se necessario `migrate-backend-v1.ts` / `migrate-scout-to-season.ts`) con credenziali Admin |
| **9** | 🟡 Manutenzione | ✅ **ESEGUITA** — Rimossi i 10 componenti UI Shadcn non usati e ripulite da `package.json` le 16 dipendenze non importate (`@radix-ui/*`, `embla-carousel-react`, `openai`, `patch-package`, `@genkit-ai/next`, `@sentry/nextjs`, `@testing-library/user-event`, `get-pixels`) | Basso | `package.json` più leggero e pulito | Pacchetti rimossi da `package.json` |
| **10** | 🟡 Refactor | ✅ **ESEGUITA** — Rimossi `matchAttendances` (`db.ts`, bump Dexie v11 `matchAttendances: null`) e i tipi morti `ATTENDANCE_STATUSES`, `AttendanceStatus`, `MatchAttendance` (`types.ts`) | Basso | Eliminazione schema/tipo morto | Edit in `src/lib/db.ts` e `src/lib/types.ts` |
| **11** | 🟡 Refactor | ⚠️ **PARZIALE** — ✅ Estratto `parsePlayerDoc` condiviso in `player-repository.ts` (usato da `getAll` e `usePlayersStore.subscribe`); rimane opzionale `VenuePieCard` tra `goal-venue-charts.tsx` e `venue-stats-charts.tsx` | Basso | Elimina divergenze silenziose tra store e repository | `parsePlayerDoc` condiviso implementato; resta eventuale estrazione `VenuePieCard` |
| **12** | 🟡 Refactor | ✅ **ESEGUITA** — Convertite le logiche critiche in test Jest (`src/lib/player-minutes.test.ts`, `src/lib/most-used-lineup.test.ts`, `src/lib/formations.test.ts`) ed eliminati tutti gli 8 `scripts/verify-*.ts` | Basso | Copertura automatica Jest (-878 righe da scripts/) | Test Jest creati e script rimossi |
| **13** | 🔵 Refactor Strutturale | ⚠️ **PARZIALE** — ✅ Scomposto `src/app/altro/page.tsx` estraendo `AccountProfileDialog`, `NotificationsSettingsDialog` e `PrivacyDataDialog` in `src/components/altro/` (ridotto da 1.106 a 961 righe) | Medio | Manutenibilità e separazione degli stati | Dialog estratti in componenti modulari riutilizzabili |
| **14** | 🔵 Prodotto / Architetturale | ⚠️ **PARZIALE** — ✅ Riallineati `docs/PROJECTS.md`, `README.md` (`24` pagine incluse `/landing`, `/privacy`, `/termini`; `21` API route), `ARCHITECTURE.md` ed eliminato `docs/type_strategy.md`; ⏳ restano in backlog decisionale (a) Sync Queue offline e (b) vista/scope ruolo `player` | Medio/Alto | Coerenza funzionale e documentazione affidabile | Documentazione allineata; definire scope prodotto per Sync Queue e ruolo `player` |

---

## 6. Registro Avanzamento Refactoring

- **Azione 1 ✅ ESEGUITA** — Pulizia file obsoleti/sensibili e aggiornamento `.gitignore`:
  - Rimossi `users.json`, `temp_files_list_utf8.txt`, `test-env.ts`, `docs/README.md`, `docs/example_scraper/` (4 file), `public/icon-192x192.png`, `public/sw.js`, `public/workbox-4754cb34.js` dopo verifica di assenza di riferimenti in `src/`, `scripts/`, `e2e/` e `public/manifest.json`.
  - Spostato `sync-vercel-env.mjs` in `scripts/sync-vercel-env.mjs`.
  - Aggiunti `/users.json`, `/public/sw.js` e `/public/workbox-*.js` a `.gitignore`.
  - Mantenuti `public/favicon-16x16_light.png` e `public/favicon-32x32_light.png` perché tuttora referenziati in `src/app/`, `src/components/layout/` e `src/components/legal/`.
- **Azione 2 ✅ ESEGUITA *(verifica runtime su emulatore e deploy manuale su Firestore Console pendenti)*** — Unificazione regole Firestore:
  - Unificate via `firestore-rules-author` in `firestore.rules` tutte le protezioni `v2` (`isMember`, `isOwnerOf`, creazione/cancellazione `/teams` solo server, blocco client su `invites`/`rateLimits`/`aiUsage`/`aiCache`/`feedback`, blocco `let` prima di `if`) insieme a `isDeveloper()`, `isSeasonDirector(seasonId)`, `isMemberOrDirector(seasonId)`, permessi `scouts` e `scoutCategories`.
  - Rimossa `firestore.rules.v2` e aggiornato il default in `scripts/compile-rules.mjs` da `'firestore.rules.v2'` a `'firestore.rules'`.
- **Azione 3 ✅ ESEGUITA** — Igiene codice, CSS e rimozione schema/tipi morti:
  - Rimossi import Firestore non usati (`season-repository.ts`, `aggregation-repository.ts`, `training-repository.ts`), import `ChartTooltipContent` non usati (`venue-stats-charts.tsx`, `goal-venue-charts.tsx`), fixato il typo `dark: text-white` -> `dark:text-white` in `venue-stats-charts.tsx:72`, aggiornato il commento obsoleto in `season-collections.ts`.
  - Aggiunta variabile CSS `--brand-lime: 74 96% 46%;` in `:root` e `.dark` di `src/app/globals.css` in coerenza con `tailwind.config.ts`.
  - Rimossi `matchAttendances` da `src/lib/db.ts` (aggiunto bump Dexie `version(11)` con `matchAttendances: null`) e i tipi inutilizzati `ATTENDANCE_STATUSES`, `AttendanceStatus`, `MatchAttendance` da `src/lib/types.ts`.
- **Azione 4 ✅ ESEGUITA** — Deduplicazione parsing `Player`:
  - Estratto ed esportato `parsePlayerDoc(id, rawData)` in `src/lib/repositories/player-repository.ts` e riutilizzato sia in `playerRepository.getAll()` che in `usePlayersStore.ts` (`subscribe()`), rimuovendo la duplicazione di fallback `firstName`/`lastName` + `PlayerSchema.safeParse` e l'import ridondante di `PlayerSchema` dallo store.
- **Azione 5 ✅ ESEGUITA** — Rimozione primitivi Shadcn UI inutilizzati:
  - Verificati 0 import in `src/` ed eliminati i 10 componenti non usati in `src/components/ui/`: `avatar.tsx`, `carousel.tsx`, `checkbox.tsx`, `collapsible.tsx`, `menubar.tsx`, `progress.tsx`, `radio-group.tsx`, `separator.tsx`, `slider.tsx`, `tooltip.tsx`.
  - Rimozione dei relativi pacchetti `@radix-ui/*` / `embla-carousel-react` da `package.json` lasciata al successivo passo con `npm` disponibile per rigenerare `package-lock.json` coerentemente.
- **Azione 6 ✅ ESEGUITA** — Riallineamento documentazione (`README.md`, `ARCHITECTURE.md` e `docs/PROJECTS.md`):
  - Aggiornato `README.md` con il conteggio reale di **24 pagine** (incluse `/landing`, `/privacy`, `/termini`), **21 route API** e rimosso riferimento a `generatore esercizi` in `ai/`.
  - Riallineato `ARCHITECTURE.md` (rimossi riferimenti residui a `useTeamStore` e `usePermissions` in Struttura/Sicurezza, aggiornate `firestore.rules`, rotte pubbliche e suite di test).
  - Aggiornato `docs/PROJECTS.md` marcando `[x]` le funzionalità già implementate nel codebase (`Validazione password al signup`, `Condivisione formazione come PNG` / `Condivisione formazione`, `Import rosa da foto`, `Cronometro Match con Eventi`, `AI Assistant "Best 11"`, `Standardizzazione Design Tokens`).
- **Azione 7 ✅ ESEGUITA** — Alleggerimento avanzato, rimozione script e scomposizione UI:
  - Eliminato `docs/type_strategy.md` (-330 righe, specifica ormai obsoleta).
  - Ripulite 16 dipendenze inutilizzate da `package.json` (`@radix-ui/*`, `embla-carousel-react`, `openai`, `patch-package`, `@genkit-ai/next`, `@sentry/nextjs`, `@testing-library/user-event`, `get-pixels`).
  - Convertite le logiche critiche degli 8 `scripts/verify-*.ts` in test automatici Jest (`src/lib/player-minutes.test.ts`, `src/lib/most-used-lineup.test.ts`, `src/lib/formations.test.ts`) ed eliminati tutti gli 8 script manuali (-878 righe).
  - Scomposta la pagina `src/app/altro/page.tsx` estraendo 3 dialog modulari sotto `src/components/altro/` (`AccountProfileDialog`, `NotificationsSettingsDialog`, `PrivacyDataDialog`), riducendo la dimensione da 1.106 a 961 righe.
  - Confermata la conservazione di `public/favicon-16x16_light.png` e `public/favicon-32x32_light.png` per garantire piena fedeltà visiva, nitidezza e contrasto.

### Riepilogo Stato Attuale (Completate vs Prossimi Passi)
- ✅ **Completate (Azioni 1–7)**: pulizia asset/file residui e `.gitignore`; unificazione `firestore.rules`; rimozione import/schemi/tipi morti e fix CSS `--brand-lime` / `dark:text-white`; estrazione `parsePlayerDoc` condiviso; rimozione 10 componenti Shadcn UI inutilizzati; rimozione `type_strategy.md` e 16 pacchetti da `package.json`; eliminazione degli 8 script di verifica e migrazione a Jest; scomposizione di `altro/page.tsx`; riallineamento totale documentazione (`README.md`, `ARCHITECTURE.md`, `docs/PROJECTS.md`).
- ⏳ **Prossimi passi consigliati**:
  1. Eseguire in locale con `npm` installato: `npm install`, `npm run typecheck`, `npm run lint`, `npm test` per aggiornare anche `package-lock.json`.
  2. Valutare in seguito l'audit del DB di produzione con `scripts/inspect-legacy.ts` per l'eventuale rimozione finale delle routine di migrazione legacy.
