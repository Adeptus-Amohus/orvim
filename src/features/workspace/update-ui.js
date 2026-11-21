import { renderAssistantMarkdown } from "./assistant.js";

export function installUpdateSettings(ctx, panel) {
  const { make, action, services } = ctx,
    card = make("section", "settings-data-card update-card"),
    status = make("p", "connection-status"),
    list = make("div", "update-list"),
    progress = make("progress");
  progress.max = 100;
  progress.hidden = true;
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  const versionLabel = make("p", "aux-note", "Версия приложения"),
    checkedLabel = make("small", "aux-note");
  let busy = false,
    checkStarted = false,
    disposed = false;
  async function run(fn) {
    if (busy) return;
    busy = true;
    check.disabled = true;
    const controls = [...list.querySelectorAll("button:not(:disabled)")];
    controls.forEach((button) => (button.disabled = true));
    card.setAttribute("aria-busy", "true");
    try {
      status.textContent = "Выполняем…";
      await services.flush();
      await fn();
    } catch (error) {
      status.textContent = String(error);
    } finally {
      busy = false;
      check.disabled = !services.localSync;
      controls.forEach((button) => (button.disabled = false));
      check.textContent = "Проверить на GitHub";
      card.removeAttribute("aria-busy");
      progress.hidden = true;
    }
  }
  const check = action(
    "Проверить на GitHub",
    () =>
      run(async () => {
        checkStarted = true;
        check.textContent = "Проверяем…";
        const result = await services.updates("check");
        if (disposed) return;
        versionLabel.textContent = "Установлена версия " + result.installed;
        checkedLabel.textContent = result.checkedAt
          ? "Проверено: " + new Date(result.checkedAt).toLocaleString()
          : "";
        status.textContent =
          result.message ||
          "Установлена версия " +
            result.installed +
            ". Подлинность манифеста подтверждена.";
        list.replaceChildren();
        if (
          typeof result.manualUrl === "string" &&
          /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases\/latest$/.test(
            result.manualUrl,
          )
        ) {
          const link = make("a", "button", "Открыть страницу выпуска");
          link.href = result.manualUrl;
          link.addEventListener("click", (event) => {
            event.preventDefault();
            void services.openExternal(result.manualUrl).catch((error) => {
              status.textContent = String(error);
            });
          });
          list.append(link);
        }
        const older = make("details", "update-older");
        older.append(make("summary", "", "Предыдущие версии и откат"));
        for (const release of result.releases || []) {
          const row = make("section", "update-release"),
            notes = make("div", "update-notes"),
            installed = release.version === result.installed;
          renderAssistantMarkdown(notes, release.notes, services.openExternal);
          row.append(
            make(
              "h4",
              "",
              "Версия " + release.version + (installed ? " · установлена" : ""),
            ),
            notes,
          );
          if (!installed) {
            const compatible =
              release.schema_min <= 3 &&
              release.schema_max >= 3 &&
              release.workspace_max >= 32;
            const install = action(
              "Скачать и установить",
              () =>
                run(async () => {
                  progress.hidden = false;
                  progress.value = 0;
                  status.textContent = "Загрузка…";
                  await services.updates("download", release.version);
                  progress.hidden = true;
                  status.textContent = "Пакет проверен. Открываем установщик…";
                  const result = await services.updates(
                    "install",
                    release.version,
                  );
                  status.textContent =
                    result.message ||
                    (result.permissionRequired
                      ? "Разрешите установку приложений для Orvim и повторите действие. Проверенный пакет уже сохранён."
                      : "Открыт системный установщик. После завершения запустите Orvim.");
                }),
              "button",
            );
            install.disabled =
              !compatible || (services.mobile && !release.newer);
            row.append(install);
            if (!compatible)
              row.append(
                make(
                  "p",
                  "aux-note",
                  "Автоматическая установка заблокирована: несовместимая схема данных.",
                ),
              );
            else if (services.mobile && !release.newer)
              row.append(
                make(
                  "p",
                  "aux-note",
                  "Android блокирует установку более старой версии.",
                ),
              );
          }
          (release.newer ? list : older).append(row);
        }
        if (older.children.length > 1) list.append(older);
      }),
    "button",
  );
  check.disabled = !services.localSync;
  if (!services.localSync)
    status.textContent = "Проверка доступна в установленном Orvim.";
  else if (typeof services.updates === "function")
    void services
      .updates("status")
      .then((result) => {
        if (disposed || checkStarted) return;
        versionLabel.textContent = "Установлена версия " + result.installed;
        if (!result.configured)
          status.textContent =
            "Проверка выпусков GitHub и загрузка обновлений через интернет. Установка — после подтверждения.";
      })
      .catch(() => {
        if (!disposed) versionLabel.textContent = "Orvim";
      });
  const listener = (event) => {
    const detail = event.detail;
    progress.hidden = false;
    progress.value = detail.total
      ? Math.round((detail.received / detail.total) * 100)
      : 0;
    status.textContent =
      "Загрузка " + detail.version + " · " + progress.value + "%";
  };
  window.addEventListener("life-os:update-progress", listener);
  card.append(
    make("h3", "", "Обновления"),
    versionLabel,
    make(
      "p",
      "aux-note",
      "Если доступно подписанное обновление, нажмите «Скачать и установить». Orvim проверит пакет и создаст резервную копию. На Android установку нужно подтвердить в системном окне.",
    ),
    status,
    checkedLabel,
    check,
    progress,
    list,
  );
  panel.append(card);
  return {
    dispose: () => {
      disposed = true;
      window.removeEventListener("life-os:update-progress", listener);
    },
  };
}
