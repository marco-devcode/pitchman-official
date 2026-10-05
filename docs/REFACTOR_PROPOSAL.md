# Refactor, pulizia e documentazione — registro

Branch `refactor/pulizia-codice`, da `main` @ `668755f`.
Tre commit: `f4712e0`, `43033d4`, `3838700`.

**Gate su ogni commit**: `tsc --noEmit` pulito (54s / 55s / 53s reali,
`tsconfig.tsbuildinfo` rimosso prima di ogni run), `next lint` 0 errori e 19
warning invariati, `jest -i` verde.

| | prima | dopo |
|---|---|---|
| Test passati | 140 | **147** |
| Righe cancellate | — | **1.532** (di cui ~1.370 di codice morto e commenti collegati) |
| Righe aggiunte | — | 393 (210 sono il test nuovo) |
| File `.ts`/`.tsx` in `src/` | 277 | 268 |

> **Correzione rispetto alla Fase 1.** Il documento precedente contava 289
> file `.ts`/`.tsx`: il numero includeva `scripts/`, non solo `src/`. E
> dichiarava 12 componenti Shadcn mai usati elencandone 8: sono **10**. I
> numeri qui sono ricalcolati sui percorsi, non ricopiati.

---

## 1. Le decisioni richieste, e come sono state risolte

| # | Domanda | Risposta |
|---|---|---|
| 1 | Branch o no? | **Branch creato**, `refactor/pulizia-codice`. Non ancora pushato. |
| 2 | `generate-exercise-flow.ts` | **La versione vecchia, non un lavoro da collegare.** Cancellata (§2). |
| 3 | I componenti Shadcn mai usati | **Tenuti.** Mai importati = mai nel bundle, zero impatto a runtime. |
| 4 | `migrate-backend-v1.ts` / `migrate-glows.ts` | Il primo **resta**, perché non verificabile da qui. Il secondo **cancellato**, perché eseguito. |
| 5 | `docs/Pages.md` | **Non creato.** Le rotte sono già descritte in `README.md` e `ARCHITECTURE.md`, che sono stati corretti. |
| 6 | Le due analisi in `docs/` | **Cancellate**, superate dal codice. |

### Sul punto 2, perché il file non andava collegato

Il generatore di esercizi con AI funziona così:

```
src/app/allenamento/libreria/page.tsx:14   ← monta il dialogo
  └─ AiExerciseGenerator  →  fetch POST /api/generate   (ai-exercise-generator.tsx:132)
       └─ api/generate/route.ts:96  →  generateDrillVariants()
            └─ ai/flows/generate-drill-variants-flow.ts      (489 righe, IL VIVO)
       └─ repairVariants()   →  lib/repair-drill.ts
       └─ drillToTactical() →  lib/drill-to-tactical.ts  →  ExercisePlayer (Konva)
       └─ useExerciseStore.addExercise()  →  salvato in libreria
```

`generate-exercise-flow.ts` produceva direttamente `TacticalExercise` (secondi,
`entityId`) dal modello: il **contratto precedente**. Oggi il contratto è
`Drill` (millisecondi, `subject`/`target`, `kind: 'goal'`), pensato per far
ragionare il modello, e la traduzione al formato del player sta in un file
apposta (`drill-to-tactical.ts`). Anche la provenienza del dato (modello,
fallback, correzioni applicate), il repair deterministico e le 3 varianti
esistono solo nel percorso nuovo.

Le due lezioni Gemini contenute nel commento del file (`z.tuple` → 400
"cannot start list", riuso della stessa istanza di schema → 400 "$ref") sono
già in `drill-schema.ts:1-14`; la catena di modelli misurata è in
`generate-drill-variants-flow.ts:36-54`. Niente di utile è andato perso.

Conseguenza: `MAX_STEPS` in `tactical-exercise.ts` era importato **solo** da
quel file, ed era un duplicato di `drill.MAX_STEPS` (entrambi 6, quest'ultimo
usato dal repair). Tolto.

### Sul punto 4, la parte che non ho potuto chiudere

`migrate-glows.ts` era stato eseguito: nel codice ci sono 178 occorrenze di
`shadow-theme`, e i 13 `rgba(172,229,4)` rimasti sono tutti casi che lo script
non toccava di proposito (stili inline in `global-error.tsx`, attributi SVG
Konva, le stringhe in `design-tokens.ts` che sono la fonte dei colori del
tema, i fill dei grafici in `aggregation-repository.ts:302`).

`migrate-backend-v1.ts` **resta nel repo**, e la ragione è che non ho potuto
verificarlo: il dry-run vuole `FIREBASE_SERVICE_ACCOUNT`, e nel
`.env.production.local` di questa macchina quel valore è la stringa letterale
`[SENSITIVE]` (12 caratteri), non un JSON. Fallo partire e muore a
`JSON.parse`. Non ho credenziali Admin per fare la verifica da qui.

