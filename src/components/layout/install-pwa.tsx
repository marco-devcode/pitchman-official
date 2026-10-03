'use client';

import { usePWAInstall } from '@/hooks/usePWAInstall';
import { Button } from '@/components/ui/button';
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Download, Share, PlusSquare, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export function InstallPWA() {
    const { canInstall, isInstalled, showIOSSheet, install, dismissIOSSheet } = usePWAInstall();
    const [justInstalled, setJustInstalled] = useState(false);

    if (isInstalled && !justInstalled) return null;

    const handleInstall = async () => {
        await install();
        setJustInstalled(true);
        setTimeout(() => setJustInstalled(false), 3000);
    };

    return (
        <>
            {/* Chrome / Android install button */}
            {(canInstall || justInstalled) && (
                <Button
                    onClick={handleInstall}
                    disabled={justInstalled}
                    size="sm"
                    className={
                        justInstalled
                            ? 'h-8 px-3 rounded-xl text-[10px] font-black uppercase gap-1.5 bg-green-500/10 border border-green-500/30 text-green-500 pointer-events-none'
                            : 'h-8 px-3 rounded-xl text-[10px] font-black uppercase gap-1.5 bg-primary/10 dark:bg-brand-orange/10 border border-primary/30 dark:border-brand-orange/30 text-primary dark:text-brand-orange hover:bg-primary/20 dark:hover:bg-brand-orange/20 transition-all'
                    }
                >
                    {justInstalled ? (
                        <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            App installata ✓
                        </>
                    ) : (
                        <>
                            <Download className="h-3.5 w-3.5" />
                            Scarica WebApp
                        </>
                    )}
                </Button>
            )}

            {/* iOS Safari bottom sheet */}
            <Sheet open={showIOSSheet} onOpenChange={(open) => !open && dismissIOSSheet()}>
                <SheetContent
                    side="bottom"
                    className="rounded-t-3xl bg-card dark:bg-black border-t border-border dark:border-brand-orange/30 shadow-2xl dark:shadow-theme pb-10"
                >
                    <SheetHeader className="mb-6">
                        <div className="flex items-center gap-3 mb-1">
                            <div className="h-10 w-10 rounded-2xl bg-primary/10 dark:bg-brand-orange/10 border border-primary/20 dark:border-brand-orange/20 flex items-center justify-center">
                                <Download className="h-5 w-5 text-primary dark:text-brand-orange" />
                            </div>
                            <SheetTitle className="text-xl font-black uppercase tracking-tight text-foreground dark:text-white">
                                Installa PitchMan
                            </SheetTitle>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider pl-1">
                            Aggiungi l'app alla schermata home per accesso rapido
                        </p>
                    </SheetHeader>

                    <div className="space-y-4 mb-8">
                        {/* Step 1 */}
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-muted/40 dark:bg-white/5 border border-border dark:border-white/5">
                            <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 dark:bg-brand-orange/10 border border-primary/20 dark:border-brand-orange/20 flex items-center justify-center">
                                <Share className="h-5 w-5 text-primary dark:text-brand-orange" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-orange mb-0.5">
                                    Passo 1
                                </span>
                                <span className="text-sm font-bold text-foreground dark:text-white leading-snug">
                                    Tocca <strong>"Condividi"</strong> nella barra di Safari
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                    L'icona si trova in basso al centro
                                </span>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-muted/40 dark:bg-white/5 border border-border dark:border-white/5">
                            <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 dark:bg-brand-orange/10 border border-primary/20 dark:border-brand-orange/20 flex items-center justify-center">
                                <PlusSquare className="h-5 w-5 text-primary dark:text-brand-orange" />
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black uppercase tracking-widest text-primary dark:text-brand-orange mb-0.5">
                                    Passo 2
                                </span>
                                <span className="text-sm font-bold text-foreground dark:text-white leading-snug">
                                    Seleziona <strong>"Aggiungi a schermata Home"</strong>
                                </span>
                                <span className="text-[10px] text-muted-foreground font-medium mt-0.5">
                                    Scorri il menu verso il basso se non la vedi
                                </span>
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={dismissIOSSheet}
                        className="w-full h-12 rounded-2xl font-black uppercase text-sm bg-primary dark:bg-black border border-primary dark:border-brand-orange text-white dark:text-brand-orange hover:opacity-90 dark:hover:bg-brand-orange/10 shadow-lg dark:shadow-theme-strong transition-all"
                    >
                        Ho capito
                    </Button>
                </SheetContent>
            </Sheet>
        </>
    );
}
