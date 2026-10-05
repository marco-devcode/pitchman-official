# Proposta di refactor, pulizia e documentazione

Data: 2026-10-05 · `main` @ `668755f` · **Fase 1, sola lettura**

Nessuna riga di codice è stata modificata. Ogni voce ha evidenza `file:line`.

> **Nota sul branch.** Il prompt chiede un branch `refactor/pulizia-codice`; la
> convenzione del repo è **solo `main`, push diretti, niente branch né PR**. Fase 1
> è sola lettura e non ne ha bisogno. Per la Fase 2 serve una decisione tua
> (domanda 1 in fondo).

---

## 1. Stato di partenza

Tutti e tre i gate sono verdi **prima** di toccare qualsiasi cosa.

| Gate | Esito |
|---|---|
| `tsc --noEmit` | **pulito**, 53s (durata reale, `tsbuildinfo` rimosso prima) |
| `next lint` | **0 errori**, 19 warning tutti preesistenti |
| `jest -i` | **16 suite passate, 140 test**, 1 suite / 38 test skipped |

I 19 warning di lint sono 12 `no-img-element`, 6 `react-hooks/exhaustive-deps`,
1 `jsx-a11y/alt-text`. Nessuno introdotto dal lavoro recente su ruoli e scout.

| Metrica | Valore |
|---|---|
| File `.ts`/`.tsx` in `src/` + `scripts/` | 289 |
| Righe totali | 46.525 |
| Cloni rilevati (`jscpd`, ≥50 token / 6 righe) | 88 — **2,05%** delle righe |
| Cloni ≥8 righe (interessanti) | 19 |
| File ≥300 righe | 28 |

Distribuzione: `components` 16.908 · `app` 11.237 · `lib` 10.458 · `store` 2.885 ·
`ai` 1.671 · `scripts` 1.312 · `services` 796 · `hooks` 444.

**Nota**: `docs/analisi-rifiniture-e-codice-morto.md` (2026-10-02) esiste già e
elenca 6 funzioni morte in `stoppage-time.ts` e `aggregators/filter.ts`. Le ho
riverificate: **sono già state rimosse**, restano solo citazioni nei commenti. Quel
documento è quindi superato dal codice — vedi voce **D1**.

---

## 2. Tabella delle proposte

