"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useMatchDetailStore } from "@/store/useMatchDetailStore";
import { Badge } from "@/components/ui/badge";
import { Info, Plus, Trash2, ArrowRightLeft, XCircle, Target, Zap, Flag, Handshake, Edit2, User, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";
import { GiSoccerBall } from "react-icons/gi";
import { IoSquare } from "react-icons/io5";
import { MatchEventDialog } from "./match-event-dialog";
import { LiveMatchTracker } from "./live-match-tracker";
import { Button } from "@/components/ui/button";
import { MatchEventType, MatchEvent } from "@/lib/types";
import { useLiveTimerStore } from "@/store/useLiveTimerStore";
import { GiGloves, GiTargetPoster, GiLightBulb } from "react-icons/gi";
import { useRouter } from "next/navigation";
import { getEventIcon, getEventLabel, formatDisplayMinute, PERIOD_ORDER } from "@/lib/match-events";
import { cn, formatPlayerInitial, displayPlayerName, isTeamName } from "@/lib/utils";

export function MatchEventsTab() {
  const { events, deleteEvent, match, allPlayers } = useMatchDetailStore();
  const { isTrackerOpen, setIsTrackerOpen } = useLiveTimerStore();
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<MatchEvent | undefined>(undefined);

  const [selectedEventOptions, setSelectedEventOptions] = useState<MatchEvent | null>(null);


  const timedEvents = events.filter(e => e.minute !== null).sort((a, b) => {
    if (PERIOD_ORDER[a.period] !== PERIOD_ORDER[b.period]) return PERIOD_ORDER[a.period] - PERIOD_ORDER[b.period];
    return (a.minute ?? 0) - (b.minute ?? 0);
  });
  const unTimedEvents = events.filter(e => e.minute === null);

  const handleEditEvent = (event: MatchEvent) => {
    setEventToEdit(event);
    setSelectedEventOptions(null);
    setIsEventDialogOpen(true);
  };

  const handleAddNewEvent = () => {
    setEventToEdit(undefined);
    setIsEventDialogOpen(true);
  };


  return (
    <div className="space-y-6 relative">
      <Card className="bg-card dark:bg-black/40 border border-border dark:border-brand-green/30 rounded-3xl shadow-sm dark:shadow-theme overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <Button
            className="rounded-full h-10 px-4 bg-background dark:bg-black border border-primary/20 dark:border-brand-green/20 text-primary dark:text-brand-green hover:bg-primary/5 dark:hover:bg-brand-green/5 shadow-sm font-black uppercase text-[11px] sm:text-xs transition-all hover:scale-105 active:scale-95"
            onClick={handleAddNewEvent}
          >
            Aggiungi eventi <Plus className="h-4 w-4 ml-1" />
          </Button>
          {events.length > 0 && (
            <Button
              onClick={() => setIsTrackerOpen(true)}
              className="h-10 px-5 rounded-full bg-primary dark:bg-brand-green text-white dark:text-black font-black uppercase tracking-widest shadow-md dark:shadow-theme-strong hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5"
            >
              <Zap className="h-4 w-4" /> LIVE
            </Button>
          )}
        </CardHeader>
        <CardContent className="relative px-2 sm:px-6 pb-8">
          {events.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border dark:border-brand-green/20 rounded-xl bg-muted/20 dark:bg-transparent">
              <Info className="h-10 w-10 text-primary dark:text-brand-green mb-3 opacity-30" />
              <p className="text-xs font-black uppercase text-foreground/40 dark:text-muted-foreground">Nessun evento registrato</p>
              <p className="text-[10px] font-bold text-foreground/30 dark:text-muted-foreground mt-2 uppercase mb-6">Usa il + per aggiungere eventi alla partita.</p>
              <Button
                onClick={() => setIsTrackerOpen(true)}
                className="h-12 px-8 rounded-full bg-primary dark:bg-brand-green text-white dark:text-black font-black uppercase tracking-widest shadow-lg dark:shadow-theme-strong hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
              >
                <Zap className="h-5 w-5" /> LIVE
              </Button>
            </div>
          ) : (
            <div className="relative pt-4">
              <div className="absolute left-1/2 top-4 bottom-0 w-px bg-border dark:bg-brand-green/20 -translate-x-1/2 before:content-[''] before:absolute before:top-0 before:left-1/2 before:-translate-x-1/2 before:w-2 before:h-2 before:rounded-full before:bg-brand-green/30" />

              <div className="space-y-6">
                {/* Cronaca Temporale */}
                {timedEvents.length > 0 && (
                  <div className="space-y-3">
                    {timedEvents.map((event, index) => {
                      const isTransitionTo2T = event.period === '2T' && timedEvents[index - 1]?.period === '1T';

                      // Calcola punteggio a fine primo tempo
                      const halfTimeScore = (() => {
                        if (!isTransitionTo2T) return "";
                        const events1T = timedEvents.filter(e => e.period === '1T' && (e.type === 'goal' || e.type === 'own_goal'));
                        let homeGoals = 0;
                        let awayGoals = 0;
                        events1T.forEach(e => {
                          if (e.type === 'goal') {
                            if (e.team === 'home') homeGoals++;
                            else awayGoals++;
                          } else if (e.type === 'own_goal') {
                            // Autogol: conta per la squadra avversaria
                            if (e.team === 'home') awayGoals++;
                            else homeGoals++;
                          }
                        });
                        return `${homeGoals}-${awayGoals}`;
                      })();

                      return (
                        <div key={event.id} className="space-y-3">
                          {isTransitionTo2T && (
                            <div className="relative flex items-center justify-center py-4">
                              <div className="absolute left-0 right-0 h-px border-t border-dashed border-border dark:border-brand-green/20"></div>
                              <span className="relative bg-card dark:bg-[#060a02] px-3 text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-muted-foreground/40 z-10">
                                INT {halfTimeScore}
                              </span>
                            </div>
                          )}
                          <TimelineEvent
                            event={event}
                            match={match}
                            getEventIcon={getEventIcon}
                            getEventLabel={getEventLabel}
                            isHome={event.type === 'own_goal' ? event.team !== 'home' : event.team === 'home'}
                            onOptionsClick={setSelectedEventOptions}
                            formatMinute={formatDisplayMinute}
                            allPlayers={allPlayers}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {unTimedEvents.length > 0 && (
                  <div className="space-y-6 pt-8">
                    <div className="relative flex justify-center mb-8">
                      <span className="bg-card dark:bg-background px-4 py-1 rounded-full border border-border dark:border-brand-green/30 text-[9px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60 z-10 shadow-sm">
                        Senza minutaggio
                      </span>
                    </div>
                    {unTimedEvents.map((event) => (
                      <TimelineEvent
                        key={event.id}
                        event={event}
                        match={match}
                        getEventIcon={getEventIcon}
                        getEventLabel={getEventLabel}
                        isHome={event.type === 'own_goal' ? event.team !== 'home' : event.team === 'home'}
                        onOptionsClick={setSelectedEventOptions}
                        formatMinute={formatDisplayMinute}
                        allPlayers={allPlayers}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <MatchEventDialog
        open={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        eventToEdit={eventToEdit}
      />

      {/* Dialog Opzioni Evento */}
      <EventOptionsDialog
        event={selectedEventOptions}
        open={!!selectedEventOptions}
        onOpenChange={(open: boolean) => !open && setSelectedEventOptions(null)}
        onEdit={handleEditEvent}
        onDelete={(id: string) => {
          deleteEvent(id);
          setSelectedEventOptions(null);
        }}
        getEventIcon={getEventIcon}
        getEventLabel={getEventLabel}
      />

      <LiveMatchTracker 
        open={isTrackerOpen}
        onOpenChange={setIsTrackerOpen}
      />
    </div>
  );
}

function TimelineEvent({ event, match, getEventIcon, getEventLabel, isHome, onOptionsClick, formatMinute, allPlayers }: any) {
  const isPitchManTeam = match?.isHome ? isHome : !isHome;
  const mainName = event.playerName || (isPitchManTeam ? 'GIOCATORE' : (match?.opponent || 'AVVERSARIO'));
  const alignLeft = isHome;
  const isCard = event.type === 'yellow_card' || event.type === 'red_card';

  /**
   * Nome abbreviato di un giocatore citato in un evento.
   *
   * Se l'evento ha playerId risolviamo il giocatore dal database e usiamo
   * firstName/lastName, che non ambigui: displayPlayerName sa cosa e' cognome
   * e cosa e' nome. La stringa salvata nell'evento non basta, perche' il
   * dialog prima salvava il campo `name` grezzo del giocatore, che
   * nell'import puo' essere "Nome Cognome": da li' si ricavava l'iniziale
   * dal nome e il nome per esteso al posto del cognome — "C. LEVI" invece di
   * "C. LEVI" con l'iniziale sbagliata a seconda di com'e' stato importato.
   *
   * Senza playerId (avversario, nome libero) si cade sul testo.
   */
  const abbreviato = (playerId: string | undefined, testo: string | undefined): string => {
    const p = playerId ? (allPlayers || []).find((x: any) => x.id === playerId) : undefined;
    if (p) return formatPlayerInitial(displayPlayerName(p));

    // Nessun playerId: o e' un avversario (nome squadra) o un nome libero.
    // Un nome squadra NON va abbreviato: "Real Milano" diventerebbe
    // "M. REAL", che non e' niente. Le squadre hanno nomi di due o piu'
    // parole, i nomi di giocatore quasi sempre due: la distinzione non e'
    // affidabile, quindi ci si appoggia a un campo dedicato.
    const t = testo || '';
    if (isTeamName(t)) return t.toUpperCase();
    return formatPlayerInitial(t);
  };

  return (
    <div className={cn(
      "relative flex items-center group w-full",
      alignLeft ? "flex-row-reverse pr-[50%]" : "pl-[50%]"
    )}>
      <div className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center z-10">
        {/* Minute tag (Side positioned) */}
        {event.minute !== null && (
          <div className={cn(
            "absolute whitespace-nowrap bg-muted/80 dark:bg-black/80 px-2.5 py-1 rounded-full border border-border dark:border-brand-green/10 text-[11px] font-black tabular-nums shadow-sm z-20",
            alignLeft ? "left-full ml-4" : "right-full mr-4"
          )}>
            {/* Il recupero non ha un "minuto" da formattare: il suo minute e'
                il NUMERO di minuti aggiuntivi, quindi formatDisplayMinute
                produrrebbe roba tipo "105+15-8'". Si mostra il tempo. */}
            {event.type === 'stoppage'
              ? (event.period === '1TS' ? '1° TEMPO' : '2° TEMPO')
              : formatDisplayMinute(event.minute, event.period, match?.duration)}
          </div>
        )}

        <button
          onClick={() => onOptionsClick(event)}
          className={cn(
            "h-9 w-9 rounded-xl flex items-center justify-center border-2 shadow-sm transition-all duration-300 hover:scale-110 active:scale-95 bg-card dark:bg-black",
            isCard 
              ? (event.type === 'yellow_card' ? "border-yellow-400/30 shadow-[0_0_10px_rgba(250,204,21,0.1)]" : "border-red-600/30 shadow-[0_0_10px_rgba(220,38,38,0.1)]")
              : "border-border dark:border-brand-green/20"
          )}
        >
          {getEventIcon(event, "h-4 w-4", !isCard)}
        </button>
      </div>

      <div className={cn(
        "flex-1 px-10 sm:px-16",
        alignLeft ? "text-right" : "text-left"
      )}>
        <div className={cn(
          "inline-flex flex-col",
          alignLeft ? "items-end" : "items-start"
        )}>
          {event.type === 'substitution' ? (
            <div className={cn("flex flex-col", alignLeft ? "items-end text-right" : "items-start text-left")}>
              <div className={cn("flex items-center gap-2", alignLeft && "flex-row-reverse")}>
                <ArrowUp className="h-3 w-3 text-emerald-500" />
                <p className="font-black leading-tight uppercase text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                  {abbreviato(event.playerId, event.playerName)}
                </p>
              </div>
              <div className={cn("flex items-center gap-2 mt-0.5 opacity-60", alignLeft && "flex-row-reverse")}>
                <ArrowDown className="h-3 w-3 text-rose-500" />
                <p className="text-[10px] sm:text-[11px] font-bold leading-tight uppercase">
                  {abbreviato(event.subOutPlayerId, event.subOutPlayerName)}
                </p>
              </div>
            </div>
          ) : event.type === 'note' ? (
            <p className="text-[11px] sm:text-xs font-medium tracking-tight text-foreground/80 break-words italic max-w-[140px] sm:max-w-[200px] select-text">
              &quot;{event.notes}&quot;
            </p>
          ) : event.type === 'stoppage' ? (
            // Minuti aggiuntivi: nessun giocatore, solo il blocco di recupero
            // dichiarato per quel tempo. Barra orizzontale con i minuti, per
            //che' si legga a colpo d'occhio nella cronaca.
            <div className={cn("flex flex-col gap-1.5", alignLeft ? "items-end" : "items-start")}>
              <div
                className="h-1.5 rounded-full bg-primary dark:bg-brand-green w-full max-w-[120px] min-w-[52px]"
                aria-hidden
              />
              <p className="text-[9px] font-black uppercase tracking-widest leading-none text-muted-foreground">
                {getEventLabel(event)}
              </p>
            </div>
          ) : (
            <div className={cn("flex flex-col", alignLeft ? "items-end text-right" : "items-start text-left")}>
              <p className="font-black leading-tight uppercase text-xs sm:text-sm truncate max-w-[120px] sm:max-w-none">
                {abbreviato(event.playerId, mainName)}
              </p>
              <div className={cn("flex items-center gap-2 mt-1", alignLeft ? "flex-row-reverse" : "flex-row")}>
                <p className="text-[9px] text-muted-foreground font-black tracking-widest leading-none">
                  {getEventLabel(event)}
                </p>
              </div>
              {event.type === 'goal' && event.assistPlayerName && (
                <div className={cn("flex items-center gap-1 mt-1 opacity-70", alignLeft ? "flex-row-reverse" : "flex-row")}>
                  <p className="text-[9px] font-bold uppercase tracking-wider">Assist: {abbreviato(event.assistPlayerId, event.assistPlayerName)}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function EventOptionsDialog({ event, open, onOpenChange, onEdit, onDelete, getEventIcon, getEventLabel }: any) {
  const router = useRouter();
  if (!event) return null;

  const involvedPlayers = [
    { id: event.playerId, name: event.playerName },
    { id: event.assistPlayerId, name: event.assistPlayerName },
    { id: event.subOutPlayerId, name: event.subOutPlayerName }
  ].filter(p => p.id && p.id !== "none");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] sm:max-w-xs bg-card dark:bg-black border border-border dark:border-brand-green/30 p-6 rounded-[28px] shadow-2xl">
        <DialogHeader className="items-center text-center">
          <div className="p-4 rounded-full border border-border dark:border-white/10 bg-white dark:bg-black mb-3 shadow-sm">
            {getEventIcon(event, "h-8 w-8", true)}
          </div>
          <DialogTitle className="text-xl font-black uppercase tracking-tight leading-none mb-1">
            Gestione Evento
          </DialogTitle>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{getEventLabel(event)}</p>
        </DialogHeader>

        <div className="space-y-2 mt-6">
          <button
            onClick={() => onEdit(event)}
            className="w-full flex items-center justify-between p-4 bg-muted/20 dark:bg-white/5 hover:bg-muted/30 dark:hover:bg-white/10 rounded-2xl transition-all group"
          >
            <span className="text-xs font-black uppercase tracking-widest">Modifica Evento</span>
            <Edit2 className="h-4 w-4 text-brand-green opacity-40 group-hover:opacity-100" />
          </button>

          <button
            onClick={() => onDelete(event.id)}
            className="w-full flex items-center justify-between p-4 bg-rose-500/10 hover:bg-rose-500/20 rounded-2xl transition-all group"
          >
            <span className="text-xs font-black uppercase tracking-widest text-rose-500">Elimina Evento</span>
            <Trash2 className="h-4 w-4 text-rose-500 opacity-40 group-hover:opacity-100" />
          </button>

          {involvedPlayers.length > 0 && (
            <div className="pt-4 space-y-2">
              <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.3em] ml-2 mb-2">Vai alla scheda</p>
              {involvedPlayers.map(p => (
                <button
                  key={p.id}
                  onClick={() => router.push(`/membri/${p.id}`)}
                  className="w-full flex items-center justify-between p-4 bg-primary/10 dark:bg-brand-green/10 hover:bg-primary/20 dark:hover:bg-brand-green/20 rounded-2xl transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <User className="h-4 w-4 text-primary dark:text-brand-green opacity-40" />
                    <span className="text-xs font-black uppercase tracking-widest truncate max-w-[150px]">{p.name}</span>
                  </div>
                  <ExternalLink className="h-3 w-3 opacity-20 group-hover:opacity-100" />
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          variant="ghost"
          className="w-full mt-6 rounded-2xl font-black uppercase text-[10px] tracking-widest py-6"
          onClick={() => onOpenChange(false)}
        >
          Chiudi
        </Button>
      </DialogContent>
    </Dialog>
  );
}
