import type { WorkspaceDocument, WorkspaceSnapshot } from "./runtime";

/** Serial writes keep snapshots and revisions in order, including during app close. */
export function createPersistence(
  document: WorkspaceDocument,
  write: (document: WorkspaceDocument) => Promise<number>,
  status: (error: string | null) => void,
) {
  let revision = document.revision,
    pending: WorkspaceSnapshot | null = null,
    saved = JSON.stringify({ data: document.data, covers: document.covers }),
    scheduled = false,
    running: Promise<void> | null = null;
  async function drain(): Promise<void> {
    while (pending) {
      const snapshot = pending;
      pending = null;
      const key = JSON.stringify(snapshot);
      if (key === saved) continue;
      try {
        revision = await write({ ...snapshot, revision });
        saved = key;
        status(null);
      } catch (error) {
        pending ??= snapshot;
        status(String(error));
        throw error;
      }
    }
  }
  async function flush(): Promise<void> {
    if (running) {
      await running;
      if (!pending) return;
    }
    if (!pending) return;
    running = drain();
    try {
      await running;
    } finally {
      running = null;
    }
  }
  function persist(snapshot: WorkspaceSnapshot) {
    // A return to the previous value while another write is in flight must
    // become a new write, otherwise the in-flight value wins after restart.
    if (JSON.stringify(snapshot) === saved && !pending && !running) return;
    pending = structuredClone(snapshot);
    if (!scheduled) {
      scheduled = true;
      queueMicrotask(() => {
        scheduled = false;
        void flush().catch(() => {});
      });
    }
  }
  return { persist, flush };
}
