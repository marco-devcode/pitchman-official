
"use client";

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { matchRepository } from '@/lib/repositories/match-repository';
import { playerRepository } from '@/lib/repositories/player-repository';
import { aggregationRepository } from '@/lib/repositories/aggregation-repository';
import { lineupRepository } from '@/lib/repositories/lineup-repository';
import { eventRepository } from '@/lib/repositories/event-repository';
import { statsRepository } from '@/lib/repositories/stats-repository';
import { enqueueMutation, isOffline } from '@/lib/sync-queue';
import { useStatsStore } from './useStatsStore';
import { useSeasonsStore } from './useSeasonsStore';
import { useAuthStore } from './useAuthStore';
import { useMatchesStore } from './useMatchesStore';
import { usePlayersStore } from './usePlayersStore';
import type { Match, Player, MatchLineup, MatchEvent, PlayerMatchStats } from '@/lib/types';
import { countGoals } from '@/lib/goal-utils';
import { computeMinutesPlayed, stoppagePeriodsActive } from '@/lib/player-minutes';
import { getStoppageFromEvent } from '@/lib/match-events';
import { parseISO, startOfDay } from 'date-fns';

interface MatchDetailState {
    matchId: string | null;
    match: Match | null;
    allPlayers: Player[];
    events: MatchEvent[];
    lineup: MatchLineup | null;
    stats: PlayerMatchStats[];
    loading: boolean;
    error: string | null;
    
    load: (matchId: string, seasonId?: string) => Promise<void>;
    updateMatch: (data: Partial<Omit<Match, 'id'>>) => Promise<void>;
    saveLineup: (lineup: MatchLineup) => Promise<void>;
    saveAllStats: (stats: PlayerMatchStats[]) => Promise<void>;
    addEvent: (event: Omit<MatchEvent, 'id'>) => Promise<void>;
    addEvents: (events: Omit<MatchEvent, 'id'>[]) => Promise<void>;
    updateEvent: (eventId: string, data: Partial<Omit<MatchEvent, 'id' | 'matchId'>>) => Promise<void>;
    deleteEvent: (eventId: string) => Promise<void>;
    syncAndPersistMinutes: () => Promise<void>;
}

const periodOrder: Record<string, number> = { '1T': 1, '2T': 2, '1TS': 3, '2TS': 4 };

/**
 * Contatore degli id temporanei.
 *
 * Serve perche' il solo Date.now() non garantisce l'unicita': ha risoluzione
 * al millisecondo, e piu' eventi salvati nella stessa milliseconda si
 * ritrovano con lo stesso id temporaneo. Vedi addEvent.
 */
let tempCounter = 0;

/**
 * Dato il nuovo insieme di eventi, ricava il recupero dichiarato e lo scrive
 * sulla partita.
 *
 * Il recupero e' un dato UNICO per periodo: se in cronaca ci sono piu' eventi
 * 'stoppage' per lo stesso tempo, vince l'ultimo (in ordine di periodo e
 * minuto). Non si sommano — 2TS = 5 seguito da 2TS = 3 significa "3", non 8:
 * il primo valore era una dichiarazione superata, non un blocco diverso.
 *
 * Un solo evento per periodo, come concordato: 1TS e 2TS sono due voci
 * distinte e non si toccano a vicenda.
 *
 * Se non ci sono piu' eventi stoppage per un periodo, il recupero di quel
 * periodo torna a 0: cancellare l'evento deve cancellare il dato, altrimenti
 * la partita resterebbe con minuti fantasma.
 */
export function deriveAddedTime(events: MatchEvent[]) {
  const out: { '1TS'?: number; '2TS'?: number } = {};
  for (const e of events) {
    if (e.type !== 'stoppage') continue;
    if (e.period !== '1TS' && e.period !== '2TS') continue;
    const n = getStoppageFromEvent(e);
    if (n > 0) out[e.period] = n;
  }
  return {
    '1TS': out['1TS'],
    '2TS': out['2TS'],
  };
}

