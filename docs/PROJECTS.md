# 🗺️ PitchMan — Roadmap & Miglioramenti

> **Come leggerlo.** Le voci con `[x]` sono fatte e c'è il path del codice.
> Quelle senza sono proposte. Quando una voce è già nel codice ma qui sembra
> da fare, il documento è il problema, non il lavoro: la Roadmap non è lo
> stato dell'app.
>
> **Stato verificato al 2026-10-05** contro `main` @ `668755f`.

Customer assistance in ? Research su documentazione FAQ e in ultima battuta cliccando su Non ho trovato la risposta apre chat con AI con accesso a documentazione e può rispondere solo a domande inerenti a come usare l'app e a che cosa fa l'app.

## 🔴 Bug & Fix Immediati
- [ ] **Hydration Errors nei Modali**: Con React 19 / Next.js e componenti headless (Radix UI), verificare e prevenire avvisi di mismatch HTML tra il server rendering e la visualizzazione locale.

---

## 🟡 Ottimizzazioni

### Developer mode
- Il developer ha accesso alle funzioni di import da tuttocampo con login, per rosa e calendario. Poi bisogna aggiornare la cronaca eventi, la proposta è uno scraping settimanale automatizzato con cronjob

### Sicurezza
- [ ] **Validazione password al signup** — `useAuthStore.ts` non impone requisiti minimi sulla password (lunghezza, complessità). Firebase accetta qualsiasi password ≥6 caratteri ma l'UI non guida l'utente.
- [ ] **Firebase App Check**

### Codice

- [x] **Gestione Errori Globali (Global Error Boundary)** — 6 file: `app/error.tsx`, `app/global-error.tsx` e un `error.tsx` per `allenamento`, `calendario`, `membri`, `statistiche`.
- [x] **Design Pattern "Service Layer" per l'AI** — `src/services/ai.service.ts` con test, più `stats-advanced-service.ts`. I flussi Genkit non sono più chiamati dal componente.
- [ ] **Condivisione formazione come PNG** — esiste `src/lib/lineup-share.ts` e lo usa `match-lineup-tab.tsx`, ma va verificato che l'immagine sia quella che l'allenatore si aspetta.
- [x] **Import da immagine (OCR)** — `src/lib/ai/file-extractor.ts`, usato dai flussi di import.
- [ ] **Ruolo `player`** — `AccountRole` lo dichiara, `assign-role` lo assegna e `useUserRole().isPlayer` lo calcola, ma nessuna route né nessun guard lo tratta come caso proprio: un account con quel ruolo si comporta come un coach che non ha ancora ricevuto inviti. Serve decidere cosa può vedere un giocatore.

---

## 🟢 Nuove Funzionalità
Scheda percentuali di lavoro per focus minuti/su totale allenamento.

Elabora logica quando nascondere navbar e barra sopra

Aggiungi freccia in basso dettagli aggiuntivi in cronaca: Aggiungi dove è entrato il pallone per gol
Aggiungi da dove è partito il tiro

Test toolbar vercel

Offline-first reale
Hai già IndexedDB via Dexie e sei una PWA, ma il valore si realizza solo se la formazione si può inserire e inviare anche senza connessione, con sync automatico al ritorno online. Un allenatore in uno spogliatoio spesso non ha segnale. Zustand + Dexie sono già lì — manca la logica di sync queue.

Stato disponibilità giocatori integrato nel flusso
Da membri/ gestisci la rosa, ma al momento dell'inserimento formazione probabilmente non vedi subito chi è infortunato o diffidato. Quell'informazione deve entrare dentro la schermata di formazione, non stare su un'altra pagina.

allenamenti e formazioni non si linkano tra loro (es. clicchi una partita → vedi formazione usata → vedi allenamento pre-gara)

"Formazione tipo" emergente
Analisi automatica delle ultime N partite per rilevare qual è la formazione che statisticamente hai usato di più, con quali giocatori fissi e quali variabili. Presentata come insight in statistiche in un tab 11.

