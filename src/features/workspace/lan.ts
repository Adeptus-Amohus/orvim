import type { WorkspaceServices, WorkspaceSnapshot } from "./runtime";
import { syncDifferences } from "./sync-review.js";

type Runtime = {
  snapshot(): WorkspaceSnapshot;
  canSync(): boolean;
  applyRemote(snapshot: WorkspaceSnapshot): void;
};
type Persistence = {
  persist(snapshot: WorkspaceSnapshot): void;
  flush(): Promise<void>;
};

/** The native journal never writes the workspace SQLite file. All incoming data
 * goes through the same revision queue as local editing, before receipt ack. */
export function startLanSync(
  runtime: Runtime,
  persistence: Persistence,
  services: Pick<
    WorkspaceServices,
    "lan" | "localSync" | "backups" | "saveFile"
  >,
) {
  let disposed = false,
    busy = false,
    resetting = false,
    mode = "off",
    timer: ReturnType<typeof setTimeout> | undefined;
  let pendingReceipt: string | undefined,
    pendingFileReceipt: string | undefined,
    cached: Record<string, any> = { mode: "off", conflicts: [] };
  let review: any;

  function publish(detail: Record<string, any>) {
    if (disposed || resetting) return;
    cached = { ...cached, ...detail };
    window.dispatchEvent(
      new CustomEvent("life-os:lan-status", { detail: cached }),
    );
    // These describe one event, not a persistent connection state. Replaying
    // reviewApplied on every status tick would close unrelated dialogs.
    for (const key of [
      "reviewApplied",
      "reviewError",
      "devices",
      "paired",
      "fileMessage",
      "fileError",
      "openFileReview",
    ])
      delete cached[key];
  }
  function schedule(delay = 20_000) {
    clearTimeout(timer);
    if (!disposed && services.localSync)
      timer = setTimeout(() => {
        void run("exchange");
      }, delay);
  }
  async function status() {
    const value = await services.lan!("status");
    mode = value.mode;
    // Native status returns a count; conflict choices arrive with the exchange.
    const { conflicts: count, ...rest } = value;
    publish({ ...rest, conflictCount: count, busy });
  }
  async function run(operation: string, args: Record<string, unknown> = {}) {
    if (disposed || resetting || busy || !services.localSync || !services.lan)
      return;
    if (
      operation === "exchange" &&
      (mode === "off" ||
        document.visibilityState === "hidden" ||
        !runtime.canSync())
    ) {
      schedule();
      return;
    }
    busy = true;
    publish({ busy: true });
    try {
      if (pendingFileReceipt) {
        await persistence.flush();
        await services.lan("fileAck", { receipt: pendingFileReceipt });
        pendingFileReceipt = undefined;
      }
      if (pendingReceipt) {
        await persistence.flush();
        await services.lan("ack", { receipt: pendingReceipt });
        pendingReceipt = undefined;
      }
      if (operation === "discover") {
        const found = await services.lan("discover");
        publish(found);
        return;
      }
      if (["fileExport", "fileImport"].includes(operation)) {
        if (review)
          throw Error("Сначала завершите открытое сравнение устройств.");
        await persistence.flush();
        const before = runtime.snapshot(),
          fingerprint = JSON.stringify(before);
        const response = await services.lan(operation, args, {
          ...before,
          revision: 0,
        });
        if (disposed || resetting) return;
        if (JSON.stringify(runtime.snapshot()) !== fingerprint)
          throw Error(
            "Данные изменились во время переноса. Повторите действие.",
          );
        if (operation === "fileExport") {
          await services.backups?.("create", "before-file-export");
          runtime.applyRemote(response.document);
          persistence.persist(runtime.snapshot());
          await persistence.flush();
          const saved = await services.saveFile(
            "Orvim-transfer-" + new Date().toISOString().slice(0, 10) + ".json",
            "application/json",
            response.content,
          );
          publish({
            fileMessage: saved
              ? "Файл переноса сохранён. Передайте его по USB на другое устройство."
              : "Сохранение файла отменено.",
          });
          return;
        }
        if (response.unchanged) {
          publish({
            fileMessage:
              "Этот файл уже применён. Повторные записи не добавлены.",
          });
          return;
        }
        const changes = syncDifferences(
          response.comparison?.local || before,
          response.document,
          response.conflicts || [],
        );
        if (!changes.length) {
          await services.lan("fileAck", { receipt: response.receipt });
          publish({ fileMessage: "Данные совпадают. Добавлять нечего." });
          return;
        }
        review = {
          receipt: response.receipt,
          fingerprint,
          changes,
          transport: "file",
          source: {},
          hostName: "Файл с другого устройства",
        };
        publish({
          review,
          fileMessage: "Файл прочитан. Сравните записи перед объединением.",
          openFileReview: true,
        });
        return;
      }
      if (operation === "resolve" && review?.transport === "file") {
        const before = runtime.snapshot();
        if (JSON.stringify(before) !== review.fingerprint)
          throw Error("Локальные данные изменились. Откройте файл заново.");
        const response = await services.lan("fileResolve", args, {
          ...before,
          revision: 0,
        });
        review = {
          ...review,
          receipt: response.receipt,
          changes: syncDifferences(
            response.comparison?.local || before,
            response.document,
            response.conflicts || [],
          ),
        };
        publish({ review });
        return;
      }
      if (operation === "review") {
        if (!review)
          throw new Error("Нет изменений для сравнения. Выполните обмен.");
        await persistence.flush();
        if (JSON.stringify(runtime.snapshot()) !== review.fingerprint) {
          review = undefined;
          publish({ review: null });
          throw new Error("Локальные данные изменились. Повторите сравнение.");
        }
        const file = review.transport === "file";
        const result = await services.lan(
          file ? "fileReview" : "review",
          {
            receipt: review.receipt,
            rejected: args.rejected || [],
            both: args.both || [],
          },
          { ...runtime.snapshot(), revision: 0 },
        );
        if (disposed || resetting) return;
        await services.backups?.("create", "before-sync-apply");
        if (disposed || resetting) return;
        runtime.applyRemote({
          data: result.document.data,
          covers: result.document.covers,
        });
        persistence.persist(runtime.snapshot());
        if (file) pendingFileReceipt = result.receipt;
        else pendingReceipt = result.receipt;
        await persistence.flush();
        await services.lan(file ? "fileAck" : "ack", {
          receipt: file ? pendingFileReceipt : pendingReceipt,
        });
        if (file) pendingFileReceipt = undefined;
        else pendingReceipt = undefined;
        review = undefined;
        publish({
          review: null,
          reviewApplied: true,
          lastSync: Date.now(),
          reviewError: "",
          fileMessage: file ? "Данные из файла объединены и сохранены." : "",
        });
        return;
      }
      if (review && ["exchange"].includes(operation)) {
        publish({ review });
        return;
      }

      if (!["exchange", "resolve"].includes(operation)) {
        await services.lan(operation, args);
        if (disposed || resetting) return;
        if (operation === "stop")
          publish({ conflicts: [], lastSync: 0, code: null, error: "" });
        if (operation === "pair") publish({ paired: true, error: "" });
        await status();
      }
      if (
        mode !== "off" &&
        (runtime.canSync() || ["resolve"].includes(operation)) &&
        document.visibilityState !== "hidden"
      ) {
        await persistence.flush();
        if (disposed || resetting) return;
        const before = runtime.snapshot(),
          fingerprint = JSON.stringify(before);
        const response = await services.lan(
          operation === "resolve" ? "resolve" : "exchange",
          args,
          { ...before, revision: 0 },
        );
        if (disposed || resetting) return;
        // Typing or an edit started while the socket was waiting: retry instead
        // of replacing a draft or acknowledging changes that were never applied.
        if (
          (!runtime.canSync() && !["resolve"].includes(operation)) ||
          JSON.stringify(runtime.snapshot()) !== fingerprint
        ) {
          schedule(3_000);
          return;
        }
        const incoming: WorkspaceSnapshot = {
          data: response.document.data,
          covers: response.document.covers,
        };
        const changes = syncDifferences(
          response.comparison?.local || before,
          incoming,
          response.conflicts || [],
        );
        if (changes.length) {
          review = {
            receipt: response.receipt,
            fingerprint,
            changes,
            source: response.comparison?.source,
            hostName: cached.hostName,
            transport: "lan",
          };
          publish({ review, conflicts: response.conflicts || [], error: "" });
          return;
        }
        if (JSON.stringify(incoming) !== fingerprint) {
          runtime.applyRemote(incoming);
          persistence.persist(runtime.snapshot());
        }
        pendingReceipt = response.receipt;
        await persistence.flush();
        await services.lan("ack", { receipt: pendingReceipt });
        pendingReceipt = undefined;
        publish({
          conflicts: response.conflicts || [],
          lastSync: response.syncedAt,
          error: "",
        });
      }
      if (!disposed) await status();
      publish({ error: "" });
    } catch (error) {
      const fileAction =
        operation.startsWith("file") ||
        (review?.transport === "file" &&
          ["review", "resolve"].includes(operation));
      publish({
        ...(fileAction ? {} : { error: String(error), offline: true }),
        reviewError:
          operation === "review" ||
          (operation === "resolve" && review?.transport === "file")
            ? String(error)
            : "",
        fileError: fileAction ? String(error) : "",
      });
    } finally {
      busy = false;
      publish({ busy: false });
      schedule();
    }
  }
  const action = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail?.operation) void run(detail.operation, detail.args);
  };
  const wake = () => {
    if (document.visibilityState !== "hidden") void run("exchange");
  };
  const saved = () => {
    if (!busy && mode !== "off") schedule(2_000);
  };
  const beforeWipe = () => {
    resetting = true;
    clearTimeout(timer);
  };
  const wipeFailed = () => {
    resetting = false;
    schedule();
  };
  window.addEventListener("life-os:before-wipe", beforeWipe);
  window.addEventListener("life-os:wipe-failed", wipeFailed);
  window.addEventListener("life-os:lan-action", action);
  window.addEventListener("life-os:workspace-saved", saved);
  window.addEventListener("focus", wake);
  document.addEventListener("visibilitychange", wake);
  if (services.localSync) void run("status");
  return () => {
    disposed = true;
    clearTimeout(timer);
    window.removeEventListener("life-os:before-wipe", beforeWipe);
    window.removeEventListener("life-os:wipe-failed", wipeFailed);
    window.removeEventListener("life-os:lan-action", action);
    window.removeEventListener("life-os:workspace-saved", saved);
    window.removeEventListener("focus", wake);
    document.removeEventListener("visibilitychange", wake);
  };
}
