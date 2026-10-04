"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPlus, Copy, Check, Ban, Crown, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { authHeaders } from "@/lib/api-client";

/**
 * Pannello Staff: chi partecipa alla stagione e come farne entrare altri.
 *
 * ESISTE PERCHE' SENZA DI ESSO NON SI PUO' CONDIVIDERE. Il join passa da
 * `POST /api/invites/redeem`, che richiede un documento in `invites`; nessun
 * client puo' crearlo (le regole dicono `allow read, write: if false`), quindi
 * l'unica via e' questo pulsante. Prima esisteva solo "inserisci codice": si
 * aveva un codice, non lo si poteva creare.
 *
 * DUE RUOLI, E NON SONO LA STESSA COSA.
 *
 * Il ruolo nella STAGIONE (`owner` / `staff`) decide chi vede i dati di questa
 * squadra, e sta nel documento della stagione. Il ruolo APPLICATIVO (`coach`,
 * `director`, `developer`) e' un permesso dell'app — pannello admin, strumenti —
 * e sta in `users/{uid}.role`. Un allenatore puo' essere staff di una squadra e
 * non avere nessuno dei due, e va benissimo: non gli serve amministrare
 * l'app, gli serve vedere i numeri della squadra.
 *
 * Il codice si mostra una volta sola, subito dopo la creazione, con un bottone
 * per copiarlo: e' il momento in cui serve. Nella lista sotto restano i codici
 * ancora attivi, per revocarli.
 */

type MioRuolo = "owner" | "staff" | null;

type Membro = {
  uid: string;
  role: "owner" | "staff" | null;
  displayName?: string;
  email?: string;
};

type Invito = {
  code: string;
  expiresAt: string;
  maxUses: number;
  usedCount: number;
  remainingUses: number;
  expired: boolean;
  legacy: boolean;
};

