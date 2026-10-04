"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Shield, Server, RefreshCw, Loader2, AlertTriangle, Check, X,
  MessageSquare, Users, Bot, Gauge, KeyRound,
} from "lucide-react";

import { RoleGuard } from "@/components/auth/RoleGuard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { authHeaders } from "@/lib/api-client";

/**
 * Pannello developer: stato del backend.
 *
 * PERCHE' ESISTE, che sembra un pannello di troppo. Ci sono tre condizioni in
 * cui l'app sembra funzionare mentre una funzionalita' e' morta, e nessuna
 * lasciava un segnale sulla schermata:
 *
 * 1. Upstash non configurato. Il rate limit non esiste, e niente lo dice.
 * 2. `AI_ENABLED=false`. L'assistente e' spento e risponde 503.
 * 3. Admin SDK non configurato. Le route protette rispondono 500 a tutti.
 *
 * Sono condizioni che si scoprono dal pannello in trenta secondi e che si
 * scoprono dagli utenti beta, una segnalazione alla volta. Il pannello
 * esistente (admin/users) mostra solo gli account: quello rispondeva alla
 * domanda "chi c'e'", non "cosa funziona".
 *
 * Il feedback arriva qui anche perche' nella landing page si dichiara che
 * l'assistente e' il modo piu' veloce per mandare una segnalazione: senza un
 * posto dove leggerle, la dichiarazione non e' vera per nessuno.
 */

type Feedback = {
  id: string;
  type: string;
  message: string;
  route: string | null;
  appVersion: string | null;
  createdAt: string | null;
};

type Health = {
  backend: {
    adminSdk: boolean;
    rateLimit: boolean;
    aiEnabled: boolean;
    globalAiLimit: number;
    dailyLimitConfigured: boolean;
  };
  rules: { deployed: string; pending: string | null };
  counts: {
    users: number;
    invites: number;
    aiCallsLast24h: number;
    tokensLast24h: number;
    seasonCollections: number;
  };
  rateLimits: Record<string, { requests: number; window: string }>;
  feedback: Feedback[];
  generatedAt: string;
};

function Stato({ ok, buono, male }: { ok: boolean; buono: string; male: string }) {
  return ok ? (
    <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 gap-1">
      <Check className="h-3 w-3" /> {buono}
    </Badge>
  ) : (
    <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 gap-1">
      <X className="h-3 w-3" /> {male}
    </Badge>
  );
}

