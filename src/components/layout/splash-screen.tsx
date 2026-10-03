export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background dark:bg-black overflow-hidden transition-colors duration-500">
      {/* Ambient glow di sfondo — adattivo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(0,128,255,0.04)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_center,rgba(172,229,4,0.06)_0%,transparent_70%)] pointer-events-none" />

      <div className="flex flex-col items-center gap-6 animate-in fade-in zoom-in duration-500">
        <div className="relative">
          {/* Glow attorno al logo */}
          <div className="absolute -inset-6 bg-primary/10 dark:bg-brand-green/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute -inset-2 bg-primary/5 dark:bg-brand-green/5 rounded-full blur-xl" />
          <img src="/favicon-16x16_light.png" alt="App Logo" className="h-24 w-24 object-contain relative drop-shadow-[0_0_20px_rgba(0,128,255,0.3)] dark:hidden" />
          <img src="/favicon-16x16.png" alt="App Logo" className="h-24 w-24 object-contain relative drop-shadow-theme-bright hidden dark:block" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="text-4xl font-black text-foreground dark:text-white tracking-tighter">PitchMan</h1>
          <p className="text-[10px] uppercase font-bold tracking-[0.4em] text-muted-foreground dark:text-white/40">Gestionale Tecnico</p>
        </div>

        {/* Barra progresso adattiva */}
        <div className="w-48 h-[3px] bg-muted dark:bg-white/5 rounded-full overflow-hidden mt-4">
          <div className="h-full bg-primary dark:bg-brand-green shadow-[0_0_8px_rgba(0,128,255,0.4)] dark:shadow-theme-bright animate-progress-loading w-full origin-left rounded-full" />
        </div>
      </div>

      <div className="absolute bottom-8 text-muted-foreground dark:text-muted-foreground/30 dark:text-white/25 text-[10px] font-bold uppercase tracking-[0.3em]">
        Caricamento...
      </div>
    </div>
  );
}
