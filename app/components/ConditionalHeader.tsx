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
  
  return <LuxeHeader />;
}
