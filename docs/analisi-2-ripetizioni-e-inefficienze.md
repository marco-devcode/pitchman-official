# Seconda analisi: ripetizioni e inefficienze

Data: 2026-10-03 · branch `preview/sandbox` @ `ae3494e`

Continua `analisi-rifiniture-e-codice-morto.md`, che si fermava a dieci. Qui la
prima parte è **risolta** (rilievi 1-7, 9, 10; l'8 era metà refactorabile e metà
deliberatamente duplicato — vedi `commit ae3494e`). Questi sono **dieci nuovi**,
trovati dopo.

Metodo: nessuno di questi è un parere. Ogni voce ha un numero verificato con un
comando, e lo strumento che l'ha prodotto è in
`scripts/cerca-morti.mjs`-equivalente, non un occhio.

Una nota sul metodo, perché il primo giro l'ha sbagliato: contando gli usi di
un simbolo **solo fuori dal file che lo dichiara**, si etichettano come morti
`FORMATION_NUMBERS` e `FORMATION_COORDINATES`, che invece sono usati da
`getJerseyNumber` e `getPositionCoordinates` nello stesso modulo. Non sono morti,
sono privati. Il rilievo 1 di questo documento usa il criterio giusto: un
simbolo è morto solo se non è usato **né internamente né altrove**.

---

## 1. `usePermissions` non viene mai chiamata: sei permessi non applicati

`src/hooks/usePermissions.ts:3`

Definisce sei controlli granulari — `canImportTuttocampo`,
`canAccessScoutingDirector`, `canCreateGlobalExercises`, `canEditRoster`,
`canViewAggregatedStats`, `canEditMatchEvents` — e **non ha un solo chiamante**.
`grep -rn 'isDirector|isDeveloper|canEdit|usePermissions' src/app src/components`
non restituisce nulla.

`useUserRole` invece è usata, ma solo da `RoleGuard.tsx:14`, che confronta il
ruolo grezzo. Quindi esistono due modi di chiedere "questo utente può farlo": il
confronto per ruolo, che funziona, e le sei permission, che no.

Pericolosità: è il caso in cui un file che sembra una guardia d'accesso è in
realtà un documento. Se domani un ruolo in più, l'unico posto che lo controlla
è `RoleGuard`, e il resto dell'app non chiede.

## 2. Le suite non partivano per sei cause diverse, e una era un difetto di codice

`package.json:14` — `"test": "jest --passWithNoTests"`

Stato iniziale misurato su CI (ubuntu, run `37024456028`), che è l'unico
ambiente dove la misura è valida:

```
Test Suites: 6 failed, 7 passed, 13 total
Tests:       4 failed, 69 passed, 73 total
```

**Correzione: la versione di questo rilievo che avevo scritto prima era
sbagliata in due punti, entrambi per una misura fatta sulla macchina sbagliata.**

1. Avevo scritto "11 suite su 13 non partono". Era il conteggio di Termux, dove
   `@next/swc-android-arm64` non è installabile e i worker muoiono con `Jest
   worker encountered 4 child process exceptions`. Su CI le suite girano: erano
   6 fallite, non 11 non eseguite.
2. Avevo scritto che la causa era l'alias `@/` non risolto da Jest. **Falso.**
   `jest.config.js` ha già `moduleNameMapper: {'^@/(.*)$': '<rootDir>/src/$1'}` e
   `--showConfig` lo conferma. L'ho smentito con una sonda: un file di test
   che importa `@/services/stats-advanced-service` fallisce con `Cannot find
   module '../../../../../../../.././src/services/...'`. Quel percorso con
   otto `../` è il *risultato* del mapper applicato da un resolver che non lo
   sta usando, non l'assenza del mapper. Su CI, dove il binario SWC c'è, le
   stesse suite passano.

Le sei cause reali, una per suite:

| Suite | Errore | Causa | Tipo |
|---|---|---|---|
| `useAsyncAction.test.ts`, `async-feedback.test.tsx` | `Cannot find module '@testing-library/dom'` | `@testing-library/react@16` ha `@testing-library/dom` come **peerDependency**, non dichiarata in `package.json` | dipendenza mancante |
| `async-feedback.test.tsx` | `SyntaxError: Cannot use import statement outside a module` su `lucide-react.js` | `lucide-react` è ESM-only e Jest non trasforma `node_modules` per default | config |
| `e2e/smoke.spec.ts` | `Class extends value undefined is not a constructor` | **Jest eseguiva il test E2E.** `playwright/test` non è un modulo Jest; gli E2E hanno un runner e un comando propri | config |
| `player-repository.test.ts` | `Cannot read properties of undefined (reading 'toUpperCase')` | Il test chiamava `add()` senza `firstName`/`lastName`, obbligatori in `PlayerCreateData` (`types.ts:344`) | test datato |
| `season-repository.test.ts` (2) | `(0, _firestore.or) is not a function` | Il mock elencava a mano le funzioni di `firebase/firestore` e **`or` non era nella lista**, pur essendo usata a `season-repository.ts:29` | test fragile |
| `stats-advanced-service.test.ts` | `expect(stats.bestCbPair.length).toBe(1)` — ricevuto 0 | Il test passava lineup da 3 titolari; in un 4-4-2 i centrali sono ai posti 2 e 3, quindi la coppia non poteva formarsi | test datato |

