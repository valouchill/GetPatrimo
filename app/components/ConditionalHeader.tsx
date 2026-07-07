'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

const LuxeHeader = dynamic(() => import('./LuxeHeader'), { ssr: false });
const LandingHeader = dynamic(() => import('./LandingHeader'), { ssr: false });

export default function ConditionalHeader() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return null;
  
  if (pathname === '/') {
    return <LandingHeader />;
  }
  if (pathname === '/concierge') {
    return null;
  }
  if (pathname?.startsWith('/dashboard/owner')) {
    return null;
  }
  if (pathname?.startsWith('/auth/')) {
    return null;
  }
  if (pathname?.includes('/contract')) {
    return null;
  }
  // Pages publiques d'information (tarifs, légal, contestation art. 22) : header
  // marketing cohérent — pas le LuxeHeader legacy (liens morts /patrimoine,
  // /messages, /dashboard-luxe.html).
  const PUBLIC_INFO_PAGES = ['/pricing', '/pro', '/cgv', '/contestation', '/privacy', '/terms', '/mentions-legales'];
  if (PUBLIC_INFO_PAGES.includes(pathname || '')) {
    return <LandingHeader />;
  }

  return <LuxeHeader />;
}
