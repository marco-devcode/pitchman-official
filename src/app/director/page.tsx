"use client";

import { RoleGuard } from "@/components/auth/RoleGuard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/store/useAuthStore";
import { Activity, Users, Trophy, BarChart3 } from "lucide-react";

export default function DirectorDashboard() {
  const { user } = useAuthStore();

  return (
    <RoleGuard 
      allowedRoles={['director', 'developer']} 
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <span className="text-2xl">🚫</span>
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight">Accesso Negato</h2>
          <p className="text-sm text-muted-foreground max-w-md">
            Questa sezione è riservata ai Direttori Sportivi. Il tuo account non ha i permessi necessari.
          </p>
        </div>
      }
    >
      <div className="space-y-6 pb-24">
        <PageHeader title="Direzione Sportiva">
          <p className="text-xs font-bold text-muted-foreground">Panoramica Società</p>
        </PageHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Squadre Attive</CardTitle>
              <Users className="h-4 w-4 text-primary dark:text-brand-green" />
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="text-3xl font-black">--</div>
              <p className="text-[10px] text-muted-foreground font-bold mt-1">Nelle stagioni correnti</p>
            </CardContent>
          </Card>
          
          <Card className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Vittorie Totali</CardTitle>
              <Trophy className="h-4 w-4 text-primary dark:text-brand-green" />
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="text-3xl font-black">--</div>
              <p className="text-[10px] text-muted-foreground font-bold mt-1">In tutte le competizioni</p>
            </CardContent>
          </Card>

          <Card className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Tasso Presenze</CardTitle>
              <Activity className="h-4 w-4 text-primary dark:text-brand-green" />
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="text-3xl font-black">--%</div>
              <p className="text-[10px] text-muted-foreground font-bold mt-1">Media allenamenti</p>
            </CardContent>
          </Card>

          <Card className="bg-card dark:bg-black/40 border-border dark:border-white/10 rounded-3xl">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0 p-5">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Performance</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary dark:text-brand-green" />
            </CardHeader>
            <CardContent className="p-5 pt-0">
              <div className="text-3xl font-black">--</div>
              <p className="text-[10px] text-muted-foreground font-bold mt-1">Gol segnati nel mese</p>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4 pt-4">
          <h3 className="text-xs font-black uppercase tracking-widest text-foreground/70 dark:text-white/50 px-2">Feed Ultime Partite (WIP)</h3>
          <div className="p-12 text-center bg-muted/30 dark:bg-black/20 border border-dashed border-border dark:border-white/10 rounded-3xl">
            <p className="text-sm font-black uppercase tracking-widest text-muted-foreground/80 dark:text-muted-foreground/40">In fase di sviluppo</p>
            <p className="text-xs text-muted-foreground/80 dark:text-muted-foreground/60 mt-2 max-w-md mx-auto">
              Qui appariranno i risultati aggregati di tutte le squadre supervisionate dal Direttore.
            </p>
          </div>
        </section>
      </div>
    </RoleGuard>
  );
}
