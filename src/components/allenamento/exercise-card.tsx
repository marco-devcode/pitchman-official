"use client";

import { Exercise } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Globe, Lock, Image as ImageIcon, Video, Link as LinkIcon, Users, ExternalLink } from "lucide-react";
import { PiTrafficCone } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from "@/components/ui/alert-dialog";

interface ExerciseCardProps {
  exercise: Exercise;
  isOwner: boolean;
  onEdit: (ex: Exercise) => void;
  onDelete: (id: string) => void;
  onView: (ex: Exercise) => void;
}

export function ExerciseCard({ exercise, isOwner, onEdit, onDelete, onView }: ExerciseCardProps) {
  return (
    <Card 
      className="group overflow-hidden bg-white/50 dark:bg-black/40 backdrop-blur-xl border-border dark:border-brand-green/10 transition-all hover:bg-white/80 dark:hover:bg-brand-green/5 hover:border-primary/40 dark:hover:border-brand-green/30 rounded-[32px] shadow-sm hover:shadow-2xl hover:shadow-primary/5 dark:hover:shadow-brand-green/10 flex flex-col h-full relative cursor-pointer active:scale-[0.98] outline-none"
      onClick={() => onView(exercise)}
    >
      {/* Media Header */}
      <div className="relative h-44 w-full overflow-hidden">
        {exercise.media.find(m => m.type === 'image') ? (
          <img 
            src={exercise.media.find(m => m.type === 'image')?.url} 
            alt={exercise.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
            onError={(e) => {
              (e.target as any).src = 'https://placehold.co/400x200?text=Immagine+non+disponibile';
            }}
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 dark:from-brand-green/10 dark:to-transparent flex items-center justify-center">
            <PiTrafficCone className="h-10 w-10 text-primary/20 dark:text-brand-green/20" />
          </div>
        )}
        
        {/* Overlay Gradients */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />
        
        {/* badges overlay */}
        <div className="absolute top-4 left-4 flex flex-col gap-2">
          {exercise.focus.slice(0, 1).map((f) => (
            <Badge key={f} className="bg-primary/90 dark:bg-brand-green shadow-xl text-white dark:text-black font-black uppercase text-[8px] px-2.5 py-1 border-none tracking-widest">
              {f}
            </Badge>
          ))}
        </div>

        {/* Actions Overlay */}
        {isOwner && (
          <div className="absolute top-4 right-4 z-20 flex gap-2 lg:opacity-0 lg:group-hover:opacity-100 transition-all duration-300 translate-y-[-10px] lg:group-hover:translate-y-0">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-9 w-9 rounded-2xl bg-white/80 dark:bg-black/60 backdrop-blur-md border border-white/20 dark:border-white/10 text-foreground dark:text-white hover:bg-primary dark:hover:bg-brand-green hover:text-white dark:hover:text-black transition-all"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(exercise);
              }}
            >
              <Pencil className="h-4.5 w-4.5" />
            </Button>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-9 w-9 rounded-2xl bg-white/80 dark:bg-black/60 backdrop-blur-md border border-white/20 dark:border-white/10 text-foreground dark:text-white hover:bg-rose-500 hover:text-white transition-all"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent 
                className="rounded-[40px] border border-border dark:border-brand-green/20 bg-card dark:bg-zinc-950 p-8 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <AlertDialogHeader className="mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-rose-500/10 flex items-center justify-center mb-4 border border-rose-500/20">
                    <Trash2 className="h-7 w-7 text-rose-500" />
                  </div>
                  <AlertDialogTitle className="text-2xl font-black uppercase tracking-tighter text-foreground dark:text-white">Elimina Esercizio?</AlertDialogTitle>
                  <AlertDialogDescription className="text-sm font-bold text-muted-foreground/80 dark:text-muted-foreground/60 leading-relaxed uppercase tracking-widest">
                    Questa azione non può essere annullata. L'esercizio verrà rimosso permanentemente dal tuo archivio tecnico.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3 mt-6">
                  <AlertDialogCancel className="h-14 rounded-[20px] font-black uppercase text-[10px] bg-muted/10 border-border dark:border-white/5 hover:bg-muted/20 tracking-widest">Annulla</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => onDelete(exercise.id)}
                    className="h-14 rounded-[20px] bg-rose-500 hover:bg-rose-600 text-white font-black uppercase text-[10px] shadow-xl shadow-rose-500/20 tracking-widest"
                  >
                    Conferma Eliminazione
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>
      
      <CardHeader className="p-6 pt-2 pb-2">
        <CardTitle className="text-xl font-black uppercase tracking-tighter text-foreground line-clamp-1 group-hover:text-primary dark:group-hover:text-brand-green transition-colors">
          {exercise.name}
        </CardTitle>
        <div className="flex items-center gap-4 mt-1 text-muted-foreground/80 dark:text-muted-foreground/40">
           <div className="flex items-center gap-1.5">
              <Users className="h-3 w-3" />
              <span className="text-[9px] font-black uppercase tracking-widest">{exercise.playerCount.slice(0,2).join(', ')} {exercise.playerCount.length > 2 ? '+' : ''}</span>
           </div>
           <div className="flex items-center gap-1.5">
              <Globe className={cn("h-3 w-3", exercise.visibility === 'global' ? "text-blue-500" : "text-amber-500")} />
              <span className="text-[9px] font-black uppercase tracking-widest">{exercise.visibility}</span>
           </div>
        </div>
      </CardHeader>

      <CardContent className="px-6 py-4 flex-1 flex flex-col justify-between">
        <p className="text-[11px] text-muted-foreground/80 line-clamp-3 leading-relaxed font-medium mb-4 italic select-text">
          {exercise.description}
        </p>
        
        <div className="flex items-center justify-between pt-4 border-t border-border/50 dark:border-brand-green/5">
          <div className="flex -space-x-2">
            {exercise.media.length > 0 ? (
              exercise.media.map((m, i) => (
                <div key={i} className={cn(
                  "h-8 w-8 rounded-xl flex items-center justify-center border-2 border-background dark:border-zinc-950 shadow-sm overflow-hidden bg-muted dark:bg-zinc-800 transition-transform hover:z-10 hover:scale-110",
                  m.type !== 'image' && (m.type === 'video' ? "text-rose-500" : "text-amber-500")
                )}>
                  {m.type === 'image' ? (
                    <img src={m.url} alt="res" className="h-full w-full object-cover" />
                  ) : m.type === 'video' ? (
                    <Video className="h-3.5 w-3.5" />
                  ) : (
                    <LinkIcon className="h-3.5 w-3.5" />
                  )}
                </div>
              ))
            ) : (
              <div className="h-8 w-8 rounded-xl bg-muted/20 flex items-center justify-center">
                <ImageIcon className="h-3.5 w-3.5 text-muted-foreground/20" />
              </div>
            )}
          </div>
          
          <Button variant="ghost" className="h-8 rounded-xl text-[9px] font-black uppercase tracking-widest text-primary dark:text-brand-green hover:bg-primary/5 dark:hover:bg-brand-green/5">
            Dettagli <ExternalLink className="h-3 w-3 ml-1.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
