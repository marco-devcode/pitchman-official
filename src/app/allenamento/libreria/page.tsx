"use client";

import { useMemo, useState, useEffect } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Plus, Search, Filter, Globe, Lock, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { PiTrafficCone } from "react-icons/pi";
import { useExerciseStore } from "@/store/useExerciseStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ExerciseCard } from "@/components/allenamento/exercise-card";
import { ExerciseDialog } from "../../../components/allenamento/exercise-dialog";
import { AiExerciseGenerator } from "@/components/allenamento/ai-exercise-generator";
import { ExerciseViewDialog } from "../../../components/allenamento/exercise-view-dialog";
import { ExerciseFilterDialog } from "../../../components/allenamento/exercise-filter-dialog";
import { cn } from "@/lib/utils";

export default function ExerciseLibraryPage() {
  const router = useRouter();
  const user = useAuthStore(state => state.user);
  const { exercises, loading, fetchAll, deleteExercise } = useExerciseStore();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [focusFilter, setFocusFilter] = useState<string | null>(null);
  const [visibilityFilter, setVisibilityFilter] = useState<'all' | 'private' | 'global'>('all');
  const [playerCountFilter, setPlayerCountFilter] = useState<string[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [isAiGeneratorOpen, setIsAiGeneratorOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<any>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const filteredExercises = useMemo(() => {
    return exercises.filter(ex => {
      const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          ex.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (ex.objectives?.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesFocus = !focusFilter || ex.focus.includes(focusFilter);
      const matchesVisibility = visibilityFilter === 'all' || ex.visibility === visibilityFilter;
      const matchesPlayerCount = playerCountFilter.length === 0 || 
                               playerCountFilter.some(c => ex.playerCount.includes(c));
      
      return matchesSearch && matchesFocus && matchesVisibility && matchesPlayerCount;
    });
  }, [exercises, searchTerm, focusFilter, visibilityFilter, playerCountFilter]);

  const uniqueFocuses = useMemo(() => {
    const sets = new Set<string>();
    exercises.forEach(ex => ex.focus.forEach(f => sets.add(f)));
    if (sets.size === 0) return ['Tecnico', 'Tattico', 'Fisico', 'Portieri', 'Partita', 'Recupero'];
    return Array.from(sets).sort();
  }, [exercises]);

  const handleEdit = (ex: any) => {
    setSelectedExercise(ex);
    setIsDialogOpen(true);
  };

  const handleView = (ex: any) => {
    setSelectedExercise(ex);
    setIsViewOpen(true);
  };

  const handleAdd = () => {
    setSelectedExercise(null);
    setIsDialogOpen(true);
  };

  const activeFiltersCount = (focusFilter ? 1 : 0) + (visibilityFilter !== 'all' ? 1 : 0) + (playerCountFilter.length > 0 ? 1 : 0);

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button 
          variant="ghost" 
          size="icon" 
          onClick={() => router.push('/allenamento')} 
          className="h-10 w-10 rounded-xl bg-card dark:bg-black/40 border border-border dark:border-brand-green/30 hover:bg-muted dark:hover:bg-brand-green/10 shadow-sm dark:shadow-themesoft text-primary dark:text-brand-green transition-all"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col">
          <h1 className="text-2xl font-black uppercase tracking-tighter text-foreground dark:text-white leading-none">Libreria Esercizi</h1>
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-1 flex items-center gap-2">
            <PiTrafficCone className="h-3 w-3 text-primary dark:text-brand-green" /> Repository Tecnico Condiviso
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-1 min-w-[300px] gap-2">
          <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary dark:group-focus-within:text-brand-green transition-colors" />
            <Input 
              placeholder="Cerca per nome o descrizione..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-11 rounded-2xl bg-card dark:bg-black/40 border-border dark:border-brand-green/20 focus-visible:ring-primary dark:focus-visible:ring-brand-green focus-visible:border-primary dark:focus-visible:border-brand-green shadow-sm text-sm"
            />
          </div>
          
          <Button 
            variant="outline" 
            onClick={() => setIsFilterDialogOpen(true)}
            className={cn(
              "h-11 px-4 rounded-2xl gap-2 border-border dark:border-brand-green/20 bg-card dark:bg-black/40 transition-all hover:bg-primary/10 dark:hover:bg-brand-green/10",
              activeFiltersCount > 0 && "border-primary dark:border-brand-green shadow-theme"
            )}
          >
            <Filter className={cn("h-4 w-4", activeFiltersCount > 0 ? "text-primary dark:text-brand-green" : "text-muted-foreground")} />
            <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Filtra</span>
            {activeFiltersCount > 0 && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary dark:bg-brand-green text-[9px] text-white dark:text-black font-black">{activeFiltersCount}</span>}
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleAdd}
            className="h-11 px-6 rounded-2xl bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase tracking-widest text-[10px] shadow-lg dark:shadow-theme-strong hover:scale-[1.02] active:scale-95 transition-all gap-2"
          >
            <Plus className="h-4 w-4" /> Nuovo Esercizio
          </Button>

          {/* Generatore AI: produce un esercizio normale con in piu' i dati
              tattici per l'animazione, quindi lo salva con lo stesso store. */}
          <Button
            onClick={() => setIsAiGeneratorOpen(true)}
            className="h-11 px-4 sm:px-6 rounded-2xl border border-brand-green/40 bg-brand-green/10 text-brand-green font-black uppercase tracking-widest text-[10px] hover:bg-brand-green/20 transition-all hover:scale-[1.02] active:scale-95 gap-2"
          >
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Crea con AI</span>
            <span className="sm:hidden">AI</span>
          </Button>
        </div>
      </div>

      <AiExerciseGenerator
        open={isAiGeneratorOpen}
        onOpenChange={setIsAiGeneratorOpen}
      />

      <ExerciseFilterDialog 
        open={isFilterDialogOpen}
        onOpenChange={setIsFilterDialogOpen}
        focusFilter={focusFilter}
        setFocusFilter={setFocusFilter}
        visibilityFilter={visibilityFilter}
        setVisibilityFilter={setVisibilityFilter}
        playerCountFilter={playerCountFilter}
        setPlayerCountFilter={setPlayerCountFilter}
        uniqueFocuses={uniqueFocuses}
      />

      {loading && exercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 animate-pulse">
          <Loader2 className="h-12 w-12 text-primary dark:text-brand-green animate-spin mb-4" />
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground dark:text-muted-foreground/60">Recupero Archivio...</p>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-border dark:border-brand-green/20 rounded-[40px] bg-card/10 backdrop-blur-sm shadow-inner group transition-all hover:bg-card/20">
          <PiTrafficCone className="h-20 w-20 text-muted-foreground dark:text-muted-foreground/20 dark:text-brand-green/20 mb-6 transition-transform group-hover:scale-110" />
          <h3 className="text-xl font-black uppercase tracking-tight text-foreground dark:text-white/80">Nessun esercizio trovato</h3>
          <p className="text-[10px] font-bold text-muted-foreground dark:text-muted-foreground/60 uppercase tracking-[0.2em] mt-3 max-w-[280px]">
            {searchTerm || focusFilter ? "Modifica i filtri di ricerca per trovare ciò che desideri." : "La libreria è vuota. Inizia aggiungendo il tuo primo esercizio tecnico."}
          </p>
          {!searchTerm && !focusFilter && (
            <Button onClick={handleAdd} variant="link" className="text-primary dark:text-brand-green font-black uppercase text-[10px] tracking-widest mt-6 hover:no-underline hover:scale-105 transition-all">
              Crea Ora <Plus className="h-3 w-3 ml-2" />
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExercises.map((ex) => (
            <ExerciseCard 
              key={ex.id} 
              exercise={ex} 
              isOwner={ex.userId === user?.id}
              onEdit={handleEdit}
              onView={handleView}
              onDelete={deleteExercise}
            />
          ))}
        </div>
      )}

      <ExerciseDialog 
        open={isDialogOpen} 
        onOpenChange={setIsDialogOpen} 
        exercise={selectedExercise}
      />

      <ExerciseViewDialog 
        open={isViewOpen}
        onOpenChange={setIsViewOpen}
        exercise={selectedExercise}
      />
    </div>
  );
}