Opzionale:
Visualizza gli allenamenti su un calendario con all'interno del giorno la scheda allenamento, clicca sul giorno per vedere la scheda sotto al calendario con anteprima presenza e focus oppure se riusciamo a mettere direttamente dentro al giorno questi dati.

Futuro app:
Editor esercizi
Crea esercizi con AI, addestra un vision e un replica
Modalità spogliatoio con sondaggi e questionari privati

### ⚽ Gestione Partite
- [ ] **Condivisione formazione** — Generare un'immagine PNG del layout tattico (campo con nomi) da condividere su WhatsApp/Telegram.

### 📊 Statistiche Avanzate
- [ ] **Export statistiche in PDF** — Report di fine stagione stampabile.

### 🤖 AI & Automazione
- [ ] **Import rosa da foto** — Scansione OCR di fogli presenze cartacei o liste rosa da foto, usando l'AI per estrarre nomi e ruoli.

### 📱 Mobile & PWA
- [ ] **Estensione Leggera Smartwatch** — Esplorare lo sviluppo di un mini target layout indossabile per prendere presenze on-the-go o far scattare un cronometro partita live dall'orologio da polso.

### 🔧 Impostazioni & UX
- [x] **Redesign Neon High-Viz** — Applicare il nuovo tema scuro/chiaro con i colori ufficiali del brand a tutte le schermate principali.
- [ ] **Profilo allenatore** — Aggiungere logo, colori sociali personalizzabili nelle impostazioni.
- [ ] **Multi-lingua** — L'app è tutta in italiano. Aggiungere supporto `i18n` (almeno IT/EN) con `next-intl`.
- [ ] **Onboarding automatizzato** — Tour interattivo alla prima apertura con micro-animazioni.
- [ ] **Esportazioni Dati Aggregate** — Pulsante di Export Excel / CSV immediato basato sulle tabelle statistiche, necessario per presidenti / scouting manager che preferiscono la carta.
- [ ] **Backup automatico (Cloud Scheduling)** — Esportazione periodica programmata dei database critici verso Google Cloud Storage / Drive come disaster recovery di primo livello.

---

## 🚀 Feature Rivoluzionarie (Game Changers)

### 🧩 Automazione & Campo
- [ ] **Cronometro Match con Eventi** — Gestione live della partita con tasti rapidi "Gol/Cartellino" che registrano l'ora esatta automaticamente.

### 🧠 Intelligenza Artificiale
- [ ] **AI Assistant "Best 11"** — Suggerimento automatico della formazione titolare incrociando presenze agli allenamenti e performance nelle ultime gare.

## 🛠️ Ottimizzazioni Tecniche e Architetturali

### 🎨 Design System
- [ ] **Standardizzazione Design Tokens** — Centralizzare tutti i colori neon in variabili CSS (`--brand-yellow`, etc.) per evitare duplicazioni di hex code sparsi nei componenti.

### 🏗️ Codice & Stabilità

---

## 📋 Priorità Consigliate

| Priorità | Attività | Impatto |
|----------|----------|---------|
| 🔴 Alta | Implementazione Caching (SWR/React Query) | Riduzione costi Firestore e UI responsiva |
| 🔴 Alta | Prevenzione Hydration Errors e Global Error Boundary | Resilienza PWA ed eliminazione freeze improvvisi |
| 🟡 Media | Cronometro Live e Gestione formati Export Dati | UX ad alte aspettative per direttori sportivi |
| 🟡 Media | Integrazione Vector Search AI per Scouting | Differenziazione competitiva assoluta |
| 🟡 Media | Firebase App Check | Sicurezza budget as a service |
| 🟢 Bassa | Layout companion WearOS / Apple Watch | WOW Factor / Usability "a bordo campo" |
| 🟢 Bassa | Generazione referto pagelle partita by AI | Engagement Premium / Giocatori |
