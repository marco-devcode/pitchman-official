# 🗺️ PitchMan — Roadmap & Miglioramenti

> **Come leggerlo.** Questo file raccoglie esclusivamente le ottimizzazioni e le
> nuove funzionalità **ancora da sviluppare**. Le attività già completate sono
> state rimosse per mantenere la roadmap snella e allineata allo stato reale del
> codice (aggiornato al `2026-11-14`).

---

## 🟡 Ottimizzazioni & Sicurezza

- [ ] **Developer mode — Cronjob Tuttocampo**: automatizzare con un cronjob settimanale l'aggiornamento post-partita della cronaca eventi (l'import manuale di rosa e calendario è già attivo).
- [ ] **Firebase App Check**: proteggere endpoint API, quota Firestore e flussi AI tramite reCAPTCHA Enterprise e verifica client.
- [ ] **Ruolo `player` (Portale Giocatore)**: definire permessi, guard e interfaccia dedicata per gli account con `AccountRole = 'player'` (già predisposto in `src/lib/types.ts`, `src/hooks/useUserRole.ts`, `/api/admin/set-role` e `/api/private/assign-role`, ma al momento privo di viste dedicate).

---

## 🟢 Nuove Funzionalità (Roadmap)

### 💬 Assistenza & Supporto
- [ ] **Customer Assistance / Help Center AI**: ricerca su FAQ e documentazione interna con fallback a chat AI vincolata a rispondere esclusivamente su funzionamento e uso di PitchMan.

### 🏋️ Allenamenti
- [ ] **Percentuali lavoro per focus**: scheda riepilogativa con ripartizione percentuale dei minuti per focus sul totale dell'allenamento.
- [ ] **Calendario mensile allenamenti**: vista calendario con scheda del giorno e anteprima di presenze e focus (direttamente nella cella o nel pannello sottostante al click).
- [ ] **Collegamento partite ↔ allenamenti**: navigazione bidirezionale tra partita disputata, formazione utilizzata e allenamento pre-gara.
- [ ] **Editor esercizi avanzato**: creazione e generazione di esercizi tramite AI / vision e miglioramenti all'editor tattico.

### ⚽ Cronaca & Partite
- [ ] **Dettagli avanzati gol in cronaca**: freccia espandibile sui gol in cronaca per registrare punto di partenza del tiro e zona della porta in cui è entrato il pallone.

### 📊 Spogliatoio & Statistiche
- [ ] **Referto pagelle partita AI**: generazione assistita delle pagelle post-partita.
- [ ] **Export statistiche in PDF**: report stampabile di fine stagione.

### 🔧 Impostazioni, UX & Piattaforma
- [ ] **Logo squadra personalizzato**: upload del logo del club nelle impostazioni del profilo (i colori tema personalizzabili sono già presenti).
- [ ] **Auto-hide barre di navigazione**: rifinire la logica di scomparsa/comparsa di navbar e barra superiore durante scroll e flussi operativi.
- [ ] **Multi-lingua (`i18n`)**: supporto italiano/inglese tramite `next-intl`.
- [ ] **Onboarding interattivo**: tour guidato alla prima apertura dell'app.
- [ ] **Backup automatico su Cloud**: esportazione periodica programmata verso Google Cloud Storage / Drive.
- [ ] **Companion Smartwatch (WearOS / Apple Watch)**: layout leggero da polso per presenze rapide e controllo del cronometro live a bordo campo.

---

## 📋 Priorità Consigliate

| Priorità | Attività | Impatto |
|----------|----------|---------|
| 🟡 Media | Firebase App Check | Protezione API, quote AI e accesso Firestore |
| 🟡 Media | Portale ruolo `player` | Accesso dedicato in sola lettura per i calciatori della rosa |
| 🟡 Media | Export statistiche di fine stagione in PDF | Reportistica stampabile per società e dirigenti |
| 🟡 Media | Integrazione Vector Search AI per Scouting | Ricerca semantica e confronto profili osservati |
| 🟢 Bassa | Companion Smartwatch (WearOS / Apple Watch) | Operatività rapida "a bordo campo" |
| 🟢 Bassa | Generazione referto pagelle partita AI | Engagement post-gara |
