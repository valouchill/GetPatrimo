'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseFetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseFetchOptions {
  /** Ne pas exécuter automatiquement au montage */
  skip?: boolean;
  /** Headers supplémentaires */
  headers?: Record<string, string>;
  /** Intervalle de polling en ms (0 = désactivé) */
  pollInterval?: number;
}

interface UseFetchReturn<T> extends UseFetchState<T> {
  /** Re-déclencher manuellement le fetch */
  refetch: () => Promise<T | null>;
}

/**
 * Hook pour effectuer des requêtes GET avec gestion du loading, erreur et cache.
 *
 * @param url - URL de l'API à appeler
 * @param options - Options de configuration
 * @returns État du fetch (data, loading, error) et fonction refetch
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useFetch<Property>('/api/owner/properties/123');
 * ```
 */
export function useFetch<T = unknown>(
  url: string | null,
  options: UseFetchOptions = {}
): UseFetchReturn<T> {
  const { skip = false, headers, pollInterval = 0 } = options;
  const [state, setState] = useState<UseFetchState<T>>({
    data: null,
    loading: !skip && !!url,
    error: null,
  });
  const abortRef = useRef<AbortController | null>(null);

  const fetchData = useCallback(async (): Promise<T | null> => {
    if (!url) return null;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch(url, {
        cache: 'no-store',
        signal: controller.signal,
        headers: { ...headers },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.msg || body.error || `Erreur ${res.status}`);
      }

      const data: T = await res.json();
      if (!controller.signal.aborted) {
        setState({ data, loading: false, error: null });
      }
      return data;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      const message = err instanceof Error ? err.message : 'Erreur inconnue';
      if (!controller.signal.aborted) {
        setState(prev => ({ ...prev, loading: false, error: message }));
      }
      return null;
    }
  }, [url, headers]);

  useEffect(() => {
    if (skip || !url) return;
    fetchData();
    return () => abortRef.current?.abort();
  }, [fetchData, skip, url]);

  useEffect(() => {
    if (!pollInterval || skip || !url) return;
    const id = setInterval(fetchData, pollInterval);
    return () => clearInterval(id);
  }, [pollInterval, fetchData, skip, url]);

  return { ...state, refetch: fetchData };
}
