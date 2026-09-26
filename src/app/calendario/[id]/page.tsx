
"use client";

import { useEffect, useState, Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchLineupTab } from "@/components/partite/match-lineup-tab";
import { MatchEventsTab } from "@/components/partite/match-events-tab";
import { MatchNotesTab } from "@/components/partite/match-notes-tab";
import { useMatchDetailStore } from "@/store/useMatchDetailStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MatchFormDialog } from "@/components/partite/match-form-dialog";
import { CalendarDays, Settings2, Users, Zap, FileText, Home, Plane, AlertCircle, ArrowLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

function MatchDetailContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const urlSeasonId = searchParams.get('s');

  const { match, loading, error, load, updateMatch } = useMatchDetailStore();
  const teamName = useSettingsStore((state) => state.teamName);
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (id) {
      load(id, urlSeasonId || undefined);
    }
  }, [id, urlSeasonId, load]);

  const handleSaveMatch = async (data: any) => {
    await updateMatch(data);
  };

  if (loading) {
    return (
      <div className="space-y-4 max-w-4xl mx-auto">
        <Skeleton className="h-12 w-3/4" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 max-w-md mx-auto text-center px-4">
        <div className="h-24 w-24 rounded-full bg-destructive/10 dark:bg-destructive/20 flex items-center justify-center mb-2 border border-destructive/20 dark:border-destructive/30 shadow-sm dark:shadow-[0_0_20px_rgba(239,68,68,0.2)] relative">
          <AlertCircle className="h-12 w-12 text-destructive opacity-90" />
          <div className="absolute inset-0 rounded-full animate-pulse opacity-20 bg-destructive"></div>
        </div>
        <h2 className="text-2xl font-black text-foreground dark:text-white uppercase tracking-widest mt-2 relative after:content-[''] after:absolute after:bottom-[-8px] after:left-1/2 after:-translate-x-1/2 after:w-16 after:h-[3px] after:bg-gradient-to-r after:from-transparent after:via-destructive dark:after:via-destructive after:to-transparent">
          Dettagli non disponibili
        </h2>
        <Card className="mt-4 border-destructive/20 bg-card/5 w-full rounded-2xl shadow-sm dark:shadow-[0_0_15px_rgba(239,68,68,0.05)] dark:bg-black/40 backdrop-blur-sm">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-destructive/80 dark:text-red-400 leading-relaxed">
              {error}
            </p>
          </CardContent>
        </Card>
        <div className="flex gap-3 w-full mt-4">
          <Button
            variant="outline"
            className="flex-1 font-black uppercase text-xs tracking-wider rounded-xl bg-background dark:bg-black border-2 border-border dark:border-white/10 text-foreground dark:text-white hover:bg-muted dark:hover:bg-white/5 h-12 transition-all shadow-sm"
            onClick={() => router.push('/calendario')}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Torna Indietro
          </Button>
          <Button
            className="flex-1 font-black uppercase text-xs tracking-wider rounded-xl bg-primary dark:bg-black border-2 border-transparent dark:border-brand-green/80 text-white dark:text-white hover:opacity-90 dark:hover:bg-brand-green/10 h-12 shadow-md dark:shadow-[0_0_15px_rgba(172,229,4,0.3)] transition-all"
            onClick={() => load(id, urlSeasonId || undefined)}
          >
            Riprova
          </Button>
        </div>
      </div>
    );
  }

  if (!match) return null;

  const matchDate = new Date(match.date);

  return (
    <div className="max-w-4xl mx-auto space-y-4 pb-20">
      <div className="flex flex-col gap-3">
        <PageHeader 
          title={
            <button 
              onClick={() => setIsFormOpen(true)}
              className="flex items-center gap-2.5 group hover:opacity-80 transition-all active:scale-[0.98] text-left"
            >
              <span className="text-foreground dark:text-white">Vs {match.opponent}</span>
              <div className="p-1.5 rounded-xl bg-primary/10 dark:bg-brand-green/10 border border-primary/20 dark:border-brand-green/20 group-hover:border-primary/40 dark:group-hover:border-brand-green/40 transition-colors">
                <Settings2 className="h-5 w-5 text-primary dark:text-brand-green group-hover:rotate-90 transition-transform duration-500" />
              </div>
            </button>
          } 
          backAction={() => router.push('/calendario')}
        />

        <Card className="bg-card dark:bg-black border border-border dark:border-brand-green/30 shadow-sm dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] overflow-hidden rounded-3xl text-foreground">
          <CardContent className="p-5 md:p-8">
            <div className="flex flex-col items-center justify-center space-y-6">
              <div className="flex items-center justify-between w-full gap-2 md:gap-4">
                <div className="flex-1 text-center min-w-0">
                  <p className="text-[9px] opacity-60 mb-1 font-black uppercase tracking-widest text-foreground dark:text-brand-green truncate">{match.isHome ? (teamName || "PITCHMAN") : match.opponent.toUpperCase()}</p>
                  <p className="text-5xl md:text-7xl font-black tabular-nums text-foreground">{match.result?.home ?? "-"}</p>
                </div>
                
                <div className="text-2xl md:text-4xl font-thin opacity-20 text-primary dark:text-brand-green px-2 self-center pt-6 shrink-0">VS</div>
                
                <div className="flex-1 text-center min-w-0">
                  <p className="text-[9px] opacity-60 mb-1 font-black uppercase tracking-widest text-foreground dark:text-brand-green truncate">{!match.isHome ? (teamName || "PITCHMAN") : match.opponent.toUpperCase()}</p>
                  <p className="text-5xl md:text-7xl font-black tabular-nums text-foreground dark:text-white">{match.result?.away ?? "-"}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 w-full pt-5 border-t border-border dark:border-brand-green/20">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <div className="p-1.5 bg-muted dark:bg-black border border-border dark:border-brand-green/30 rounded-lg text-primary dark:text-brand-green">
                    <CalendarDays className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-foreground dark:text-white">{matchDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                </div>
                <div className="flex items-center gap-2 text-xs font-bold">
                  <div className="p-1.5 bg-muted dark:bg-black border border-border dark:border-brand-green/30 rounded-lg text-primary dark:text-brand-green">
                    {match.isHome ? <Home className="h-3.5 w-3.5" /> : <Plane className="h-3.5 w-3.5" />}
                  </div>
                  <span className="truncate uppercase tracking-wider text-foreground dark:text-white">{match.isHome ? 'Casa' : 'Trasferta'}</span>
                </div>
              </div>


            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue={searchParams.get('tab') || "eventi"} className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4 h-12 bg-muted/50 dark:bg-black/40 border border-border dark:border-brand-green/20 p-1 rounded-xl">
          <TabsTrigger value="eventi" className="flex items-center gap-1.5 text-[9px] font-black uppercase rounded-lg data-[state=active]:bg-muted dark:data-[state=active]:bg-black data-[state=active]:text-foreground dark:data-[state=active]:text-brand-green data-[state=active]:border data-[state=active]:border-primary dark:data-[state=active]:border-brand-green data-[state=active]:shadow-sm dark:data-[state=active]:shadow-[0_0_10px_rgba(172,229,4,0.15)] text-muted-foreground transition-all">
            <Zap className="h-3.5 w-3.5" /> Cronaca
          </TabsTrigger>
          <TabsTrigger value="formazione" className="flex items-center gap-1.5 text-[9px] font-black uppercase rounded-lg data-[state=active]:bg-muted dark:data-[state=active]:bg-black data-[state=active]:text-foreground dark:data-[state=active]:text-brand-green data-[state=active]:border data-[state=active]:border-primary dark:data-[state=active]:border-brand-green data-[state=active]:shadow-sm dark:data-[state=active]:shadow-[0_0_10px_rgba(172,229,4,0.15)] text-muted-foreground transition-all">
            <Users className="h-3.5 w-3.5" /> Formazione
          </TabsTrigger>
          <TabsTrigger value="note" className="flex items-center gap-1.5 text-[9px] font-black uppercase rounded-lg data-[state=active]:bg-muted dark:data-[state=active]:bg-black data-[state=active]:text-foreground dark:data-[state=active]:text-brand-green data-[state=active]:border data-[state=active]:border-primary dark:data-[state=active]:border-brand-green data-[state=active]:shadow-sm dark:data-[state=active]:shadow-[0_0_10px_rgba(172,229,4,0.15)] text-muted-foreground transition-all">
            <FileText className="h-3.5 w-3.5" /> Note
          </TabsTrigger>
        </TabsList>

        <TabsContent value="eventi" className="outline-none">
          <MatchEventsTab />
        </TabsContent>

        <TabsContent value="formazione" className="outline-none">
          <MatchLineupTab />
        </TabsContent>

        <TabsContent value="note" className="outline-none">
          <MatchNotesTab />
        </TabsContent>
      </Tabs>

      <MatchFormDialog
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        onSave={handleSaveMatch}
        match={match}
      />
    </div>
  );
}

export default function MatchDetailPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center uppercase font-black text-muted-foreground animate-pulse">Inizializzazione Sistema...</div>}>
      <MatchDetailContent />
    </Suspense>
  );
}