| ID | Tipo | Dove | Problema | Intervento | Rischio | Sforzo | Come verifico che non cambia |
|---|---|---|---|---|---|---|---|
| M1 | morto | `src/ai/flows/generate-exercise-flow.ts` (349 righe) | Zero import. Non è in `src/ai/dev.ts`, non raggiunto da nessuna route API. `generateExercise` non è chiamato da `src/app/api/` né `src/services/` | Rimuovere il file | **medio** | 1 h | `tsc` + `jest` invariati; grep `generateExercise` resta vuoto |
| M2 | morto | `src/components/partite/lineup-form-dialog.tsx` (259) | `LineupFormDialog` non è importato. I 3 riferimenti sono commenti in `lineup-mapping.ts`, `types.ts`, `formation-modules.ts` | Rimuovere il file + **correggere i 3 commenti** che lo danno per vivo | medio | 30 m | `tsc`; i commenti non devono più nominarlo |
| M3 | morto | `src/components/partite/full-calendar-dialog.tsx` (332) | Zero import. Unico riferimento in un commento di `round-badge.tsx:7` | Rimuovere il file + correggere il commento | medio | 20 m | `tsc` |
| M4 | morto | `src/components/giocatori/bulk-player-dialog.tsx` (162) | Zero import, zero riferimenti | Rimuovere il file | basso | 5 m | `tsc` |
| M5 | morto | `src/lib/repositories/attendance-repository.ts` (15) | Zero import. Accesso a `db.matchAttendances` mai usato | Rimuovere il file | **basso** | 5 m | `tsc`; `db.matchAttendances` è ancora usato altrove? |
| M6 | morto | `src/lib/repositories/user-repository.ts` (45) | Zero import. Duplica l'accesso a `users` che c'è già in `api/auth/init-user` | Rimuovere il file | basso | 5 m | `tsc` |
| M7 | morto | `src/ai/tools/secure-stats-tools.ts` (61) | Zero import. Tool Genkit mai registrati in alcun flow | Rimuovere il file | basso | 5 m | `tsc` |
| M8 | morto | `src/store/useTeamStore.ts` (58) + `src/hooks/usePermissions.ts` (14) | Zero import. `usePermissions` citato solo in un commento di `import-rosa/route.ts:8` | Rimuovere entrambi + correggere il commento | basso | 10 m | `tsc` |
| M9 | morto | `src/components/squadra/player-card.tsx` (3 righe) | File guscio, zero import | Rimuovere | basso | 2 m | `tsc` |
| M10 | commento | `src/store/useMatchDetailStore.ts:317` | Il commento dice «un ingresso nel recupero vale **1 minuto** preso all'uscente», ma `player-minutes.ts:30` ha una sezione «Perché non esiste più il "minuto forzato a 1"» | Riscrivere il commento sul modello attuale | **basso** | 5 m | Solo commento: nessun cambio di codice |
| M11 | commento | `useMatchDetailStore.ts:288,290,296` | `halfTime`, `addedTime`, `chronologicalEvents` dichiarati e mai letti: residui del calcolo delegato a `computeMinutesPlayed` | Rimuovere le 3 dichiarazioni | basso | 10 m | `tsc`; il calcolo non cambia perché non le usava |
| M12 | struttura | `src/app/altro/page.tsx` (1.078) | File più grande del repo: settings, debug, reset dati, tema in un file | **Non propongo di estrarlo** (v. §4) | — | — | — |
| M13 | doc | `docs/analisi-rifiniture-e-codice-morto.md`, `docs/analisi-2-ripetizioni-e-inefficienze.md` | Entrambi superati: i 6 codici morti citati non esistono più | **Domanda 5**: archiviarli o aggiornarli | — | — | — |
| M14 | doc | `docs/Pages.md` | **Non esiste.** Il prompt lo chiede allineato alle route reali; oggi non c'è nessun documento delle pagine | Crearlo dalle route reali | basso | 1 h | Solo documentazione |
| M15 | doc | `README.md` §Struttura, `docs/Stili.md`, `docs/PROJECTS.md`, `docs/backend.json` | Verificati contro il codice durante l'audit: divergono su almeno 4 punti (§5) | Correggere i punti divergenti | basso | 1 h | Solo documentazione |

---

## 3. Codice morto — evidenza

Metodo: `grep -rln "<nome>"` su `src/`, `scripts/`, `e2e/` escludendo il file
stesso, poi `grep -rE "(from|import\() *['\"][^'\"]*<nome>"` per distinguere un
**import reale** da una menzione in un commento. Per i 10 candidati: **zero import
reali**. Escluso di proposito ogni file che segue una convenzione Next
(`page`, `layout`, `route`, `error`, `loading`, `not-found`, `default`).

| File | Righe | Nominato da | È un import? |
|---|---|---|---|
| `src/ai/flows/generate-exercise-flow.ts` | 349 | 2 file, entrambi in commento | **no** |
| `src/components/partite/lineup-form-dialog.tsx` | 259 | 3 file, tutti commenti | **no** |
| `src/components/partite/full-calendar-dialog.tsx` | 332 | 1 commento | **no** |
| `src/components/giocatori/bulk-player-dialog.tsx` | 162 | 0 | **no** |
| `src/lib/repositories/attendance-repository.ts` | 15 | 0 | **no** |
| `src/lib/repositories/user-repository.ts` | 45 | 0 | **no** |
| `src/ai/tools/secure-stats-tools.ts` | 61 | 0 | **no** |
| `src/store/useTeamStore.ts` | 58 | 0 | **no** |
| `src/hooks/usePermissions.ts` | 14 | 1 commento | **no** |
| `src/components/squadra/player-card.tsx` | 3 | 0 | **no** |

