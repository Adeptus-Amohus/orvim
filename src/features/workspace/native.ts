import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeTextFile, writeFile } from "@tauri-apps/plugin-fs";
import type { WorkspaceDocument, WorkspaceSnapshot } from "./runtime";
import { createPersistence as queuePersistence } from "./persistence";
import { reminderPlan } from "./reminders";
import { widgetSnapshot } from "./widget-model.js";

const collections = [
  "tasks",
  "events",
  "checkins",
  "projects",
  "sleepLogs",
  "foodLogs",
  "workouts",
  "recoveryLogs",
  "waterLogs",
  "trainingGoals",
  "archiveItems",
  "savedMeals",
  "taskTemplates",
  "thoughts",
  "financeLogs",
  "exercises",
  "stepLogs",
  "weightLogs",
  "illnessLogs",
  "nutrientLogs",
];
const day = () => {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
};
export function emptyDocument(): WorkspaceDocument {
  return {
    revision: 0,
    covers: [],
    data: {
      ...Object.fromEntries(collections.map((name) => [name, []])),
      version: 32,
      nextId: 1,
      waterTarget: 2000,
      foodTarget: 0,
      archiveCategories: ["Фильмы", "Книги", "Аниме"],
      selectedDate: day(),
      selectedLifeDay: day(),
      selectedArchiveCategory: "Фильмы",
      range: "six",
      palette: "sun",
      appearance: "system",
      activePage: "home",
      lifeTab: "mood",
      lifeDetailOpen: false,
      customColor: "#8c6ad8",
      languageMode: "system",
      fontMode: "system",
    },
  };
}
// Browser development uses IndexedDB. Installed Windows/Android builds always use SQLite.
let previewDatabase: Promise<IDBDatabase> | undefined;
async function browserDatabase(): Promise<IDBDatabase> {
  previewDatabase ??= new Promise((resolve, reject) => {
    const request = indexedDB.open("life-os-preview", 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore("documents");
    request.onerror = () => {
      previewDatabase = undefined;
      reject(request.error);
    };
    request.onsuccess = () => resolve(request.result);
  });
  return previewDatabase;
}
async function browserRead(): Promise<WorkspaceDocument> {
  const db = await browserDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("documents");
    const request = tx.objectStore("documents").get("workspace");
    request.onsuccess = () =>
      resolve((request.result as WorkspaceDocument) ?? emptyDocument());
    request.onerror = () => reject(request.error);
  });
}
async function browserWrite(document: WorkspaceDocument): Promise<number> {
  const db = await browserDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("documents", "readwrite");
    const store = tx.objectStore("documents");
    const read = store.get("workspace");
    let conflict = false;
    read.onsuccess = () => {
      const old = read.result as WorkspaceDocument | undefined;
      if ((old?.revision ?? 0) !== document.revision) {
        conflict = true;
        tx.abort();
        return;
      }
      store.put({ ...document, revision: document.revision + 1 }, "workspace");
    };
    tx.oncomplete = () => {
      resolve(document.revision + 1);
    };
    tx.onabort = () => {
      reject(
        new Error(
          conflict
            ? "Данные изменены в другом окне. Перезапустите приложение."
            : "Не удалось сохранить данные.",
        ),
      );
    };
    tx.onerror = () => reject(tx.error);
  });
}
export async function loadDocument(): Promise<WorkspaceDocument> {
  return isTauri()
    ? invoke<WorkspaceDocument>("load_workspace")
    : browserRead();
}
export function createPersistence(
  document: WorkspaceDocument,
  status: (error: string | null) => void,
) {
  let reminderSignature = "";
  let reminderQueue: Promise<void> = Promise.resolve();
  let widgetSignature = "";
  let widgetQueue: Promise<void> = Promise.resolve();
  function syncWidgets(snapshot: WorkspaceSnapshot): Promise<void> {
    if (!isTauri() || !/Android/i.test(navigator.userAgent))
      return Promise.resolve();
    const projection = widgetSnapshot(snapshot, Date.now(), navigator.language);
    const signature = JSON.stringify({ ...projection, updatedAt: 0 });
    widgetQueue = widgetQueue
      .catch(() => {})
      .then(async () => {
        if (signature === widgetSignature) return;
        await invoke("platform_action", {
          operation: "widgetUpdate",
          args: projection,
        });
        widgetSignature = signature;
      });
    return widgetQueue;
  }
  function syncReminders(snapshot: WorkspaceSnapshot): Promise<void> {
    if (!isTauri()) return Promise.resolve();
    const plan = reminderPlan(snapshot);
    const nextSignature = JSON.stringify(plan);
    reminderQueue = reminderQueue
      .catch(() => {})
      .then(async () => {
        if (nextSignature === reminderSignature) return;
        try {
          const result = await invoke<{ message: string }>("sync_reminders", {
            plan,
          });
          reminderSignature = nextSignature;
          window.dispatchEvent(
            new CustomEvent("life-os:reminder-status", { detail: result }),
          );
        } catch (error) {
          window.dispatchEvent(
            new CustomEvent("life-os:reminder-status", {
              detail: { message: String(error), error: true },
            }),
          );
        }
      });
    return reminderQueue;
  }
  const persistence = queuePersistence(
    document,
    async (document) => {
      if (!isTauri()) return browserWrite(document);
      const revision = await invoke<number>("save_workspace", { document });
      window.dispatchEvent(new CustomEvent("life-os:workspace-saved"));
      await syncReminders(document);
      // A launcher failure must never turn a successful database write into a retry.
      await syncWidgets(document).catch(() => {});
      return revision;
    },
    status,
  );
  return { ...persistence, syncReminders, syncWidgets };
}
export const nativeServices = {
  cancelRequest: async (requestId: string) => {
    if (isTauri()) await invoke("cancel_connection_request", { requestId });
  },
  updates: async (operation: string, version?: string) => {
    if (!isTauri())
      throw Error("Обновления доступны в установленном приложении.");
    return invoke<any>("update_action", { operation, version });
  },
  validateActions: async (changes: unknown[]) =>
    invoke<any>("validate_assistant_actions", { changes }),
  backups: async (
    operation: string,
    name?: string,
    password?: string,
    content?: string,
  ) => {
    if (!isTauri())
      throw Error("Автоматические копии доступны в установленном приложении.");
    return invoke<any>("backup_action", { operation, name, password, content });
  },
  localSync: isTauri(),
  lan: async (
    operation: string,
    args: Record<string, unknown> = {},
    document?: WorkspaceDocument,
  ) => {
    if (!isTauri())
      throw Error(
        "Синхронизация доступна в установленном приложении Windows / Android.",
      );
    return invoke<any>("lan_sync", { operation, args, document });
  },
  mobile: /Android/i.test(navigator.userAgent),
  desktopTray: isTauri() && /Windows/i.test(navigator.userAgent),
  credential: async (
    operation: string,
    provider: string,
    value?: string,
    source?: string,
  ) => {
    if (!isTauri())
      throw Error("API подключения доступны в установленном приложении.");
    return invoke<{ configured: boolean }>("connection_credential", {
      operation,
      provider,
      value,
      source,
    });
  },
  request: async (args: Record<string, unknown>) => {
    if (!isTauri())
      throw Error("API подключения доступны в установленном приложении.");
    return invoke<any>("connection_request", { args });
  },
  platform: async (operation: string, args: Record<string, unknown>) => {
    if (!isTauri())
      throw Error("Эта функция доступна в установленном приложении.");
    return invoke<any>("platform_action", { operation, args });
  },
  googleLogin: (clientId: string, clientSecret: string) =>
    invoke("google_login", { clientId, clientSecret }),
};
export async function openFile(
  kind: "backup" | "image" | "document",
): Promise<File | null> {
  if (isTauri()) {
    const path = await open({
      multiple: false,
      directory: false,
      filters: [
        {
          name:
            kind === "image"
              ? "JPEG / PNG"
              : kind === "document"
                ? "Documents"
                : "Orvim backup",
          extensions:
            kind === "image"
              ? ["jpg", "jpeg", "png"]
              : kind === "document"
                ? ["pdf", "doc", "docx", "txt", "md"]
                : ["json"],
        },
      ],
    });
    if (!path || Array.isArray(path)) return null;
    const bytes = await readFile(path);
    if (
      bytes.length >
      (kind === "image" ? 10 : kind === "document" ? 5 : 160) * 1024 * 1024
    )
      throw new Error("Файл слишком большой.");
    const png =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const jpg = bytes[0] === 255 && bytes[1] === 216;
    if (kind === "image" && !png && !jpg)
      throw new Error("Выберите изображение JPEG или PNG.");
    return new File(
      [bytes],
      kind === "document"
        ? path.split(/[\\/]/).pop() || "document.pdf"
        : kind === "backup"
          ? "backup.json"
          : png
            ? "cover.png"
            : "cover.jpg",
      {
        type:
          kind === "document"
            ? "application/octet-stream"
            : kind === "backup"
              ? "application/json"
              : png
                ? "image/png"
                : "image/jpeg",
      },
    );
  }
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept =
      kind === "backup"
        ? ".json"
        : kind === "document"
          ? ".pdf,.doc,.docx,.txt,.md"
          : "image/jpeg,image/png";
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener("cancel", () => resolve(null), { once: true });
    input.click();
  });
}
export async function saveAttachment(
  name: string,
  data: string,
): Promise<boolean> {
  const match = /^data:([\w.+/-]*);base64,([A-Za-z0-9+/=]+)$/.exec(data);
  if (!match || !/\.(pdf|docx?|txt|md)$/i.test(name))
    throw Error("Некорректный файл.");
  const bytes = Uint8Array.from(atob(match[2]!), (char) => char.charCodeAt(0));
  if (isTauri()) {
    const path = await save({
      defaultPath: name.replace(/[\\/:*?"<>|]/g, "_"),
      filters: [
        {
          name: "Document",
          extensions: [name.split(".").pop()!.toLowerCase()],
        },
      ],
    });
    if (!path) return false;
    await writeFile(path, bytes);
    return true;
  }
  const url = URL.createObjectURL(
    new Blob([bytes], { type: match[1] || "application/octet-stream" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
  return true;
}
export async function openExternal(url: string): Promise<void> {
  const parsed = new URL(url);
  if (
    !["https:", "http:"].includes(parsed.protocol) ||
    parsed.username ||
    parsed.password
  )
    throw Error("Некорректная ссылка.");
  if (isTauri())
    await invoke("platform_action", {
      operation: "openUrl",
      args: { url: parsed.href },
    });
  else window.open(parsed.href, "_blank", "noopener,noreferrer");
}
export async function saveFile(
  name: string,
  type: string,
  content: string,
): Promise<boolean> {
  if (isTauri()) {
    const path = await save({
      defaultPath: name,
      filters: [
        {
          name: type.includes("json") ? "JSON" : "CSV",
          extensions: [type.includes("json") ? "json" : "csv"],
        },
      ],
    });
    if (!path) return false;
    await writeTextFile(path, content);
    return true;
  }
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}
