'use client';

/**
 * Schermata del DIRETTORE SPORTIVO.
 *
 * Non e' la dashboard dell'allenatore, e non deve assomigliarle. Qui non ci
 * sono partite, eventi, presenze ne' test: il direttore valuta chi c'e' in una
 * squadra e chi sta osservando, e per quello bastano tre numeri e due elenchi.
 * Quello che vede e' in sola lettura e arriva tutto da `/api/director/seasons`,
 * che calcola i numeri lato server.
 *
 * I nomi dei giocatori e degli osservati ci sono di proposito: sono informazione
 * di mercato, e un direttore che non vede i nomi non puo' decidere niente.
 * Quello che NON c'e' e' il resto della stagione.
 *
 * Prima questa pagina mostrava quattro card con `--` e un feed "in fase di
 * sviluppo": numeri mai calcolati, nessun accesso a dati. Il sintomo era
 * identico a "non ci sono squadre", quindi non diceva nulla.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Eye,
  HeartPulse,
  RefreshCw,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import { RoleGuard } from '@/components/auth/RoleGuard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { initializeFirebase } from '@/firebase';

type Rosa = { nome: string; ruolo: string; infortunato: boolean };
type Osservato = { nome: string; ruolo: string; squadra: string };
type Stagione = {
  seasonId: string;
  name: string;
  rosa: Rosa[];
  totRosa: number;
  osservati: Osservato[];
  infortunati: number;
};

/**
 * Stato vuoto. NON e' un errore e non e' un accesso negato: e' la risposta
 * corretta per un direttore a cui nessun club ha ancora condiviso il codice, e
 * anche per un account che non e' direttore.
 */
function NessunaSquadra() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-muted dark:bg-white/5 flex items-center justify-center">
        <Users className="h-7 w-7 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-black uppercase tracking-tight">Nessuna squadra condivisa</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Questa schermata mostra le squadre che hanno condiviso con te il proprio
        codice di invito. Non ce n&apos;e&apos; ancora.
      </p>
      <Link href="/">
        <Button variant="ghost" className="text-primary dark:text-brand-green">
          Torna alla tua area
        </Button>
      </Link>
    </div>
  );
}

export default function DirectorDashboard() {
  const [stagioni, setStagioni] = useState<Stagione[] | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [aperta, setAperta] = useState<string | null>(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const firebaseUser = initializeFirebase().auth.currentUser;
      if (!firebaseUser) throw new Error('Sessione assente: accedi di nuovo.');
      const token = await firebaseUser.getIdToken();
      const risposta = await fetch('/api/director/seasons', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (risposta.status === 403) {
        // Non sei direttore: non e' un errore da mostrare, e' una schermata che
        // non ti riguarda. Stesso effetto di nessuna squadra.
        setStagioni([]);
        return;
      }
      const dati = await risposta.json();
      if (!risposta.ok) throw new Error(dati?.error ?? 'Squadre non disponibili.');
      setStagioni(dati.seasons as Stagione[]);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore sconosciuto.');
      setStagioni([]);
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const lista = stagioni ?? [];
  const vuoto = !caricamento && lista.length === 0 && !errore;

  return (
    <RoleGuard allowedRoles={['director']} fallback={<NessunaSquadra />}>
      <div className="space-y-6 pb-24">
        <PageHeader title="Le mie squadre">
          <p className="text-xs font-bold text-muted-foreground">
            Condivise dai club con il tuo codice
          </p>
        </PageHeader>

        {errore && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errore}</span>
          </div>
        )}

        {vuoto && <NessunaSquadra />}

        {caricamento && (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        )}

        <div className="space-y-4">
          {lista.map((s) => {
            const isAperta = aperta === s.seasonId;
            return (
              <Card
                key={s.seasonId}
                className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl"
              >
                <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
                  <CardTitle className="text-sm font-black uppercase tracking-wide">
                    {s.name}
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={carica}
                    disabled={caricamento}
                    aria-label="Aggiorna"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </CardHeader>

                <CardContent className="p-5 pt-0 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Numero
                      icona={<Users className="h-4 w-4" />}
                      valore={s.totRosa}
                      etichetta="In rosa"
                    />
                    <Numero
                      icona={<Eye className="h-4 w-4" />}
                      valore={s.osservati.length}
                      etichetta="Osservati"
                    />
                    <Numero
                      icona={<HeartPulse className="h-4 w-4" />}
                      valore={s.infortunati}
                      etichetta="Infortunati"
                      allarme={s.infortunati > 0}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    onClick={() => setAperta(isAperta ? null : s.seasonId)}
                    className="w-full justify-between border border-border/50 dark:border-brand-green/10"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {isAperta ? 'Nascondi' : 'Rosa e osservati'}
                    </span>
                    {isAperta ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>

                  {isAperta && (
                    <div className="space-y-4 pt-2">
                      <Elenco
                        titolo="Rosa"
                        vuotoMessaggio="Nessun giocatore in rosa."
                        righe={s.rosa.map((p) => ({
                          chiave: `${p.nome}-${p.ruolo}`,
                          nome: p.nome,
                          dettaglio: p.ruolo,
                          allarme: p.infortunato,
                          allarmeTesto: 'infortunato',
                        }))}
                      />
                      <Elenco
                        titolo="Osservati"
                        vuotoMessaggio="Nessun osservato."
                        righe={s.osservati.map((o) => ({
                          chiave: `${o.nome}-${o.squadra}`,
                          nome: o.nome,
                          dettaglio: o.squadra ? `${o.ruolo} · ${o.squadra}` : o.ruolo,
                        }))}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </RoleGuard>
  );
}

function Numero({
  icona,
  valore,
  etichetta,
  allarme,
}: {
  icona: React.ReactNode;
  valore: number;
  etichetta: string;
  allarme?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        allarme
          ? 'border-red-500/40 bg-red-500/5'
          : 'border-border/50 dark:border-brand-green/10'
      }`}
    >
      <div
        className={`flex items-center gap-1.5 ${
          allarme ? 'text-red-600 dark:text-red-400' : 'text-primary dark:text-brand-green'
        }`}
      >
        {icona}
        <span className="text-2xl font-black">{valore}</span>
      </div>
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">
        {etichetta}
      </div>
    </div>
  );
}

function Elenco({
  titolo,
  vuotoMessaggio,
  righe,
}: {
  titolo: string;
  vuotoMessaggio: string;
  righe: { chiave: string; nome: string; dettaglio: string; allarme?: boolean; allarmeTesto?: string }[];
}) {
  return (
    <div className="space-y-2">
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
        {titolo} ({righe.length})
      </div>
      {righe.length === 0 ? (
        <p className="text-xs text-muted-foreground">{vuotoMessaggio}</p>
      ) : (
        <ul className="divide-y divide-border/50 dark:divide-brand-green/10 rounded-2xl border border-border/50 dark:border-brand-green/10">
          {righe.map((r) => (
            <li key={r.chiave} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="text-xs font-bold">{r.nome}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                {r.dettaglio}
                {r.allarme && (
                  <span className="text-red-600 dark:text-red-400 font-black">
                    {r.allarmeTesto}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}