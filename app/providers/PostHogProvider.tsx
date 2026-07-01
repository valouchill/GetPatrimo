'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import posthog from 'posthog-js';

/**
 * PostHogProvider — analytics client, posture RGPD-minimale ET anti-fuite :
 *   - cookieless (`persistence: 'memory'`), sans autocapture, sans session recording
 *   - pageviews manuels, JAMAIS sur les routes à secret/PII (tunnels)
 *   - `sanitize_properties` : rédige l'URL de TOUS les events (retire query string +
 *     redige les chemins porteurs de tokens/PII) — défense en profondeur
 *   - `identify(userId)` sur changement réel d'utilisateur, `reset()` à la déconnexion
 *
 * No-op si `NEXT_PUBLIC_POSTHOG_KEY` est absente (inlinée au build). Doit être
 * rendu SOUS le SessionProvider (utilise useSession).
 */

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://eu.i.posthog.com';

// Routes dont l'URL porte un token capability ou de la PII : lien Sésame
// (/apply/PT-*), tokens de vérification, ?token= de reset mdp, slug passeport
// (/p/, /dossier = prénom + aléa donnant accès KYC public). On n'émet AUCUN
// pageview dessus, et on redige leur URL partout où elle apparaît.
const SENSITIVE_PREFIXES = [
  '/apply',
  '/verify',
  '/verify-guarantor',
  '/verify-cotenant',
  '/p/',
  '/dossier',
  '/auth/reset-password',
];

function matchSensitive(pathname: string): string | null {
  for (const p of SENSITIVE_PREFIXES) {
    const withSlash = p.endsWith('/') ? p : p + '/';
    if (pathname === p || pathname.startsWith(withSlash)) return p;
  }
  return null;
}

/** Retire TOUTE query string + redige les segments sensibles d'une URL/chemin. */
function redactUrl(raw: unknown): unknown {
  if (typeof raw !== 'string' || !raw) return raw;
  try {
    const u = new URL(raw, 'https://redacted.local');
    const hit = matchSensitive(u.pathname);
    const path = hit
      ? (hit.endsWith('/') ? hit + '[redacted]' : hit + '/[redacted]')
      : u.pathname;
    // query string TOUJOURS supprimée (kill ?token=, callbackUrl, utm_content=slug…)
    return u.origin === 'https://redacted.local' ? path : u.origin + path;
  } catch {
    return '[redacted]';
  }
}

const URL_PROP_KEYS = [
  '$current_url',
  '$pathname',
  '$referrer',
  '$initial_current_url',
  '$initial_referrer',
  '$initial_pathname',
];

export default function PostHogProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const uid = (session?.user as { id?: string } | undefined)?.id;
  const loaded = (): boolean =>
    (posthog as unknown as { __loaded?: boolean }).__loaded === true;

  React.useEffect(() => {
    if (!KEY || loaded()) return;
    posthog.init(KEY, {
      api_host: HOST,
      persistence: 'memory',
      autocapture: false,
      capture_pageview: false,
      disable_session_recording: true,
      person_profiles: 'identified_only',
      sanitize_properties: (properties) => {
        for (const k of URL_PROP_KEYS) {
          if (properties[k] != null) properties[k] = redactUrl(properties[k]);
        }
        // utm_content peut contenir le slug passeport (prénom+token) → retiré.
        if (properties.utm_content != null) delete properties.utm_content;
        return properties;
      },
    });
  }, []);

  // Pageview manuel — jamais sur les routes à secret (aucun intérêt funnel).
  React.useEffect(() => {
    if (!KEY || !loaded()) return;
    if (matchSensitive(pathname)) return;
    posthog.capture('$pageview');
  }, [pathname]);

  // identify au changement réel d'utilisateur ; reset propre à la déconnexion.
  React.useEffect(() => {
    if (!KEY || !loaded()) return;
    if (uid) posthog.identify(String(uid));
    else if (status === 'unauthenticated') posthog.reset();
  }, [uid, status]);

  return <>{children}</>;
}