export function StaffPanel({ seasonId }: { seasonId: string }) {
  const [mioRuolo, setMioRuolo] = useState<MioRuolo>(null);
  const [mioUid, setMioUid] = useState<string | null>(null);
  const [membri, setMembri] = useState<Membro[]>([]);
  const [inviti, setInviti] = useState<Invito[]>([]);
  const [caricamento, setCaricamento] = useState(true);
  const [creando, setCreando] = useState(false);
  const [inCorso, setInCorso] = useState<string | null>(null);
  const [errore, setErrore] = useState<string | null>(null);
  const [nuovoCodice, setNuovoCodice] = useState<string | null>(null);
  const [copiato, setCopiato] = useState(false);

  const carica = useCallback(async () => {
    setCaricamento(true);
    setErrore(null);
    try {
      const res = await fetch(`/api/seasons/${encodeURIComponent(seasonId)}/members`, {
        headers: await authHeaders(),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setErrore(body?.error?.message ?? "Non riesco a leggere lo staff.");
        return;
      }
      setMembri(body.members ?? []);
      setMioRuolo(body.myRole ?? null);
      // Il proprio uid serve per "Esci dalla stagione". Nessuna altra callata
      // lo chiede: la lista dei membri contiene gia' il documento di chi guarda.
      const proprio = (body.members ?? []).find(
        (m: Membro) => m.uid === body.mioUid,
      );
      setMioUid(proprio?.uid ?? null);

      // I codici si chiedono solo all'owner: la rotta risponderebbe 403 a uno
      // staff, e una lista vuota sembrerebbe "non ci sono codici" invece di
      // "non puoi vederli".
      if (body.myRole === "owner") {
        const resInv = await fetch(`/api/seasons/${encodeURIComponent(seasonId)}/invites`, {
          headers: await authHeaders(),
        });
        const bodyInv = await resInv.json().catch(() => null);
        if (resInv.ok) setInviti(bodyInv.invites ?? []);
      }
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Errore di rete.");
    } finally {
      setCaricamento(false);
    }
  }, [seasonId]);

  useEffect(() => {
    void carica();
  }, [carica]);

  const creaCodice = async () => {
    setCreando(true);
    setErrore(null);
    try {
      const res = await fetch(`/api/seasons/${encodeURIComponent(seasonId)}/invites`, {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ role: "staff" }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setErrore(body?.error?.message ?? "Non riesco a creare il codice.");
        return;
      }
      setNuovoCodice(body.code);
      void carica();
    } finally {
      setCreando(false);
    }
  };

  const revoca = async (code: string) => {
    setInCorso(code);
    setErrore(null);
    try {
      const res = await fetch(
        `/api/seasons/${encodeURIComponent(seasonId)}/invites/${encodeURIComponent(code)}`,
        { method: "DELETE", headers: await authHeaders() },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setErrore(body?.error?.message ?? "Non riesco a revocare il codice.");
        return;
      }
      void carica();
    } finally {
      setInCorso(null);
    }
  };

  const rimuovi = async (uid: string) => {
    setInCorso(uid);
    setErrore(null);
    try {
      const res = await fetch(
        `/api/seasons/${encodeURIComponent(seasonId)}/members/${encodeURIComponent(uid)}`,
        { method: "DELETE", headers: await authHeaders() },
      );
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setErrore(body?.error?.message ?? "Non riesco a rimuovere il membro.");
        return;
      }
      void carica();
    } finally {
      setInCorso(null);
    }
  };

  /**
   * Uscire dalla stagione = rimuoversi dalla squadra.
   *
   * La prima versione faceva una `GET /members` per scoprire il proprio uid e poi
   * chiamava `rimuovi`: due richieste e un test che poteva passare sbagliando.
   * `GET /members` restituisce gia' `myRole`, quindi basta chiedere il proprio
   * uid insieme. Piu' semplice, e il comportamento non dipende da quale membro
   * capita per primo nella lista.
   */
  const esci = async (mioUid: string) => {
    await rimuovi(mioUid);
  };

  const copia = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 2000);
  };

  const nome = (m: Membro) => m.displayName || m.email || "Utente";

  if (caricamento) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errore && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {errore}
        </div>
      )}

      {/* ── Il codice appena creato: si mostra una volta sola ─────────── */}
      {nuovoCodice && (
        <Card className="border-brand-green/40 bg-brand-green/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Manda questo codice a chi deve entrare</CardTitle>
            <CardDescription>
              Vale per una persona. Scade tra 7 giorni.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-background px-3 py-2 text-center text-lg font-black tracking-widest">
                {nuovoCodice}
              </code>
              <Button size="icon" variant="outline" onClick={() => copia(nuovoCodice)} aria-label="Copia">
                {copiato ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full"
              onClick={() => { setNuovoCodice(null); setCopiato(false); }}
            >
              Chiudi
            </Button>
          </CardContent>
        </Card>
      )}

      {/* ── Chi partecipa ─────────────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4" /> Staff ({membri.length})
          </CardTitle>
          <CardDescription>
            Chi vede i dati di questa squadra. Il ruolo nell'app è un'altra cosa.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {membri.map((m) => (
            <div key={m.uid} className="flex items-center gap-2 rounded-md border border-divider px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{nome(m)}</p>
                <p className="truncate text-xs text-muted-foreground">{m.uid}</p>
              </div>
              {m.role === "owner" ? (
                <Badge className="gap-1 bg-brand-green/15 text-brand-green">
                  <Crown className="h-3 w-3" /> Owner
                </Badge>
              ) : (
                <Badge variant="outline">Staff</Badge>
              )}
              {mioRuolo === "owner" && m.role !== "owner" && (
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={inCorso === m.uid}
                  onClick={() => rimuovi(m.uid)}
                  aria-label={`Rimuovi ${nome(m)}`}
                >
                  {inCorso === m.uid ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Ban className="h-4 w-4" />
                  )}
                </Button>
              )}
            </div>
          ))}

          {mioRuolo === "staff" && mioUid && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2 w-full"
              disabled={inCorso === mioUid}
              onClick={() => esci(mioUid)}
            >
              Esci da questa stagione
            </Button>
          )}
        </CardContent>
      </Card>

      {/* ── Codici — solo l'owner ─────────────────────────────────────── */}
      {mioRuolo === "owner" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Codici d&apos;invito</CardTitle>
            <CardDescription>
              Un codice fa entrare una persona. Chi entra può vedere i dati della squadra.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button onClick={creaCodice} disabled={creando} className="w-full gap-2">
              {creando ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Crea codice invito
            </Button>

            {inviti.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">
                Nessun codice attivo.
              </p>
            ) : (
              inviti.map((i) => (
                <div key={i.code} className="flex items-center gap-2 rounded-md border border-divider px-3 py-2">
                  <code className="flex-1 font-mono text-sm font-bold tracking-wider">{i.code}</code>
                  {i.legacy && (
                    <Badge variant="outline" className="text-[10px]">
                      vecchio
                    </Badge>
                  )}
                  {i.expired ? (
                    <Badge variant="outline" className="text-[10px]">scaduto</Badge>
                  ) : i.remainingUses > 0 ? (
                    <Badge className="bg-brand-green/15 text-[10px] text-brand-green">
                      {i.remainingUses} {i.remainingUses === 1 ? "posto" : "posti"}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">usato</Badge>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={inCorso === i.code}
                    onClick={() => revoca(i.code)}
                    aria-label={`Revoca ${i.code}`}
                  >
                    {inCorso === i.code ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Ban className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}