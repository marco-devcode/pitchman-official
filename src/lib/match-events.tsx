/**
 * Utility e logica condivisa per la gestione degli eventi partita.
 */

import React from "react";
import {
  Info, Target, Zap, Flag, Handshake, XCircle, Timer,
  ArrowUp, ArrowDown, ArrowRightLeft
} from 'lucide-react';
import { GiSoccerBall, GiGloves, GiTargetPoster, GiLightBulb } from "react-icons/gi";
import { IoSquare } from "react-icons/io5";
import { cn } from "@/lib/utils";
import { MatchEvent } from "@/lib/types";

export const PERIOD_ORDER: Record<string, number> = {
  '1T': 1,
  '2T': 2,
  '1TS': 3,
  '2TS': 4
};

/**
 * Restituisce l'icona corrispondente al tipo di evento.
 */
export const getEventIcon = (event: Partial<MatchEvent>, size: string = "h-4 w-4", forceNeutral = false) => {
  const neutralClass = "text-black dark:text-white";
  
  const getFinalClass = (specificClass: string, isCard = false) => {
    if (isCard) return cn(size, specificClass);
    return forceNeutral ? cn(size, neutralClass) : cn(size, specificClass);
  };

  switch (event.type) {
    case 'goal':
      if (event.goalType === 'rigore') return <Target className={getFinalClass("text-black dark:text-white")} />;
      if (event.goalType === 'punizione') return <Zap className={getFinalClass("text-black dark:text-white")} />;
      if (event.goalType === 'calcio_angolo') return <Flag className={getFinalClass("text-black dark:text-white")} />;
      return <GiSoccerBall className={getFinalClass("text-black dark:text-white")} />;
    case 'own_goal': return <GiSoccerBall className={getFinalClass("text-black dark:text-white")} />;
    case 'assist': return <Handshake className={getFinalClass("text-black dark:text-white")} />;
    case 'yellow_card': return <IoSquare className={getFinalClass("text-brand-card-yellow", true)} />;
    case 'red_card': return <IoSquare className={getFinalClass("text-brand-card-red", true)} />;
    case 'substitution':
    case 'sub_in':
    case 'sub_out': 
      return (
        <div className="flex items-center -space-x-1.5 h-full">
          <ArrowUp className={cn(size, "text-emerald-500 -translate-y-0.5")} />
          <ArrowDown className={cn(size, "text-rose-500 translate-y-0.5")} />
        </div>
      );
    case 'penalty_saved': return <GiGloves className={getFinalClass("text-black dark:text-white")} />;
    case 'penalty_missed': return <XCircle className={getFinalClass("text-black dark:text-white")} />;
    case 'chance': return <GiLightBulb className={getFinalClass("text-black dark:text-white")} />;
    case 'woodwork': return <GiTargetPoster className={getFinalClass("text-black dark:text-white")} />;
    case 'stoppage': return <Timer className={getFinalClass("text-black dark:text-white")} />;
    case 'note': return <Info className={getFinalClass("text-black dark:text-white")} />;
    default: return <Info className={getFinalClass("text-black dark:text-white")} />;
  }
};

/**
 * Restituisce l'etichetta testuale dell'evento.
 */
export const getEventLabel = (event: Partial<MatchEvent>) => {
  if (event.type === 'goal') {
    if (!event.goalType || event.goalType === 'azione') return 'GOL';
    return event.goalType.replace('_', ' ').toUpperCase();
  }
  if (event.type === 'own_goal') return 'AUTOGOL';
  if (event.type === 'substitution') return 'SOSTITUZIONE';
  // Il recupero e' l'unico evento senza giocatore: il testo porta i minuti
  // ("3 MIN AGGIUNTI") e il periodo lo dice gia' il tag del minuto. Il
  // minute dell'evento non viene usato come numero di minuti aggiuntivi,
  // perche' in un 1TS/2TS il minuto e' relativo al periodo, non assoluto.
  if (event.type === 'stoppage') {
    const n = getStoppageFromEvent(event);
    if (n <= 0) return 'RECUPERO';
    return `${n} MIN AGGIUNTI`;
  }

  switch (event.type) {
    case 'yellow_card': return 'AMMONIZIONE';
    case 'red_card': return 'ESPULSIONE';
    case 'penalty_saved': return 'RIGORE PARATO';
    case 'penalty_missed': return 'RIGORE SBAGLIATO';
    case 'chance': return 'OCCASIONE';
    case 'woodwork': return 'PALO / TRAVERSA';
    case 'note': return 'NOTA / ALTRO';
    default: return '';
  }
};

/**
 * Minuti aggiuntivi dichiarati da un evento 'stoppage'.
 *
 * Il dato vive in `notes` come numero semplice ("3"): gli eventi hanno gia'
 * `minute` (relativo al periodo) e non aggiungere un campo nuovo significa
 * non toccare schema, repository e normalizzatori.
 *
 * NON confondere con getStoppage() di stoppage-time.ts, che legge il dato
 * gia' salvato sulla partita. Questa legge l'evento in cronaca: e' il ponte
 * fra i due, e vengono chiamate insieme quando si applica l'evento.
 */
export const getStoppageFromEvent = (event: Partial<MatchEvent>): number => {
  const raw = (event.notes || '').trim();
  if (!raw) return 0;
  // tollera "3", "3'", "+3", "3 min", "3 minuti"
  const m = raw.match(/^\+?(\d{1,2})/);
  const n = m ? parseInt(m[1], 10) : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Formatta il minuto dell'evento tenendo conto del periodo e della durata del match.
 */
export const formatDisplayMinute = (minute: number | null, period: string, matchDuration: number = 90) => {
  if (minute === null) return "";

  const halfTime = Math.floor(matchDuration / 2);

  switch (period) {
    case '1T':
      return minute > halfTime ? `${halfTime}+${minute - halfTime}'` : `${minute}'`;
    case '2T':
      return minute > halfTime ? `${matchDuration}+${minute - halfTime}'` : `${halfTime + minute}'`;
    case '1TS':
      return minute > 15 ? `${matchDuration}+15+${minute - 15}'` : `${matchDuration + minute}'`;
    case '2TS':
      return minute > 15 ? `${matchDuration}+30+${minute - 15}'` : `${matchDuration + 15 + minute}'`;
    default:
      return `${minute}'`;
  }
};
