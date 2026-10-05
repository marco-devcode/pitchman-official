'use client';

/**
 * Piani e limiti, dal backend.
 *
 * La schermata e' VOLUTAMENTE passiva sui limiti: durante la beta non si cambia
 * un tetto da qui. Il motivo e' nella regola che gia' vale per il resto del
 * progetto — un tetto sbagliato blocca sempre nel senso che blocca chi usa il
 * prodotto per bene, e in un'app in beta un blocco non richiesto costa piu' di
 * una risorsa sprecata. Quindi qui si VEDE cosa c'e', e si cambia solo il piano
 * dell'account.
 *
 * I limiti vivono gia' nel codice (`src/lib/plans.ts`) e vengono copiati sul
 * documento stagione, perche' le Firestore rules non possono fare query su
 * un'altra collection. Qui si mostra la tabella reale, non una copia nel
 * frontend che potrebbe divergere.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CreditCard,
  RefreshCw,
  Loader2,
  AlertTriangle,
  Infinity as InfinityIcon,
  Check,
} from 'lucide-react';

import { RoleGuard } from '@/components/auth/RoleGuard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { initializeFirebase } from '@/firebase';
import { PLAN_LIMITS, normalizePlan, type PlanId } from '@/lib/plans';

const PIANI: PlanId[] = ['beta', 'free', 'coach', 'staff'];

const PIANO_LABEL: Record<PlanId, string> = {
  beta: 'Beta',
  free: 'Free',
  coach: 'Coach',
  staff: 'Staff',
};

/**
 * `Infinity` non e' un tetto e non deve sembrare un numero. Il tetto assente e'
 * `maxPlayers: Infinity` per scelta: ogni confronto con `Infinity` da' "c'e'
 * spazio", quindi non puo' essere scambiato per un tetto reale. Qui lo
 * mostriamo come "nessun tetto" perche' e' quello che significa.
 */
function Limite({ valore }: { valore: number }) {
  if (!Number.isFinite(valore)) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <InfinityIcon className="h-3 w-3" />
        nessun tetto
      </span>
    );
  }
  return <span>{valore}</span>;
}

export default function AdminPlans() {
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Il form per cambiare piano sta in `/admin/users`, dove c'e' gia' l'elenco
  // degli account. Qui non si duplica: due form per lo stesso dato sono due
  // posti dove possono divergere.
  const [aperto, setAperto] = useState(false);

  const verifica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const firebaseUser = initializeFirebase().auth.currentUser;
      if (!firebaseUser) throw new Error('Sessione assente: accedi di nuovo.');
      const token = await firebaseUser.getIdToken();
      const risposta = await fetch('/api/admin/health', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!risposta.ok) throw new Error('Stato del backend non disponibile.');
      setOk('Backend raggiungibile: tabella piani e limiti in uso.');
    } catch (e) {
      setErrore(e instanceof Error ? e.message : 'Errore sconosciuto.');
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void verifica();
  }, [verifica]);

  return (
    <RoleGuard
      allowedRoles={['developer']}
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <span className="text-2xl">🚫</span>
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight">Accesso Negato</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Questa sezione e&apos; riservata agli sviluppatori.
          </p>
        </div>
      }
    >
      <div className="space-y-6 pb-24">
        <PageHeader title="Piani e limiti">
          <p className="text-xs font-bold text-muted-foreground">
            Sorgente: <code>src/lib/plans.ts</code>
          </p>
        </PageHeader>

        {errore && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{errore}</span>
          </div>
        )}
        {ok && (
          <div className="flex items-start gap-2 rounded-2xl border border-border/50 dark:border-brand-green/20 px-4 py-3 text-xs font-bold">
            <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary dark:text-brand-green" />
            <span>{ok}</span>
          </div>
        )}

        {/* La tabella: quello che il codice applica davvero. */}
        <Card className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-sm">
                <CreditCard className="h-4 w-4 text-primary dark:text-brand-green" />
                Tabella dei piani
              </CardTitle>
              <CardDescription className="text-xs">
                I limiti vengono copiati sul documento stagione quando la stagione
                viene creata, perche&apos; le rules Firestore non possono fare
                query su un&apos;altra collection.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={verifica} disabled={caricamento}>
              {caricamento ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>

          <CardContent className="p-5 pt-0">
            <div className="rounded-2xl border border-border/50 dark:border-brand-green/10 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/50 dark:border-brand-green/10">
                    <th className="text-left p-3 font-black uppercase tracking-widest text-muted-foreground">
                      Piano
                    </th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-muted-foreground">
                      Giocatori
                    </th>
                    <th className="text-left p-3 font-black uppercase tracking-widest text-muted-foreground">
                      Membri stagione
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PIANI.map((p) => (
                    <tr key={p} className="border-b border-border/30 dark:border-brand-green/5 last:border-0">
                      <td className="p-3 font-bold">
                        {PIANO_LABEL[p]}
                        <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                          {p}
                        </span>
                      </td>
                      <td className="p-3">
                        <Limite valore={PLAN_LIMITS[p].maxPlayers} />
                      </td>
                      <td className="p-3">
                        <Limite valore={PLAN_LIMITS[p].maxMembers} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl">
          <CardHeader className="pb-2 space-y-1 p-5">
            <CardTitle className="text-sm">Dove si cambia il piano</CardTitle>
            <CardDescription className="text-xs">
              Il piano sta su <code>users/&#123;uid&#125;.plan</code>. Un account senza
              il campo non e&apos; su &quot;free&quot;: <code>normalizePlan</code> lo mappa a{' '}
              <code>{normalizePlan(undefined)}</code>, quindi un campo assente non toglie
              mai l&apos;accesso.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-5 pt-0">
            <Button
              variant="ghost"
              onClick={() => setAperto((v) => !v)}
              className="w-full border border-border/50 dark:border-brand-green/10"
            >
              {aperto ? 'Chiudi' : 'Assegna piano a un account'}
            </Button>
            {aperto && (
              <p className="mt-3 text-xs text-muted-foreground">
                L&apos;assegnazione si fa dalla pagina Account, dove c&apos;e&apos; gia&apos; l&apos;elenco
                degli utenti. Non c&apos;e&apos; un secondo form qui: due form per lo stesso dato
                sono due posti dove possono divergere.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </RoleGuard>
  );
}