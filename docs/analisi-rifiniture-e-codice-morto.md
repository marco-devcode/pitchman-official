# Analisi: ripetizioni e codice superato

Data: 2026-10-02 · branch `main` @ `4264c5a`

Analisi **in sola lettura**: nessuna riga di codice è stata modificata. Ogni
voce ha evidenza `file:line`, verificata con grep. I 10 rilievi sono quelli
trovati prima dello stop richiesto; l'analisi era ancora in corso.

---

## 1. `getMatchEndAbsolute` — codice morto

`src/lib/stoppage-time.ts:71`

Zero chiamanti in tutto `src/`. È rimasto dal modello di minutaggio
sostituito: la fine partita per i minuti ora sta in
`matchEndAbsolute(duration, stoppageActive)` dentro `player-minutes.ts`.

Pericolosità: il nome dice "fine partita" e restituisce
`durata + recupero dichiarato`, cioè **il valore opposto** a quello che il
minutaggio usa adesso. Un import futuro riporterebbe dentro il recupero.

## 2. `getPeriodDuration` — codice morto

`src/lib/stoppage-time.ts:36`

Zero chiamanti. L'unico uso è `getRegularDuration` a riga 37, che a sua volta
è morto (vedi 3).

## 3. `getRegularDuration` — codice morto

`src/lib/stoppage-time.ts:44`

Due occorrenze: la definizione e la chiamata a riga 37 dentro `getPeriodDuration`,
che non è mai chiamato. È un sottoalbero morto di 3 funzioni.

## 4. `getTotalStoppage` — codice morto

`src/lib/stoppage-time.ts:25`

Due occorrenze: definizione e chiamata a riga 72 dentro `getMatchEndAbsolute`,
morta. Idem: sottoalbero morto.

> **1, 2, 3, 4 insieme**: in `stoppage-time.ts` sopravvivono 4 funzioni senza
> un solo chiamante, tutte sullo stesso tema del minutaggio. Il file commenta
> la fine del calcolo, ma il calcolo non c'è più.

## 5. `computeTeamRecord` — codice morto + duplicato

`src/lib/aggregators/filter.ts:27`

Zero chiamanti. Duplica riga per riga `getTeamRecordFromContext` in
`aggregation-repository.ts:176`, che è la versione usata davvero
(`useStatsStore.ts:73` e `:121`). Due implementazioni dello stesso record
W/D/L con campi diversi (`matchesPlayed` incluso solo nella prima).

## 6. `computeGoalsByInterval` — codice morto + duplicato

`src/lib/aggregators/filter.ts:132`

Zero chiamanti. Duplica `getGoalsByIntervalFromContext`
(`aggregation-repository.ts:242`), usata dal live store. Divergono: la versione
morta scompone a 1/3 e 2/3 della durata, quella viva usa gli stessi limiti ma
produce chiavi diverse (`"1-30'"` vs `30/60/90`).

## 7. `getAbsoluteMinute` — stesso nome, due moduli, due significati

- `src/lib/stoppage-time.ts:90` — **morta**, 0 chiamanti
- `src/lib/player-minutes.ts:144` — **viva**, usata dal calcolo dei minuti

Nomi identici, semantica opposta: quella morta proietta il recupero **dopo**
la fine regolamentare, quella viva lavora sulla timeline somma con i blocchi
supplementari. Un `import { getAbsoluteMinute } from '@/lib/stoppage-time'`
in un file nuovo passa `tsc`, compila, e produce minuti sbagliati senza
alcun errore.

## 8. La tabella della formazione esiste in quattro copie

| Dove | Cosa |
|---|---|
| `src/components/statistiche/squad-formation-view.tsx:21` | `FORMATION_ROWS` (indici per riga) |
| `src/lib/lineup-mapping.ts:53` | `FORMATION_COORDINATES` |
| `src/lib/lineup-mapping.ts:33` | `FORMATION_POSITIONS` |
| `src/lib/types.ts:102` e `:120` | `FORMATION_ROLES` + `FORMATION_POSITIONS` (una seconda `FORMATION_POSITIONS`) |

Il file `lineup-mapping.ts:13` **documenta** che le copie devono restare
allineate a mano. Divergenza passata già (c'era un commento sul 4-3-1-2 con
ruoli sbagliati, e il 3-4-3 mancava da tre liste). Oggi l'invariante è
controllato a `lineup-mapping.ts:139` e `:193`, ma **non** su `FORMATION_ROWS`,
che ha la sua guardia a parte a `squad-formation-view.tsx:36`.

## 9. Il blocco statistiche "in campo" è duplicato

`src/app/membri/[id]/page.tsx:396-460` ≡ `src/app/membri/confronto/page.tsx:67-113`

~60 righe in entrambi, stessa struttura e già divergenti:

- entrata/uscita dal campo calcolate con `find` sulle sostituzioni
- `own_goal` trattato come gol subito in entrambi, ma con i due rami invertiti
- in `[id]` c'è `player && getPrimaryRole(player) === 'POR'`, in `confronto`
  no
- in `[id]` gli eventi sono ordinati per `minute` con `?? 0`, in `confronto`
  per `e.minute - a.minute` (crash se `minute` è `null`)

È la stessa classe di difetto di `hasPlayed`: definizione duplicata, copie
che divergono in silenzio.

## 10. `TeamRecord` definito due volte

- `src/lib/aggregators/filter.ts:21` — interfaccia del modulo morto
- `src/store/useStatsStore.ts:13` — interfaccia dello store vivo

Due forme diverse dello stesso tipo (`FullTeamRecord` in
`aggregation-repository.ts:40` è una terza). Stesso pattern per
`PlayerStatsRow` (`filter.ts:61`) e `IntervalData` (`filter.ts:126`), usati solo
dalle funzioni morte 5 e 6.

---

## In sintesi

**Codice morto vero** (nessun chiamante): 6 funzioni, concentrate in due file —
`stoppage-time.ts` (1, 2, 3, 4) e `aggregators/filter.ts` (5, 6).

**Duplicazioni attive**: 3 — `getAbsoluteMinute` (7), la tabella formazione (8),
il blocco statistiche in campo (9). Le tre sono documentate nel codice come
"devono restare allineate", il che è un modo onesto per ammettere che sono
fragili.

**Il rischio più alto non è il codice morto**: è il 7. Un nome duplicato con
semantica opposta passa il type-checker e produce minuti sbagliati senza
segnalare niente.

## Non ho analizzato

- `scripts/verify-*.ts`: eseguibili, esclusi dall'app
- la skill `pitchman-maintenance`, che è già sopravvissuta a due dei rilievi 7
  e 8
- `e2e/`, `docs/`, `scripts/*.mjs`
