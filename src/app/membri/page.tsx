"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { PlusCircle, Edit, Trash2, ChevronUp, ChevronDown, Sparkles, Search, Plus, ChevronRight, Globe, Hospital, Save, Users, Frame, Shield, Network, TrendingUp } from "lucide-react";
import type { Player, Role, PlayerRole, RoleCategory } from "@/lib/types";
import type { PlayerCreateData } from "@/lib/repositories/player-repository";
import { useAuthStore } from "@/store/useAuthStore";
import { migrateRole, getPrimaryRole, ROLE_CATEGORIES } from "@/lib/types";
import dynamic from "next/dynamic";

const PlayerFormDialog = dynamic(() => import("@/components/squadra/player-form-dialog").then(mod => mod.PlayerFormDialog), { ssr: false });
const SmartPlayerDialog = dynamic(() => import("@/components/giocatori/smart-player-dialog").then(mod => mod.SmartPlayerDialog), { ssr: false });
const ImportTuttocampoDialog = dynamic(() => import("@/components/squadra/import-tuttocampo-dialog").then(mod => mod.ImportTuttocampoDialog), { ssr: false });
const InjuryFormDialog = dynamic(() => import("@/components/squadra/injury-form-dialog").then(mod => mod.InjuryFormDialog), { ssr: false });
import { FaUserSecret } from "react-icons/fa";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePlayersStore } from "@/store/usePlayersStore";
import { useSeasonsStore } from "@/store/useSeasonsStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn, displayPlayerName } from "@/lib/utils";
import { ErrorState } from "@/components/ui/error-state";
import { parseError, missingSeasonError } from "@/lib/error-utils";

/**
 * Ripartizione della rosa in quattro box di conteggio.
 *
 * Solo informative, non filtrano la lista: e' un riepilogo di come e' fatta la
 * squadra, non un navigatore. Le sigle sono abbreviazioni di ruolo diverse da
 * quelle del modello dati (DC, TD, CDC, AS...), quindi qui compaiono solo i
 * ruoli generali: la sigla precisa sta nella lista, a destra.
 */
const RIEPILOGO: { sigla: string; cat: RoleCategory; colore: string; Icone: typeof Frame; lettera: string }[] = [
  // Frame e' un rettangolo semplice, e serve per la porta vista frontalmente.
  // NON usare Goal: in lucide e' un bersaglio con una freccia, cioe' un
  // bersaglio, non una porta. Shield per la difesa, Network per il centrocampo
  // (il nodo da cui escono i passaggi), TrendingUp per l'attacco.
  // lettera: la sigla del badge nella lista. Scritta per esteso invece di
  // sigla[0], perche' la prima lettera funziona solo per caso: se un giorno
  // una sigla cominciasse con un'altra lettera, il badge mostrerebbe la sigla
  // sbagliata senza che nessuno se ne accorga.
  { sigla: 'POR', cat: 'POR', colore: 'amber', Icone: Frame, lettera: 'P' },
  { sigla: 'DIF', cat: 'DIF', colore: 'emerald', Icone: Shield, lettera: 'D' },
  { sigla: 'CEN', cat: 'CEN', colore: 'blue', Icone: Network, lettera: 'C' },
  { sigla: 'ATT', cat: 'ATT', colore: 'rose', Icone: TrendingUp, lettera: 'A' },
];

