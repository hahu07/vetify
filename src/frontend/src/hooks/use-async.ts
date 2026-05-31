import { useCallback, useRef, useState } from "react";

export interface UseAsyncState<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  execute: () => Promise<void>;
  retry: () => void;
}

/**
 * Generic async hook with loading/error states and retry support.
 * Pass an async function; call execute() to run it.
 * retry() is an alias for execute().
 */
export function useAsync<T>(asyncFn: () => Promise<T>): UseAsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fnRef = useRef(asyncFn);
  fnRef.current = asyncFn;

  const execute = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fnRef.current();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, []);

  const retry = useCallback(() => {
    void execute();
  }, [execute]);

  return { data, error, isLoading, execute, retry };
}
