# ⚽ PitchMan — Studio

**Il sistema operativo intelligente per la gestione tecnica calcistica.**

PitchMan è una PWA (Next.js 15) per allenatori e staff tecnico: gestione rosa,
calendario, cronaca live, allenamenti, scouting e statistiche — con un assistente
AI (Gemini 2.5 Flash via Genkit) per importazione da testo/immagini, suggerimento
formazioni e chatbot tattico. Funziona anche offline (Dexie/IndexedDB).

> Documentazione tecnica di riferimento: **[ARCHITECTURE.md](./ARCHITECTURE.md)**.
> I documenti in `docs/` (es. `implementation.md`, `type_strategy.md`, `PROJECTS.md`)
> sono **roadmap / piani di business**, non lo stato attuale del codice.

---

## 🛠️ Tech Stack

- **Core**: Next.js 15 (App Router) · React 19 · TypeScript
- **Backend/DB**: Firebase (Firestore, Auth) · Vercel Blob
- **AI**: Google Genkit + Gemini 2.5 Flash
- **UI**: Tailwind CSS · shadcn/ui · Lucide · Framer Motion
- **State**: Zustand (contesto squadra + store per-feature) · Dexie (offline PWA)
- **Charts**: Recharts

## 📁 Struttura (reale)

```
src/
  app/            routes App Router + error.tsx per sezione
  ai/             flussi Genkit (chatbot, import rosa/calendario, lineup,
                  generatore esercizi) + genkit.ts
  components/
    ui/           primitivi shadcn + async-feedback (loading/errore coerente)
    layout/       header, bottom-nav, auth-guard, theme-provider
    ai/ giocatori/ partite/ allenamento/ calendario/ scout/ statisthe/
                  componenti di dominio
  lib/
    repositories/ CRUD Firestore (repository pattern)
    hooks/        useAsyncAction
    season-collections.ts  registro delle collection di stagione
    schemas.ts types.ts plans.ts player-minutes.ts drill.ts utils.ts db.ts
  services/       logica use-case: ai.service, stats-advanced-service
  store/          Zustand per-feature (seasons, players, matches, stats, …)
  hooks/          useUserRole, usePrefetch, usePresence, usePWAInstall
  firebase/       provider Auth + Firestore init
```

### Rotte

Le pagine sono 23 (`src/app/**/page.tsx`). Le sezioni che non compaiono
nell'albero sopra: `/admin`, `/admin/users`, `/admin/plans`, `/admin/health`
(developer), `/director` (direttore sportivo), `/membri`, `/membri/[id]`,
`/membri/confronto`, `/login`, `/altro` (impostazioni, tema, debug).

Le route API sono 22 sotto `src/app/api/`: le stagioni
(`seasons`, `seasons/[seasonId]`, `.../members`, `.../invites`),
l'AI (`generate`, `chatbot`, `ai/import`, `import-rosa`,
`import-calendario`), gli account (`account/export`, `account/delete`),
l'amministrazione (`admin/users`, `admin/set-role`, `admin/health`) e le
rotte private (`private/assign-role`, `director/seasons`, `feedback`).

**Le regole Firestore non si pubblicano col deploy dell'app.** Vercel
pubblica il codice, non `firestore.rules`: serve
`firebase deploy --only firestore:rules`. Un commit con solo regole non è
ancora dal vivo.

## 🔑 Convenzioni chiave

- **Ownership dei dati**: ogni store per-feature è l'unico proprietario della sua
  collection Firestore. La stagione attiva sta in `useSeasonsStore`, l'utente e
  il ruolo in `useAuthStore`; non esiste un store di contesto unico.
- **Ruoli**: `AccountRole` (`developer` / `director` / `coach` / `player`) è
  letto dal claim del token. Il direttore sportivo è un ruolo distinto dal
  coach, assegnato fuori dall'app: entra in `directorUids`, non in
  `sharedWith`, così non ottiene permessi di scrittura per il solo fatto di
  essere stato condiviso.
- **Logica di servizio** in `src/services` (astrazione flussi AI, aggregazioni).
- **Errori/loading async**: hook `useAsyncAction` + `<AsyncFeedback>` — pattern
  unico in tutti i dialoghi AI (niente `console.error` nudi né spinner reinventati).
- **Autorizzazione**: la lista dei ruoli è scritta nella route
  (`requireAuth(request, ['coach', …])`). Il client non decide cosa si può
  scrivere.
- **Sicurezza**: Firestore Security Rules validano il `role` dai Firebase Auth
  custom claims; le API admin verificano il token lato server.

## 🚀 Setup locale

```bash
npm install
cp .env.example .env.local   # valorizza le chiavi (NON committare il .env.local)
npm run dev                  # http://localhost:9002
```

Le variabili d'ambiente (Firebase, Gemini, Blob) vivono **solo su Vercel** e non
sono nel repo. `.env*` è git-ignorato. Vedi `.env.example` per l'elenco.

## ✅ Quality gates

- `npm run lint` — ESLint (next/core-web-vitals)
- `npm test` — Jest (repository + service layer + hook `useAsyncAction`)
- `npm run test:e2e` — Playwright smoke test (richiede `npx playwright install`)
- Type-check: gestito da Vercel in `next build` (non duplicato in CI)

La CI GitHub Actions esegue **lint + unit test + E2E** a ogni push/PR su `main`.

## 📦 Build & Deploy

- `npm run build` → `npm run start` (o Vercel, già collegato).
- PWA: service worker + manifest in `public/` (offline-first).

---

*PitchMan — sviluppato per il calcio dilettantistico / giovanile.*
