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

## 2. `npm test` non esegue quasi niente, e la riga di riepilogo sembra un successo

`package.json:14` — `"test": "jest --passWithNoTests"`

Misurato:

```
Test Suites: 11 failed, 2 passed, 13 total
Tests:       31 passed, 31 total
```

**Undici suite su tredici non partono.** La riga `Tests: 31 passed` è l'ultima
e sembra un verde: chi scorre l'output vede un test che passa. In realtà quei 31
test sono tutti nelle due suite sopravvissute, e il repository di aggregazione —
presenze, minuti, record, quello che ho modificato quattro volte in questi giorni
— non è fra le due.

La causa è una sola e la riproduco:

```
Cannot find module '../../../../../../../../.././src/ai/flows/chatbot-flow'
  from 'src/services/ai.service.ts'
```

`src/services/ai.service.ts:3` importa `@/ai/flows/chatbot-flow`, che Jest
risolve come percorso relativo e non come alias. Tutte le suite che transitano
per quel modulo muoiono lì. Il path con otto `../` è il sintomo: è un alias
scritto a mano che regge solo finché la profondità delle cartelle non cambia.

`src/lib/repositories/aggregation-repository.test.ts` è una delle suite che
non parte. Dentro è anche un test che verifica che `true` sia `true`:

```ts
it('should have tests', () => {
    // TODO: Re-enable tests once dependency issue is resolved.
    expect(true).toBe(true);
});
```

Quindi due problemi distinti, e vanno risolti in ordine: **prima** l'alias, che
è un modulo mancante (`moduleNameMapper` in `jest.config`, o l'import relativo),
**poi** la copia vuota, che comunque non verifica niente e va cancellata finché
non si rimette.

Nota sul metodo: avevo scritto qui che "il test passa, quindi il repository
risulta coperto". È falso, e l'ho scritto prima di misurare. Il caso reale è
più grave, perché il test non parte. Mi correggo perché un'analisi con una
conclusione sbagliata in testa è peggio di un'analisi senza conclusioni.

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

**Il più serio è il 2.** Undici suite su tredici non si eseguono, e la riga di
riepilogo dice `31 passed`, che sembra un verde. Il repository di aggregazione non
è fra le due che girano, e nessuno se ne accorge perché il comando non fallisce
in modo che si noti. Il secondo è il **1**: sei permessi scritti e mai applicati,
con un sistema parallelo che funziona e che nessuno documenta.

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