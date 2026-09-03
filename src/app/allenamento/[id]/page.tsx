
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useTrainingStore } from "@/store/useTrainingStore";
import { trainingRepository } from "@/lib/repositories/training-repository";
import { useAuthStore } from "@/store/useAuthStore";
import { usePlayersStore } from "@/store/usePlayersStore";
import { ArrowLeft, Save, ClipboardList, Users, CheckCircle2, Clock, XCircle, Loader2, Target, Calendar, ExternalLink, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import type { TrainingSession, TrainingAttendance, TrainingStatus, Player } from "@/lib/types";
import { getPrimaryRole } from "@/lib/types";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import { parseISO } from "date-fns";
import { useExerciseStore } from "@/store/useExerciseStore";
import { displayPlayerName } from "@/lib/utils";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExerciseViewDialog } from "@/components/allenamento/exercise-view-dialog";
import { Exercise } from "@/lib/types";
import { Search, Plus as PlusIcon } from "lucide-react";

export default function TrainingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.id as string;
  const user = useAuthStore(state => state.user);
  const { players, fetchAll: fetchPlayers } = usePlayersStore();
  
  const [session, setSession] = useState<TrainingSession | null>(null);
  const [attendance, setAttendance] = useState<TrainingAttendance[]>([]);
  const [notes, setNotes] = useState("");
  const [focus, setFocus] = useState("");
  const [sessionExercises, setSessionExercises] = useState<{ id: string; duration?: string }[]>([]);
  const [viewingExercise, setViewingExercise] = useState<Exercise | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  
  // Attendance counts
  const presentCount = attendance.filter(a => a.status === 'presente' || a.status === 'ritardo').length;
  const lateCount = attendance.filter(a => a.status === 'ritardo').length;
  const absentCount = players.length - presentCount;
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("programma");

  const { exercises, fetchAll: fetchExercises } = useExerciseStore();
  
  const selectedExerciseIds = sessionExercises.map(e => e.id);
  const selectedExercises = exercises.filter(ex => selectedExerciseIds.includes(ex.id));
  const filteredExercises = exercises.filter(ex => 
    ex.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    ex.focus.some(f => f.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const parseDuration = (dur: string): number => {
    if (!dur) return 0;
    const clean = dur.toLowerCase().replace(/['min]/g, '').trim();
    if (clean.includes('x')) {
      const parts = clean.split('x');
      return (parseFloat(parts[0]) || 0) * (parseFloat(parts[1]) || 0);
    }
    return parseFloat(clean) || 0;
  };

  const totalDuration = sessionExercises.reduce((acc, curr) => {
    const exercise = exercises.find(ex => ex.id === curr.id);
    const durStr = curr.duration || exercise?.duration || "0";
    return acc + parseDuration(durStr);
  }, 0);

  const targetDuration = 90; // 1h30
  const progressPercentage = Math.min(100, (totalDuration / targetDuration) * 100);

  useEffect(() => {
    if (!user || !sessionId) return;

    const load = async () => {
      setLoading(true);
      const s = await trainingRepository.getById(user.id, sessionId);
      if (s) {
        setSession(s);
        setNotes(s.notes || "");
        setFocus(s.focus || "");
        setSessionExercises(s.exercises || (s.exerciseIds || []).map(id => ({ id })));
        const att = await trainingRepository.getAttendance(user.id, sessionId);
        setAttendance(att);
        useTrainingStore.getState().updateSessionLocally(sessionId, { notes: s.notes, focus: s.focus, exerciseIds: s.exerciseIds, ...s });
      }
      await fetchPlayers();
      await fetchExercises();
      setLoading(false);
    };
    load();
  }, [user, sessionId, fetchPlayers]);

  const handleSaveNotes = async () => {
    if (!user || !session) return;
    setSaving(true);
    await trainingRepository.update(user.id, sessionId, { notes, focus, exercises: sessionExercises });
    useTrainingStore.getState().updateSessionLocally(sessionId, { notes, focus, exercises: sessionExercises });
    setSaving(false);
  };

  const toggleExercise = (id: string) => {
    const exercise = exercises.find(ex => ex.id === id);
    setSessionExercises(prev => {
      const exists = prev.find(x => x.id === id);
      if (exists) return prev.filter(x => x.id !== id);
      return [...prev, { id, duration: exercise?.duration || "" }];
    });
  };

  const updateExerciseDuration = (id: string, newDuration: string) => {
    setSessionExercises(prev => prev.map(ex => 
      ex.id === id ? { ...ex, duration: newDuration } : ex
    ));
  };

  const updateAttendance = async (playerId: string, status: TrainingStatus) => {
    if (!user || !session) return;
    const nextAtt = attendance.filter(a => a.playerId !== playerId).concat({ playerId, status });
    setAttendance(nextAtt);
    // update store sync
    useTrainingStore.getState().updateSessionLocally(sessionId, { attendances: nextAtt } as any);
    await trainingRepository.setAttendance(user.id, sessionId, playerId, status);
  };

  const markAllAsPresent = async () => {
    if (!user || !session) return;
    setSaving(true);
    try {
      // Find players not yet marked exactly as present
      const playersToUpdate = players.filter(p => {
         const current = attendance.find(a => a.playerId === p.id);
         return !current || current.status !== 'presente';
      });
      
      if (playersToUpdate.length === 0) {
         setSaving(false);
         return; // Già tutti presenti
      }

      // Costruire il nuovo stato locale
      let currentAtt = [...attendance];
      
      // Update locally immediately
      for (const p of playersToUpdate) {
         currentAtt = currentAtt.filter(a => a.playerId !== p.id).concat({ playerId: p.id, status: 'presente' });
      }
      setAttendance(currentAtt);
      useTrainingStore.getState().updateSessionLocally(sessionId, { attendances: currentAtt } as any);
      
      // Eseguire le chiamate Firestore
      // N.b.: questo potrebbe essere un batch in futuro, ma per compatibilità con l'architettura attuale usiamo Promise.all
      await Promise.all(
        playersToUpdate.map(p => trainingRepository.setAttendance(user.id, sessionId, p.id, 'presente'))
      );
      
    } catch(e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-10 w-10 text-primary dark:text-brand-green animate-spin" />
        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Caricamento Sessione...</p>
      </div>
    );
  }

  if (!session) return <div className="p-8 text-center uppercase font-black">Sessione non trovata</div>;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10 rounded-xl bg-muted dark:bg-black/40 border border-border dark:border-brand-green/30 hover:bg-muted/80 dark:hover:bg-black/60 shadow-none dark:shadow-[0_0_10px_rgba(172,229,4,0.05)] transition-all">
          <ArrowLeft className="h-5 w-5 text-primary dark:text-brand-green" />
        </Button>
        <div className="flex flex-col">
          <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground leading-none flex items-center gap-2">
            <span>Allenamento #{session.index.toString().padStart(2, '0')}</span>
            <span className="text-primary dark:text-brand-green opacity-40">/</span>
            <span className="text-lg opacity-80">{format(session.date.includes('T') ? parseISO(session.date) : new Date(session.date), "dd MMM yyyy", { locale: it })}</span>
          </h1>
          
          {/* Attendance Summary Bar - Always visible under title */}
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black uppercase tracking-widest text-foreground/70">
                {presentCount} / {players.length} ATLETI
              </span>
              <span className="text-[11px] font-black uppercase tracking-widest text-primary dark:text-brand-green">
                {selectedExercises.length} ESERCIZI
              </span>
            </div>
            <div className="h-3 w-full bg-muted dark:bg-zinc-900 rounded-full overflow-hidden border border-border dark:border-brand-green/10 relative">
              <div 
                className="h-full transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(172,229,4,0.4)] bg-primary dark:bg-brand-green"
                style={{ width: `${players.length > 0 ? (presentCount / players.length) * 100 : 0}%` }}
              />
              {lateCount > 0 && (
                <div 
                  className="absolute top-0 right-0 h-full w-[4px] bg-yellow-500 rounded-r-full"
                  style={{ width: `${players.length > 0 ? (lateCount / players.length) * 100 : 0}%` }}
                  title={`Ritardo: ${lateCount} giocatore${lateCount > 1 ? 'i' : ''}`}
                />
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase text-green-600 dark:text-green-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" /> {presentCount - lateCount} Presenti
              </span>
              {lateCount > 0 && (
                <span className="text-[9px] font-bold uppercase text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {lateCount} Ritardo{lateCount > 1 ? 'i' : ''}
                </span>
              )}
              <span className="text-[9px] font-bold uppercase text-red-600 dark:text-red-400 flex items-center gap-1">
                <XCircle className="h-3 w-3" /> {absentCount} Assenti
              </span>
            </div>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6 h-12 bg-muted dark:bg-black/40 p-1 rounded-2xl border border-border dark:border-brand-green/30 shadow-none dark:shadow-[0_0_10px_rgba(172,229,4,0.1)]">
          <TabsTrigger value="programma" className="flex items-center gap-2 text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-card dark:data-[state=active]:bg-black data-[state=active]:border data-[state=active]:border-primary/30 dark:data-[state=active]:border-brand-green data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:shadow-[0_0_10px_rgba(172,229,4,0.15)] transition-all">
            <ClipboardList className="h-4 w-4 text-primary dark:text-brand-green" /> Programma
          </TabsTrigger>
          <TabsTrigger value="presenze" className="flex items-center gap-2 text-[10px] font-black uppercase rounded-xl data-[state=active]:bg-card dark:data-[state=active]:bg-black data-[state=active]:border data-[state=active]:border-primary/30 dark:data-[state=active]:border-brand-green data-[state=active]:text-foreground dark:data-[state=active]:text-white data-[state=active]:shadow-sm dark:data-[state=active]:shadow-[0_0_10px_rgba(172,229,4,0.15)] transition-all">
            <Users className="h-4 w-4 text-primary dark:text-brand-green" /> Presenze
          </TabsTrigger>
        </TabsList>

        <TabsContent value="programma" className="space-y-4 outline-none">
          <Card className="rounded-3xl border border-border dark:border-brand-green/30 shadow-sm dark:shadow-[0_0_15px_rgba(172,229,4,0.1)] overflow-hidden">
            <CardHeader className="bg-muted dark:bg-black/60 border-b border-border dark:border-brand-green/30 p-6 pb-8">
              <CardTitle className="text-lg font-black uppercase tracking-tight text-foreground">Esercitazioni e Obiettivi</CardTitle>
              <CardDescription className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest">Definisci il piano tecnico della seduta.</CardDescription>
              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-foreground/60">Carico Sessione (Target 1h30)</span>
                  <span className={cn(
                    "text-[10px] font-black uppercase",
                    totalDuration > targetDuration ? "text-rose-500" : "text-primary dark:text-brand-green"
                  )}>{totalDuration} / {targetDuration} MIN</span>
                </div>
                <div className="h-2 w-full bg-muted dark:bg-zinc-900 rounded-full overflow-hidden border border-border dark:border-brand-green/10">
                  <div 
                    className={cn(
                      "h-full transition-all duration-500 rounded-full shadow-[0_0_10px_rgba(var(--primary),0.3)]",
                      totalDuration > targetDuration ? "bg-rose-500" : "bg-primary dark:bg-brand-green"
                    )}
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 bg-card dark:bg-background rounded-t-3xl border-t border-border dark:border-brand-green/30 space-y-6">
              <div className="space-y-3 pb-6 border-b border-border dark:border-brand-green/20">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary dark:text-brand-green" />
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green">Focus:</Label>
                </div>
                <Input 
                  placeholder="Es. Tecnico, Tattico, Fisico..."
                  className="h-11 rounded-xl bg-background dark:bg-black border border-primary/50 dark:border-brand-green shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.15)] text-foreground font-bold text-sm focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                />
                <div className="flex flex-wrap gap-2">
                  {['Tecnico', 'Tattico', 'Fisico', 'Portieri', 'Partita', 'Recupero'].map(f => (
                    <button
                      key={f}
                      onClick={() => setFocus(f)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-wider transition-all",
                        focus === f ? "bg-primary dark:bg-black border border-primary dark:border-brand-green text-white shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.15)]" : "bg-muted/30 text-muted-foreground hover:bg-muted/50 border border-transparent"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sezione Esercitazioni Aggiunte */}
              {selectedExercises.length > 0 && (
                <div className="space-y-3 pb-6 border-b border-border dark:border-brand-green/20">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4 text-primary dark:text-brand-green" />
                    <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green">Esercitazioni Selezionate:</Label>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedExercises.map((ex) => {
                      const sessionEx = sessionExercises.find(s => s.id === ex.id);
                      return (
                        <Card 
                          key={ex.id} 
                          className="group relative rounded-2xl border border-border dark:border-brand-green/20 hover:border-primary dark:hover:border-brand-green bg-muted/20 dark:bg-black/40 overflow-hidden transition-all shadow-sm"
                        >
                          <CardContent className="p-4 flex flex-col gap-3">
                             <div className="flex items-center justify-between">
                                <div className="flex flex-col min-w-0" onClick={() => setViewingExercise(ex)}>
                                   <span className="text-[11px] font-black uppercase text-foreground leading-tight truncate pr-2 hover:text-primary dark:hover:text-brand-green cursor-pointer">{ex.name}</span>
                                   <div className="flex flex-wrap gap-1 mt-1">
                                      {ex.focus.slice(0, 1).map(f => (
                                        <Badge key={f} variant="outline" className="text-[7px] py-0 px-1 border-primary/20 dark:border-brand-green/20 text-muted-foreground uppercase">{f}</Badge>
                                      ))}
                                   </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex flex-col items-center">
                                      <Label className="text-[8px] font-black uppercase text-muted-foreground/50 mb-0.5">Serie</Label>
                                      <Input 
                                        type="number"
                                        className="h-8 w-12 text-center text-[10px] font-black uppercase bg-background dark:bg-black border-border dark:border-brand-green/20 p-0 focus-visible:ring-brand-green"
                                        value={(sessionEx?.duration || "").includes('x') ? (sessionEx?.duration || "").split('x')[0] : ""}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const parts = (sessionEx?.duration || "").split('x');
                                          const mins = parts.length > 1 ? parts[1] : (sessionEx?.duration || "");
                                          updateExerciseDuration(ex.id, val ? `${val}x${mins}` : mins);
                                        }}
                                        placeholder="1"
                                      />
                                    </div>
                                    <span className="text-muted-foreground/30 font-black text-xs mt-3">x</span>
                                    <div className="flex flex-col items-center">
                                      <Label className="text-[8px] font-black uppercase text-muted-foreground/50 mb-0.5">Minuti</Label>
                                      <Input 
                                        type="number"
                                        className="h-8 w-14 text-center text-[10px] font-black uppercase bg-background dark:bg-black border-border dark:border-brand-green/20 p-0 focus-visible:ring-brand-green"
                                        value={(sessionEx?.duration || "").includes('x') ? (sessionEx?.duration || "").split('x')[1] : (sessionEx?.duration || "")}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          const parts = (sessionEx?.duration || "").split('x');
                                          const sets = parts.length > 1 ? parts[0] : "";
                                          updateExerciseDuration(ex.id, sets ? `${sets}x${val}` : val);
                                        }}
                                        placeholder="15"
                                      />
                                    </div>
                                  </div>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-8 w-8 rounded-lg text-rose-500 hover:bg-rose-500/10 mt-3"
                                    onClick={() => toggleExercise(ex.id)}
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                </div>
                             </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-primary dark:text-brand-green" />
                  <Label className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-green">Note e Programma Dettagliato:</Label>
                </div>
                <Textarea 
                  placeholder="Inserisci qui gli esercizi aggiuntivi o dettagli sul programma (es. Riscaldamento tecnico, Partitella finale...)"
                  className="min-h-[400px] text-sm leading-relaxed bg-background dark:bg-black/40 border border-border dark:border-brand-green/30 rounded-2xl p-4 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green resize-none shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.05)] text-foreground dark:text-white"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
              <div className="pt-6 border-t border-border dark:border-brand-green/20 mt-6">
                <Button 
                  className="w-full h-12 bg-primary dark:bg-black border border-primary dark:border-brand-green text-white rounded-2xl font-black uppercase text-xs shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.15)] hover:opacity-90 dark:hover:bg-black/80 transition-all"
                  onClick={handleSaveNotes}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  Salva Programma
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="presenze" className="space-y-4 outline-none">
          <div className="flex items-center justify-between mb-4 mt-2">
             <h3 className="text-[12px] font-black uppercase text-foreground/80 tracking-widest pl-2">Lista Convocati</h3>
             <Button 
               size="sm" 
               className="h-9 rounded-xl font-black uppercase text-[10px] bg-primary dark:bg-black border border-primary dark:border-brand-green text-white hover:opacity-90 dark:hover:bg-black/80 shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.15)] hover:scale-105 transition-all"
               onClick={markAllAsPresent}
               disabled={saving || players.length === 0}
             >
               {saving ? <Loader2 className="h-3 w-3 animate-spin mr-1.5 text-white dark:text-brand-green" /> : <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-white dark:text-brand-green" />}
               Tutti Presenti
             </Button>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {players.map(player => {
              const currentStatus = attendance.find(a => a.playerId === player.id)?.status;
              
              return (
                <Card key={player.id} className="rounded-2xl border border-border dark:border-brand-green/20 overflow-hidden bg-card dark:bg-card/40 backdrop-blur-sm shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.05)]">
                  <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4 w-full">
                    <div className="flex flex-col justify-center sm:pl-2 flex-1">
                      <span className="text-[15px] font-black uppercase tracking-tight text-foreground">{displayPlayerName(player)}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">{getPrimaryRole(player)}</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 w-full">
                      <Button 
                        size="sm" 
                        variant={currentStatus === 'presente' ? 'default' : 'outline'}
                        className={cn(
                          "h-10 rounded-xl font-black uppercase text-[9px] px-2 transition-all",
                          currentStatus === 'presente' ? "bg-green-500 hover:bg-green-600 text-white border-none" : "border-green-500/30 text-green-600 hover:bg-green-50"
                        )}
                        onClick={() => updateAttendance(player.id, 'presente')}
                      >
                        Presente
                      </Button>
                      <Button 
                        size="sm" 
                        variant={currentStatus === 'ritardo' ? 'default' : 'outline'}
                        className={cn(
                          "h-10 rounded-xl font-black uppercase text-[9px] px-2 transition-all",
                          currentStatus === 'ritardo' ? "bg-yellow-500 hover:bg-yellow-600 text-white border-none" : "border-yellow-500/30 text-yellow-600 hover:bg-yellow-50"
                        )}
                        onClick={() => updateAttendance(player.id, 'ritardo')}
                      >
                        Ritardo
                      </Button>
                      <Button 
                        size="sm" 
                        variant={currentStatus === 'assente' ? 'default' : 'outline'}
                        className={cn(
                          "h-10 rounded-xl font-black uppercase text-[9px] px-2 transition-all",
                          currentStatus === 'assente' ? "bg-red-500 hover:bg-red-600 text-white border-none" : "border-red-500/30 text-red-600 hover:bg-red-50"
                        )}
                        onClick={() => updateAttendance(player.id, 'assente')}
                      >
                        Assente
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Floating Action Button for Exercises - Visible only in Programma tab */}
      {activeTab === "programma" && (
        <div className="fixed bottom-24 right-6 z-50">
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button 
                  size="icon" 
                  className="h-12 w-12 rounded-full bg-primary dark:bg-black border-4 border-card dark:border-brand-green/20 text-white dark:text-brand-green shadow-2xl hover:scale-110 active:scale-95 transition-all group"
                >
                  <PlusIcon className="h-6 w-6 group-hover:rotate-90 transition-transform duration-300" />
                </Button>
              </PopoverTrigger>
              <PopoverContent 
                side="top" 
                align="end" 
                className="w-80 p-0 mr-2 mb-2 bg-card dark:bg-black border border-border dark:border-brand-green/30 rounded-[32px] shadow-2xl overflow-hidden"
              >
                <div className="p-5 border-b border-border dark:border-brand-green/20 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-foreground">Aggiungi Esercizi</h3>
                  <div className="relative">
                     <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                     <Input 
                      placeholder="Cerca in libreria..."
                      className="h-9 pl-9 rounded-xl bg-muted/30 border-none text-[11px] font-bold"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                     />
                  </div>
                </div>
                <ScrollArea className="h-72">
                  <div className="p-2 space-y-1">
                    {filteredExercises.map(ex => {
                      const isSelected = selectedExerciseIds.includes(ex.id);
                      return (
                        <button 
                          key={ex.id}
                          onClick={() => toggleExercise(ex.id)}
                          className={cn(
                            "w-full flex items-center justify-between p-4 rounded-2xl transition-all text-left group",
                            isSelected ? "bg-primary/5 dark:bg-brand-green/5 border border-primary/20 dark:border-brand-green/20" : "hover:bg-muted/30 border border-transparent"
                          )}
                        >
                           <div className="flex flex-col gap-0.5 max-w-[80%]">
                              <span className={cn("text-[11px] font-black uppercase truncate", isSelected ? "text-primary dark:text-brand-green" : "text-foreground")}>
                                {ex.name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest truncate">{ex.focus.join(' · ')}</span>
                                {ex.duration && (
                                  <>
                                    <span className="text-[8px] text-muted-foreground opacity-30">•</span>
                                    <span className="text-[8px] font-black text-primary dark:text-brand-green uppercase tracking-widest">{ex.duration}</span>
                                  </>
                                )}
                              </div>
                           </div>
                           {isSelected ? (
                              <div className="h-5 w-5 rounded-full bg-primary dark:bg-brand-green flex items-center justify-center">
                                 <CheckCircle2 className="h-3 w-3 text-white dark:text-black" />
                              </div>
                           ) : (
                              <PlusIcon className="h-4 w-4 text-muted-foreground/30 group-hover:text-foreground" />
                           )}
                        </button>
                      );
                    })}
                    {exercises.length === 0 && (
                       <div className="p-8 text-center">
                          <p className="text-[10px] font-black uppercase text-muted-foreground opacity-30">Nessun esercizio trovato</p>
                       </div>
                    )}
                  </div>
                </ScrollArea>
                <div className="p-4 bg-muted/10 dark:bg-brand-green/5 border-t border-border dark:border-brand-green/20">
                    <Button 
                      className="w-full h-10 rounded-xl bg-primary dark:bg-brand-green text-white dark:text-black text-[10px] font-black uppercase tracking-widest shadow-lg"
                      onClick={() => setIsPopoverOpen(false)}
                    >
                      Fatto ({selectedExerciseIds.length})
                    </Button>
                </div>
              </PopoverContent>
            </Popover>
        </div>
      )}

      {/* Detail Dialog */}
      <ExerciseViewDialog 
        open={!!viewingExercise}
        onOpenChange={(open) => !open && setViewingExercise(null)}
        exercise={viewingExercise}
      />
    </div>
  );
}