Cosa fa, per decidere con criterio: scrive `ownerId`, `members`, `memberUids`,
`plan`, `limits` su ogni documento in `teams/`, e crea i codici invito legacy
per le stagioni già condivise. Il codice dell'app **accetta due forme** del
documento — `src/lib/server/auth.ts:137-141` lo dice esplicitamente — quindi
non è il prerequisito di nessun flusso funzionante, è un riordino di dati.

**La traccia della domanda "dovevamo?" è proprio lì**: quel commento dice
«Dopo la migrazione `members` e' la fonte vera e `sharedWith` resta solo come
campo legacy». Se quella frase è vera oggi, lo script ha finito e si può
cancellare. Per farlo senza credenziali si può guardare un documento in
`teams/` e vedere se ha `members` e `memberUids`.

---

## 2. Cosa è stato fatto

### `f4712e0` — il commento che mente e le dichiarazioni inutilizzate

- `useMatchDetailStore.ts` dichiarava `halfTime`, `addedTime` e
  `chronologicalEvents` senza leggerne nessuno: residui del calcolo dei minuti,
  che ora vive in `computeMinutesPlayed`. Tolti i tre.
- Il commento sul modello dei minuti diceva che «un ingresso nel recupero vale
  1 minuto preso all'uscente». Quella regola è stata **abolita**:
  `player-minutes.ts:30-34` ha la sezione «Perché non esiste più il "minuto
  forzato a 1"». Il commento induceva a "correggere" il codice per adeguarlo.
- 9 import Firestore non usati: 6 in `season-repository.ts`, 2 in
  `aggregation-repository.ts`, 1 in `training-repository.ts`.

### `43033d4` — codice mai raggiunto

Dieci file con **zero import reali**, verificati uno per uno con un pattern che
distingue un import da una menzione in un commento:

| File | Righe | Note |
|---|---|---|
| `ai/flows/generate-exercise-flow.ts` | 349 | il contratto vecchio, vedi sopra |
| `components/partite/lineup-form-dialog.tsx` | 259 | 3 commenti lo davano per vivo |
| `components/partite/full-calendar-dialog.tsx` | 332 | 1 commento in `round-badge.tsx:7` |
| `components/giocatori/bulk-player-dialog.tsx` | 162 | zero riferimenti |
| `lib/repositories/attendance-repository.ts` | 15 | `db.matchAttendances` mai usato |
| `lib/repositories/user-repository.ts` | 45 | duplica `api/auth/init-user` |
| `ai/tools/secure-stats-tools.ts` | 61 | tool Genkit mai registrati in un flow |
| `store/useTeamStore.ts` | 58 | sostituito da `useSeasonsStore` + `useAuthStore` |
| `hooks/usePermissions.ts` | 14 | sostituito da `useUserRole` |
| `components/squadra/player-card.tsx` | 3 | file guscio |

I sei commenti che li nominavano ora dicono il fatto («un dialog rimosso»)
invece di un path che non porta più da nessuna parte.

### `3838700` — documentazione allineata, e un bug trovato facendo il lavoro

Cinque documenti descrivevano cose che il codice non fa:

| Documento | Divergenza | Correzione |
|---|---|---|
| `ARCHITECTURE.md` | `useTeamStore` "fonte di verità" e `usePermissions` come modulo dei permessi: entrambi morti | tabella dei store con i path verificati, ruolo del direttore, `useUserRole` |
| `README.md` | stessa divergenza + rotte `/admin`, `/director` assenti + `trainingSessions`/`seasons` come collection | struttura reale, sezione rotte, convenzioni sui ruoli |
| `docs/backend.json` | tutto sotto `/users/{userId}/`, osservati e allenamenti inclusi: sono dati di squadra dal commit `db7aadb` | path `teams/{seasonId}/…`, `presence`, `aggregates`, ruoli, la regola per cui i dati di squadra non filtrano per `userId` |
| `docs/Stili.md` | 4 link `file:///d:/Download/…` (path Windows assoluti, invalidi ovunque); assenti i 4 livelli di alone | riscritto sui valori verificati |
| `docs/PROJECTS.md` | 6 `error.tsx`, service layer AI e OCR da immagine elencati come da fare | marcati `[x]` con il path |

Cancellate `docs/analisi-rifiniture-e-codice-morto.md` e
`docs/analisi-2-ripetizioni-e-inefficienze.md`: i 6 codici morti che elencano
non esistono più.

---

## 3. Il bug trovato per strada

`season-collections.ts:11` dichiarava che `season-collections.test.ts`
confronta il registro delle collection con quelle usate nel codice e «fallisce
se ne compare una che non è qui».

**Quel file non è mai esistito.** Verificato su tutti i branch: nessun commit
lo ha mai aggiunto o rimosso. Il commento prometteva un meccanismo che non
c'era — la stessa classe di difetto del commento sui minuti.

