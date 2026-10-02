"use client";

import { WifiOff, ShieldAlert, CalendarX, DatabaseZap, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AppError, AppErrorType } from "@/lib/error-utils";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const ERROR_ICONS: Record<AppErrorType, React.ElementType> = {
  offline: WifiOff,
  unauthorized: ShieldAlert,
  "missing-season": CalendarX,
  "not-found": AlertTriangle,
  "firestore-error": DatabaseZap,
  unknown: AlertTriangle,
};

const ERROR_COLORS: Record<AppErrorType, { icon: string; border: string; bg: string; glow: string }> = {
  offline: {
    icon: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    glow: "dark:shadow-[0_0_30px_rgba(251,191,36,0.1)]",
  },
  unauthorized: {
    icon: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    glow: "dark:shadow-[0_0_30px_rgba(248,113,113,0.1)]",
  },
  "missing-season": {
    icon: "text-primary dark:text-brand-green",
    border: "border-primary/30 dark:border-brand-green/30",
    bg: "bg-primary/5 dark:bg-brand-green/5",
    glow: "dark:shadow-[0_0_30px_rgba(172,229,4,0.08)]",
  },
  "not-found": {
    icon: "text-orange-400",
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
    glow: "dark:shadow-[0_0_30px_rgba(251,146,60,0.1)]",
  },
  "firestore-error": {
    icon: "text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    glow: "dark:shadow-[0_0_30px_rgba(96,165,250,0.1)]",
  },
  unknown: {
    icon: "text-muted-foreground",
    border: "border-border",
    bg: "bg-muted/5",
    glow: "",
  },
};

interface ErrorStateProps {
  /** L'oggetto AppError da mostrare. Se non fornito, usa il messaggio raw. */
  error?: AppError | null;
  /** Messaggio di errore come stringa (alternativa a `error`). */
  message?: string;
  /** Tipo di errore per selezionare icona e colori. Default: 'unknown'. */
  type?: AppErrorType;
  /** Callback invocata al click del pulsante di azione primaria (es. "Riprova"). */
  onRetry?: () => void;
  /** Classe CSS aggiuntiva per il container radice. */
  className?: string;
  /** Se true, occupa tutto lo spazio verticale disponibile (per layout a schermo intero). */
  fullScreen?: boolean;
}

export function ErrorState({
  error,
  message,
  type,
  onRetry,
  className,
  fullScreen = false,
}: ErrorStateProps) {
  const router = useRouter();

  const resolvedType: AppErrorType = error?.type ?? type ?? "unknown";
  const resolvedMessage = error?.message ?? message ?? "Si è verificato un errore imprevisto.";
  const actionLabel = error?.actionLabel;
  const actionHref = error?.actionHref;

  const colors = ERROR_COLORS[resolvedType];
  const Icon = ERROR_ICONS[resolvedType];

  const handleAction = () => {
    if (actionHref) {
      router.push(actionHref);
    } else if (onRetry) {
      onRetry();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6",
        fullScreen ? "min-h-[60vh]" : "py-16",
        className
      )}
    >
      {/* Card container */}
      <div
        className={cn(
          "relative flex flex-col items-center gap-5 p-8 rounded-3xl border backdrop-blur-sm",
          "max-w-sm w-full transition-all",
          colors.border,
          colors.bg,
          colors.glow
        )}
      >
        {/* Decorative background blur */}
        <div
          className={cn(
            "absolute inset-0 rounded-3xl opacity-30 pointer-events-none",
            "bg-gradient-to-br from-transparent via-transparent to-current"
          )}
        />

        {/* Icon */}
        <div
          className={cn(
            "relative z-10 flex items-center justify-center w-16 h-16 rounded-2xl",
            "border backdrop-blur-sm",
            colors.border,
            colors.bg
          )}
        >
          <Icon className={cn("w-8 h-8", colors.icon)} strokeWidth={1.5} />
        </div>

        {/* Text */}
        <div className="relative z-10 space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/80 dark:text-muted-foreground/60">
            {resolvedType === "offline"
              ? "Connessione Assente"
              : resolvedType === "unauthorized"
              ? "Accesso Negato"
              : resolvedType === "missing-season"
              ? "Configurazione Richiesta"
              : resolvedType === "not-found"
              ? "Non Trovato"
              : resolvedType === "firestore-error"
              ? "Errore Dati"
              : "Errore"}
          </p>
          <p className="text-sm font-medium leading-relaxed text-foreground/80">
            {resolvedMessage}
          </p>
        </div>

        {/* Action button */}
        {(actionLabel || onRetry) && (
          <Button
            onClick={handleAction}
            className={cn(
              "relative z-10 h-11 px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all",
              "bg-background dark:bg-black border",
              colors.border,
              "text-foreground hover:opacity-80 active:scale-95",
              "flex items-center gap-2"
            )}
            variant="outline"
          >
            {resolvedType !== "unauthorized" && resolvedType !== "missing-season" && (
              <RefreshCw className="w-3.5 h-3.5 opacity-60" />
            )}
            {actionLabel ?? "Riprova"}
          </Button>
        )}
      </div>
    </div>
  );
}
