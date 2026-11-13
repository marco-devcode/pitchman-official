
"use client";

import { usePathname } from 'next/navigation';
import { BottomNav } from './bottom-nav';

export function BottomNavWrapper() {
  const pathname = usePathname();
  if (pathname === '/login' || pathname === '/privacy' || pathname === '/termini' || pathname === '/landing') return null;
  return <BottomNav />;
}
