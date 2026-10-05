"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Search,
  LayoutGrid,
  Settings,
  TrendingUp,
  Calendar,
  Users,
  Shield,
  CreditCard,
  Server
} from 'lucide-react';
import { PiTrafficCone } from "react-icons/pi";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";

const navItems = [
  { href: "/allenamento", label: "Allenamento", icon: PiTrafficCone },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/membri", label: "Rosa", icon: Users },
  { href: "/altro", label: "Impostazioni", icon: Settings },
];

/**
 * Barra del DEVELOPER su mobile.
 *
 * Stessa regola dell'header: il developer non ha una squadra, quindi la barra da
 * allenatore gli mostrerebbe cinque destinazioni che non gli appartengono e
 * gli darebbe l'impressione di aver perso qualcosa. Qui vede solo il backend.
 */
const developerNavItems = [
  { href: "/admin", label: "Backend", icon: Server },
  { href: "/admin/users", label: "Account", icon: Shield },
  { href: "/admin/plans", label: "Piani", icon: CreditCard },
  { href: "/admin/health", label: "Salute", icon: TrendingUp },
  { href: "/", label: "Esci", icon: LayoutGrid },
];

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center justify-center gap-1 p-2 transition-all w-full",
        // Icona non attiva: /80 nel chiaro perche' il grigio al 50% sul fondo
        // chiaro scende a 1.78:1 e le voci della barra sparivano. Sul nero il
        // valore basso regge e resta /30.
        isActive ? "text-primary dark:text-brand-green" : "text-muted-foreground dark:text-muted-foreground/30"
      )}
    >
      <div className={cn(
        "transition-all duration-300 p-1.5 rounded-xl",
        isActive && "text-primary dark:text-brand-green shadow-[0_0_15px_rgba(37,99,235,0.2)] dark:shadow-none dark:drop-shadow-theme-bright scale-110"
      )}>
        <Icon className="h-6 w-6" />
      </div>
      <span className={cn(
        "text-[9px] font-black uppercase tracking-wider transition-colors",
        // Etichetta non attiva: stesso motivo, /40 era la soglia che non
        // reggeva sul chiaro.
        isActive ? "text-foreground dark:text-brand-green" : "text-muted-foreground dark:text-muted-foreground/30"
      )}>
        {label}
      </span>
    </Link>
  );
}

export function BottomNav() {
  const [mounted, setMounted] = useState(false);
  const user = useAuthStore((state) => state.user);
  // `isMounted` protegge dal mismatch di hydration: il server non sa il ruolo,
  // quindi renderizza la barra vuota e il client la riempie. Senza questo gate
  // React segnalerebbe un mismatch a ogni utente su ogni pagina.
  const isDeveloper = mounted && user?.role === 'developer';
  const items = isDeveloper ? developerNavItems : navItems;

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-20 items-center justify-around bg-background md:hidden">
      </nav>
    );
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex h-20 items-center justify-around bg-background dark:bg-black border-t border-border dark:border-brand-green/20 md:hidden px-4 pb-2 shadow-[0_-10px_30px_rgba(0,0,0,0.1)] dark:shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
      {items.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
    </nav>
  );
}
