"use client";

import { useEffect, useState, useCallback } from "react";
import { Shield, Users, RefreshCw, Loader2, Check, AlertTriangle } from "lucide-react";

import { RoleGuard } from "@/components/auth/RoleGuard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { initializeFirebase } from "@/firebase";
import { useAuthStore } from "@/store/useAuthStore";
import type { AccountRole } from "@/lib/types";

const RUOLI: { valore: AccountRole; etichetta: string }[] = [
  { valore: "coach", etichetta: "Allenatore" },
  { valore: "director", etichetta: "Direttore Sportivo" },
  { valore: "player", etichetta: "Giocatore" },
  { valore: "developer", etichetta: "Sviluppatore" },
];

type Utente = {
  uid: string;
  email: string;
  displayName: string;
  claimRole: string | null;
  profiloRole: string | null;
  sincronizzato: boolean;
  createdAt: string;
  lastSignedInAt: string | null;
};

/**
 * Pannello ruoli.
 *
 * `api/admin/set-role` esisteva da prima ma non aveva un chiamante: senza un
 * posto da cui assegnare un ruolo, l'unico `developer` andeva promosso a mano
 * dalla console Firebase. Questa pagina e' quel posto.
 *
 * Nota sul refresh del token: `set-role` scrive il custom claim subito, ma il
 * token che l'utente tiene in mano contiene il ruolo VECCHIO fino al prossimo
 * refresh. Dopo un cambio l'interessato resta con il ruolo precedente per
 * qualche minuto, e il pannello lo segnala: e' il motivo per cui `getIdToken`
 * va chiamato con `true` (forza il refresh) quando si rilegge il proprio ruolo.
 */
export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const [utenti, setUtenti] = useState<Utente[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [esito, setEsito] = useState<string | null>(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const firebaseUser = initializeFirebase().auth.currentUser;
      if (!firebaseUser) {
        setErrore("Sessione non trovata: accedi di nuovo.");
        return;
      }
      const token = await firebaseUser.getIdToken();
      const risposta = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const dati = await risposta.json();
      if (!risposta.ok) {
        setErrore(dati.error ?? "Errore nel caricamento degli account.");
        return;
      }
      setUtenti(dati.users ?? []);
    } catch {
      setErrore("Errore di rete.");
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    carica();
  }, [carica]);

  const cambiaRuolo = async (uid: string, ruolo: string) => {
    setInCorso(uid);
    setEsito(null);
    setErrore(null);
    try {
      const firebaseUser = initializeFirebase().auth.currentUser;
      if (!firebaseUser) {
        setErrore("Sessione non trovata: accedi di nuovo.");
        return;
      }
      const token = await firebaseUser.getIdToken();
      const risposta = await fetch("/api/admin/set-role", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ uid, role: ruolo }),
      });
      const dati = await risposta.json();
      if (!risposta.ok) {
        setErrore(dati.error ?? "Ruolo non aggiornato.");
        return;
      }
      setEsito(`Ruolo aggiornato a ${ruolo}. L'utente deve fare un nuovo login.`);
      await carica();
    } catch {
      setErrore("Errore di rete.");
    } finally {
      setInCorso(null);
    }
  };

  const fallback = (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
      <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
        <span className="text-2xl">🚫</span>
      </div>
      <h2 className="text-xl font-black uppercase tracking-tight">Accesso Negato</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        Questa sezione è riservata agli sviluppatori.
      </p>
    </div>
  );

  const disabilitati = utenti.filter((u) => !u.sincronizzato).length;

  return (
    <RoleGuard allowedRoles={['developer']} fallback={fallback}>
      <div className="space-y-6 pb-24">
        <PageHeader title="Gestione Account">
          <p className="text-xs font-bold text-muted-foreground">
            Ruoli e permessi degli utenti registrati
          </p>
        </PageHeader>

        {errore && (
          <div className="flex items-center gap-2 rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-600 dark:text-red-400">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {errore}
          </div>
        )}
        {esito && (
          <div className="flex items-center gap-2 rounded-2xl border border-green-500/40 bg-green-500/10 px-4 py-3 text-xs font-bold text-green-600 dark:text-green-400">
            <Check className="h-4 w-4 shrink-0" />
            {esito}
          </div>
        )}

        <Card className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl">
          <CardHeader className="flex flex-row items-center justify-between p-5 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Account registrati ({utenti.length})
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={carica} disabled={caricamento}>
              {caricamento ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </CardHeader>
          <CardContent className="p-5 pt-0 space-y-3">
            {caricamento && utenti.length === 0 && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Caricamento account…
              </p>
            )}

            {!caricamento && utenti.length === 0 && !errore && (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nessun account trovato.
              </p>
            )}

            {utenti.map((u) => {
              const ruoloCorrente = u.claimRole ?? u.profiloRole ?? 'coach';
              const nome = u.displayName || u.email || u.uid;
              return (
                <div
                  key={u.uid}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border dark:border-white/10 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-black truncate">{nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
                    {!u.sincronizzato && (
                      <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                        Ruolo non sincronizzato: profilo dice "{u.profiloRole ?? 'nessuno'}".
                        Si allinea al prossimo login.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {u.uid === user?.id && (
                      <Badge variant="outline" className="text-[9px] font-black uppercase">
                        <Shield className="h-3 w-3 mr-1" />
                        Tu
                      </Badge>
                    )}
                    <Select
                      value={ruoloCorrente}
                      disabled={inCorso === u.uid}
                      onValueChange={(v) => cambiaRuolo(u.uid, v)}
                    >
                      <SelectTrigger className="w-44 h-9 text-xs font-bold rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {RUOLI.map((r) => (
                          <SelectItem key={r.valore} value={r.valore} className="text-xs font-bold">
                            {r.etichetta}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {inCorso === u.uid && <Loader2 className="h-4 w-4 animate-spin" />}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {disabilitati > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {disabilitati} account con ruolo non sincronizzato. Non è un errore: il custom
            claim è già aggiornato, ma il documento Firestore si allinea al prossimo login
            dell&apos;utente.
          </p>
        )}
      </div>
    </RoleGuard>
  );
}