Il test c'è ora: `src/lib/season-collections.test.ts`, 7 casi, in entrambe le
direzioni.

**Verificato che fallisca quando deve**, non solo che passi:

- tolta `scoutCategories` dal registro → il test «ogni collection usata nel
  codice è registrata» va rosso;
- tolta la condizione di rimozione da una voce legacy → il test sulla nota va
  rosso;
- ripristinato → 7/7 verdi.

Il mio check è stato sbagliato due volte prima di essere giusto, ed è il
motello per cui la verifica conta:

1. `String.match` con il flag `/g` restituisce i match **completi**, non il
   gruppo catturato: le chiavi erano stringhe tipo `'teams', seasonId,
   'players'` e il test non trovava niente.
2. `aggregates` è scritta con `doc(db, 'teams', seasonId, 'aggregates', …)` e
   non con `collection(...)`: serviva un terzo pattern.

### Due precisazioni che il test ha fatto emergere

**Il registro protegge l'export, non la cancellazione.** Il commento del file
attribuiva al registro la garanzia che «Elimina account» non lasci dati a
terra. Ma `account/delete/route.ts:75` usa `recursiveDelete` sul documento
stagione, che porta via ogni sottocollection registrata o no. Il registro
serve a `account/export`, che legge una collection alla volta e non può sapere
cosa non sta guardando.

**Due voci del registro non sono raggiunte dal codice**: `events` e
`trainings`. Non si può affermare che siano vuote senza accesso ai dati, quindi
**non sono state cancellate**: restano con `legacyDaVerificare: true` e la
condizione di rimozione scritta nella nota. Il test accetta che siano legacy
solo se la condizione c'è.

---

## 4. Cosa non è stato toccato, e perché

- **`src/components/ui/`** — 10 file mai importati, 770 righe (`avatar`,
  `carousel`, `checkbox`, `collapsible`, `menubar`, `progress`,
  `radio-group`, `separator`, `slider`, `tooltip`). Innocui: mai importati =
  mai nel bundle. Sono anche la sorgente da cui prendere un componente se
  serve (`npx shadcn add <nome>`).
- **`altro/page.tsx`** (1.078 righe, il file più grande) — contiene debug,
  reset dati e gestione tema. Un refactor da 1.000 righe dentro il tema è il
  caso in cui una regressione costa più della ripetizione.
- **`getAbsoluteMinute`** — duplicato in `stoppage-time.ts` e
  `player-minutes.ts`: nome e tipo identici, significato opposto. Un import
  sbagliato passa `tsc` e produce minuti sbagliati senza segnale. Rinominarlo
  tocca il minutaggio: refactor di stabilità, non di manutenzione.
- **`migrate-backend-v1.ts`** — vedi §1.
- **I 19 warning di lint** — preesistenti. `no-img-element` vuol dire passare
  a `next/image`, che cambia il rendering.
- **`brand-lime`** — dichiarato in `tailwind.config.ts:28`, ma `--brand-lime`
  non è definito in `globals.css` e il token non compare in `src/`. Una classe
  `bg-brand-lime` non darebbe errore e non avrebbe colore. Segnalato in
  `docs/Stili.md`, non corretto: è una decisione di design.

## 5. Duplicazioni — segnalate, non lavorate

88 cloni, 2,05% delle righe. **Nessuno raggiunge la regola del tre con
un'astrazione che ripaghi**, quindi sono tutte segnalazioni.

Le due coppie che valgono attenzione, perché divergerebbero in silenzio:

- `goal-venue-charts.tsx:58-72` ↔ `venue-stats-charts.tsx` — la stessa carta,
  letta dalla stessa sessione: il fix del memo che non si invalida è passato
  da una sola delle due.
- `usePlayersStore.ts:149-162` ↔ `player-repository.ts` — la stessa logica in
  due livelli (store e repository).

## 6. Aree senza test, refactor ad alto rischio

Copertura: 17 suite su 268 file. Nessun test per:

| Area | Perché è rischioso |
|---|---|
| Import calendario (andata/ritorno) | formato federale con date `A.`/`R.`, nessun test sul parser |
| Delta dei test fisici | il segno dipende dall'unità (metri vs secondi): invertito, e un test sbagliato qui conferma il bug |
| Copertura ruoli / ruolo↔slot | la regola «il lato conta» (CS/CD) è verificata solo a runtime |
| Migrazioni ruoli | `migrateRole` con fallback è stato causa di un bug silenzioso |
| Ordinamenti e classifiche | `sortResults`, `getPrimaryRole`: nessun caso limite |
| **Registro delle collection** | **coperto ora** da `season-collections.test.ts` |

---

## 7. Prossimo passo

Il branch non è pushato. `main` è intatto: i tre commit ci sono solo qui.
Serve una decisione esplicita su cosa fare — mergiare in `main` (che è la
convenzione del repo) o lasciare il branch aperto.
