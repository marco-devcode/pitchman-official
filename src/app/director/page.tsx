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

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  Search,
  Shield,
} from 'lucide-react';

import { RoleGuard } from '@/components/auth/RoleGuard';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { initializeFirebase } from '@/firebase';

type Rosa = { nome: string; ruolo: string; infortunato: boolean };
type Osservato = { id?: string; nome: string; ruolo: string; squadra: string; note?: string };
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
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [searchScout, setSearchScout] = useState('');

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

  // Visione unificata di tutti i giocatori osservati dalle squadre condivise,
  // aggregando i tag delle squadre che tengono lo stesso profilo sotto osservazione.
  const tuttiGliOsservati = useMemo(() => {
    const map = new Map<
      string,
      {
        chiave: string;
        nome: string;
        ruolo: string;
        squadra: string;
        note: string;
        teamTags: { seasonId: string; name: string }[];
      }
    >();

    for (const s of lista) {
      for (const o of s.osservati) {
        const key = `${o.nome.trim().toLowerCase()}::${o.squadra.trim().toLowerCase()}`;
        const existing = map.get(key);
        if (existing) {
          if (!existing.teamTags.some((t) => t.seasonId === s.seasonId)) {
            existing.teamTags.push({ seasonId: s.seasonId, name: s.name });
          }
          if (!existing.note && o.note) existing.note = o.note;
        } else {
          map.set(key, {
            chiave: o.id ? `${s.seasonId}-${o.id}` : `${s.seasonId}-${key}`,
            nome: o.nome,
            ruolo: o.ruolo,
            squadra: o.squadra,
            note: o.note ?? '',
            teamTags: [{ seasonId: s.seasonId, name: s.name }],
          });
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [lista]);

  const osservatiFiltrati = useMemo(() => {
    const q = searchScout.trim().toLowerCase();
    return tuttiGliOsservati.filter((o) => {
      const matchTeam =
        teamFilter === 'all' || o.teamTags.some((t) => t.seasonId === teamFilter);
      const matchQuery =
        !q ||
        o.nome.toLowerCase().includes(q) ||
        o.ruolo.toLowerCase().includes(q) ||
        o.squadra.toLowerCase().includes(q) ||
        o.teamTags.some((t) => t.name.toLowerCase().includes(q));
      return matchTeam && matchQuery;
    });
  }, [tuttiGliOsservati, teamFilter, searchScout]);

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

        {!caricamento && lista.length > 0 && (
          <Card className="bg-card dark:bg-black/40 border-border dark:border-brand-green/30 rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between pb-3 space-y-0 p-5">
              <div>
                <CardTitle className="text-sm font-black uppercase tracking-wide flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary dark:text-brand-green" />
                  Visione Unificata Osservati ({tuttiGliOsservati.length})
                </CardTitle>
                <p className="text-[11px] font-bold text-muted-foreground mt-0.5">
                  Tutti i profili scoutati dalle tue squadre, con tag della squadra che li osserva
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={carica}
                disabled={caricamento}
                aria-label="Aggiorna osservati"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </CardHeader>

            <CardContent className="p-5 pt-0 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchScout}
                  onChange={(e) => setSearchScout(e.target.value)}
                  placeholder="Cerca per giocatore, ruolo, club o squadra..."
                  className="pl-9 h-9 text-xs font-bold rounded-xl bg-background dark:bg-black border-border dark:border-brand-green/20"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTeamFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                    teamFilter === 'all'
                      ? 'bg-primary dark:bg-brand-green text-white dark:text-black border-primary dark:border-brand-green'
                      : 'bg-background/60 dark:bg-black/40 text-muted-foreground border-border/60 dark:border-white/10'
                  }`}
                >
                  Tutte ({tuttiGliOsservati.length})
                </button>
                {lista.map((s) => (
                  <button
                    key={s.seasonId}
                    type="button"
                    onClick={() => setTeamFilter(s.seasonId)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                      teamFilter === s.seasonId
                        ? 'bg-primary dark:bg-brand-green text-white dark:text-black border-primary dark:border-brand-green'
                        : 'bg-background/60 dark:bg-black/40 text-muted-foreground border-border/60 dark:border-white/10'
                    }`}
                  >
                    {s.name} ({s.osservati.length})
                  </button>
                ))}
              </div>

              {osservatiFiltrati.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Nessun osservato trovato con i filtri correnti.
                </p>
              ) : (
                <ul className="divide-y divide-border/50 dark:divide-brand-green/10 rounded-2xl border border-border/50 dark:border-brand-green/10">
                  {osservatiFiltrati.map((o) => (
                    <li
                      key={o.chiave}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3.5 py-2.5"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-black uppercase">{o.nome}</span>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            {o.ruolo}
                            {o.squadra ? ` · ${o.squadra}` : ''}
                          </span>
                        </div>
                        {o.note && (
                          <p className="text-[10px] text-muted-foreground line-clamp-1 italic">
                            &quot;{o.note}&quot;
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 sm:justify-end">
                        {o.teamTags.map((tag) => (
                          <Badge
                            key={tag.seasonId}
                            variant="outline"
                            className="inline-flex items-center gap-1 text-[9px] font-black uppercase px-2 py-0.5 rounded-md border-primary/30 dark:border-brand-green/30 bg-primary/5 dark:bg-brand-green/10 text-primary dark:text-brand-green"
                          >
                            <Shield className="h-2.5 w-2.5" />
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
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
                          chiave: o.id ? `${s.seasonId}-${o.id}` : `${o.nome}-${o.squadra}`,
                          nome: o.nome,
                          dettaglio: o.squadra ? `${o.ruolo} · ${o.squadra}` : o.ruolo,
                          tag: s.name,
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
  righe: { chiave: string; nome: string; dettaglio: string; tag?: string; allarme?: boolean; allarmeTesto?: string }[];
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
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold">{r.nome}</span>
                {r.tag && (
                  <Badge
                    variant="outline"
                    className="text-[8px] font-black uppercase px-1.5 py-0 rounded border-primary/30 dark:border-brand-green/30 text-primary dark:text-brand-green"
                  >
                    {r.tag}
                  </Badge>
                )}
              </div>
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