**Totale: 1.298 righe**, 2,8% del repo.

### Non propongo di rimuovere (segnalati, come chiede il prompt)

- **`src/components/ui/`** — 12 file mai importati: `avatar`, `carousel`,
  `collapsible`, `menubar`, `progress`, `radio-group`, `slider`, `tooltip`.
  Componenti Shadcn generati: si segnalano, non si cancellano senza approvazione.
- **`scripts/verify-*.ts`** (8 file) e `scripts/migrate-*.ts` (2) — eseguibili a
  mano, esclusi dall'app per costruzione. **`migrate-backend-v1.ts` e
  `migrate-glows.ts` sono domande per te** (domanda 4): non decido io se un
  refactor di dati vecchi serve ancora.

---

## 4. Duplicazioni

88 cloni, 2,05% delle righe. **Nessuno raggiunge la regola del tre con un
astrazione utile**, quindi le propongo tutte come *segnalazione*, non come lavoro.

| Occorrenze | Righe | Dove | Nota |
|---|---|---|---|
| 2 | 31 | `tuttocampo-scraper.ts:238-268` ↔ `:66-98` | Stesso parsing su due percorsi dello stesso file |
| 2 | 17 | `api/admin/set-role/route.ts:3-19` ↔ `api/auth/init-user/route.ts` | Blocco verify-token + claim |
| 2 | 17 | `aggregation-repository.ts:160-176` | Interni allo stesso file |
| 2 | 15 | `goal-venue-charts.tsx:58-72` ↔ `venue-stats-charts.tsx` | **Le due carte lette dalla stessa sessione**: il fix del memo che non si invalida è passato da una e non dall'altra |
| 2 | 15 | `import-calendario-scraper-dialog.tsx:97-111` ↔ `import-tuttocampo-dialog.tsx` | Due dialog di import che si somigliano |
| 2 | 13 | `match-event-dialog.tsx:578-590` ↔ `:605-617` | Interni allo stesso file |
| 2 | 14 | `lineup-form-dialog.tsx:45-58` ↔ `match-lineup-tab.tsx` | Il primo è morto (M2) |
| 2 | 14 | `usePlayersStore.ts:149-162` ↔ `player-repository.ts` | **Stessa logica in store e repository**: i due livelli possono divergere |

### Importanti ma sotto soglia

- **`getAbsoluteMinute`**: due moduli (`stoppage-time.ts` e `player-minutes.ts`),
  due significati. È il rilievo più rischioso del repo perché il tipo è identico e
  il nome pure: un import sbagliato passa `tsc` e produce minuti sbagliati senza
  segnale. **Già commentato in entrambi i file.**
- **Elenco import non usati**: `season-repository.ts` ha 9 import Firestore non
  usati (13-15% del file), `aggregation-repository.ts` 3, `training-repository` 2.
  Pulizia a costo zero, `--noUnusedLocals` li elenca tutti.
- **File ≥300 righe**: 28. I peggiori sono `altro/page.tsx` (1.078),
  `membri/[id]/page.tsx` (913), `exercise-player-inner.tsx` (739),
  `match-event-dialog.tsx` (708).

---

## 5. Documentazione — divergenze verificate

Ho confrontato i documenti con il codice. Divergenze reali:

| Documento | Affermazione | Realtà |
|---|---|---|
| `docs/backend.json` | modello dati | **non aggiornato per `scouts`/`scoutCategories`**, spostati da `users/{uid}` a `teams/{seasonId}` |
| `README.md` §Struttura | struttura cartelle | non riflette le route `/admin`, `/admin/plans`, `/api/director`, `/api/private` |
| `docs/Stili.md` | token e pattern | solo 1.728 byte: non copre i pattern ricorrenti che il prompt chiede (empty state, dialog, card, chip) |
| `docs/PROJECTS.md` | stato funzionalità | non menziona né il ruolo direttore né la distinzione developer/direttore |
| `docs/Pages.md` | — | **il file non esiste** |

---

## 6. Aree senza test (refactor ad alto rischio)

