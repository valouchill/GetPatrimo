'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import posthog from 'posthog-js';

/**
 * PostHogProvider — analytics client, posture RGPD-minimale :
 *   - cookieless (`persistence: 'memory'`), sans autocapture, sans session recording
 *   - pageviews manuels (App Router ne les émet pas sur navigation SPA)
 *   - `identify(userId)` sur la session → stitch avec les events serveur
 *
 * No-op si `NEXT_PUBLIC_POSTHOG_KEY` est absente (inlinée au build). Doit être
 * rendu SOUS le SessionProvider (utilise useSession).
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const { data: session } = useSession();

  React.useEffect(() => {
    if (!KEY || (posthog as unknown as { __loaded?: boolean }).__loaded) return;
    posthog.init(KEY, {
      api_host: HOST,
      persistence: 'memory',
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
    });
  }, []);

  React.useEffect(() => {
    if (!KEY || !(posthog as unknown as { __loaded?: boolean }).__loaded) return;
    posthog.capture('$pageview');
  }, [pathname]);

  React.useEffect(() => {
    if (!KEY || !(posthog as unknown as { __loaded?: boolean }).__loaded) return;
    const uid = (session?.user as { id?: string } | undefined)?.id;
    if (uid) posthog.identify(String(uid));
  }, [session]);

  return <>{children}</>;
}
