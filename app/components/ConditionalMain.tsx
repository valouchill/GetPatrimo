'use client';

import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function ConditionalMain({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  
  if (!mounted) return <main className="w-full">{children}</main>;
  
  if (pathname === '/concierge') {
    return <main className="w-full">{children}</main>;
  }
  if (pathname === '/') {
    return <main className="w-full">{children}</main>;
  }
  if (pathname?.startsWith('/dashboard/owner')) {
    return <main className="w-full">{children}</main>;
  }
  
  return <main className="w-full pt-24">{children}</main>;
}