export default function AdminHealthPage() {
  const [dati, setDati] = useState<Health | null>(null);
  const [caricamento, setCaricamento] = useState(true);
  const [errore, setErrore] = useState<string | null>(null);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const res = await fetch("/api/admin/health", { headers: await authHeaders() });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setErrore(body?.error?.message ?? "Non riesco a leggere lo stato del backend.");
        return;
      }
      setDati(body as Health);
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore di rete.");
    } finally {
      setCaricamento(false);
    }
  }, []);

  useEffect(() => {
    void carica();
  }, [carica]);

  return (
    <RoleGuard allowedRoles={["developer"]}>
      <div className="space-y-6">
        <PageHeader title="Backend">
          <Button onClick={carica} disabled={caricamento} variant="outline" size="sm" className="gap-2">
            {caricamento ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Aggiorna
          </Button>
        </PageHeader>
        <p className="-mt-6 mb-6 text-sm text-muted-foreground">
          Stato del server: permessi, limiti, costi AI e feedback degli utenti.
        </p>

        {errore && (
          <Card className="border-destructive/40">
            <CardContent className="flex items-center gap-3 pt-6 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {errore}
            </CardContent>
          </Card>
        )}

        {!dati && !errore && (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}

        {dati && (
          <>
            {/* ── Cosa funziona ────────────────────────────────────────── */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Shield className="h-4 w-4" /> Permessi
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Firebase Admin</span>
                    <Stato ok={dati.backend.adminSdk} buono="configurato" male="assente" />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Regole attive</span>
                    <span className="font-mono text-xs">{dati.rules.deployed}</span>
                  </div>
                  {dati.rules.pending && (
                    <div className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-400">
                      <code>{dati.rules.pending}</code> non ancora pubblicata. Le regole nuove si
                      pubblicano DOPO la migrazione.
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Gauge className="h-4 w-4" /> Limiti
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Rate limit</span>
                    <Stato
                      ok={dati.backend.rateLimit}
                      buono="attivo"
                      male="disattivato (Upstash assente)"
                    />
                  </div>
                  {!dati.backend.rateLimit && (
                    <p className="text-xs text-muted-foreground">
                      Le route AI funzionano senza limite per utente. Imposta
                      {" "}<code>UPSTASH_REDIS_REST_URL</code> e{" "}
                      <code>UPSTASH_REDIS_REST_TOKEN</code>.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Tetto globale AI</span>
                    <Stato
                      ok={dati.backend.dailyLimitConfigured}
                      buono={`${dati.backend.globalAiLimit}/giorno`}
                      male="non impostato"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Bot className="h-4 w-4" /> Intelligenza artificiale
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Assistente</span>
                    <Stato ok={dati.backend.aiEnabled} buono="attivo" male="spento" />
                  </div>
                  {!dati.backend.aiEnabled && (
                    <p className="text-xs text-muted-foreground">
                      Le route AI rispondono 503. Imposta <code>AI_ENABLED=true</code>.
                    </p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Chiamate 24h</span>
                    <span className="font-medium">{dati.counts.aiCallsLast24h}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Token 24h</span>
                    <span className="font-medium">
                      {dati.counts.tokensLast24h.toLocaleString("it-IT")}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Volumi ───────────────────────────────────────────────── */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { etichetta: "Account", valore: dati.counts.users, icona: Users },
                { etichetta: "Codici invito", valore: dati.counts.invites, icona: KeyRound },
                { etichetta: "Chiamate AI 24h", valore: dati.counts.aiCallsLast24h, icona: Bot },
                { etichetta: "Collection stagione", valore: dati.counts.seasonCollections, icona: Server },
              ].map(({ etichetta, valore, icona: Icona }) => (
                <Card key={etichetta}>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icona className="h-3.5 w-3.5" /> {etichetta}
                    </div>
                    <p className="mt-2 text-2xl font-black tabular-nums">{valore}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* ── Limiti per rotta ─────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Limiti per rotta</CardTitle>
                <CardDescription>
                  I limiti valgono per utente, tranne il riscatto invito che vale anche per
                  IP.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(dati.rateLimits).map(([rotta, spec]) => (
                    <div
                      key={rotta}
                      className="flex items-center justify-between rounded-md border border-divider px-3 py-2 text-xs"
                    >
                      <span className="font-mono">{rotta}</span>
                      <span className="text-muted-foreground">
                        {spec.requests} / {spec.window}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ── Feedback ─────────────────────────────────────────────── */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4" /> Feedback recente
                </CardTitle>
                <CardDescription>
                  Le ultime {dati.feedback.length} segnalazioni. Nessun dato dei giocatori viene
                  allegato automaticamente.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {dati.feedback.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    Nessuna segnalazione.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {dati.feedback.map((f) => (
                      <div key={f.id} className="rounded-md border border-divider p-3">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <Badge variant="outline">{f.type}</Badge>
                          {f.route && <span className="font-mono text-muted-foreground">{f.route}</span>}
                          {f.createdAt && (
                            <span className="ml-auto text-muted-foreground">
                              {new Date(f.createdAt).toLocaleString("it-IT")}
                            </span>
                          )}
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{f.message}</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              Aggiornato alle {new Date(dati.generatedAt).toLocaleTimeString("it-IT")}
            </p>
          </>
        )}
      </div>
    </RoleGuard>
  );
}