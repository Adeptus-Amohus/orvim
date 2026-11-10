import { useEffect, useLayoutEffect, useRef, useState } from "react";
import "../features/workspace/life-tracking.css";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { createWindowCloser } from "./window-close";
import StartupLoader from "./StartupLoader";
import {
  interfaceLanguage,
  interfaceMessage,
} from "../features/workspace/ui-language.js";
import { createIconRefresher } from "../features/workspace/refresh-icons";
import { workspaceIcons as icons } from "../features/workspace/icons";
import markup from "../features/workspace/markup.html?raw";
import { mountWorkspace } from "../features/workspace/runtime";
import { startLanSync } from "../features/workspace/lan";
import {
  createPersistence,
  loadDocument,
  openFile,
  saveFile,
  saveAttachment,
  openExternal,
  nativeServices,
} from "../features/workspace/native";
import "../features/workspace/workspace.css";
import "../features/workspace/appearance.css";
import "../features/workspace/upgrades.css";
import "../features/workspace/usability.css";
import "../features/workspace/thoughts.css";
import "../features/workspace/database.css";
import "../features/workspace/assistant.css";
import "../features/workspace/training.css";
import "../features/workspace/experience.css";
import "../features/workspace/interactions.css";
import "../styles/application.css";
import "../features/workspace/controls.css";
import "../features/workspace/refinements.css";
import "@fontsource/nunito/cyrillic-400.css";
import "@fontsource/nunito/cyrillic-500.css";
import "@fontsource/nunito/cyrillic-600.css";
import "@fontsource/nunito/cyrillic-700.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-500.css";
import "@fontsource/nunito/latin-600.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/ibm-plex-sans/cyrillic-400.css";
import "@fontsource/ibm-plex-sans/cyrillic-500.css";
import "@fontsource/ibm-plex-sans/cyrillic-600.css";
import "@fontsource/ibm-plex-sans/cyrillic-700.css";
import "@fontsource/ibm-plex-sans/latin-400.css";
import "@fontsource/ibm-plex-sans/latin-500.css";
import "@fontsource/ibm-plex-sans/latin-600.css";
import "@fontsource/ibm-plex-sans/latin-700.css";
import "@fontsource/nunito/cyrillic-ext-400.css";
import "@fontsource/nunito/cyrillic-ext-500.css";
import "@fontsource/nunito/cyrillic-ext-600.css";
import "@fontsource/nunito/cyrillic-ext-700.css";
import "@fontsource/ibm-plex-sans/cyrillic-ext-400.css";
import "@fontsource/ibm-plex-sans/cyrillic-ext-500.css";
import "@fontsource/ibm-plex-sans/cyrillic-ext-600.css";
import "@fontsource/ibm-plex-sans/cyrillic-ext-700.css";

const refreshWorkspaceIcons = createIconRefresher(icons);

