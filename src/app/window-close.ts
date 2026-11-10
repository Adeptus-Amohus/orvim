/** Serialize close requests, and never hide or exit before pending writes finish. */
export function createWindowCloser(actions: {
  persist: () => void;
  flush: () => Promise<void>;
  hideToTray: () => Promise<boolean>;
  destroy: () => Promise<void>;
  onError: (error: unknown) => void;
}) {
  let pending: Promise<void> | undefined;
  return () => {
    if (pending) return pending;
    pending = (async () => {
      try {
        actions.persist();
        await actions.flush();
        if (!(await actions.hideToTray())) await actions.destroy();
      } catch (error) {
        actions.onError(error);
      }
    })().finally(() => {
      pending = undefined;
    });
    return pending;
  };
}