Copertura reale: 16 suite su 289 file. Nessun test per:

| Area | Perché è rischioso | Test di caratterizzazione da scrivire **prima** |
|---|---|---|
| Import calendario (andata/ritorno) | formato federale con date `A.`/`R.`, nessun test | parser su fixture del formato reale |
| Delta test fisici | il segno dipende dall'unità (metri vs secondi): invertito, e un test sbagliato qui conferma il bug | `computeDelta` su entrambe le direzioni |
| Copertura ruoli / ruolo↔slot | la regola "il lato conta" (CS/CD) non è testata | `assertFormationInvariants` esiste già ma è solo a runtime |
| Migrazioni ruoli | `migrateRole` con fallback è stato la causa di un bugsilenzioso | identity per ogni `ALL_ROLES` |
| Ordinamenti e classifiche | `sortResults`, `getPrimaryRole` | casi limite |

---

## 7. Ordine di esecuzione consigliato

1. **M10, M11** — commento obsoleto e dichiarazioni inutilizzate. Rischio basso, e
   M10 corregge un commento che mente su una regola di dominio.
2. **Import non usati** (elencati in §4) — costo zero, nessun rischio.
3. **M3, M4, M5, M6, M7, M8, M9** — morti piccoli, zero import reali.
4. **M14, M15, M13** — documentazione.
5. **M1, M2** — morti grandi, con i commenti che li citano. Ultimi, perché sono
   gli unici dove un uso futuro possibile esiste.

Ogni passo è un commit separato con `tsc` + `jest` dopo.

---

## 8. Cosa non toccherei, e perché

- **`src/components/ui/`** — Shadcn generati. Un `git checkout` li riporta
  identici.
- **`src/app/altro/page.tsx`** (1.078 righe) — è il file più grande, ma contiene
  debug, reset dati e gestione tema: è roba di servizio che il prompt dice di non
  rimuovere, ed è anche il posto dove il caricamento dei dati è più semplice da
  rompere. **Non propongo di estrarlo**: un refactor di 1.000 righe con dentro il
  tema e i reset è esattamente il caso in cui una regressione costa più di una
  ripetizione.
- **`getAbsoluteMinute`** — duplicato pericoloso ma commentato e con due nomi
  diversi per modulo. Rinominarlo è un refactor che tocca il minutaggio: refactor
  di stabilità, non di manutenzione.
- **`verify-dont-assume-green`** e la catena Firestore — funzionano e sono
  coperti dal commento.
- **I 19 warning di lint** — preesistenti e non correlati. `no-img-element` vuol
  dire passare a `next/image`, che cambia il rendering: è un intervento a parte,
  non un refactor.

---

## 9. Domande per te

1. **Branch o no?** Il prompt ne chiede uno, il repo dice `main` diretto.
2. **`migrate-backend-v1.ts` e `migrate-glows.ts`**: si tengono come strumento
   o si buttano? Non li ho aperti nel dettaglio.
3. **12 componenti Shadcn mai usati** (`avatar`, `carousel`, `collapsible`,
   `menubar`, `progress`, `radio-group`, `slider`, `tooltip`): restano? Il prompt
   dice di non eliminarli senza approvazione, quindi chiedo.
4. **`generate-exercise-flow.ts`**: è un flow AI completo e ben scritto, 349
   righe, mai chiamato. È una feature che hai intenzione di collegare (il prompt
   vieta di toccare i prompt AI) o il lavoro è stato abbandonato?
5. **Le due analisi in `docs/`** sono superate dal codice. Le archivio, le
   aggiorno, o le lascio?
6. **`docs/Pages.md`** non esiste: lo creo?

---

## 10. Bug trovati, non corretti

- **`useMatchDetailStore.ts:317`**, commento obsoleto (M10): dice che un ingresso
  nel recupero vale 1 minuto. Il modello attuale (`player-minutes.ts`) ha
  abolito quella regola. Non è un bug di codice, ma è il tipo di commento che
  induce il prossimo a "correggere" il codice per adeguarlo al commento.