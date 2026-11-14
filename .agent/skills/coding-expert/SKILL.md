---
name: coding-expert
description: Standard avanzati di ingegneria del software, programmazione difensiva, type-safety rigorosa, refactoring e verifica continua per massimizzare la qualità ed eliminare gli errori. Da attivare per qualsiasi operazione di scrittura, modifica, debug o testing di codice.
---

# CODING EXPERT & SOFTWARE CRAFTSMANSHIP

Questo standard operativo definisce la disciplina, i pattern architetturali e i controlli di qualità necessari per produrre codice robusto, performante, privo di regressioni e allineato all'architettura di progetto.

---

## 1. Principi Guida (First Principles)

1. **Zero Assumption (Ispezione prima della scrittura)**:
   - Prima di creare o modificare file, esplora sempre i contratti esistenti, i tipi correlati e i componenti genitore/figlio.
   - Non ipotizzare mai firme di funzioni, parametri di route o strutture di store: verifica nel codice sorgente.

2. **Single Responsibility & Coerenza Architetturale**:
   - Rispetta la separazione dei livelli: UI (`src/components`), logica di servizio/dominio (`src/services`), accesso dati/repository (`src/lib/repositories`), stato globale (`src/store` o feature stores).
   - Non duplicare logica di query o stato di dominio: ogni collezione o feature ha un unico store proprietario (rif. [ARCHITECTURE.md](file:///d:/pitchman-official/docs/ARCHITECTURE.md)).

3. **Type-Safety Assoluta (Zero `any`)**:
   - È vietato l'uso di `any` arbitrari o cast ciechi (`as any`).
   - Usa Discriminated Unions e pattern esaustivi per stati complessi (es. caricamento/successo/errore).
   - **Regola obbligatoria**: Esegui un typecheck quando crei o modifichi tipi o interfacce.

4. **Programmazione Difensiva**:
   - Tratta sempre input esterni (API, form, parametri URL, Firestore) come potenzialmente incompleti o invalidi.
   - Gestisci esplicitamente stati nulli, `undefined`, timeout, race conditions e disconnessioni di rete.
   - Pulisci sempre listener, sottoscrizioni (onSnapshot, event listener) e timer negli hook di ciclo di vita (`useEffect`).

---

## 2. Flusso di Lavoro a 4 Fasi

### Fase 1: Diagnosi & Mappatura dell'Impatto
- Individua i file e le dipendenze coinvolte.
- Verifica se la modifica tocca contratti condivisi (interfacce, tipi, signature, schemi di collezioni).
- Se il task richiede modifiche alle collezioni Firestore, verifica `src/lib/season-collections.ts`.

### Fase 2: Implementazione Chirurgica
- Mantieni le modifiche atomiche, leggibili e focalizzate sullo scopo del task.
- Rispetta le convenzioni di stile del progetto (Tailwind CSS, shadcn/ui, convenzioni di denominazione).
- Utilizza il pattern standardizzato per le azioni asincrone:
  - Hook: `useAsyncAction(action)`
  - UI: `<AsyncFeedback loading={...} error={...} />`
- Nelle route Next.js 15 (App Router):
  - Ricorda che in Next.js 15 `params` e `searchParams` sono `Promise` e devono essere attesi con `await`.
  - Dichiara `'use client'` solo quando necessario (gestione stato, hook React, eventi browser).

### Fase 3: Red Team Self-Review
Prima di rilasciare la modifica, verifica:
- [ ] Ci sono memory leak o listener senza cleanup?
- [ ] Ci sono re-render non necessari? (Negli store Zustand usa selettori specifici `state => state.field`).
- [ ] La gestione degli errori restituisce un messaggio utente chiaro senza far crashare l'app?
- [ ] I confini Server/Client in Next.js sono rispettati?
- [ ] Ci sono vulnerabilità o violazioni di sicurezza (es. sanitizzazione input, autorizzazioni ruolo con `useUserRole` / `requireAuth`)?

### Fase 4: Verifica & Validazione Esecutiva
- Esegui i controlli statici e di compilazione:
  - Typecheck: `npm run typecheck` (o verifica statica TypeScript).
  - Linting: `npm run lint` se richiesto per pulizia del codice.
  - Test unitari/integrazione: `npm test` o test mirati sulle funzioni toccate.
- Se mancano prerequisiti (es. `node_modules` non installato nel runtime locale), effettua un'analisi statica manuale riga per riga per validare la coerenza dei tipi e delle firme.

---

## 3. Standard Specifici dello Stack Tecnologico

### Next.js 15 & React 19
- **Server Components per default**: Lascia i componenti come Server Component a meno che non servano interattività, state locale o event handler.
- **Parametri asincroni**: In Next.js 15, le pagine ricevono `props: { params: Promise<T> }`. Accedi sempre con `const { id } = await params;`.
- **Error Boundaries**: Assicurati che i flussi asincroni usino `useAsyncAction`, mentre gli errori di rendering siano catturati da `error.tsx` / `global-error.tsx`.

### State Management & Stores (Zustand)
- Non creare store "onniscienti" o duplicati (es. no store inutilizzati come vecchi wrapper).
- Il contesto trasversale è diviso tra `useSeasonsStore` (stagione attiva) e `useAuthStore` (utente e ruolo).
- Accedi allo store estraendo solo i campi necessari:
  ```typescript
  // CORRETTO: re-render solo quando cambia `activeSeason`
  const activeSeason = useSeasonsStore((state) => state.activeSeason);
  ```

### Firestore & Sicurezza Dati
- Non invocare query Firestore dentro loop `for` o `map`: usa `Promise.all` o batch.
- Tutte le collezioni per-stagione devono risiedere sotto `teams/{seasonId}/...` e devono essere registrate in `src/lib/season-collections.ts`.
- Le modifiche alle regole di sicurezza Firestore (`firestore.rules`) richiedono massima attenzione a non esporre permessi di scrittura a ruoli non autorizzati.

---

## 4. Checklist di Pre-Consegna
Prima di confermare un'implementazione:
1. **Sintassi & Tipi**: Zero errori TypeScript.
2. **Import puliti**: Nessun import circolare, nessun import inutilizzato.
3. **Resilienza**: Nessuna promessa non gestita (`.catch()` o `try/catch`).
4. **Tracciabilità**: File linkati con percorsi assoluti/relativi cliccabili.

---

## 5. Riferimenti Dettagliati
- [Pattern Architetturali & Convenzioni PitchMan](file:///d:/pitchman-official/.agent/skills/coding-expert/references/architecture_and_patterns.md)
- [Cheatsheet Prevenzione Errori & Anti-Pattern](file:///d:/pitchman-official/.agent/skills/coding-expert/references/error_prevention_cheatsheet.md)

