"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Globe, Lock, Image as ImageIcon, Video, Link as LinkIcon, Save, X, Target, Users, Loader2, Clock } from "lucide-react";
import { PiTrafficCone } from "react-icons/pi";
import { Exercise, ExerciseMedia, ExerciseMediaType } from "@/lib/types";
import { useExerciseStore } from "@/store/useExerciseStore";
import { cn } from "@/lib/utils";

interface ExerciseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercise?: Exercise | null;
}

const DEFAULT_FOCUSES = ['Tecnico', 'Tattico', 'Fisico', 'Portieri', 'Partita', 'Recupero'];
const COMMON_PLAYER_COUNTS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '22+'];

export function ExerciseDialog({ open, onOpenChange, exercise }: ExerciseDialogProps) {
  const { addExercise, updateExercise, loading } = useExerciseStore();
  
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [objectives, setObjectives] = useState("");
  const [focus, setFocus] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'private' | 'global'>('private');
  const [playerCount, setPlayerCount] = useState<string[]>([]);
  const [media, setMedia] = useState<ExerciseMedia[]>([]);
  const [newMediaUrl, setNewMediaUrl] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [durationSets, setDurationSets] = useState("");
  const [newMediaType, setNewMediaType] = useState<ExerciseMediaType>('image');
  const [uploadLoading, setUploadLoading] = useState(false);

  useEffect(() => {
    if (exercise) {
      setName(exercise.name);
      setDescription(exercise.description);
      setObjectives(exercise.objectives || "");
      setFocus(exercise.focus);
      setVisibility(exercise.visibility);
      setPlayerCount(exercise.playerCount || []);
      setMedia(exercise.media);
      const dur = exercise.duration || "";
      if (dur.toLowerCase().includes('x')) {
        const [s, m] = dur.toLowerCase().split('x');
        setDurationSets(s.replace(/[^0-9]/g, ''));
        setDurationMin(m.replace(/[^0-9]/g, ''));
      } else {
        setDurationSets("");
        setDurationMin(dur.replace(/[^0-9]/g, ''));
      }
    } else {
      setName("");
      setDescription("");
      setObjectives("");
      setFocus([]);
      setVisibility('private');
      setPlayerCount([]);
      setMedia([]);
      setDurationMin("");
      setDurationSets("");
    }
  }, [exercise, open]);

  const toggleFocus = (f: string) => {
    setFocus(prev => prev.includes(f) ? prev.filter(x => x !== f) : [...prev, f]);
  };

  const togglePlayerCount = (c: string) => {
    setPlayerCount(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
  };

  const addMedia = () => {
    if (!newMediaUrl) return;
    // Prevent adding local blob URLs manually
    if (newMediaUrl.startsWith('blob:')) return;
    setMedia(prev => [...prev, { type: newMediaType, url: newMediaUrl }]);
    setNewMediaUrl("");
  };

  const removeMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name) return;
    
    let finalDuration = "";
    if (durationSets && durationMin) {
      finalDuration = `${durationSets}x${durationMin}`;
    } else if (durationMin) {
      finalDuration = durationMin;
    }

    const data = {
      name,
      description,
      objectives,
      focus,
      visibility,
      playerCount: playerCount.length > 0 ? playerCount : ['Qualsiasi'],
      media,
      duration: finalDuration
    };

    if (exercise) {
      await updateExercise(exercise.id, data);
    } else {
      await addExercise(data);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[92vh] bg-card dark:bg-zinc-950 border border-border dark:border-brand-green/30 rounded-[32px] shadow-2xl p-5 outline-none flex flex-col gap-0 overflow-hidden">
        <DialogHeader className="mb-3 px-1">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 dark:bg-brand-green/10 flex items-center justify-center border border-primary/20 dark:border-brand-green/20">
              <PiTrafficCone className="h-5 w-5 text-primary dark:text-brand-green" />
            </div>
            <div className="space-y-0.5">
              <DialogTitle className="text-xl font-black uppercase tracking-tighter text-foreground dark:text-white leading-none">
                {exercise ? "Modifica Esercizio" : "Nuovo Esercizio"}
              </DialogTitle>
              <DialogDescription className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground dark:text-muted-foreground/50">
                Archivia la tua metodologia tecnica
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide px-1">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Left: General Info */}
            <div className="space-y-4">
              <div className="space-y-1.5 group">
                <div className="flex items-center gap-2 mb-0.5">
                  <Target className="h-3.5 w-3.5 text-primary dark:text-brand-green" />
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">Dati Base</Label>
                </div>
                <Input 
                  placeholder="Nome dell'esercizio..." 
                  className="h-11 rounded-xl bg-background dark:bg-black/40 border-border dark:border-brand-green/10 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-sm font-bold uppercase"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 mb-0.5 mt-2">
                      <Clock className="h-3.5 w-3.5 text-primary dark:text-brand-green" />
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">Minuti</Label>
                    </div>
                    <Input 
                      type="number"
                      placeholder="Es: 15" 
                      className="h-10 rounded-xl bg-background dark:bg-black/40 border-border dark:border-brand-green/10 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-xs font-bold"
                      value={durationMin}
                      onChange={e => setDurationMin(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2 mb-0.5 mt-2">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">Serie</Label>
                    </div>
                    <Input 
                      type="number"
                      placeholder="Es: 3" 
                      className="h-10 rounded-xl bg-background dark:bg-black/40 border-border dark:border-brand-green/10 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-xs font-bold"
                      value={durationSets}
                      onChange={e => setDurationSets(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/40 ml-1">Obiettivi</Label>
                  <Textarea 
                    placeholder="Quali sono gli obiettivi tecnici/tattici?" 
                    className="min-h-[60px] rounded-xl bg-background dark:bg-black/40 border-border dark:border-brand-green/10 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-xs font-medium resize-none px-3 py-2"
                    value={objectives}
                    onChange={e => setObjectives(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/40 ml-1">Svolgimento</Label>
                  <Textarea 
                    placeholder="Descrivi come si svolge l'esercizio..." 
                    className="min-h-[100px] rounded-xl bg-background dark:bg-black/40 border-border dark:border-brand-green/10 focus-visible:ring-primary dark:focus-visible:ring-brand-green text-xs font-medium resize-none px-3 py-2"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-0.5">
                  <Globe className="h-3.5 w-3.5 text-primary dark:text-brand-green" />
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">Focus & Visibilità</Label>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {DEFAULT_FOCUSES.map(f => (
                    <button
                      key={f}
                      onClick={() => toggleFocus(f)}
                      className={cn(
                        "px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                        focus.includes(f) 
                          ? "bg-primary dark:bg-black border-primary dark:border-brand-green text-white dark:text-brand-green shadow-sm shadow-primary/20" 
                          : "bg-muted/10 dark:bg-black/20 border-transparent text-muted-foreground hover:bg-muted/20 hover:border-border dark:hover:border-brand-green/30"
                      )}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => setVisibility('private')}
                    className={cn(
                      "flex-1 h-10 rounded-xl border flex items-center justify-center gap-2 transition-all",
                      visibility === 'private' ? "bg-amber-500/10 border-amber-500/50 text-amber-500 font-bold" : "bg-muted/10 border-transparent text-muted-foreground"
                    )}
                  >
                    <Lock className="h-3.5 w-3.5" /> <span className="text-[9px] uppercase font-black">Privato</span>
                  </button>
                  <button 
                    onClick={() => setVisibility('global')}
                    className={cn(
                      "flex-1 h-10 rounded-xl border flex items-center justify-center gap-2 transition-all",
                      visibility === 'global' ? "bg-blue-500/10 border-blue-500/50 text-blue-500 font-bold" : "bg-muted/10 border-transparent text-muted-foreground"
                    )}
                  >
                    <Globe className="h-3.5 w-3.5" /> <span className="text-[9px] uppercase font-black">Globale</span>
                  </button>
                </div>
              </div>

              <div className="space-y-2 group">
                <div className="flex items-center gap-2 mb-0.5">
                  <Users className="h-3.5 w-3.5 text-primary dark:text-brand-green" />
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">Adattabile a (N. Giocatori):</Label>
                </div>
                <div className="flex flex-wrap gap-1">
                  {COMMON_PLAYER_COUNTS.map(c => (
                    <button
                      key={c}
                      onClick={() => togglePlayerCount(c)}
                      className={cn(
                        "min-w-[32px] h-8 rounded-lg text-[9px] font-black uppercase tracking-tighter border transition-all",
                        playerCount.includes(c) 
                          ? "bg-primary dark:bg-black border-primary dark:border-brand-green text-white dark:text-brand-green shadow-sm" 
                          : "bg-muted/10 dark:bg-black/20 border-transparent text-muted-foreground hover:border-border dark:hover:border-brand-green/30"
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Media & Assets */}
            <div className="space-y-4">
              <div className="space-y-3 group">
                <div className="flex items-center gap-2 mb-0.5">
                  <ImageIcon className="h-3.5 w-3.5 text-primary dark:text-brand-green" />
                  <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground dark:text-muted-foreground/60">Risorse Multimediali</Label>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Select value={newMediaType} onValueChange={(v: any) => setNewMediaType(v)}>
                      <SelectTrigger className="w-[110px] h-10 rounded-xl bg-background dark:bg-black/20 border-border dark:border-brand-green/10 text-[9px] font-black uppercase">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card dark:bg-zinc-950 border-border dark:border-brand-green/20">
                        <SelectItem value="image" className="text-[10px] font-black uppercase">Immagine</SelectItem>
                        <SelectItem value="video" className="text-[10px] font-black uppercase">Video (YT/Vim)</SelectItem>
                        <SelectItem value="link" className="text-[10px] font-black uppercase">Link Est.</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input 
                      placeholder="URL risorsa..." 
                      className="flex-1 h-10 rounded-xl bg-background dark:bg-black/40 border-border dark:border-brand-green/10 text-xs"
                      value={newMediaUrl}
                      onChange={e => setNewMediaUrl(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addMedia()}
                    />
                    <Button onClick={addMedia} variant="secondary" size="icon" className="h-10 w-10 rounded-xl bg-primary dark:bg-brand-green text-white dark:text-black">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {newMediaType === 'image' && newMediaUrl && (
                    <div className="h-20 w-full rounded-xl border border-dashed border-border dark:border-brand-green/30 bg-muted/5 flex items-center justify-center overflow-hidden">
                      <img 
                        src={newMediaUrl} 
                        alt="Live Preview" 
                        className="h-full w-full object-contain"
                        onError={(e) => {
                          (e.target as any).src = 'https://placehold.co/300x100?text=Anteprima+non+disponibile';
                        }}
                      />
                    </div>
                  )}

                  <div className="pt-1">
                    <input 
                      type="file" 
                      id="exercise-image-upload" 
                      className="hidden" 
                      accept="image/*"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        
                        setUploadLoading(true);
                        try {
                          const formData = new FormData();
                          formData.append('image', file);
                          
                          // Mostriamo anteprima locale immediata
                          const localUrl = URL.createObjectURL(file);
                          setNewMediaUrl(localUrl);
                          setNewMediaType('image');

                          const { uploadExerciseImage } = await import('@/app/actions/blob-actions');
                          const blobUrl = await uploadExerciseImage(formData);
                          
                          setMedia(prev => [...prev, { type: 'image', url: blobUrl }]);
                          setNewMediaUrl("");
                          // Puliamo l'input per permettere lo stesso file dopo
                          e.target.value = '';
                        } catch (err: any) {
                          console.error("Upload error:", err);
                        } finally {
                          setUploadLoading(false);
                        }
                      }}
                    />
                    <Button 
                      type="button"
                      variant="outline"
                      className="w-full h-11 rounded-xl border-dashed border-primary/40 dark:border-brand-green/40 bg-primary/5 dark:bg-brand-green/5 hover:bg-primary/10 dark:hover:bg-brand-green/10 text-[10px] font-black uppercase tracking-widest gap-2"
                      onClick={() => document.getElementById('exercise-image-upload')?.click()}
                      disabled={uploadLoading}
                    >
                      {uploadLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                      {uploadLoading ? "Caricamento..." : "Carica file dal dispositivo"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[260px] overflow-y-auto px-1 scrollbar-hide py-1 border border-border/40 dark:border-brand-green/5 rounded-2xl bg-black/5 dark:bg-black/20">
                  {media.length === 0 ? (
                    <div className="py-8 flex flex-col items-center justify-center text-muted-foreground dark:text-muted-foreground/30 italic">
                      <ImageIcon className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-[9px] font-bold uppercase tracking-tight">Nessuna risorsa aggiunta</p>
                    </div>
                  ) : (
                    media.map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded-xl bg-background dark:bg-zinc-900 border border-border dark:border-brand-green/10 group/item hover:border-primary/30 dark:hover:border-brand-green/30 transition-all">
                        <div className="flex items-center gap-3 overflow-hidden">
                          <div className={cn(
                            "h-7 w-7 rounded-lg flex items-center justify-center shrink-0 overflow-hidden border border-border/20",
                            item.type === 'image' ? "bg-blue-500/10" : item.type === 'video' ? "bg-rose-500/10 text-rose-500" : "bg-amber-500/10 text-amber-500"
                          )}>
                            {item.type === 'image' ? (
                              <img src={item.url} alt="preview" className="h-full w-full object-cover" onError={(e) => {
                                (e.target as any).src = 'https://placehold.co/100x100?text=No+Img';
                              }} />
                            ) : item.type === 'video' ? (
                              <Video className="h-3.5 w-3.5" />
                            ) : (
                              <LinkIcon className="h-3.5 w-3.5" />
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-foreground/70 truncate">{item.url}</span>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => removeMedia(i)} className="h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-500/10 opacity-0 group-hover/item:opacity-100 transition-all">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4 pt-4 border-t border-border dark:border-white/5 mx-1 flex-row gap-3">
          <Button variant="ghost" className="flex-1 h-12 rounded-xl text-[10px] font-black uppercase tracking-widest text-muted-foreground" onClick={() => onOpenChange(false)} disabled={loading || uploadLoading}>
            <X className="h-3.5 w-3.5 mr-2" /> Esci
          </Button>
          <Button 
            className="flex-[2] h-12 rounded-xl bg-primary dark:bg-black border-2 border-primary dark:border-brand-green text-white dark:text-brand-green font-black uppercase text-xs shadow-xl dark:shadow-theme hover:scale-[1.01] transition-all"
            onClick={handleSave}
            disabled={loading || !name || uploadLoading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {exercise ? "Aggiorna" : "Pubblica Esercizio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
