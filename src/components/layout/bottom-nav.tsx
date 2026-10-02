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
  Users
} from "lucide-react";
import { PiTrafficCone } from "react-icons/pi";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/allenamento", label: "Allenamento", icon: PiTrafficCone },
  { href: "/calendario", label: "Calendario", icon: Calendar },
  { href: "/", label: "Dashboard", icon: LayoutGrid },
  { href: "/membri", label: "Rosa", icon: Users },
  { href: "/altro", label: "Impostazioni", icon: Settings },
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
        isActive && "text-primary dark:text-brand-green shadow-[0_0_15px_rgba(37,99,235,0.2)] dark:shadow-none dark:drop-shadow-[0_0_6px_rgba(172,229,4,0.8)] scale-110"
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
      {navItems.map((item) => (
        <NavLink key={item.href} {...item} />
      ))}
    </nav>
  );
}
