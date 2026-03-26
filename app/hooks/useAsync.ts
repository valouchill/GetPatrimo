'use client';

import { useState, useCallback } from 'react';

interface UseAsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface UseAsyncReturn<T, A extends unknown[]> extends UseAsyncState<T> {
  /** Exécuter l'action async */
  execute: (...args: A) => Promise<T | null>;
  /** Réinitialiser l'état */
  reset: () => void;
}

/**
 * Hook pour exécuter une action async avec gestion du loading et des erreurs.
 *
 * @param asyncFn - Fonction asynchrone à exécuter
 * @returns État (data, loading, error), execute et reset
 *
 * @example
 * ```tsx
 * const { execute, loading, error } = useAsync(async (id: string) => {
 *   const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });
 *   if (!res.ok) throw new Error('Erreur suppression');
 *   return res.json();
 * });
 * ```
 */
export function useAsync<T = unknown, A extends unknown[] = unknown[]>(
  asyncFn: (...args: A) => Promise<T>
): UseAsyncReturn<T, A> {
  const [state, setState] = useState<UseAsyncState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: A): Promise<T | null> => {
      setState({ data: null, loading: true, error: null });
      try {
        const data = await asyncFn(...args);
        setState({ data, loading: false, error: null });
        return data;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Erreur inconnue';
        setState(prev => ({ ...prev, loading: false, error: message }));
        return null;
      }
    },
    [asyncFn]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return { ...state, execute, reset };
}