export default function FullApp() {
  const container = useRef<HTMLDivElement>(null);
  const runtimeRef = useRef<ReturnType<typeof mountWorkspace> | null>(null);
  const flushRef = useRef<(() => Promise<void>) | null>(null);
  const [error, setError] = useState<string | null>(null),
    [ready, setReady] = useState(false),
    [attempt, setAttempt] = useState(0);
  const [recoveryFile, setRecoveryFile] = useState<string | null>(null),
    [recoveryPassword, setRecoveryPassword] = useState(""),
    [recovering, setRecovering] = useState(false);
  useLayoutEffect(() => {
    // Scroll offsets set while the workspace is hidden are discarded by WebView.
    if (ready) runtimeRef.current?.refreshLayout();
  }, [ready]);
  useEffect(() => {
    let cancelled = false,
      dispose: (() => void) | undefined,
      unlisten: (() => void) | undefined;
    let unlistenNotifications: (() => void) | undefined;
    let unlistenUpdates: (() => void) | undefined;
    let stopWidgets: (() => void) | undefined;
    setReady(false);
    setError(null);
    void (async () => {
      try {
        const document = await loadDocument();
        if (cancelled || !container.current) return;
        const persistence = createPersistence(document, (message) => {
          if (!cancelled) setError(message);
        });
        flushRef.current = persistence.flush;
        const root = container.current;
        root.innerHTML = markup;
        const runtime = mountWorkspace(root, document, {
          ...persistence,
          ...nativeServices,
          readDocument: loadDocument,
          openFile,
          saveFile,
          saveAttachment,
          openExternal,
          refreshIcons: refreshWorkspaceIcons,
        });
        const stopLanSync = startLanSync(runtime, persistence, {
          ...nativeServices,
          saveFile,
        });
        runtimeRef.current = runtime;
        dispose = () => {
          runtimeRef.current = null;
          stopLanSync();
          runtime.dispose();
        };
        // Opening a window must not replace persisted records with defaults.
        setReady(true);
        if (isTauri()) {
          if (nativeServices.mobile) {
            let importing = false;
            const importWidgets = async () => {
              if (importing || cancelled) return;
              importing = true;
              try {
                const result = await nativeServices.platform(
                  "widgetPending",
                  {},
                );
                const keys = runtime.importWidgetCommands(
                  result.commands || [],
                );
                if (keys.length) {
                  persistence.persist(runtime.snapshot());
                  await persistence.flush();
                  await nativeServices.platform("widgetAck", { keys });
                  await persistence.syncWidgets(runtime.snapshot());
                }
              } catch (cause) {
                if (!cancelled) setError(String(cause));
              } finally {
                importing = false;
              }
            };
            const resumeWidgets = () => {
              void importWidgets();
            };
            globalThis.window.addEventListener("life-os:resume", resumeWidgets);
            stopWidgets = () =>
              globalThis.window.removeEventListener(
                "life-os:resume",
                resumeWidgets,
              );
            await importWidgets();
          }
          // Replace schedules from an older version even if the user makes no edits.
          void persistence.syncReminders(runtime.snapshot());
          void persistence.syncWidgets(runtime.snapshot()).catch(() => {});
          if (nativeServices.mobile) {
            const action = await nativeServices.platform("widgetAction", {});
            if (action?.action)
              globalThis.window.dispatchEvent(
                new CustomEvent("orvim:widget-action", { detail: action }),
              );
          }
          unlistenUpdates = await listen("life-os:update-progress", (event) =>
            globalThis.window.dispatchEvent(
              new CustomEvent("life-os:update-progress", {
                detail: event.payload,
              }),
            ),
          );
          if (cancelled) {
            unlistenUpdates();
            return;
          }
          unlistenNotifications = await listen("life-notification", (event) =>
            globalThis.window.dispatchEvent(
              new CustomEvent("life-os:notification", {
                detail: event.payload,
              }),
            ),
          );
          if (cancelled) {
            unlistenNotifications();
            return;
          }
          const activation = await nativeServices.platform(
            "notificationClick",
            {},
          );
          if (activation?.kind)
            globalThis.window.dispatchEvent(
              new CustomEvent("life-os:notification", { detail: activation }),
            );
          if (nativeServices.mobile) {
            const snapshot = runtime.snapshot(),
              settings = snapshot.data.notificationSettings as Record<
                string,
                unknown
              >;
            if (
              settings.enabled !== false &&
              (settings.wellbeingEnabled !== false ||
                settings.scheduleEnabled !== false) &&
              !settings.requested
            ) {
              settings.requested = true;
              persistence.persist(snapshot);
              void nativeServices
                .platform("notificationPermission", {})
                .then((result) =>
                  globalThis.window.dispatchEvent(
                    new CustomEvent("life-os:reminder-status", {
                      detail: result,
                    }),
                  ),
                )
                .catch(() => {});
            }
          }
          const window = getCurrentWindow();
          const closeWindow = createWindowCloser({
            persist: () => persistence.persist(runtime.snapshot()),
            flush: persistence.flush,
            hideToTray: async () => {
              if (!nativeServices.desktopTray) return false;
              return (
                (await nativeServices.platform("trayClose", {})).hidden === true
              );
            },
            destroy: () => window.destroy(),
            onError: (cause) => {
              if (!cancelled) setError(String(cause));
            },
          });
          const remove = await window.onCloseRequested(async (event) => {
            event.preventDefault();
            await closeWindow();
          });
          if (cancelled) remove();
          else unlisten = remove;
        }
      } catch (cause) {
        if (!cancelled) setError(String(cause));
      }
    })();
    return () => {
      cancelled = true;
      unlisten?.();
      unlistenNotifications?.();
      unlistenUpdates?.();
      stopWidgets?.();
      dispose?.();
      flushRef.current = null;
    };
  }, [attempt]);
  const language = container.current?.lang || interfaceLanguage();
  const t = (ru: string, en: string) => (language === "en" ? en : ru);
  return (
    <>
      {!ready && !error && <StartupLoader />}
      {!ready && error && (
        <div className="startup" lang={language}>
          <h1>Orvim</h1>
          <p>{interfaceMessage(error, language)}</p>
          {error && (
            <>
              <button onClick={() => setAttempt((value) => value + 1)}>
                {t("Повторить", "Retry")}
              </button>
              {isTauri() && (
                <button
                  disabled={recovering}
                  onClick={async () => {
                    try {
                      const file = await openFile("backup");
                      if (file) setRecoveryFile(await file.text());
                    } catch (e) {
                      setError(String(e));
                    }
                  }}
                >
                  {t(
                    "Восстановить копию с паролем",
                    "Restore a password-protected backup",
                  )}
                </button>
              )}
              {recoveryFile && (
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();
                    setRecovering(true);
                    try {
                      await nativeServices.backups(
                        "recoverEncrypted",
                        undefined,
                        recoveryPassword,
                        recoveryFile,
                      );
                      setRecoveryFile(null);
                      setAttempt((value) => value + 1);
                    } catch (e) {
                      setError(String(e));
                    } finally {
                      setRecoveryPassword("");
                      setRecovering(false);
                    }
                  }}
                >
                  <p>
                    {t(
                      "Восстановить данные из выбранной копии. Недоступные файлы сохранятся отдельно.",
                      "Restore data from the selected backup. Unavailable files will be kept separately.",
                    )}
                  </p>
                  <input
                    type="password"
                    autoComplete="current-password"
                    aria-label={t(
                      "Пароль защищённой копии",
                      "Encrypted backup password",
                    )}
                    value={recoveryPassword}
                    onChange={(event) =>
                      setRecoveryPassword(event.target.value)
                    }
                  />
                  <button disabled={recovering}>
                    {recovering
                      ? t("Восстанавливаем…", "Restoring…")
                      : t("Восстановить", "Restore")}
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      )}
      {ready && error && (
        <div className="save-error" role="alert">
          <span>
            {t(
              "Изменения пока не сохранены: ",
              "Changes have not been saved yet: ",
            )}
            {interfaceMessage(error, language)}
          </span>
          <button
            onClick={() => {
              void flushRef.current?.().catch(() => {});
            }}
          >
            {t("Повторить", "Retry")}
          </button>
          <span>
            {t(
              "Резервная копия доступна в настройках.",
              "Backups are available in settings.",
            )}
          </span>
        </div>
      )}
      <div
        ref={container}
        id="life-os-workspace"
        data-palette="sun"
        data-motion="playing"
        hidden={!ready}
      />
    </>
  );
}