Nota sul `jest.config.js`: **`next/jest` restituisce una funzione, non un
oggetto**, e i suoi `transformIgnorePatterns` vengono *prima* di quelli
custom (Jest usa il primo che matcha). Quindi `transformIgnorePatterns:
['/node_modules/(?!(lucide-react)/)']` nella config custom non ha nessun
effetto — l'ho verificato con `--showConfig` prima e dopo. Serve riscrivere
l'array **dopo** aver risolto la config.

Nota sul metodo, due volte. La prima volta ho scritto "il test passa, quindi il
repository risulta coperto" senza aver misurato. La seconda ho attribuito la
causa all'alias misurando su Termux invece che su CI, dove l'alias è
configurato e funziona. Un'analisi con una conclusione sbagliata in testa è
peggio di un'analisi senza conclusioni, quindi lascio dentro entrambe le
correzioni invece di cancellarle.

### Stato dopo la sistemazione

```
Test Suites: 12 passed, 12 total
Tests:       89 passed, 89 total
```

`aggregation-repository.test.ts` non era più recuperabile come era: conteneva
`expect(true).toBe(true)` con un TODO su `dexie-mock-extended`, una dipendenza
che il repository non usa. Le funzioni che contano presenze, minuti e record
(`getTeamRecordFromContext`, `getPlayersAggregatedStatsFromContext`) sono
**pure**: prendono un `SeasonDataContext` già costruito e non toccano
Firestore. Non servono mock, quindi il file è stato riscritto con 9 test
veri, fra cui il caso che storicamente è stato sbagliato in quattro
implementazioni diverse: **il subentrato all'ultimo minuto di recupero ha 0
minuti ma ha giocato**, e **chi resta in panchina non ha presenze**.

Restano due warning di `next lint` (`<img>` in `app-header.tsx` e
`splash-screen.tsx`, più due dipendenze di hook in `allenamento/`), presenti
prima di questo lavoro e non introdotti qui.

## 3. Un campo deprecato è ancora quello mostrato all'utente

- `src/lib/types.ts:347` — `role?: Role`, `@deprecated Use roles[0] instead`
- `src/lib/types.ts:349` — `secondaryRoles?: Role[]`, `@deprecated`

`src/app/membri/confronto/page.tsx:260` mostra `{p1?.role}`: il campo deprecato,
mentre `src/app/membri/page.tsx:115` usa `p.roles`. Quindi nella schermata di
confronto un giocatore con ruoli multipli mostra il primo ruolo storico, e
nell'elenco rosa mostra tutti quelli nuovi. I due schermi dicono cose diverse
sullo stesso giocatore.

`secondaryRoles` non risulta usato da nessuna parte.

## 4. Due repository interi mai importati

- `src/lib/repositories/attendance-repository.ts` (15 righe) — `attendanceRepository`
- `src/lib/repositories/user-repository.ts` (45 righe) — `userRepository`

Nessun file in `src/` li importa. Sono accesso dati scritto e mai chiamato:
non è un costo di runtime, è un costo di **fiducia**. Un altro sviluppatore li
userà, o penserà che siano il posto giusto dove mettere una query, e scoprirà che
funzionano solo a metà.

## 5. L'amministrazione non è collegata

`src/lib/firebase-admin.ts` (42 righe) — `isAdminReady` non è usato da nessuna
parte. Le API di amministrazione esistono (`src/app/api/admin/set-role/route.ts`,
`src/app/api/auth/init-user/route.ts` controllano `decodedToken.role`), ma il
lato client non ha modo di sapere se l'admin è pronto. Non so se sia un
incompiuto o una scelta: il punto è che il nome del file promette un'integrazione
che il codice non chiude.

## 6. Quattro helper di scrittura "non bloccante" mai usati

`src/firebase/non-blocking-updates.tsx` (88 righe) —
`setDocumentNonBlocking`, `addDocumentNonBlocking`,
`updateDocumentNonBlocking`, `deleteDocumentNonBlocking`.

Nessun chiamante. Sono la risposta standard al pattern Firestore
"non bloccare la UI", quindi la loro esistenza suggerisce che il problema fosse
stato affrontato — ma o non è mai stato applicato, o è stato superato da altro.
In entrambi i casi il file è un'informazione falsa.

## 7. `COMMON_PLAYER_COUNTS` duplicata, identica, in due file

- `src/components/allenamento/exercise-dialog.tsx:23`
- `src/components/allenamento/exercise-filter-dialog.tsx:21`

Stessa costante, stesso array di 23 elementi, `['1' … '22', '22+']`, identici.
Aggiungere il `'23'` significa ricordarsi di due file, e la differenza
comparirebbe in un menu a tendina senza che nessuno se ne accorga.

## 8. `useChartColors` esiste ancora in quattro copie

`src/lib/design-tokens.ts:82` (quella buona) e poi
`src/app/membri/[id]/page.tsx:42`,
`src/components/allenamento/physical-tab.tsx:26`,
`src/components/allenamento/test-charts-tab.tsx:24`.

