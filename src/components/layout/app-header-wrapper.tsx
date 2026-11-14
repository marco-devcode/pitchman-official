
"use client";

import { usePathname } from 'next/navigation';
import { AppHeader } from './app-header';

export function AppHeaderWrapper() {
  const pathname = usePathname();
  if (
    pathname === '/login' ||
    pathname === '/privacy' ||
    pathname === '/termini' ||
    pathname === '/landing' ||
    pathname.startsWith('/sondaggio')
  ) {
    return null;
  }
  return <AppHeader />;
}
