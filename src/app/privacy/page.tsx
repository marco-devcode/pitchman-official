import React from 'react';
import type { Metadata } from 'next';
import { LegalPageLayout } from '@/components/legal/legal-page-layout';
import { ShieldCheck, Mail, Database, Lock, UserCheck, AlertCircle, Server } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Privacy Policy – PitchMan',
  description: 'Informativa sulla privacy e protezione dei dati personali di PitchMan ai sensi del GDPR.',
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      lastUpdated="20 maggio 2026"
      activeDoc="privacy"
    >
      {/* 1. Titolare del Trattamento */}
      <section className="space-y-3 p-5 rounded-2xl bg-card/60 dark:bg-card/20 border border-border dark:border-brand-green/20">
        <div className="flex items-center gap-2.5 text-primary dark:text-brand-green">
          <ShieldCheck className="h-5 w-5" />
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
            1. Titolare del Trattamento
          </h2>
        </div>
        <p>
          Questa informativa sulla privacy si applica alla web application <strong>PitchMan</strong>.
        </p>
        <div className="flex items-center gap-2 text-sm font-semibold p-3 rounded-xl bg-muted/50 dark:bg-black/50 border border-border/50 dark:border-brand-green/10">
          <Mail className="h-4 w-4 text-primary dark:text-brand-green shrink-0" />
          <span>Email di contatto:</span>
          <a
            href="mailto:losviluppatore@hotmail.com"
            className="text-primary dark:text-brand-green hover:underline font-bold"
          >
            losviluppatore@hotmail.com
          </a>
        </div>
      </section>

      {/* 2. Dati Raccolti */}
      <section className="space-y-4">
        <div className="flex items-center gap-2.5 text-primary dark:text-brand-green">
          <Database className="h-5 w-5" />
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
            2. Dati Raccolti
          </h2>
        </div>
        <p>Raccogliamo ed elaboriamo le seguenti categorie di dati necessari all'erogazione del servizio:</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-card/40 dark:bg-card/15 border border-border/60 dark:border-brand-green/15 space-y-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground dark:text-white">
              Dati di Registrazione
            </h3>
            <ul className="text-xs sm:text-sm space-y-1 list-disc list-inside text-muted-foreground dark:text-white/70">
              <li>Nome e cognome</li>
              <li>Indirizzo email</li>
              <li>Password (memorizzata in forma cifrata)</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-card/40 dark:bg-card/15 border border-border/60 dark:border-brand-green/15 space-y-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground dark:text-white">
              Dati del Profilo Utente / Atleta
            </h3>
            <ul className="text-xs sm:text-sm space-y-1 list-disc list-inside text-muted-foreground dark:text-white/70">
              <li>Età</li>
              <li>Ruolo (es. portiere, difensore, centrocampista, attaccante)</li>
              <li>Numero di maglia</li>
              <li>Altezza e peso</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-card/40 dark:bg-card/15 border border-border/60 dark:border-brand-green/15 space-y-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground dark:text-white">
              Dati di Gioco e Prestazione
            </h3>
            <ul className="text-xs sm:text-sm space-y-1 list-disc list-inside text-muted-foreground dark:text-white/70">
              <li>Presenze ad allenamenti e partite</li>
              <li>Gol, assist, voti e valutazioni</li>
              <li>Note tattiche e statistiche degli allenamenti</li>
              <li>Convocazioni</li>
            </ul>
          </div>

          <div className="p-4 rounded-xl bg-card/40 dark:bg-card/15 border border-border/60 dark:border-brand-green/15 space-y-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-foreground dark:text-white">
              Dati Tecnici Minimi
            </h3>
            <ul className="text-xs sm:text-sm space-y-1 list-disc list-inside text-muted-foreground dark:text-white/70">
              <li>Indirizzo IP e log di accesso</li>
              <li>Tipo di dispositivo e browser</li>
              <li>Cookie tecnici essenziali per la gestione della sessione</li>
            </ul>
          </div>
        </div>
      </section>

      {/* 3. Finalità e Base Giuridica */}
      <section className="space-y-4">
        <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
          3. Finalità e Base Giuridica del Trattamento
        </h2>
        <p>Trattiamo i dati personali esclusivamente per le seguenti finalità conformi al GDPR:</p>
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-muted/40 dark:bg-card/15 border border-border/60 dark:border-brand-green/15">
            <h4 className="font-bold text-foreground dark:text-white">
              • Esecuzione del servizio (art. 6.1.b GDPR)
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/70 mt-1">
              Gestione del profilo, monitoraggio delle prestazioni sportive, elaborazione formazioni e organizzazione delle attività della squadra.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/40 dark:bg-card/15 border border-border/60 dark:border-brand-green/15">
            <h4 className="font-bold text-foreground dark:text-white">
              • Legittimo interesse (art. 6.1.f GDPR)
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/70 mt-1">
              Sicurezza dell'infrastruttura tecnica, diagnostica, manutenzione e prevenzione di accessi non autorizzati, abusi o frodi.
            </p>
          </div>
          <div className="p-4 rounded-xl bg-muted/40 dark:bg-card/15 border border-border/60 dark:border-brand-green/15">
            <h4 className="font-bold text-foreground dark:text-white">
              • Consenso (art. 6.1.a GDPR)
            </h4>
            <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/70 mt-1">
              Invio di notifiche o comunicazioni di servizio facoltative e aggiornamenti di sistema.
            </p>
          </div>
        </div>
      </section>

      {/* 4. Condivisione dei Dati */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 text-primary dark:text-brand-green">
          <Server className="h-5 w-5" />
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
            4. Condivisione dei Dati
          </h2>
        </div>
        <p>
          I dati personali <strong>non vengono in alcun caso venduti, ceduti o noleggiati a terze parti</strong> per finalità commerciali o di marketing. I dati sono trattati esclusivamente da fornitori tecnici necessari all'erogazione del servizio:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-muted-foreground dark:text-white/70 pl-2">
          <li><strong>Fornitore di infrastruttura cloud e database:</strong> Google Firebase (hosting europeo / globale certificato).</li>
          <li><strong>Servizi di autenticazione e intelligenza artificiale:</strong> Google e Gemini API (per funzionalità di supporto analitico avanzato).</li>
        </ul>
      </section>

      {/* 5. Conservazione dei Dati */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
          5. Conservazione dei Dati
        </h2>
        <ul className="list-disc list-inside space-y-2 text-xs sm:text-sm text-muted-foreground dark:text-white/70">
          <li>
            <strong>Dati dell'account e delle prestazioni:</strong> Conservati per l'intera durata dell'utilizzo del servizio. In caso di richiesta esplicita di cancellazione dell'account o prolungata inattività, i dati vengono eliminati definitivamente entro 30 giorni.
          </li>
          <li>
            <strong>Log tecnici di accesso:</strong> Conservati temporaneamente per un massimo di 12 mesi esclusivamente per motivi di sicurezza tecnica e audit.
          </li>
        </ul>
      </section>

      {/* 6. I Tuoi Diritti (GDPR) */}
      <section className="space-y-4 p-5 rounded-2xl bg-card/60 dark:bg-card/20 border border-border dark:border-brand-green/20">
        <div className="flex items-center gap-2.5 text-primary dark:text-brand-green">
          <UserCheck className="h-5 w-5" />
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
            6. I Tuoi Diritti (GDPR)
          </h2>
        </div>
        <p className="text-xs sm:text-sm">
          Ai sensi del Regolamento UE 2016/679 (GDPR), l'utente ha diritto in qualsiasi momento di:
        </p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-muted-foreground dark:text-white/80">
          <li className="p-2.5 rounded-lg bg-muted/40 dark:bg-black/40 border border-border/40">✓ Accedere ai propri dati e richiederne una copia</li>
          <li className="p-2.5 rounded-lg bg-muted/40 dark:bg-black/40 border border-border/40">✓ Richiedere la rettifica o la cancellazione (diritto all'oblio)</li>
          <li className="p-2.5 rounded-lg bg-muted/40 dark:bg-black/40 border border-border/40">✓ Limitare o opporsi al trattamento per legittimo interesse</li>
          <li className="p-2.5 rounded-lg bg-muted/40 dark:bg-black/40 border border-border/40">✓ Richiedere la portabilità dei dati in formato strutturato (CSV)</li>
        </ul>
        <p className="text-xs text-muted-foreground dark:text-white/60">
          Hai inoltre il diritto di proporre reclamo all'autorità di controllo: Garante per la Protezione dei Dati Personali (
          <a
            href="https://www.garanteprivacy.it"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary dark:text-brand-green underline font-bold"
          >
            www.garanteprivacy.it
          </a>
          ).
        </p>
      </section>

      {/* 7. Sicurezza dei Dati */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 text-primary dark:text-brand-green">
          <Lock className="h-5 w-5" />
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
            7. Sicurezza dei Dati
          </h2>
        </div>
        <p>
          Adottiamo misure tecniche e organizzative conformi allo stato dell'arte per proteggere i dati da accessi non autorizzati, alterazioni o perdite:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-muted-foreground dark:text-white/70">
          <li>Comunicazioni protette da protocollo crittografico HTTPS (TLS).</li>
          <li>Cifratura delle credenziali e protezione a livello di regole di sicurezza database (Firebase Security Rules).</li>
          <li>Accesso amministrativo rigorosamente limitato tramite autorizzazioni su base ruolo (RBAC).</li>
        </ul>
      </section>

      {/* 8. Minori */}
      <section className="space-y-3 p-4 rounded-xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-foreground dark:text-white">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
          <AlertCircle className="h-4 w-4" />
          <h2 className="text-base font-black uppercase tracking-tight">8. Minori</h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/80">
          La piattaforma PitchMan è destinata a utenti che abbiano compiuto il <strong>18° anno di età</strong>. Non raccogliamo intenzionalmente dati di minori di 18 anni senza l'esplicito consenso e supervisione degli esercenti la potestà genitoriale.
        </p>
      </section>

      {/* 9. Modifiche alla Privacy Policy */}
      <section className="space-y-2">
        <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
          9. Modifiche alla Privacy Policy
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/70">
          Questa informativa può essere aggiornata periodicamente per riflettere modifiche normative o evoluzioni delle funzionalità della piattaforma. L'utilizzo continuativo della web app implica l'accettazione della versione vigente indicata in cima al documento.
        </p>
      </section>
    </LegalPageLayout>
  );
}