const STILE_BOX: Record<string, { box: string; testo: string; badge: string }> = {
  amber:   { box: 'bg-amber-500/10 dark:bg-amber-500/10 border-amber-500/30',   testo: 'text-amber-600 dark:text-amber-400',   badge: 'bg-amber-500/20 text-amber-600 dark:text-amber-400' },
  emerald: { box: 'bg-emerald-500/10 dark:bg-emerald-500/10 border-emerald-500/30', testo: 'text-emerald-600 dark:text-emerald-400', badge: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' },
  blue:    { box: 'bg-blue-500/10 dark:bg-blue-500/10 border-blue-500/30',      testo: 'text-blue-600 dark:text-blue-400',      badge: 'bg-blue-500/20 text-blue-600 dark:text-blue-400' },
  rose:    { box: 'bg-rose-500/10 dark:bg-rose-500/10 border-rose-500/30',       testo: 'text-rose-600 dark:text-rose-400',       badge: 'bg-rose-500/20 text-rose-600 dark:text-rose-400' },
};

export default function RosaPage() {
  const router = useRouter();
  const { players, loading: playersLoading, error: playersError, fetchAll, add, update, remove, bulkAdd, removeAll } = usePlayersStore();
  const { activeSeason, loading: seasonsLoading, error: seasonsError, fetchAll: fetchSeasons } = useSeasonsStore();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSmartFormOpen, setIsSmartFormOpen] = useState(false);
  const [isImportTuttocampoOpen, setIsImportTuttocampoOpen] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [playerToDelete, setPlayerToDelete] = useState<Player | null>(null);
  const [isDeleteAllOpen, setIsDeleteAllOpen] = useState(false);
  const [isInjuryFormOpen, setIsInjuryFormOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isEditMode, setIsEditMode] = useState(false);

  const loading = playersLoading || seasonsLoading;

  useEffect(() => {
    const initialize = async () => {
      await fetchSeasons();
      fetchAll();
    };
    initialize();
  }, [fetchAll, fetchSeasons]);

  const handleOpenForm = (player: Player | null) => {
    setSelectedPlayer(player);
    setIsFormOpen(true);
  };

  const handleSavePlayer = async (data: { name: string, firstName: string, lastName: string, roles: PlayerRole[] }, playerId?: string) => {
    if (playerId) {
      await update(playerId, data);
    } else {
      await add(data);
    }
  };

  const handleSmartSavePlayers = async (playersData: { name: string, roles: PlayerRole[] }[]) => {
    const user = useAuthStore.getState().user;
    const activeSeason = useSeasonsStore.getState().activeSeason;
    if (!user || !activeSeason) return;
    const mapped: PlayerCreateData[] = playersData.map(p => ({
      name: p.name,
      firstName: p.name.split(' ')[0] || p.name,
      lastName: p.name.split(' ').slice(1).join(' ') || '',
      roles: p.roles,
      seasonId: activeSeason.id,
      userId: user.id,
    }));
    await bulkAdd(mapped);
  };

  const handleDeletePlayer = async () => {
    if (!playerToDelete) return;
    const playerId = playerToDelete.id;
    setPlayerToDelete(null);

    setTimeout(async () => {
      try {
        await remove(playerId);
        // Forza pulizia pointer-events per bug Radix
        document.body.style.pointerEvents = "";
      } catch (error) {
        console.error("Errore durante l'eliminazione del giocatore:", error);
      }
    }, 200);
  };

  const handleDeleteAllPlayers = async () => {
    setIsDeleteAllOpen(false);

    setTimeout(async () => {
      try {
        await removeAll();
        // Forza pulizia pointer-events per bug Radix
        document.body.style.pointerEvents = "";
      } catch (error) {
        console.error("Errore durante l'eliminazione della rosa:", error);
      }
    }, 200);
  };

  // Map new PlayerRole codes back to legacy Role labels for grouping
  const reverseRoleMap: Record<PlayerRole, string> = {
    POR: 'Portiere', DC: 'Difensore', TD: 'Difensore', TS: 'Difensore', ADA: 'Difensore', ASA: 'Difensore',
    CDC: 'Centrocampista', TRQ: 'Centrocampista', CD: 'Centrocampista', CS: 'Centrocampista',
    AD: 'Attaccante', AS: 'Attaccante', ATT: 'Attaccante',
  };

  /**
   * Lista piatta dei giocatori, ordinati per ruolo generale P/D/C/A e poi per
   * cognome dentro ogni reparto.
   *
   * Il ruolo viene da getPrimaryRole, che usa roles[0] e in caso cade il campo
   * role vecchio: e' la stessa funzione usata in campo, quindi la lista non puo'
   * classificare un giocatore in un reparto diverso da quello in cui lo schiera
   * l'allenatore.(reverseRoleMap fa il mismo raggruppamento ma per le vecchie
   * etichette testuali, che qui non servono.)
   */
  const perReparto = useMemo(() => {
    const ordine: RoleCategory[] = ['POR', 'DIF', 'CEN', 'ATT'];
    const chiave = (p: Player): RoleCategory => {
      const r = getPrimaryRole(p);
      // r e' una sigla di ruolo (DC, TD, CDC...), non una categoria: va
      // cercato in quale categoria rientra, che e' quello che ROLE_CATEGORIES
      // fa. Un ruolo non previsto cade in centrocampo, che e' il reparto
      // neutro: meglio che sparire dalla lista.
      return ordine.find((c) => ROLE_CATEGORIES[c].includes(r)) ?? 'CEN';
    };
    return [...players]
      .filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
      .sort((a, b) => {
        const d = ordine.indexOf(chiave(a)) - ordine.indexOf(chiave(b));
        if (d !== 0) return d;
        return (a.lastName || '').localeCompare(b.lastName || '');
      })
      .map(p => ({ p, cat: chiave(p), ruolo: getPrimaryRole(p) }));
  }, [players, searchTerm]);

  /** Quanti giocatori per reparto, per i numeri nelle quattro box. */
  const conteggi = useMemo(() => {
    const c: Record<string, number> = { POR: 0, DIF: 0, CEN: 0, ATT: 0 };
    for (const r of perReparto) c[r.cat]++;
    return c;
  }, [perReparto]);

  if (!loading && !activeSeason && !seasonsError) {
    return (
      <div className="pb-24 pt-4">
        <ErrorState error={missingSeasonError()} />
      </div>
    );
  }

  const hasPageError = seasonsError || playersError;

  return (
    <div className="pb-24 pt-4 space-y-3">
      {hasPageError ? (
        <ErrorState
          error={parseError(seasonsError || playersError)}
          onRetry={() => {
            fetchSeasons();
            fetchAll();
          }}
        />
      ) : (
        <>
          <div className="px-4">
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary dark:text-brand-green" />
                <Input
                  type="text"
                  placeholder="Cerca"
                  className="w-full h-12 pl-12 pr-4 rounded-full bg-background dark:bg-black border border-primary/30 dark:border-brand-green/30 text-foreground placeholder:text-muted-foreground dark:text-muted-foreground/50 font-medium text-lg focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.05)]"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
                {!isEditMode ? (
                  <>
                    <Button
                      onClick={() => router.push('/scout')}
                      variant="ghost"
                      className="h-12 w-12 rounded-full p-0 flex-shrink-0 bg-background dark:bg-black border border-primary/20 dark:border-brand-green/20 text-primary dark:text-brand-green shadow-sm hover:bg-primary/5 dark:hover:bg-brand-green/5 transition-all hover:scale-105 active:scale-95"
                      title="Scout"
                    >
                      <FaUserSecret className="h-6 w-6" />
                    </Button>
                    <Button
                      onClick={() => setIsInjuryFormOpen(true)}
                      variant="ghost"
                      className="h-12 w-12 rounded-full p-0 flex-shrink-0 bg-background dark:bg-black border border-primary/20 dark:border-brand-green/20 text-primary dark:text-brand-green shadow-sm hover:bg-primary/5 dark:hover:bg-brand-green/5 transition-all hover:scale-105 active:scale-95"
                      title="Gestisci Infortuni"
                    >
                      <Hospital className="h-6 w-6" />
                    </Button>
                    <Button
                      onClick={() => handleOpenForm(null)}
                      variant="ghost"
                      className="h-12 w-12 rounded-full p-0 flex-shrink-0 bg-background dark:bg-black border border-primary/20 dark:border-brand-green/20 text-primary dark:text-brand-green shadow-sm hover:bg-primary/5 dark:hover:bg-brand-green/5 transition-all hover:scale-105 active:scale-95"
                      title="Aggiungi Giocatore"
                    >
                      <Plus className="h-7 w-7" />
                    </Button>
                    <Button
                      onClick={() => setIsEditMode(true)}
                      variant="ghost"
                      className="h-12 w-12 rounded-full p-0 flex-shrink-0 bg-background dark:bg-black border border-primary/20 dark:border-brand-green/20 text-primary dark:text-brand-green shadow-sm hover:bg-primary/5 dark:hover:bg-brand-green/5 transition-all hover:scale-105 active:scale-95"
                      title="Modalità Modifica"
                    >
                      <Edit className="h-5 w-5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      onClick={() => setIsEditMode(false)}
                      variant="ghost"
                      className="h-12 w-12 rounded-full p-0 flex-shrink-0 bg-primary dark:bg-brand-green border border-primary/20 dark:border-brand-green/20 text-white dark:text-black shadow-sm hover:opacity-90 transition-all hover:scale-105 active:scale-95"
                      title="Salva"
                    >
                      <Save className="h-6 w-6" />
                    </Button>
                    <Button
                      onClick={() => setIsDeleteAllOpen(true)}
                      variant="ghost"
                      className="h-12 w-12 rounded-full p-0 flex-shrink-0 bg-destructive/10 border border-destructive/20 text-destructive shadow-sm hover:bg-destructive/20 transition-all hover:scale-105 active:scale-95"
                      title="Svuota Rosa"
                    >
                      <Trash2 className="h-6 w-6" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Link to Rosa Overview */}
          <div className="px-3">
            <button
              onClick={() => router.push('/rosa')}
              className="flex items-center gap-3 w-full p-3 rounded-2xl bg-muted/30 dark:bg-card/20 border border-border dark:border-brand-green/20 hover:bg-muted/50 dark:hover:bg-card/30 transition-all"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 dark:bg-brand-green/10 flex items-center justify-center shrink-0">
                <Users className="h-5 w-5 text-primary dark:text-brand-green" />
              </div>
              <div className="flex-1 text-left">
                <span className="text-sm font-black uppercase tracking-tight">Panoramica Rosa</span>
                <p className="text-[9px] font-bold uppercase text-muted-foreground dark:text-muted-foreground/60 tracking-widest">
                  Visualizza posizione per posizione con indicatori di copertura
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <div className="space-y-2 px-3">
            {/* Quattro box di conteggio, solo informative: dicono com'e' fatta
                la squadra, non filtrano la lista. */}
            <div className="grid grid-cols-4 gap-2">
              {RIEPILOGO.map(({ sigla, cat, colore, Icone }) => {
                const st = STILE_BOX[colore];
                return (
                  <div
                    key={sigla}
                    className={`rounded-2xl border px-1 py-3 flex flex-col items-center justify-center gap-1 ${st.box}`}
                  >
                    <Icone className={`h-4 w-4 ${st.testo}`} aria-hidden />
                    <span className={`text-[11px] font-black uppercase tracking-wider ${st.testo}`}>{sigla}</span>
                    <span className={`text-xl font-black leading-none ${st.testo}`}>{conteggi[cat] ?? 0}</span>
                  </div>
                );
              })}
            </div>

            {/* Lista piatta, ordinata P/D/C/A e poi per cognome. Le sigle a
                destra sono quelle vere del giocatore (DC, TD, CDC, AS...),
                non le abbreviazioni generiche delle box: li' si conta per
                reparto, qui si dice il ruolo preciso. */}
            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full rounded-xl bg-card/20" />
                <Skeleton className="h-12 w-full rounded-xl bg-card/20" />
                <Skeleton className="h-12 w-full rounded-xl bg-card/20" />
                <Skeleton className="h-12 w-full rounded-xl bg-card/20" />
              </div>
            ) : perReparto.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-sm italic">
                {searchTerm ? 'Nessun giocatore trovato' : 'Nessun giocatore in rosa'}
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden bg-card dark:bg-black/40 border border-border dark:border-brand-green/20">
                {perReparto.map(({ p, cat, ruolo }) => {
                  const st = STILE_BOX[RIEPILOGO.find(x => x.cat === cat)?.colore ?? 'blue'];
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const isInjured = p.injuries?.some(inj => {
                    const a = new Date(inj.startDate);
                    const b = new Date(inj.endDate);
                    a.setHours(0, 0, 0, 0);
                    b.setHours(23, 59, 59, 999);
                    return today >= a && today <= b;
                  });
                  return (
                    <div
                      key={p.id}
                      className="flex items-center gap-3 px-3 py-2.5 border-b border-border dark:border-brand-green/10 last:border-b-0 hover:bg-muted dark:hover:bg-black/60 transition-colors cursor-pointer"
                      onClick={() => router.push(`/membri/${p.id}`)}
                    >
                      <span className={`w-6 h-6 shrink-0 rounded-md flex items-center justify-center text-[10px] font-black ${st.badge}`}>
                        {RIEPILOGO.find(x => x.cat === cat)?.lettera}
                      </span>
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-foreground dark:text-white font-medium text-[15px] truncate">{displayPlayerName(p)}</span>
                        {isInjured && <Hospital className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                      </div>
                      {isEditMode ? (
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground dark:text-white/40 hover:text-destructive hover:bg-destructive/10 dark:hover:text-red-500 dark:hover:bg-red-500/10 transition-all"
                            onClick={(e) => { e.stopPropagation(); setPlayerToDelete(p); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground dark:text-white/40 hover:text-primary dark:hover:text-brand-green hover:bg-primary/10 dark:hover:bg-brand-green/10 transition-all"
                            onClick={(e) => { e.stopPropagation(); handleOpenForm(p); }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      ) : (
                        <>
                          <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground dark:text-muted-foreground/70 shrink-0">
                            {ruolo}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground dark:text-muted-foreground/30 shrink-0" />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      <PlayerFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSavePlayer}
        player={selectedPlayer}
        onAIImport={() => {
          setIsFormOpen(false);
          setIsSmartFormOpen(true);
        }}
        onTuttocampoImport={() => {
          setIsFormOpen(false);
          setIsImportTuttocampoOpen(true);
        }}
      />

      <SmartPlayerDialog
        open={isSmartFormOpen}
        onOpenChange={setIsSmartFormOpen}
        onSave={handleSmartSavePlayers}
      />

      <ImportTuttocampoDialog
        open={isImportTuttocampoOpen}
        onOpenChange={setIsImportTuttocampoOpen}
        onSave={handleSmartSavePlayers}
      />

      <AlertDialog open={!!playerToDelete} onOpenChange={(open) => !open && setPlayerToDelete(null)}>
        <AlertDialogContent className="max-w-[90vw] md:max-w-md rounded-3xl bg-card dark:bg-black border border-border dark:border-brand-green/30 text-foreground p-6 shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground dark:text-white font-black uppercase text-lg tracking-tight">Rimuovi Giocatore</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-muted-foreground">
              Vuoi eliminare definitivamente <strong className="text-foreground dark:text-brand-green">{playerToDelete?.name}</strong> dalla rosa?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-3 mt-4">
            <AlertDialogCancel className="mt-0 text-[11px] font-bold uppercase rounded-xl flex-1 h-11 border-border dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted dark:hover:bg-black/40">Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePlayer} className="bg-destructive hover:bg-destructive/90 text-[11px] text-destructive-foreground font-bold uppercase rounded-xl flex-1 h-11 border-none shadow-sm dark:shadow-[0_0_15px_rgba(248,113,113,0.3)]">
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteAllOpen} onOpenChange={setIsDeleteAllOpen}>
        <AlertDialogContent className="max-w-[90vw] md:max-w-md rounded-3xl bg-card dark:bg-black border border-border dark:border-brand-green/30 text-foreground p-6 shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive font-black uppercase text-lg tracking-tight">Svuota Rosa</AlertDialogTitle>
            <AlertDialogDescription className="text-sm font-medium leading-relaxed text-muted-foreground">
              Vuoi eliminare TUTTI i {players.length} giocatori della rosa? Questa azione è irreversibile.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end gap-3 mt-4">
            <AlertDialogCancel className="mt-0 text-[11px] font-bold uppercase rounded-xl flex-1 h-11 border-border dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted dark:hover:bg-black/40">Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAllPlayers} className="bg-destructive hover:bg-destructive/90 text-[11px] text-destructive-foreground font-bold uppercase rounded-xl flex-1 h-11 border-none shadow-sm dark:shadow-[0_0_15px_rgba(248,113,113,0.3)]">
              Elimina Tutto
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InjuryFormDialog
        open={isInjuryFormOpen}
        onOpenChange={setIsInjuryFormOpen}
      />
    </div>
  );
}
