"use client";

import { useState, useEffect } from 'react';
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Download, Moon, Sun, Plus, CheckCircle2, History, AlertTriangle, RefreshCw, LogOut, User, Trash2, Clock, Loader2, Bell, Shield, ChevronRight, Shirt, Share2, Copy, Pencil, BarChart3 } from 'lucide-react';
import { PiTrafficCone } from "react-icons/pi";
import { useToast } from '@/hooks/use-toast';
import { playerRepository } from '@/lib/repositories/player-repository';
import { matchRepository } from '@/lib/repositories/match-repository';
import { GiSoccerBall } from "react-icons/gi";
import { useThemeStore } from '@/store/useThemeStore';
import { useSeasonsStore } from '@/store/useSeasonsStore';
import { useMatchesStore } from '@/store/useMatchesStore';
import { usePlayersStore } from '@/store/usePlayersStore';
import { useStatsStore } from '@/store/useStatsStore';
import { useAuthStore } from '@/store/useAuthStore';
import { useSettingsStore } from '@/store/useSettingsStore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MATCH_FILTERS, type FilterType } from '@/lib/aggregators/filter';
import { useRouter } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export default function AltroPage() {
  const [isAddingSeason, setIsAddingSeason] = useState(false);
  const [isDeletingSeason, setIsDeletingSeason] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [newSeasonName, setNewSeasonName] = useState('');
  const [seasonToDelete, setSeasonToDelete] = useState<{ id: string, name: string } | null>(null);
  const [seasonToRename, setSeasonToRename] = useState<{ id: string, name: string } | null>(null);
  const [renamedName, setRenamedName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Dialog states
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSquadraOpen, setIsSquadraOpen] = useState(false);
  const [isNotificheOpen, setIsNotificheOpen] = useState(false);
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [seasonToShare, setSeasonToShare] = useState<any>(null);
  const [isJoining, setIsJoining] = useState(false);

  const { toast } = useToast();
  const router = useRouter();
  const { theme, toggleTheme } = useThemeStore();
  const { seasons, activeSeason, fetchAll: fetchSeasons, addSeason, setActiveSeason, removeSeason, renameSeason, joinSeason } = useSeasonsStore();
  const { 
    defaultDuration, setDefaultDuration, 
    sessionsPerWeek, setSessionsPerWeek, 
    trainingDays, setTrainingDays, 
    autoSetPresenceOnGenerate, setAutoSetPresenceOnGenerate,
    teamName, setTeamName, saveSettings, fetchSettings,
    matchNotificationEnabled, matchNotificationTime,
    trainingNotificationEnabled, trainingNotificationTime,
    statsDefaultFilter, setStatsDefaultFilter
  } = useSettingsStore();
  const { applyDefaultFilter } = useStatsStore();

  const [localTeamName, setLocalTeamName] = useState('');
  const [localDefaultDuration, setLocalDefaultDuration] = useState(90);
  const [localTrainingDays, setLocalTrainingDays] = useState<number[]>([]);
  const [localAutoSetPresenceOnGenerate, setLocalAutoSetPresenceOnGenerate] = useState(false);
  const [localMatchNotificationEnabled, setLocalMatchNotificationEnabled] = useState(false);
  const [localMatchNotificationTime, setLocalMatchNotificationTime] = useState('20:00');
  const [localTrainingNotificationEnabled, setLocalTrainingNotificationEnabled] = useState(false);
  const [localTrainingNotificationTime, setLocalTrainingNotificationTime] = useState('20:00');
  const [localStatsDefaultFilter, setLocalStatsDefaultFilter] = useState<FilterType>('all');

  useEffect(() => {
    if (isSquadraOpen) {
      setLocalTeamName(teamName);
      setLocalDefaultDuration(defaultDuration);
      setLocalTrainingDays(trainingDays);
      setLocalAutoSetPresenceOnGenerate(autoSetPresenceOnGenerate);
      setLocalStatsDefaultFilter(statsDefaultFilter ?? 'all');
    }
  }, [isSquadraOpen, teamName, defaultDuration, trainingDays, autoSetPresenceOnGenerate, statsDefaultFilter]);

  useEffect(() => {
    if (isNotificheOpen) {
      setLocalMatchNotificationEnabled(matchNotificationEnabled || false);
      setLocalMatchNotificationTime(matchNotificationTime || '20:00');
      setLocalTrainingNotificationEnabled(trainingNotificationEnabled || false);
      setLocalTrainingNotificationTime(trainingNotificationTime || '20:00');
    }
  }, [isNotificheOpen, matchNotificationEnabled, matchNotificationTime, trainingNotificationEnabled, trainingNotificationTime]);

  const { user, logout } = useAuthStore();

  const handleSaveSettings = async () => {
    if (!user) return;
    setStatsDefaultFilter(localStatsDefaultFilter);
    await saveSettings(user.id, {
      teamName: localTeamName,
      defaultDuration: localDefaultDuration,
      trainingDays: localTrainingDays,
      sessionsPerWeek: localTrainingDays.length,
      autoSetPresenceOnGenerate: localAutoSetPresenceOnGenerate,
      statsDefaultFilter: localStatsDefaultFilter
    });
    // La preferenza appena salvata deve avere effetto subito, senza ricaricare la pagina
    applyDefaultFilter();
    setIsSquadraOpen(false);
    toast({ title: "Impostazioni Salvate", description: "Le modifiche alla squadra sono state applicate." });
  };

  const handleSaveNotifications = async () => {
    if (!user) return;
    await saveSettings(user.id, {
      matchNotificationEnabled: localMatchNotificationEnabled,
      matchNotificationTime: localMatchNotificationTime,
      trainingNotificationEnabled: localTrainingNotificationEnabled,
      trainingNotificationTime: localTrainingNotificationTime
    });
    setIsNotificheOpen(false);
    toast({ title: "Notifiche Salvate", description: "Le preferenze di notifica sono state applicate." });
  };
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    fetchSeasons();
    if (user) {
      fetchSettings(user.id);
    }
  }, [fetchSeasons, user, fetchSettings]);

  const handleAddSeason = async () => {
    if (!newSeasonName.trim() || isAddingSeason) return;
    setIsAddingSeason(true);
    try {
      // Normalize: trim and check for duplicates client-side too
      const normalizedName = newSeasonName.trim();
      const duplicate = seasons.find(s => s.name.toLowerCase() === normalizedName.toLowerCase());
      if (duplicate) {
        toast({ title: "Stagione esistente", description: `La stagione "${normalizedName}" esiste già. Selezionala dall'elenco.` });
        setIsAddingSeason(false);
        return;
      }
      const newSeason = await addSeason(normalizedName);
      setNewSeasonName('');
      // Attiva la nuova stagione e redirect alla home
      if (newSeason?.id) {
        await setActiveSeason(newSeason.id);
        router.push('/');
      }
    } catch (error) {
      toast({ variant: "destructive", title: "Errore", description: "Impossibile creare la stagione." });
    } finally {
      setIsAddingSeason(false);
    }
  };

  const handleRenameSeason = async () => {
    if (!seasonToRename || !renamedName.trim()) return;
    setIsRenaming(true);
    try {
      await renameSeason(seasonToRename.id, renamedName.trim());
      setSeasonToRename(null);
      setRenamedName('');
      toast({ title: "Stagione Rinomata", description: "Il nome è stato aggiornato correttamente." });
    } catch (e) {
      toast({ variant: "destructive", title: "Errore", description: "Impossibile rinominare la stagione." });
    } finally {
      setIsRenaming(false);
    }
  };

  const handleSwitchSeason = async (id: string) => {
    const previousActiveId = activeSeason?.id;
    try {
      await setActiveSeason(id);
      // Redirect to home to "restart" the app with new active season
      router.push('/');
    } catch (err) {
      // Rollback on failure: re-activate previous season in store
      if (previousActiveId) {
        const sortedSeasons = seasons.map(s => ({ ...s, isActive: s.id === previousActiveId }));
        const prevActive = sortedSeasons.find(s => s.id === previousActiveId) || null;
        useSeasonsStore.setState({ seasons: sortedSeasons, activeSeason: prevActive });
      }
      toast({ variant: "destructive", title: "Errore", description: "Impossibile cambiare stagione." });
    }
  };

  const handleJoinSeason = async () => {
    if (!joinCode.trim()) return;
    setIsJoining(true);
    try {
      await joinSeason(joinCode.trim());
      toast({ title: "Stagione Unita!", description: "Ora puoi collaborare su questa stagione." });
      setJoinCode('');
      setIsJoinDialogOpen(false);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Errore", description: error.message || "Impossibile unirsi alla stagione." });
    } finally {
      setIsJoining(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato!", description: "Codice stagione copiato negli appunti." });
  };


  const handleDeleteSeason = async () => {
    if (!seasonToDelete) return;
    const id = seasonToDelete.id;
    const name = seasonToDelete.name;
    // Close both dialogs immediately
    setSeasonToDelete(null);
    setIsSquadraOpen(false);
    setIsDeletingSeason(true);
    try {
      await removeSeason(id);
      toast({ title: "Stagione Eliminata", description: `La stagione "${name}" è stata eliminata.` });
      // Redirect to home to "restart" the app with fresh state
      router.push('/');
    } catch (err: any) {
      toast({ variant: "destructive", title: "Errore", description: err?.message || "Impossibile eliminare la stagione." });
    } finally {
      setIsDeletingSeason(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    const flattenedData = data.map(item => {
      const flatItem: { [key: string]: any } = {};
      for (const key in item) {
        if (typeof item[key] === 'object' && item[key] !== null && !Array.isArray(item[key])) {
          for (const subKey in item[key]) {
            flatItem[`${key}_${subKey}`] = item[key][subKey];
          }
        } else {
          flatItem[key] = item[key];
        }
      }
      return flatItem;
    });
    const headers = Object.keys(flattenedData[0]);
    const csvRows = [headers.join(',')];
    for (const row of flattenedData) {
      const values = headers.map(header => {
        let value = row[header];
        if (value === null || value === undefined) value = '';
        else if (typeof value === 'string') value = `"${value.replace(/"/g, '""')}"`;
        return value;
      });
      csvRows.push(values.join(','));
    }
    return csvRows.join('\n');
  }

  const downloadCSV = (csvString: string, filename: string) => {
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  const handleExport = async () => {
    if (!user || !activeSeason) {
      toast({ variant: "destructive", title: "Nessuna stagione attiva", description: "Seleziona una stagione prima di esportare." });
      return;
    }
    setIsExporting(true);
    try {
      const players = await playerRepository.getAll(user.id, activeSeason.id);
      const playersCSV = convertToCSV(players);
      downloadCSV(playersCSV, `pitchman_players_${user.username}.csv`);

      const matches = await matchRepository.getAll(user.id, activeSeason.id);
      const matchesCSV = convertToCSV(matches);
      downloadCSV(matchesCSV, `pitchman_matches_${user.username}.csv`);
    } catch (error) {
      toast({ variant: "destructive", title: "Esportazione fallita" });
    } finally {
      setIsExporting(false);
    }
  }

  const handleResetSeason = async () => {
    if (!user || !activeSeason) return;
    setIsResetting(true);
    try {
      const players = await playerRepository.getAll(user.id, activeSeason.id);
      const matches = await matchRepository.getAll(user.id, activeSeason.id);

      const deletePromises = [
        ...players.map(p => playerRepository.delete(p.id, activeSeason.id)),
        ...matches.map(m => matchRepository.delete(m.id, activeSeason.id))
      ];

      await Promise.all(deletePromises);

      await Promise.all([
        useMatchesStore.getState().fetchAll(activeSeason.id),
        usePlayersStore.getState().fetchAll(activeSeason.id),
        useStatsStore.getState().loadSummaryStats(activeSeason.id)
      ]);

      toast({
        title: "Stagione Resettata",
        description: `Tutti i dati della stagione ${activeSeason.name} sono stati eliminati.`
      });
      setIsPrivacyOpen(false);
    } catch (e) {
      console.error("Reset error:", e);
      toast({ variant: "destructive", title: "Errore nel reset dei dati" });
    } finally {
      setIsResetting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="pb-24 pt-4 space-y-6 bg-background">
      <div className="flex items-center gap-2 px-6 mb-2">
        <h1 className="text-2xl font-black text-foreground uppercase tracking-tight">Impostazioni</h1>
      </div>

      <div className="flex flex-col space-y-3 px-2">
        {/* Accordion/Menu Items in the style of the screenshot */}

        {/* Profilo Allenatore */}
        <div
          onClick={() => setIsAccountOpen(true)}
          className="flex items-center gap-4 bg-card border border-border dark:bg-black/40 dark:border-brand-green/30 rounded-3xl p-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-black/60 transition-all shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.05)] active:scale-[0.98]"
        >
          <div className="w-14 h-14 rounded-2xl bg-muted dark:bg-black border border-border dark:border-brand-green flex items-center justify-center shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.1)]">
            <User className="h-6 w-6 text-primary dark:text-brand-green" />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-foreground font-black text-lg tracking-wide uppercase">Profilo Allenatore</span>
            <span className="text-foreground/40 text-[10px] font-bold uppercase tracking-widest">Dettagli account</span>
          </div>
        </div>

        {/* Gestione Squadra */}
        <div
          onClick={() => setIsSquadraOpen(true)}
          className="flex items-center gap-4 bg-card border border-border dark:bg-black/40 dark:border-brand-green/30 rounded-3xl p-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-black/60 transition-all shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.05)] active:scale-[0.98]"
        >
          <div className="w-14 h-14 rounded-2xl bg-muted dark:bg-black border border-border dark:border-brand-green flex items-center justify-center shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.1)]">
            <Shirt className="h-6 w-6 text-primary dark:text-brand-green" />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-foreground font-black text-lg tracking-wide uppercase">Gestione Squadra</span>
            <span className="text-foreground/40 text-[10px] font-bold uppercase tracking-widest">Archivio Stagioni & Allenamenti</span>
          </div>
        </div>

        {/* Notifiche */}
        <div
          onClick={() => setIsNotificheOpen(true)}
          className="flex items-center gap-4 bg-card border border-border dark:bg-black/40 dark:border-brand-green/30 rounded-3xl p-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-black/60 transition-all shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.05)] active:scale-[0.98]"
        >
          <div className="w-14 h-14 rounded-2xl bg-muted dark:bg-black border border-border dark:border-brand-green flex items-center justify-center shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.1)]">
            <Bell className="h-6 w-6 text-primary dark:text-brand-green" />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-foreground font-black text-lg tracking-wide uppercase">Notifiche</span>
            <span className="text-foreground/40 text-[10px] font-bold uppercase tracking-widest">Preferenze push</span>
          </div>
        </div>

        {/* Tema */}
        <div
          className="flex items-center gap-4 bg-card border border-border dark:bg-black/40 dark:border-brand-green/30 rounded-3xl p-3 shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.05)]"
        >
          <div className="w-14 h-14 rounded-2xl bg-muted dark:bg-black border border-border dark:border-brand-green flex items-center justify-center shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.1)]">
            <Moon className="h-6 w-6 text-primary dark:text-brand-green" />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-foreground font-black text-lg tracking-wide uppercase">Tema</span>
            <span className="text-foreground/40 text-[10px] font-bold uppercase tracking-widest">Chiaro/Scuro</span>
          </div>
          <div className="bg-muted/80 rounded-full flex items-center p-1 mr-2 shadow-inner border border-white/10">
            {/* Un toggle visivo custom che mimi quello nel mockup */}
            <div
              className={cn("px-4 py-1.5 rounded-full flex items-center justify-center cursor-pointer transition-all", theme !== 'dark' ? "bg-card/40 hover:bg-card/50 text-foreground" : "text-foreground/50")}
              onClick={() => theme === 'dark' && toggleTheme()}
            >
              <Sun className="h-4 w-4" />
            </div>
            <div
              className={cn("px-4 py-1.5 rounded-full flex items-center justify-center font-bold text-sm cursor-pointer transition-all", theme === 'dark' ? "bg-black border border-brand-green text-white shadow-[0_0_10px_rgba(172,229,4,0.15)]" : "text-foreground/50")}
              onClick={() => theme !== 'dark' && toggleTheme()}
            >
              Scuro
            </div>
          </div>
        </div>

        {/* Privacy & Sicurezza */}
        <div
          onClick={() => setIsPrivacyOpen(true)}
          className="flex items-center gap-4 bg-card border border-border dark:bg-black/40 dark:border-brand-green/30 rounded-3xl p-3 cursor-pointer hover:bg-muted/50 dark:hover:bg-black/60 transition-all shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.05)] active:scale-[0.98]"
        >
          <div className="w-14 h-14 rounded-2xl bg-muted dark:bg-black border border-border dark:border-brand-green flex items-center justify-center shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.1)]">
            <Shield className="h-6 w-6 text-primary dark:text-brand-green" />
          </div>
          <div className="flex flex-col flex-1">
            <span className="text-foreground font-black text-lg tracking-wide uppercase">Privacy & Sicurezza</span>
            <span className="text-foreground/40 text-[10px] font-bold uppercase tracking-widest">Permessi & Dati</span>
          </div>
        </div>

      </div>

      {/* DIALOGS */}

      {/* Account Dialog */}
      <Dialog open={isAccountOpen} onOpenChange={setIsAccountOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">Profilo Allenatore</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-muted/30 dark:bg-card/20 hover:bg-muted/50 dark:hover:bg-card/30">
              <div className="h-12 w-12 rounded-full bg-background dark:bg-black border border-border dark:border-brand-green flex items-center justify-center text-primary dark:text-brand-green font-black uppercase text-xl shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.15)]">
                {user?.username.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-black tracking-tight">{user?.username}</span>
                <span className="text-sm text-muted-foreground/60">{user?.email}</span>
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleLogout}
                className="w-full rounded-xl font-black uppercase text-xs h-12 bg-background dark:bg-black border border-rose-500/50 text-rose-500 hover:bg-rose-500/10 hover:border-rose-500 shadow-sm dark:shadow-[0_0_10px_rgba(244,63,94,0.05)] transition-all"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Esci dall'Account
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Gestione Squadra Dialog */}
      <Dialog open={isSquadraOpen} onOpenChange={setIsSquadraOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()} className="max-w-[95vw] sm:max-w-lg rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] text-foreground max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">Gestione Squadra</DialogTitle>
            <DialogDescription className="text-muted-foreground">Configura archivio stagioni e frequenza allenamento.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Nome Squadra */}
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Nome Squadra</h3>
              <Input
                placeholder="Es: PitchMan FC"
                value={localTeamName}
                onChange={(e) => setLocalTeamName(e.target.value)}
                className="font-bold uppercase text-xs bg-background dark:bg-black border border-border dark:border-brand-green/30 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green h-12 rounded-xl text-foreground"
              />
            </div>

            {/* Allenamenti / Gare */}
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Preferenze</h3>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 dark:bg-card/20 hover:bg-muted/50 dark:hover:bg-card/30 border border-border dark:border-transparent">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary dark:text-brand-green" />
                  <Label className="text-sm font-bold">Durata Partite</Label>
                </div>
                <Select value={localDefaultDuration.toString()} onValueChange={(v) => setLocalDefaultDuration(parseInt(v))}>
                  <SelectTrigger className="w-32 h-9 text-xs font-bold uppercase bg-background dark:bg-black border border-border dark:border-brand-green/30 focus:ring-1 focus:ring-primary dark:focus:ring-brand-green">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border dark:border-white/10 text-foreground">
                    <SelectItem value="70">70 min</SelectItem>
                    <SelectItem value="80">80 min</SelectItem>
                    <SelectItem value="90">90 min</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-3 p-3 rounded-2xl bg-muted/30 dark:bg-card/20 hover:bg-muted/50 dark:hover:bg-card/30 border border-border dark:border-transparent">
                <div className="flex items-center gap-2">
                  <PiTrafficCone className="w-4 h-4 text-primary dark:text-brand-green" />
                  <Label className="text-sm font-bold">Giorni di Allenamento</Label>
                </div>
                <div className="flex justify-between gap-1 mt-1">
                  {[
                    { label: 'L', value: 1 },
                    { label: 'M', value: 2 },
                    { label: 'M', value: 3 },
                    { label: 'G', value: 4 },
                    { label: 'V', value: 5 },
                    { label: 'S', value: 6 },
                    { label: 'D', value: 0 },
                  ].map((day) => {
                    const isSelected = localTrainingDays?.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        onClick={() => {
                          const newDays = isSelected
                            ? localTrainingDays.filter(d => d !== day.value)
                            : [...(localTrainingDays || []), day.value];
                          setLocalTrainingDays(newDays);
                        }}
                        className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all",
                          isSelected
                            ? "bg-primary dark:bg-black border border-primary dark:border-brand-green text-white shadow-md dark:shadow-[0_0_10px_rgba(172,229,4,0.15)] scale-110"
                            : "bg-muted dark:bg-black/20 text-muted-foreground hover:bg-muted-foreground/10 dark:hover:bg-black/40"
                        )}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-3 p-3 rounded-2xl bg-muted/30 dark:bg-card/20 hover:bg-muted/50 dark:hover:bg-card/30 border border-border dark:border-transparent">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-primary dark:text-brand-green" />
                    <Label className="text-sm font-bold">Auto-Compila Presenze</Label>
                  </div>
                  <Switch
                    checked={localAutoSetPresenceOnGenerate}
                    onCheckedChange={setLocalAutoSetPresenceOnGenerate}
                    className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-brand-green"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/60 font-medium">Marcare tutti come presenti alla creazione automatica degli allenamenti.</p>
              </div>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/30 dark:bg-card/20 hover:bg-muted/50 dark:hover:bg-card/30 border border-border dark:border-transparent">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary dark:text-brand-green" />
                  <Label className="text-sm font-bold">Statistiche su</Label>
                </div>
                <Select value={localStatsDefaultFilter} onValueChange={(v) => setLocalStatsDefaultFilter(v as FilterType)}>
                  <SelectTrigger className="w-40 h-9 text-xs font-bold uppercase bg-background dark:bg-black border border-border dark:border-brand-green/30 focus:ring-1 focus:ring-primary dark:focus:ring-brand-green">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border-border dark:border-white/10 text-foreground">
                    {MATCH_FILTERS.map(f => (
                      <SelectItem key={f} value={f} className="text-xs font-bold uppercase">
                        {f === 'all' ? 'Totale' : f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-[10px] text-muted-foreground/60 font-medium -mt-2">Tab predefinita per Bomber, Assistman, Fedelissimo e per le statistiche del giocatore. Le amichevoli non finiscono nel campionato.</p>
            </div>

            <Button 
                onClick={handleSaveSettings}
                className="w-full bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-brand-green hover:opacity-90 dark:hover:bg-brand-green/10 h-12 rounded-2xl font-black uppercase shadow-lg dark:shadow-[0_0_15px_rgba(172,229,4,0.2)]"
            >
                Salva Modifiche
            </Button>

            {/* Stagioni */}
            <div className="space-y-3">
              <h3 className="text-sm font-black uppercase tracking-widest text-foreground dark:text-white">Archivio Stagioni</h3>

              <div className="flex gap-2">
                <Button onClick={() => setIsJoinDialogOpen(true)} className="flex-1 bg-background dark:bg-black border border-border dark:border-brand-green/30 text-foreground dark:text-white hover:bg-muted dark:hover:bg-black/60 shadow-sm transition-all h-10 rounded-xl font-black uppercase text-[10px]">
                  <Plus className="h-3.5 w-3.5 mr-1" /> Partecipa con Codice
                </Button>
              </div>

              <div className="flex gap-2">
                <Input
                  placeholder="Es: 2025/26"
                  value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)}
                  className="font-bold uppercase text-xs bg-background dark:bg-black border border-border dark:border-brand-green/30 focus-visible:ring-1 focus-visible:ring-primary dark:focus-visible:ring-brand-green h-10 rounded-xl text-foreground"
                />
                <Button onClick={handleAddSeason} disabled={isAddingSeason} className="bg-primary dark:bg-black border border-primary dark:border-brand-green text-white hover:opacity-90 dark:hover:bg-black/80 shadow-md dark:shadow-[0_0_10px_rgba(172,229,4,0.15)] transition-all h-10 rounded-xl font-black uppercase">
                  {isAddingSeason ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1 text-white dark:text-brand-green" />} Crea
                </Button>
              </div>

              <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                {seasons.map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl border transition-all",
                      s.isActive ? "bg-background dark:bg-black border-primary dark:border-brand-green shadow-md dark:shadow-[0_0_10px_rgba(172,229,4,0.1)]" : "bg-muted/30 dark:bg-card/20 border-transparent cursor-pointer hover:bg-muted/50 dark:hover:bg-card/50"
                    )}
                    onClick={() => !s.isActive && handleSwitchSeason(s.id)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className={cn("text-sm font-black uppercase tracking-tight", s.isActive ? "text-primary dark:text-white" : "text-foreground")}>
                          Stagione {s.name}
                        </span>
                      </div>
                      {s.isActive && (
                        <Badge className="text-[9px] bg-primary dark:bg-black border border-primary dark:border-brand-green text-white shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.1)] font-black uppercase py-0.5 px-2">Attiva</Badge>
                      )}
                      {s.ownerId !== user?.id && (
                        <Badge variant="outline" className="text-[8px] border-blue-500/50 text-blue-500 font-black uppercase py-0.5 px-1.5 ml-1">Invitato</Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {s.ownerId === user?.id && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary dark:text-brand-green hover:bg-primary/10 dark:hover:bg-brand-green/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSeasonToRename({ id: s.id, name: s.name });
                              setRenamedName(s.name);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-primary dark:text-brand-green hover:bg-primary/10 dark:hover:bg-brand-green/10"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSeasonToShare(s);
                            }}
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {!s.isActive && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-foreground/40 hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setIsSquadraOpen(false);
                            setSeasonToDelete({ id: s.id, name: s.name });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notifiche Dialog */}
      <Dialog open={isNotificheOpen} onOpenChange={setIsNotificheOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-lg rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">Notifiche Push</DialogTitle>
            <DialogDescription className="text-muted-foreground">Configura gli avvisi pre-gara e pre-allenamento.</DialogDescription>
          </DialogHeader>

          <div className="space-y-6 pt-4">
            {/* Notifica Partita */}
            <div className="flex flex-col gap-3 p-3 rounded-2xl bg-muted/30 dark:bg-card/20 border border-border dark:border-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-bold uppercase tracking-tight">Giorno della Partita</Label>
                </div>
                <Switch
                  checked={localMatchNotificationEnabled}
                  onCheckedChange={setLocalMatchNotificationEnabled}
                  className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-brand-green"
                />
              </div>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                "Prendi nota della formazione e inserisci il risultato!"
              </p>
              {localMatchNotificationEnabled && (
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Orario Notifica</Label>
                  <Input 
                    type="time" 
                    value={localMatchNotificationTime}
                    onChange={(e) => setLocalMatchNotificationTime(e.target.value)}
                    className="w-28 h-8 text-xs font-bold bg-background dark:bg-black border-border dark:border-brand-green/30"
                  />
                </div>
              )}
            </div>

            {/* Notifica Allenamento */}
            <div className="flex flex-col gap-3 p-3 rounded-2xl bg-muted/30 dark:bg-card/20 border border-border dark:border-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label className="text-sm font-bold uppercase tracking-tight">Giorno dell'Allenamento</Label>
                </div>
                <Switch
                  checked={localTrainingNotificationEnabled}
                  onCheckedChange={setLocalTrainingNotificationEnabled}
                  className="data-[state=checked]:bg-primary dark:data-[state=checked]:bg-brand-green"
                />
              </div>
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                "Chi c'era oggi? Segna le presenze e gli esercizi svolti!"
              </p>
              {localTrainingNotificationEnabled && (
                <div className="flex items-center justify-between pt-2 border-t border-border/50">
                  <Label className="text-xs font-bold text-muted-foreground uppercase">Orario Notifica</Label>
                  <Input 
                    type="time" 
                    value={localTrainingNotificationTime}
                    onChange={(e) => setLocalTrainingNotificationTime(e.target.value)}
                    className="w-28 h-8 text-xs font-bold bg-background dark:bg-black border-border dark:border-brand-green/30"
                  />
                </div>
              )}
            </div>

            <Button 
                onClick={handleSaveNotifications}
                className="w-full bg-primary dark:bg-black border border-primary dark:border-brand-green text-white dark:text-brand-green hover:opacity-90 dark:hover:bg-brand-green/10 h-12 rounded-2xl font-black uppercase shadow-lg dark:shadow-[0_0_15px_rgba(172,229,4,0.2)]"
            >
                Salva Notifiche
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy & Sicurezza Dialog */}
      <Dialog open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground">Privacy & Dati</DialogTitle>
            <DialogDescription className="text-muted-foreground">Esporta i tuoi dati o formatta l'account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 pt-2">

            <div className="space-y-2">
              <Button onClick={handleExport} disabled={isExporting} className="w-full font-black uppercase text-xs h-12 bg-primary dark:bg-black border border-primary dark:border-brand-green/30 text-white dark:text-white hover:opacity-90 dark:hover:bg-black/80 hover:border-primary dark:hover:border-brand-green shadow-sm dark:shadow-[0_0_10px_rgba(172,229,4,0.05)] transition-all rounded-xl">
                <Download className="mr-2 h-4 w-4 text-white dark:text-brand-green" />
                {isExporting ? "Esportazione..." : "Esporta tutto (CSV)"}
              </Button>
              <p className="text-[10px] text-foreground/40 text-center px-4">Ricevi un file per la squadra e uno per le partite nel tuo dispositivo.</p>
            </div>

            <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 space-y-3">
              <div className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                <h4 className="font-black uppercase text-sm -mt-0.5">Zona Pericolo</h4>
              </div>
              <p className="text-[11px] text-foreground/60">Cancellare tutti i dati della stagione {activeSeason?.name}? Questa azione è irreversibile.</p>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full font-black uppercase text-xs rounded-xl h-10 mt-2">
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset Stagione
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-2xl dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] text-foreground max-w-[90vw]">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="uppercase font-black text-destructive">Resettare la stagione?</AlertDialogTitle>
                    <AlertDialogDescription className="text-xs leading-relaxed text-muted-foreground font-bold">
                      Cancellazione DEFINITIVA giocatori, partite e statistiche della stagione <strong>{activeSeason?.name}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="flex-row gap-2 mt-4">
                    <AlertDialogCancel className="flex-1 mt-0 rounded-xl font-bold text-xs bg-card/40 hover:bg-card/50 text-foreground border-none" disabled={isResetting}>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetSeason} className="flex-1 bg-destructive hover:bg-destructive/90 rounded-xl font-bold text-xs uppercase border-none" disabled={isResetting}>
                      {isResetting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Conferma Reset"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Join Season Dialog */}
      <Dialog open={isJoinDialogOpen} onOpenChange={setIsJoinDialogOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground uppercase tracking-tight">Partecipa a una Stagione</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground uppercase">Inserisci il codice condiviso dal tuo collega Mister.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Es: S-K9B2A"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              className="font-black text-center text-lg h-14 tracking-widest bg-muted/30 dark:bg-black border-2 border-border dark:border-brand-green/20 focus-visible:ring-brand-green rounded-2xl"
            />
            <Button
              onClick={handleJoinSeason}
              disabled={isJoining || !joinCode}
              className="w-full rounded-2xl font-black uppercase h-12 bg-primary dark:bg-black border border-primary dark:border-brand-green text-white shadow-lg dark:shadow-[0_0_15px_rgba(172,229,4,0.2)]"
            >
              {isJoining ? <Loader2 className="h-5 w-5 animate-spin" /> : "Unisciti alla Squadra"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Season Dialog */}
      <Dialog open={!!seasonToShare} onOpenChange={(open) => !open && setSeasonToShare(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] text-foreground text-center">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground uppercase tracking-tight mx-auto">Condividi Stagione</DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
             <div className="p-6 rounded-3xl bg-muted/30 dark:bg-brand-green/5 border border-dashed border-primary/30 dark:border-brand-green/40">
                <p className="text-[10px] font-black uppercase text-muted-foreground mb-2">Codice d'invito</p>
                <h2 className="text-3xl font-black tracking-widest text-primary dark:text-brand-green mb-4">{seasonToShare?.id}</h2>
                <Button 
                  onClick={() => copyToClipboard(seasonToShare?.id)}
                  variant="outline" 
                  className="rounded-xl font-black uppercase text-xs h-10 border-primary/30 dark:border-brand-green/30 text-primary dark:text-brand-green hover:bg-primary/10 dark:hover:bg-brand-green/10"
                >
                  <Copy className="h-3.5 w-3.5 mr-2" /> Copia Codice
                </Button>
             </div>
             <p className="text-[10px] font-bold text-muted-foreground leading-relaxed px-4">
               Invia questo codice al tuo assistente o collega osservatore. Inserendolo nella sezione "Partecipa con Codice", potrà accedere a tutti i dati di questa stagione.
             </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Season Deletion Confirmation — OUTSIDE the Dialog */}
      <AlertDialog open={!!seasonToDelete} onOpenChange={(open) => { if (!open && !isDeletingSeason) setSeasonToDelete(null); }}>
        <AlertDialogContent className="rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-2xl dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] text-foreground max-w-[90vw]">
          <AlertDialogHeader>
            <AlertDialogTitle className="uppercase font-black text-destructive">Elimina Stagione?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs text-muted-foreground font-bold">
              Questa azione cancellerà DEFINITIVAMENTE la stagione <strong>{seasonToDelete?.name}</strong> e tutti i relativi dati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row gap-2 mt-4">
            <AlertDialogCancel className="flex-1 mt-0 rounded-xl font-bold text-xs bg-card/40 hover:bg-card/50 text-foreground border-none" disabled={isDeletingSeason}>Annulla</AlertDialogCancel>
            <Button onClick={handleDeleteSeason} disabled={isDeletingSeason} className="flex-1 bg-destructive hover:bg-destructive/90 rounded-xl font-bold text-xs uppercase border-none text-white">
              {isDeletingSeason ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Elimina"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Season Rename Dialog */}
      <Dialog open={!!seasonToRename} onOpenChange={(open) => !open && setSeasonToRename(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-md rounded-3xl bg-background border border-border dark:bg-black dark:border-brand-green/30 shadow-xl dark:shadow-[0_0_20px_rgba(172,229,4,0.15)] text-foreground">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-foreground uppercase tracking-tight">Rinomina Stagione</DialogTitle>
            <DialogDescription className="text-xs font-bold text-muted-foreground uppercase">Inserisci il nuovo nome per la stagione.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <Input
              placeholder="Es: 2025/26"
              value={renamedName}
              onChange={(e) => setRenamedName(e.target.value)}
              className="font-black text-lg h-12 bg-muted/30 dark:bg-black border-border dark:border-brand-green/20 focus-visible:ring-brand-green rounded-2xl"
            />
            <div className="flex gap-2">
              <Button
                variant="ghost"
                onClick={() => setSeasonToRename(null)}
                className="flex-1 rounded-xl font-black uppercase text-xs h-12 text-foreground/60 hover:bg-muted"
              >
                Annulla
              </Button>
              <Button
                onClick={handleRenameSeason}
                disabled={isRenaming || !renamedName.trim()}
                className="flex-1 rounded-xl font-black uppercase h-12 bg-primary dark:bg-black border border-primary dark:border-brand-green text-white shadow-lg dark:shadow-[0_0_15px_rgba(172,229,4,0.2)]"
              >
                {isRenaming ? <Loader2 className="h-5 w-5 animate-spin" /> : "Salva Nome"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
