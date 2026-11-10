import { useCallback, useEffect, useRef, useState } from "react";
import { repository } from "../data/repository";
import type { Snapshot } from "../domain/models";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
export function useWorkspace() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const snapshot = await repository.snapshot();
      if (current === sequence.current) {
        setData(snapshot);
        setError(null);
      }
    } catch (reason) {
      if (current === sequence.current) setError(errorMessage(reason));
    }
  }, []);
  useEffect(() => {
    void reload();
  }, [reload]);
  // Re-read on focus so a second window cannot leave the view stale.
  useEffect(() => {
    const refresh = () => {
      void reload();
    };
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [reload]);
  const mutate = useCallback(
    async <T>(operation: () => Promise<T>): Promise<T> => {
      setBusy(true);
      try {
        const result = await operation();
        await reload();
        return result;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );
  return { data, error, busy, reload, mutate };
}
export type Workspace = ReturnType<typeof useWorkspace>;
