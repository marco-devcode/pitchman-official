"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Target, Users, ExternalLink, ImageIcon, Video, Link as LinkIcon, Calendar, Clock, Sparkles } from "lucide-react";
import ExercisePlayer from "@/components/allenamento/exercise-player";
import { PiTrafficCone } from "react-icons/pi";
import { Exercise } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface ExerciseViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise: Exercise | null;
}

export function ExerciseViewDialog({ open, onOpenChange, exercise }: ExerciseViewDialogProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  if (!exercise) return null;

  const formatUrl = (url: string) => {
    if (!url) return '';
    // Consenti protocolli standard e Base64 senza aggiungere https://
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) return url;
    return `https://${url}`;
  };

  const handleResourceClick = (e: React.MouseEvent, m: any) => {
    if (m.type === 'image') {
      e.preventDefault();
      setSelectedImage(m.url);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[95vw] sm:max-w-3xl max-h-[92vh] bg-card dark:bg-zinc-950 border border-border dark:border-brand-green/30 rounded-[32px] shadow-2xl p-0 outline-none overflow-hidden flex flex-col">
          <div className="p-6 md:p-8 flex-1 overflow-y-auto scrollbar-hide">
            <div className="space-y-8">
              {/* Header Section */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-2">
                    {exercise.focus.map(f => (
                      <Badge key={f} className="bg-primary/10 dark:bg-brand-green/10 text-primary dark:text-brand-green font-black uppercase text-[9px] px-3 py-1 rounded-lg border border-primary/20 dark:border-brand-green/20 tracking-widest">
                        {f}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <DialogTitle className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-foreground dark:text-white leading-none">
                    {exercise.name}
                  </DialogTitle>
                  <div className="flex items-center gap-4 text-muted-foreground dark:text-muted-foreground/60">
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">{exercise.playerCount.join(', ')} Giocatori</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-bold uppercase tracking-widest">Autore: {exercise.ownerName}</span>
                    </div>
                    {exercise.duration && (
                      <div className="flex items-center gap-1.5 text-primary dark:text-brand-green">
                        <Clock className="h-3.5 w-3.5" />
                        <span className="text-[10px] font-black uppercase tracking-widest">Durata: {exercise.duration}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Content Sections */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="md:col-span-2 space-y-8">
                  {exercise.objectives && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/5 dark:bg-brand-green/5 flex items-center justify-center border border-primary/10 dark:border-brand-green/10">
                          <Target className="h-4 w-4 text-primary dark:text-brand-green" />
                        </div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Obiettivi Strategici</h3>
                      </div>
                      <div className="bg-muted/30 dark:bg-zinc-900/40 p-5 rounded-3xl border border-border/50 dark:border-brand-green/5">
                        <p className="text-sm md:text-base text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium select-text">
                          {exercise.objectives}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-primary/5 dark:bg-brand-green/5 flex items-center justify-center border border-primary/10 dark:border-brand-green/10">
                        <PiTrafficCone className="h-4 w-4 text-primary dark:text-brand-green" />
                      </div>
                      <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Svolgimento dell'Esercizio</h3>
                    </div>
                    <div className="bg-muted/30 dark:bg-zinc-900/40 p-5 rounded-3xl border border-border/50 dark:border-brand-green/5">
                      <p className="text-sm md:text-base text-foreground/80 leading-relaxed whitespace-pre-wrap font-medium select-text">
                        {exercise.description}
                      </p>
                    </div>
                  </div>

                  {/* Animazione tattica: presente solo se l'esercizio e' stato
                      generato con AI. Gli esercizi creati a mano non hanno il
                      campo `tactical` e qui semplicemente non compare nulla. */}
                  {exercise.tactical && exercise.tactical.steps?.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <Sparkles className="h-4 w-4 text-primary dark:text-brand-green" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-foreground">
                          Lavagna Animata
                        </h3>
                      </div>
                      <div className="flex justify-center rounded-3xl border border-border/50 dark:border-brand-green/10 bg-muted/20 dark:bg-zinc-900/30 p-4">
                        <ExercisePlayer data={exercise.tactical} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Sidebar: Media Resources */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 px-1">
                    <ImageIcon className="h-4 w-4 text-primary dark:text-brand-green" />
                    <h3 className="text-xs font-black uppercase tracking-widest text-foreground">Risorse Esterne</h3>
                  </div>
                  <div className="flex flex-col gap-2">
                    {exercise.media.length === 0 ? (
                      <div className="py-8 text-center bg-muted/10 dark:bg-zinc-900/20 rounded-3xl border border-dashed border-border/40">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/30 italic">Nessun file allegato</p>
                      </div>
                    ) : (
                      exercise.media.map((m, i) => (
                        <a 
                          key={i} 
                          href={formatUrl(m.url)} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => handleResourceClick(e, m)}
                          className="flex items-center justify-between p-3.5 rounded-2xl bg-muted/20 dark:bg-zinc-900 border border-border dark:border-brand-green/5 hover:border-primary dark:hover:border-brand-green hover:bg-primary/5 dark:hover:bg-brand-green/5 transition-all group shadow-sm"
                        >
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className={cn(
                              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 overflow-hidden border border-border/20",
                              m.type === 'image' ? "bg-blue-500/10 text-blue-500" : m.type === 'video' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                            )}>
                              {m.type === 'image' ? (
                                <img src={m.url} className="h-full w-full object-cover" onError={(e) => {
                                  (e.target as any).src = 'https://placehold.co/100x100?text=IMG';
                                }} />
                              ) : m.type === 'video' ? <Video className="h-4 w-4" /> : <LinkIcon className="h-4 w-4" />}
                            </div>
                            <div className="flex flex-col overflow-hidden">
                              <span className="text-[10px] font-black uppercase tracking-tight text-foreground">
                                {m.type === 'image' ? 'Visualizza Immagine' : m.type === 'video' ? 'Video Full' : 'Allegato'}
                              </span>
                              <span className="text-[9px] font-bold text-muted-foreground truncate max-w-[120px]">
                                {m.url.startsWith('data:') ? 'Immagine Incorporata' : m.url.replace(/^https?:\/\//, '')}
                              </span>
                            </div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground dark:text-muted-foreground/30 group-hover:text-primary dark:group-hover:text-brand-green transition-colors" />
                        </a>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
          <div className="relative group">
            <img src={selectedImage || ""} alt="Full view" className="max-w-full max-h-[85vh] rounded-2xl shadow-2xl border border-white/10" />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
