'use client';

/**
 * Home del BACKEND: la schermata che vede il developer e nessun altro.
 *
 * Non e' la dashboard di squadra, e non deve diventarlo. Il developer non ha
 * una squadra: niente rosa, niente calendario, niente allenamenti, perche'
 * ogni schermata di gestione lo inviterebbe a creare dati che nessuno
 * consulta. Qui si entra solo per amministrare: assegnare ruoli, controllare
 * che il backend sia vivo, gestire i piani.
 *
 * Le tre sezioni rispondono alle tre domande che ti fai guardando un'app in
 * beta: chi c'e', cosa funziona, e quanto mi costa.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Shield,
  Users,
  Server,
  CreditCard,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Check,
  ChevronRight,
} from 'lucide-react';

import { RoleGuard } from '@/components/auth/RoleGuard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { initializeFirebase } from '@/firebase';

type Utente = {
  uid: string;
  email: string;
  claimRole: string | null;
  profiloRole: string | null;
  plan: string | null;
  sincronizzato: boolean;
};

const RUOLO_LABEL: Record<string, string> = {
  developer: 'Sviluppatore',
  director: 'Direttore Sportivo',
  coach: 'Allenatore',
  player: 'Giocatore',
};

/**
 * Fallback della guardia: qui non e' decorativo.
 *
 * Un developer che ha perso il ruolo e rimane su `/admin` vedeva la pagina
 * vuota e poteva pensare che l'app fosse rotta. Il messaggio nomina la causa
 * ("non sei sviluppatore") e la via d'uscita.
 */
function AccessoNegato() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
        <span className="text-2xl">🚫</span>
      </div>
      <h2 className="text-xl font-black uppercase tracking-tight">Accesso Negato</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Questa sezione e' riservata agli sviluppatori. Il tuo account non ha il ruolo
        richiesto: nessun dato e' stato letto.
      </p>
      <Link href="/">
        <Button variant="ghost" className="text-primary dark:text-brand-green">
          Torna alla tua area
        </Button>
      </Link>
    </div>
  );
}

export default function AdminHome() {
  const [utenti, setUtenti] = useState<Utente[] | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const firebaseUser = initializeFirebase().auth.currentUser;
      if (!firebaseUser) throw new Error('Sessione assente: accedi di nuovo.');
      const token = await firebaseUser.getIdToken();
      const risposta = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dati = await risposta.json();
      if (!risposta.ok) throw new Error(dati?.error ?? 'Elenco account non disponibile.');
      setUtenti(dati.users as Utente[]);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore sconosciuto.');
      setUtenti([]);
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  const conta = (predicato: (u: Utente) => boolean) => (utenti ?? []).filter(predicato).length;
  const nonSincronizzati = conta((u) => !u.sincronizzato);
  const direttori = conta((u) => (u.profiloRole ?? u.claimRole) === 'director');
  const senzaPiano = conta((u) => !u.plan);

  return (
    <RoleGuard allowedRoles={['developer']} fallback={<AccessoNegato />}>
      <div className="space-y-6 pb-24">
        <PageHeader title="Backend">
          <p className="text-xs font-bold text-muted-foreground">Amministrazione</p>
        </PageHeader>

        {/* ── Sezione 1: PERMESSI ── */}
        <Card className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-primary dark:text-brand-green" />
                Permessi
              </CardTitle>
              <CardDescription className="text-xs">
                Chi puo' fare cosa. Il developer si assegna da console Firebase, il
                direttore arriva da richiesta privata.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={carica} disabled={caricamento}>
              {caricamento ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-4">
            {errore && (
              <div className="flex items-start gap-2 text-xs text-red-600 dark:text-red-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{errore}</span>
              </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Account" value={utenti?.length ?? 0} />
              <Metric label="Direttori" value={direttori} />
              <Metric label="Da sincronizzare" value={nonSincronizzati} />
              <Metric label="Senza piano" value={senzaPiano} />
            </div>

            {nonSincronizzati > 0 && (
              <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  {nonSincronizzati} account con claim e profilo diversi: l'app mostra
                  un ruolo e le rules ne applicano un altro. Si risolve accedendo
                  una volta, che fa propagare il claim al documento.
                </span>
              </div>
            )}

            <Link href="/admin/users">
              <Button
                variant="ghost"
                className="w-full justify-between border border-border/50 dark:border-brand-green/10"
              >
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary dark:text-brand-green" />
                  Gestisci account e ruoli
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* ── Sezione 2: VERIFICHE ── */}
        <Card className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl">
          <CardHeader className="pb-2 space-y-1 p-5">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Server className="h-4 w-4 text-primary dark:text-brand-green" />
              Verifiche
            </CardTitle>
            <CardDescription className="text-xs">
              Permessi, limiti per rotta, costi AI e feedback.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Link href="/admin/health">
              <Button
                variant="ghost"
                className="w-full justify-between border border-border/50 dark:border-brand-green/10"
              >
                <span className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary dark:text-brand-green" />
                  Stato del backend
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* ── Sezione 3: PIANI ── */}
        <Card className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl">
          <CardHeader className="pb-2 space-y-1 p-5">
            <CardTitle className="flex items-center gap-2 text-sm">
              <CreditCard className="h-4 w-4 text-primary dark:text-brand-green" />
              Piani a pagamento
            </CardTitle>
            <CardDescription className="text-xs">
              In beta tutti gli account sono su <code>beta</code>: nessun tetto sui
              giocatori, massimo 5 membri per stagione.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Link href="/admin/plans">
              <Button
                variant="ghost"
                className="w-full justify-between border border-border/50 dark:border-brand-green/10"
              >
                <span className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-primary dark:text-brand-green" />
                  Gestisci piani e limiti
                </span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border/50 dark:border-brand-green/10 p-3">
      <div className="text-2xl font-black">{value}</div>
      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mt-1">
        {label}
      </div>
    </div>
  );
}