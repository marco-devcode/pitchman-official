import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPageLayout } from '@/components/legal/legal-page-layout';
import { FileText, ShieldAlert, Cpu, AlertTriangle, Copyright, Mail, Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Termini e Condizioni – PitchMan',
  description: 'Termini e condizioni generali di utilizzo della web application PitchMan.',
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Termini e Condizioni di Servizio"
      lastUpdated="20 maggio 2026"
      activeDoc="termini"
    >
      {/* 1. Ambito e accettazione */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 text-primary dark:text-brand-green">
          <Scale className="h-5 w-5" />
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
            1. Ambito e Accettazione
          </h2>
        </div>
        <p>Le presenti condizioni ("Termini") regolano l'utilizzo di:</p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-muted-foreground dark:text-white/70 pl-2">
          <li>La web app <strong>PitchMan</strong> (accessibile via browser web e mobile PWA)</li>
          <li>Le componenti backend, API e i database correlati alla piattaforma</li>
        </ul>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/80 p-3.5 rounded-xl bg-card/60 dark:bg-card/20 border border-border dark:border-brand-green/20">
          Utilizzando il servizio, l'utente dichiara di aver letto, compreso e integralmente accettato i presenti Termini. In caso di mancata accettazione, l'utente è tenuto a interrompere immediatamente l'utilizzo della web app e può richiedere la cancellazione del proprio account.
        </p>
      </section>

      {/* 2. Finalità del servizio */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
          2. Finalità del Servizio
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/80">
          PitchMan è una piattaforma attualmente in fase di <strong>MVP (Minimum Viable Product)</strong> dedicata alla gestione sportiva per allenatori e staff, organizzazione di allenamenti, gestione partite, formazioni tattiche e monitoraggio delle prestazioni atletiche. Il servizio consente agli utenti registrati di creare un profilo e monitorare i dati di gioco della propria squadra.
        </p>
      </section>

      {/* 3. Requisiti dell’utente */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
          3. Requisiti dell'Utente
        </h2>
        <ul className="list-disc list-inside space-y-1.5 text-xs sm:text-sm text-muted-foreground dark:text-white/70 pl-2">
          <li>Il servizio è destinato esclusivamente a utenti di età pari o superiore a <strong>18 anni</strong>.</li>
          <li>L'utente si impegna a fornire dati di registrazione veritieri e corretti.</li>
          <li>L'utente è l'unico responsabile della custodia e della riservatezza delle proprie credenziali di accesso e delle attività svolte mediante il proprio account.</li>
        </ul>
      </section>

      {/* 4. Natura del servizio e costi */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
          4. Natura del Servizio e Costi
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/80">
          PitchMan è attualmente rilasciato in forma di <strong>MVP gratuito</strong>. L'accesso alle funzionalità presenti è fornito a titolo gratuito, salvo diverse comunicazioni future o introduzione di funzionalità e piani avanzati a pagamento. Eventuali costi di connettività internet, traffico dati o dispositivi hardware terzi restano interamente a carico dell'utente.
        </p>
      </section>

      {/* 5. Regole d'uso e responsabilità dell’utente */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 text-primary dark:text-brand-green">
          <ShieldAlert className="h-5 w-5" />
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
            5. Regole d'Uso e Responsabilità dell'Utente
          </h2>
        </div>
        <p className="text-xs sm:text-sm">L'utente si impegna formalmente a:</p>
        <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground dark:text-white/70">
          <li className="flex items-start gap-2">
            <span className="text-primary dark:text-brand-green font-bold">•</span>
            <span>Utilizzare la web app in modo lecito, civile e conforme ai presenti Termini.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary dark:text-brand-green font-bold">•</span>
            <span>Non abusare delle funzionalità (es. tentativi di scraping di dati di altri utenti, attacchi informatici, tentativi di elusione dei sistemi di autenticazione o delle regole di sicurezza).</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary dark:text-brand-green font-bold">•</span>
            <span>Non caricare contenuti offensivi, volgari, lesivi dei diritti altrui o falsi all'interno delle note, dei profili degli atleti o dei campi di testo.</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-primary dark:text-brand-green font-bold">•</span>
            <span>Non utilizzare il servizio per spam o attività illecite. L'utente è l'unico responsabile dei contenuti e dei dati inseriti.</span>
          </li>
        </ul>
      </section>

      {/* 6. Limitazioni tecniche e disponibilità (Fase MVP) */}
      <section className="space-y-3 p-4 rounded-xl bg-muted/40 dark:bg-card/20 border border-border/60 dark:border-brand-green/20">
        <div className="flex items-center gap-2 text-primary dark:text-brand-green">
          <Cpu className="h-4 w-4" />
          <h2 className="text-base font-black uppercase tracking-tight text-foreground dark:text-white">
            6. Limitazioni Tecniche e Disponibilità (Fase MVP)
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/80">
          Trattandosi di una versione MVP in fase di test pubblico:
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-muted-foreground dark:text-white/70 pl-2">
          <li>Il servizio può essere soggetto a interruzioni temporanee, bug tecnici, rallentamenti o disservizi di rete.</li>
          <li>Lo sviluppatore si riserva il diritto di modificare, aggiornare, sospendere o rimuovere funzionalità in qualsiasi momento per esigenze tecniche, evolutive o di sicurezza, senza obbligo di preavviso.</li>
        </ul>
      </section>

      {/* 7. Sospensione e chiusura dell'account */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
          7. Sospensione e Chiusura dell'Account
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/80">
          Lo sviluppatore si riserva il diritto di sospendere, limitare o eliminare definitivamente l'accesso al servizio a un utente, in qualsiasi momento e senza preavviso, in caso di violazione dei presenti Termini, comportamenti lesivi dell'infrastruttura tecnica o esigenze di sicurezza straordinaria.
        </p>
      </section>

      {/* 8. Esclusioni e limitazioni di responsabilità */}
      <section className="space-y-3 p-4 rounded-xl bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-foreground dark:text-white">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold">
          <AlertTriangle className="h-4 w-4" />
          <h2 className="text-base font-black uppercase tracking-tight">
            8. Esclusioni e Limitazioni di Responsabilità
          </h2>
        </div>
        <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground dark:text-white/80">
          <li>
            Il servizio è fornito <strong>"così com'è"</strong> e <strong>"come disponibile"</strong>, senza garanzie di alcun tipo, esplicite o implicite.
          </li>
          <li>
            Nei limiti massimi consentiti dalla legge applicabile, lo sviluppatore non risponde di danni diretti o indiretti, perdita di dati di allenamento o di gioco, interruzioni di servizio o infortuni derivanti dall'interpretazione o applicazione pratica delle metriche o dei suggerimenti tattici dell'applicazione.
          </li>
        </ul>
      </section>

      {/* 9. Proprietà intellettuale */}
      <section className="space-y-3">
        <div className="flex items-center gap-2.5 text-primary dark:text-brand-green">
          <Copyright className="h-5 w-5" />
          <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
            9. Proprietà Intellettuale
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/80">
          Il codice sorgente, l'interfaccia grafica, il marchio e logo <strong>PitchMan</strong>, i design, le icone e i contenuti originali sono di proprietà esclusiva e protetti dalle vigenti norme sul diritto d'autore e proprietà industriale. È severamente vietata la copia, la decompilazione, il reverse engineering o la distribuzione non autorizzata.
        </p>
      </section>

      {/* 10. Privacy e trattamento dati */}
      <section className="space-y-3 p-4 rounded-xl bg-card/60 dark:bg-card/20 border border-border dark:border-brand-green/20">
        <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
          10. Privacy e Trattamento Dati
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/80">
          Il trattamento dei dati personali inseriti nella web app è disciplinato dall'apposita informativa consultabile alla pagina:
        </p>
        <Link
          href="/privacy"
          className="inline-flex items-center gap-2 text-xs font-bold text-primary dark:text-brand-green hover:underline"
        >
          <FileText className="h-4 w-4" />
          <span>Consulta la Privacy Policy di PitchMan &rarr;</span>
        </Link>
      </section>

      {/* 11. Modifiche dei Termini */}
      <section className="space-y-3">
        <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
          11. Modifiche dei Termini
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/80">
          I presenti Termini possono essere aggiornati in qualsiasi momento per adeguarli a nuove funzionalità o variazioni di legge. La data in cima al documento indica la versione corrente. L'uso continuato della web app dopo una modifica equivale all'accettazione della versione aggiornata.
        </p>
      </section>

      {/* 12. Contatti */}
      <section className="space-y-3 p-4 rounded-xl bg-muted/40 dark:bg-black/40 border border-border/60 dark:border-brand-green/20">
        <div className="flex items-center gap-2 text-primary dark:text-brand-green">
          <Mail className="h-4 w-4" />
          <h2 className="text-base font-black uppercase tracking-tight text-foreground dark:text-white">
            12. Contatti e Supporto
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground dark:text-white/70">
          Per segnalazioni, domande o chiarimenti relativi ai presenti Termini, è possibile contattare lo sviluppatore all'indirizzo email:
        </p>
        <a
          href="mailto:losviluppatore@hotmail.com"
          className="inline-block text-xs sm:text-sm text-primary dark:text-brand-green hover:underline font-bold"
        >
          losviluppatore@hotmail.com
        </a>
      </section>
    </LegalPageLayout>
  );
}