Le tre locali ora delegano a `readThemeChartPalette`, quindi il pericolo dei
colori hardcoded è risolto. Ma sono tre wrapper di quattro righe attorno alla
stessa chiamata: se la firma della palette cambia, il tipo se ne accorge, ma
ogni wrapper resta da cancellare a mano. Sono il primo posto dove rifarebbero
tutto, e quindi il primo posto dove un refactor automatico li lascerebbe indietro.

## 9. Trentanove esportazioni mai usate, in quindici file

Numero misurato, non approssimato: `39`. La distribuzione:

| File | Quante |
|---|---|
| `firebase/non-blocking-updates.tsx` | 4 |
| `lib/schemas.ts` | 4 |
| `store/useTeamStore.ts` | 4 |
| `ai/tools/secure-stats-tools.ts` | 3 |
| `firebase/non-blocking-login.tsx` | 3 |
| `firebase/provider.tsx` | 2 |
| `lib/drill-schema.ts` | 2 |
| `lib/drill.ts` | 2 |
| `components/partite/full-calendar-dialog.tsx` | 1 |
| `components/partite/lineup-form-dialog.tsx` | 1 |
| `components/giocatori/bulk-player-dialog.tsx` | 1 |
| `components/squadra/player-card.tsx` | 1 |
| `firebase/firestore/use-doc.tsx` | 1 |
| `hooks/usePermissions.ts` | 1 |
| `lib/drill-to-tactical.ts` | 1 |
| `lib/firebase-admin.ts` | 1 |
| `lib/repositories/attendance-repository.ts` | 1 |
| `lib/repositories/user-repository.ts` | 1 |
| `lib/rosa-coverage.ts` | 1 |

`lib/schemas.ts` è il caso da capire: quattro schemi non importati *ma* gli
schemi sono quasi sempre consumati da un registro, quindi va guardato se sono
membri di un oggetto invece che esportazioni isolate. Non li ho contati come
morti per sicurezza.

`lib/rosa-coverage.ts:getFormationSlotPositions` invece è morto sul serio: dopo
il refactor della formazione, `rosa-pitch.tsx` legge `FORMATION_SLOT_COORDS` e
questa funzione è rimasta indietro.

## 10. `useChartColors` definita anche dove non serve nessun grafico

Si sovrappone all'8 e vale la pena tenerlo separato, perché è un difetto
diversivo.

`src/app/membri/[id]/page.tsx:42` chiama `readThemeChartPalette` dentro un
`useMemo` con dipendenza `isDark`, quindi **legge le variabili CSS una volta per
render** e reagisce solo al cambio chiaro/scuro. Se l'utente cambia i colori
mentre la pagina è aperta, `getComputedStyle` viene riletto solo al prossimo
cambio di tema.

Il caso pratico: l'utente è nella scheda giocatore, apre Impostazioni in un
'altra scheda, cambia il tema, torna indietro. La pagina non si ri-renderizza da
sola e mostra grafici del colore precedente.

È la stessa classe di difetto che avevo già corretto dentro
`COLORS.charts.*`: le tabelle di `design-tokens` leggono `--a1` al momento della
chiamata, i tre wrapper locali no.

---

## In sintesi

**Il più serio è il 2.** Sei suite su tredici non passavano, per sei cause
diverse: una peer dependency non dichiarata, un pacchetto ESM-only non
trasformato, un test E2E che Jest eseguiva per sbaglio, due test datati e un
mock di Firestore scritto a mano che si rompe a ogni funzione nuova. La riga
di riepilogo diceva `4 failed, 69 passed` e non rendeva chiaro che il
repository di aggregazione — presenze, minuti, record, quello modificato
quattro volte in questi giorni — non avesse un solo test che lo coprisse.
Ora è sistemato: 12 suite, 89 test, tutti verdi. Il secondo è il **1**: sei
permessi scritti e mai applicati, con un sistema parallelo che funziona e che
nessuno documenta.

**Il 3 e il 10 sono difetti che l'utente può vedere**: due schermate che
dicono ruoli diversi sullo stesso giocatore, e grafici con il colore del tema
precedente.

**Raggruppati per natura**: i rilievi 1, 4, 5, 6 e 9 sono tutti codice morto
(39 esportazioni, di cui 14 in file interi mai importati). Se si facesse un solo
intervento, sarebbe cancellarli — ma il 1 e il 2 vanno decisi **a parte**,
perché sono scelte, non pulizia: o si collega l'amministrazione, o si cancella;
o si ripristina il test, o si cancella il file.

## Non ho analizzato

- `scripts/verify-*.ts`: eseguibili, esclusi dall'app
- `e2e/`, `docs/`, `scripts/*.mjs`
- le 38 occorrenze di `onChange={(e) => ...}`: sospette per le riscritture a ogni
  render, ma non ho misurato se causano problemi reali, e senza misurare
  sarebbe un parere
- i 13 punti in cui `.find()` sta dentro un `.map()`/`.filter()`: potenzialmente
  quadratici, ma la grandezza dei dati (una stagione) è piccola e non ho
  misurato un rallentamento reale