export const useMatchDetailStore = create<MatchDetailState>()(
  persist(
    (set, get) => ({
    matchId: null,
    match: null,
    allPlayers: [],
    events: [],
    lineup: null,
    stats: [],
    loading: true,
    error: null,

    load: async (matchId, seasonId) => {
        // MISURA TEMPORANEA
        set(state => ({ 
            loading: !state.match || state.matchId !== matchId, 
            error: null, 
            matchId, 
            match: state.matchId === matchId ? state.match : null 
        }));
        
        try {
            const authState = useAuthStore.getState();
            if (!authState.isAuthenticated || !authState.user) {
                set({ error: "Accesso negato: devi essere loggato per visualizzare i dettagli.", loading: false });
                return;
            }
            
            const currentUser = authState.user;
            let targetSeasonId = seasonId || useSeasonsStore.getState().activeSeason?.id;
            if (!targetSeasonId) {
                await useSeasonsStore.getState().fetchAll();
                targetSeasonId = useSeasonsStore.getState().activeSeason?.id;
            }

            if (!targetSeasonId) {
                set({ error: "Identificativo stagione mancante.", loading: false });
                return;
            }

            // La partita e' gia' in memoria: il calendario l'ha appena letta e
            // mostrata a schermo, quindi rileggerla da Firestore costa un giro
            // di rete (misurati 270-570ms su questo progetto) per restituire lo
            // stesso oggetto. Si rilegge solo se non c'e' — link diretto,
            // ricaricamento della pagina, deep link da una notifica.
            const inMemoria = useMatchesStore.getState().matches.find((m) => m.id === matchId);
            const match = inMemoria ?? (await matchRepository.getById(matchId, targetSeasonId));

            if (!match) {
                set({ error: "Partita non trovata o permessi insufficienti.", loading: false });
                return;
            }

            // La ROSA non blocca l'apertura.
            //
            // Serve alla scheda Formazione e ai dialog che scelgono un
            // giocatore, non al risultato e non alla cronaca, che sono le prime
            // cose che l'allenatore guarda. Tenerla in attesa significa tenere
            // uno scheletro davanti a dati che sono gia' arrivati: e' la
            // differenza fra aprire una partita in mezzo secondo e aprirla in
            // tre.
            //
            // Se la rosa e' gia' in memoria (l'allenatore e' passato da Rosa, o
            // ha gia' aperto una partita) si usa subito e non si legge niente.
            // Altrimenti si parte con quel che c'e' e si aggiorna quando
            // arriva, senza bloccare.
            const rosaInMemoria = usePlayersStore.getState().players;
            const allPlayers = rosaInMemoria.length ? rosaInMemoria : [];

            const [matchEvents, matchLineup, matchStats] = await Promise.all([
                eventRepository.getForMatch(matchId, targetSeasonId, currentUser.id),
                lineupRepository.getForMatch(matchId, targetSeasonId, currentUser.id),
                statsRepository.getForMatch(matchId, targetSeasonId, currentUser.id)
            ]);

            if (!rosaInMemoria.length) {
                // Fuori dal percorso di caricamento e senza blocco: una rosa non
                // caricata e' un problema della scheda Formazione, non
                // dell'apertura della partita. Il controllo su matchId evita che
                // una risposta in arrivo sovrascriva la scena di un'altra
                // partita nel frattempo aperta.
                playerRepository.getAll(currentUser.id, targetSeasonId).then((fresh) => {
                    if (get().matchId !== matchId) return;
                    set({ allPlayers: fresh });
                }).catch(() => {});
            }

            // Ricalcola il risultato dagli eventi appena riletti, invece di
            // fidarsi di match.result salvato su Firestore.
            //
            // Il campo persistito puo' essere stantio: l'app lo aggiorna a ogni
            // evento, ma se una scrittura e' fallita, o se la partita e' stata
            // completata (che inizializza result a 0-0), oppure se gli eventi
            // sono stati corretti da un altro dispositivo, quel campo resta
            // indietro. Il sintomo era: gli eventi in cronaca c'erano tutti e
            // corretti, ma il punteggio mostrava 0-0 e il risultato non
            // riparava piu' da solo.
            //
            // Gli eventi sono la fonte di verita: se esistono, il risultato si
            // conta da loro. Se NON esistono eventi, si lascia il risultato
            // salvato: una partita con il risultato impostato a mano e senza
            // eventi registrati deve restare com'e'.
            const eventi = matchEvents || [];
            // `haEventi` da solo NON basta per decidere di riscrivere il
            // risultato: un'ammonizione, una sostituzione o un gol di recupero
            // non sono gol. Con una partita il cui risultato e' stato inserito
            // a mano e un solo cartellino giallo, `haEventi` era vero e il
            // risultato veniva ricalcolato a 0-0, cancellando il punteggio
            // digitato. La riscrittura parte solo se ci sono eventi che
            // incidono sui gol.
            const eventiConGol = eventi.some(e => e.type === 'goal' || e.type === 'own_goal');
            const ricalcolato = countGoals(eventi);
            const resultFinale = eventiConGol
                ? { home: ricalcolato.home, away: ricalcolato.away }
                : match.result;

            set({
                match: { ...match, result: resultFinale },
                allPlayers,
                events: eventi,
                lineup: matchLineup || null,
                stats: matchStats || [],
                loading: false,
                error: null
            });

            // Ripara su Firestore il risultato stantio, cosi' anche la lista
            // calendario (che legge il campo salvato) torna corretta. Senza
            // questo il reload riparerebbe solo lo schermo della partita.
            //
            // Il caso che mancava: `result` ASSENTE. La guardia precedente
            // richiedeva `match.result &&`, quindi con il campo assente la
            // riparazione non partiva e la partita restava stantia per sempre,
            // anche avendo gli eventi corretti. Il calendario mostrava 0-0 con
            // la partita in "completed" (il 0-0 e' il fallback di `?? 0`, non un
            // dato salvato) mentre dentro la partita i gol c'erano tutti: e'
            // il sintomo "passa ma non rimane".
            //
            // Quindi: se ci sono eventi che contano come gol, il risultato
            // salvato deve essere allineato a quello ricalcolato, sia quando
            // e' diverso sia quando non esiste. Se non ci sono gol registrati si
            // lascia tutto com'e': una partita col risultato inserito a mano
            // non deve essere azzerata da un'ammonizione o una sostituzione.
            // La riparazione su Firestore NON blocca load(): qui `set()` ha
            // gia' fatto comparire i dati a schermo, ma due `await` di scrittura
            // tenevano la funzione appesa, e con lei l'indicatore di
            // caricamento della pagina.
            //
            // Non e' una differenza accademica: la pagina passa a mostrare il
            // contenuto solo quando `loading` diventa false, quindi ogni await
            // qui dentro e' tempo che l'allenatore guarda uno scheletro con la
            // partita gia' pronta.
            if (eventiConGol) {
                const salvato = match.result;
                const diversoDaSalvato = !salvato || salvato.home !== resultFinale!.home || salvato.away !== resultFinale!.away;

                // Una partita con eventi registrati ma ancora 'scheduled' resta
                // fuori dai "ultimi incontri" e non entra nelle statistiche
                // (record, bomber, tab per tipo partita), perche' quei
                // calcolatori filtrano su status === 'completed'. La segnaliamo
                // come giocata solo se la data e' gia' passata: una partita in
                // corso non va completata da sola.
                const partitaGiaPassata = parseISO(match.date) < startOfDay(new Date());
                const daCompletare = match.status === 'scheduled' && partitaGiaPassata;

                if (diversoDaSalvato || daCompletare) {
                    // `load` e' un lettore, ma qui SCRIVE: corregge un
                    // risultato stantio e può completare una partita già
                    // passata. Entrambe le cose cambiano il record, quindi gli
                    // aggregati in memoria vanno considerati sporchi. Senza
                    // questo, la dashboard mostrerebbe il record precedente
                    // finche' non si entra in /statistiche — che è il buco
                    // originale.
                    useStatsStore.getState().markStatsDirty();
                    matchRepository.update(matchId, targetSeasonId, {
                        ...(diversoDaSalvato ? { result: resultFinale } : {}),
                        ...(daCompletare ? { status: 'completed' as const } : {}),
                    }).catch((e) => console.error("Match repair error:", e));
                }
            }
        } catch (e: any) {
            console.error("Match load error:", e);
            set({ 
                error: e.message || "Errore durante il recupero dei dati.", 
                loading: false 
            });
        }
    },

    syncAndPersistMinutes: async () => {
        const { match, lineup, events, matchId, allPlayers } = get();
        const user = useAuthStore.getState().user;
        if (!match || !matchId || !user) return;

        // Punto unico di invalidazione degli aggregati: ogni percorso che
        // cambia eventi, formazione o statistiche passa di qui (tranne
        // updateMatch, che segnala a parte). Cosi' il flag non puo' dimenticare
        // un caso: se domani un nuovo tipo di scrittura, e' dentro questo
        // metodo o dentro updateMatch.
        useStatsStore.getState().markStatsDirty();

        const duration = match.duration || 90;
        const pitchManTeam = match.isHome ? 'home' : 'away';

        // NB: qui NON c'e' piu' nessun "minuto assoluto con recupero". Il
        // minutaggio e' delegato a computeMinutesPlayed, dove il recupero non
        // sposta il clock: la fine partita per i minuti e' `duration`, punto.
        // Sotto il calcolo non serve ne' `halfTime` ne' `addedTime`: il primo
        // e' dentro computeMinutesPlayed, il secondo riguarda solo la
        // cronologia degli eventi, che non guarda qui.

        const newStats: PlayerMatchStats[] = allPlayers.map(player => {
            const playerId = player.id;
            const teamEvents = events.filter(e => e.team === pitchManTeam);
            
            const yellowCards = teamEvents.filter(e => e.type === 'yellow_card' && e.playerId === playerId).length;
            const redCards = teamEvents.filter(e => e.type === 'red_card' && e.playerId === playerId).length;
            const goals = teamEvents.filter(e => e.type === 'goal' && e.playerId === playerId).length;
            const assists = teamEvents.filter(e => e.type === 'goal' && e.assistPlayerId === playerId).length;
            // Nota: own_goal NON viene conteggiato come gol del giocatore

            const isStarter = lineup?.starters.some(p => (typeof p === 'string' ? p : p.playerId) === playerId);
            const isSubstitute = lineup?.substitutes.some(p => (typeof p === 'string' ? p : p.playerId) === playerId);

            // Modello dei minuti in src/lib/player-minutes.ts: il recupero NON
            // conta e NON esiste piu' il "minuto forzato a 1" (un ingresso nel
            // supplementare vale tutto quello che resta, vedi la sezione
            // "Perche' non esiste piu' il minuto forzato a 1" in quel file).
            // Qui il calcolo e' delegato, non reimplementato.
            const minutesPlayed = lineup && (isStarter || isSubstitute)
                ? computeMinutesPlayed({
                    duration,
                    // I tempi supplementari esistono solo se attivati e solo
                    // nelle partite di torneo: unico punto che lo decide.
                    stoppageActive: stoppagePeriodsActive(match),
                    isStarter: !!isStarter,
                    events: teamEvents,
                    playerId,
                })
                : 0;

            return { matchId, playerId, minutesPlayed, goals, assists, yellowCards, redCards, teamOwnerId: user.id };
        }).filter(s => s.minutesPlayed > 0 || s.goals > 0 || s.assists > 0 || s.yellowCards > 0 || s.redCards > 0);

        set({ stats: newStats });

        // Aggregati in memoria non piu' attendibili: la dashboard legge la
        // leaderboard, che loadSummaryStats NON ricalcola. Il refresh avviene
        // al prossimo arrivo sulla dashboard (refreshIfDirty), non qui.
        useStatsStore.getState().markStatsDirty();

        // Scritture asincrone
        newStats.forEach(stat => {
            statsRepository.upsert(matchId, match.seasonId, stat.playerId, stat, user.id);
        });

        aggregationRepository.syncAllPlayersStats(user.id, match.seasonId).then(() => {
            useStatsStore.getState().loadSummaryStats();
        });
    },

    saveAllStats: async (newStats) => {
        const { matchId, match } = get();
        const user = useAuthStore.getState().user;
        if (!matchId || !match || !user) return;

        // saveAllStats scrive le stats senza passare da syncAndPersistMinutes:
        // senza questo la dashboard mostrerebbe le stats precedenti.
        useStatsStore.getState().markStatsDirty();

        set({ stats: newStats });

        if (isOffline()) {
          for (const stat of newStats) {
            await enqueueMutation({
              collection: 'playerMatchStats',
              docId: stat.playerId,
              action: 'upsert',
              seasonId: match.seasonId,
              matchId,
              playerId: stat.playerId,
              payload: stat,
            });
          }
          return;
        }

        newStats.forEach(stat => {
            statsRepository.upsert(matchId, match.seasonId, stat.playerId, stat, user.id);
        });

        aggregationRepository.syncAllPlayersStats(user.id, match.seasonId).then(() => {
            useStatsStore.getState().loadSummaryStats();
        });
    },

    addEvent: async (eventData) => {
        const { matchId, match, events: currentEvents } = get();
        const user = useAuthStore.getState().user;
        if (!matchId || !match || !user) return;

        // La dashboard mostra la leaderboard, che loadSummaryStats NON
        // ricalcola: ogni scrittura qui la rende stale fino a
        // /statistiche. Si marca il contesto sporco e si lascia il
        // refresh alla dashboard (refreshIfDirty). Viene fatto PRIMA
        // del ramo offline, che pure torna qui senza passare da
        // syncAndPersistMinutes.
        useStatsStore.getState().markStatsDirty();

        // Id temporaneo UNICO per evento. Date.now() non basta: ha risoluzione
        // di un millisecondo, e aggiungendo piu' eventi in sequenza stretta
        // (due dialog confermati in fretta) due eventi prendono lo stesso id.
        // Il map() di sostituzione piu' sotto cerca per id, quindi con id
        // collisionati sostituiva TUTTI gli eventi con lo stesso temp-id con un
        // solo risultato: 6 gol salvati di fila diventavano 2 visibili in
        // cronaca, che e' il bug segnalato. Il contatore e unico per sessione,
        // quindi lo stesso id non si ripete mai.
        const tempId = `temp-${Date.now()}-${tempCounter++}`;
        const newEvent: MatchEvent = { ...eventData, id: tempId, matchId };
        const updatedEvents = [...currentEvents, newEvent].sort((a, b) => {
            const pA = periodOrder[a.period] || 0;
            const pB = periodOrder[b.period] || 0;
            if (pA !== pB) return pA - pB;
            return (a.minute ?? 0) - (b.minute ?? 0);
        });

        const { home: homeGoals, away: awayGoals } = countGoals(updatedEvents);
        const updatedMatch = { ...match, result: { home: homeGoals, away: awayGoals } };

        set({ events: updatedEvents, match: updatedMatch });

        if (isOffline()) {
          await enqueueMutation({
            collection: 'matchEvents',
            docId: tempId,
            action: 'add',
            payload: { ...eventData, matchId, teamOwnerId: user.id },
            userId: user.id,
            seasonId: match.seasonId,
            matchId,
          });
          return;
        }

        // Il salvataggio del risultato va ATTESO, e va fatto DOPO la risposta di
        // Firestore sugli eventi. Senza await, piu' salvataggi in sequenza
        // partono in parallelo e l'ultimo ad arrivare vince: ognuno porta il
        // conteggio che aveva calcolato al proprio momento, quindi il risultato
        // finale puo' essere un conteggio vecchio (2 invece di 6).
        // Con await gli eventi sono gia' confermati e il conteggio e' quello
        // finale.
        try {
            const savedEvent = await eventRepository.add({ ...eventData, matchId }, match.seasonId, user.id);
            set(state => ({
                events: state.events.map(e => e.id === tempId ? savedEvent : e)
            }));
            await matchRepository.update(matchId, match.seasonId, { result: { home: homeGoals, away: awayGoals } });
        } catch (e) {
            console.error("Errore nel salvataggio dell'evento:", e);
        }

        get().syncAndPersistMinutes();
    },

    addEvents: async (eventsData) => {
        const { matchId, match, events: currentEvents } = get();
        const user = useAuthStore.getState().user;
        if (!matchId || !match || !user) return;

        // La dashboard mostra la leaderboard, che loadSummaryStats NON
        // ricalcola: ogni scrittura qui la rende stale fino a
        // /statistiche. Si marca il contesto sporco e si lascia il
        // refresh alla dashboard (refreshIfDirty). Viene fatto PRIMA
        // del ramo offline, che pure torna qui senza passare da
        // syncAndPersistMinutes.
        useStatsStore.getState().markStatsDirty();

        // Salva tutti gli eventi e ASPETTA: senza attendere, le scritture
        // partono in parallelo e l'ultima ad arrivare sul risultato vince con
        // un conteggio vecchio.
        //
        // Promise.all mantiene l'ordine degli input, quindi salvati[i]
        // corrisponde a eventsData[i] e quindi al tempId[i]. La sostituzione
        // si fa per posizione, non confrontando id: l'id reale di Firestore e'
        // diverso da quello temporaneo, quindi un confronto per valore non
        // abbinerebbe mai.
        const tempIds: string[] = [];
        let updatedEvents = [...currentEvents];

        for (const data of eventsData) {
            const tempId = `temp-${Date.now()}-${tempCounter++}`;
            tempIds.push(tempId);
            updatedEvents.push({ ...data, id: tempId, matchId });
        }

        try {
            const salvati = await Promise.all(
                eventsData.map((data) =>
                    eventRepository.add({ ...data, matchId }, match.seasonId, user.id),
                ),
            );
            set((state) => ({
                events: state.events.map((e) => {
                    const idx = tempIds.indexOf(e.id);
                    return idx >= 0 ? salvati[idx] : e;
                }),
            }));
        } catch (e) {
            console.error("Errore nel salvataggio degli eventi:", e);
        }

        updatedEvents.sort((a, b) => {
            const pA = periodOrder[a.period] || 0;
            const pB = periodOrder[b.period] || 0;
            if (pA !== pB) return pA - pB;
            return (a.minute ?? 0) - (b.minute ?? 0);
        });

        const { home: homeGoals, away: awayGoals } = countGoals(updatedEvents);
        // Il recupero si ricava dagli eventi: aggiungere un evento
        // 'stoppage' deve cambiare i minuti giocati, quindi va applicato
        // PRIMA di syncAndPersistMinutes (che legge match.addedTime dallo
        // stato) e non dopo.
        const addedTime = deriveAddedTime(updatedEvents);
        const updatedMatch = { ...match, result: { home: homeGoals, away: awayGoals }, addedTime };

        set({ events: updatedEvents, match: updatedMatch });

        await matchRepository.update(matchId, match.seasonId, {
            result: { home: homeGoals, away: awayGoals },
            addedTime,
        });
        get().syncAndPersistMinutes();
    },

    updateEvent: async (eventId, eventData) => {
        const { matchId, match, events: currentEvents } = get();
        const user = useAuthStore.getState().user;
        if (!matchId || !match || !user) return;

        // La dashboard mostra la leaderboard, che loadSummaryStats NON
        // ricalcola: ogni scrittura qui la rende stale fino a
        // /statistiche. Si marca il contesto sporco e si lascia il
        // refresh alla dashboard (refreshIfDirty). Viene fatto PRIMA
        // del ramo offline, che pure torna qui senza passare da
        // syncAndPersistMinutes.
        useStatsStore.getState().markStatsDirty();

        const updatedEvents = currentEvents.map(e => 
          e.id === eventId ? { ...e, ...eventData } : e
        ).sort((a, b) => {
            const pA = periodOrder[a.period] || 0;
            const pB = periodOrder[b.period] || 0;
            if (pA !== pB) return pA - pB;
            return (a.minute ?? 0) - (b.minute ?? 0);
        });

        const { home: homeGoals, away: awayGoals } = countGoals(updatedEvents);
        const addedTime = deriveAddedTime(updatedEvents);
        const updatedMatch = { ...match, result: { home: homeGoals, away: awayGoals }, addedTime };

        set({ events: updatedEvents, match: updatedMatch });

        if (isOffline()) {
          await enqueueMutation({
            collection: 'matchEvents',
            docId: eventId,
            action: 'update',
            payload: eventData,
            userId: user.id,
            seasonId: match.seasonId,
            matchId,
          });
          return;
        }

        // Atteso, come in addEvent/addEvents: scritture non attese si
        // sovrascrivono a vicenda e l'ultima arriva con dati vecchi.
        try {
            await eventRepository.update(eventId, matchId, match.seasonId, eventData);
            await matchRepository.update(matchId, match.seasonId, {
                result: { home: homeGoals, away: awayGoals },
                addedTime,
            });
        } catch (e) {
            console.error("Errore nell'aggiornamento dell'evento:", e);
        }
        get().syncAndPersistMinutes();
    },

    deleteEvent: async (eventId) => {
        const { matchId, match, events: currentEvents } = get();
        const user = useAuthStore.getState().user;
        if (!matchId || !match || !user) return;

        // La dashboard mostra la leaderboard, che loadSummaryStats NON
        // ricalcola: ogni scrittura qui la rende stale fino a
        // /statistiche. Si marca il contesto sporco e si lascia il
        // refresh alla dashboard (refreshIfDirty). Viene fatto PRIMA
        // del ramo offline, che pure torna qui senza passare da
        // syncAndPersistMinutes.
        useStatsStore.getState().markStatsDirty();

        const updatedEvents = currentEvents.filter(e => e.id !== eventId);
        const { home: homeGoals, away: awayGoals } = countGoals(updatedEvents);
        // Cancellare l'evento 'stoppage' deve cancellare anche il recupero:
        // senza questo la partita resterebbe con minuti che non hanno piu'
        // nessun evento che li dichiari.
        const addedTime = deriveAddedTime(updatedEvents);
        const updatedMatch = { ...match, result: { home: homeGoals, away: awayGoals }, addedTime };

        set({ events: updatedEvents, match: updatedMatch });

        if (isOffline()) {
          await enqueueMutation({
            collection: 'matchEvents',
            docId: eventId,
            action: 'delete',
            payload: {},
            userId: user.id,
            seasonId: match.seasonId,
            matchId,
          });
          return;
        }

        // Atteso, come negli altri percorsi: cancellare un evento e salvare
        // il risultato devono essere sequenziali, altrimenti il risultato puo'
        // arrivare prima della cancellazione e contare un gol che non c'e' piu'.
        try {
            await eventRepository.delete(eventId, matchId, match.seasonId);
            await matchRepository.update(matchId, match.seasonId, {
                result: { home: homeGoals, away: awayGoals },
                addedTime,
            });
        } catch (e) {
            console.error("Errore nella cancellazione dell'evento:", e);
        }

        get().syncAndPersistMinutes();
    },
    
    updateMatch: async (data) => {
        const { matchId, match } = get();
        if (!matchId || !match) return;

        // Un update della partita tocca quasi sempre il riepilogo o la
        // leaderboard (result, status completed, durata), e NON passa da
        // syncAndPersistMinutes quando non cambiano durata/recupero/stato.
        useStatsStore.getState().markStatsDirty();

        let updates: Partial<Match> = { ...data };
        // Se la partita viene segnata come completata ma non c'è un risultato, lo inizializziamo a 0-0
        if (updates.status === 'completed' && !match.result && !updates.result) {
            updates.result = { home: 0, away: 0 };
        }

        const updatedMatch = { ...match, ...updates };
        set({ match: updatedMatch });

        matchRepository.update(matchId, match.seasonId, updates);
        
        // Ricalcola i minuti se cambiano durata, recupero o stato: il
        // recupero modifica la fine partita reale (95 con 5 di 2TS), quindi
        // senza questo i minuti resterebbero quelli senza recupero. La
        // presenza dei minuti e' controllata con !== undefined, non truthiness:
        // azzerare il recupero ({'2TS': 0}) deve ricalcolare come 90.
        if (updates.duration !== undefined || updates.addedTime !== undefined || updates.status === 'completed') {
            get().syncAndPersistMinutes();
        }
    },

    saveLineup: async (lineupData) => {
        const { matchId, match } = get();
        const user = useAuthStore.getState().user;
        if (!matchId || !match || !user) return;

        // La dashboard mostra la leaderboard, che loadSummaryStats NON
        // ricalcola: ogni scrittura qui la rende stale fino a
        // /statistiche. Si marca il contesto sporco e si lascia il
        // refresh alla dashboard (refreshIfDirty). Viene fatto PRIMA
        // del ramo offline, che pure torna qui senza passare da
        // syncAndPersistMinutes.
        useStatsStore.getState().markStatsDirty();

        // Optimistic local update (works online and offline)
        set({ lineup: { ...lineupData, matchId } });

        if (isOffline()) {
          // Queue the mutation; it will be flushed when connectivity returns
          await enqueueMutation({
            collection: 'matchLineups',
            docId: matchId,
            action: 'update',
            payload: { ...lineupData, matchId },
            userId: user.id,
            seasonId: match.seasonId,
          });
          return;
        }

        lineupRepository.save({ ...lineupData, matchId }, match.seasonId, user.id);
        get().syncAndPersistMinutes();
    }
  }),
  {
    name: 'pitchman-match-detail',
  }
 )
);
