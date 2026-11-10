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
    check.textContent = "Проверяем…";
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
            notes = make("p", "", release.notes),
            installed = release.version === result.installed;
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
              release.workspace_max >= 31;
            const download = action(
                "Загрузить",
                () =>
                  run(async () => {
                    progress.hidden = false;
                    await services.updates("download", release.version);
                    status.textContent = "Пакет загружен и проверен.";
                    install.disabled = false;
                  }),
                "button",
              ),
              install = action(
                "Установить / перейти на эту версию",
                () =>
                  run(async () => {
                    if (!compatible)
                      throw Error(
                        "Схема несовместима. Используйте восстановление подходящей копии; новые изменения будут потеряны.",
                      );
                    const result = await services.updates(
                      "install",
                      release.version,
                    );
                    status.textContent =
                      result.message ||
                      (result.permissionRequired
                        ? "Разрешите установку приложений для Orvim и нажмите установить ещё раз."
                        : "Открыт системный установщик. После завершения запустите Orvim.");
                  }),
                "button",
              );
            install.disabled = true;
            download.disabled = !compatible;
            row.append(download, install);
            if (!compatible)
              row.append(
                make(
                  "p",
                  "aux-note",
                  "Автоматическая установка заблокирована: несовместимая схема данных.",
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
      "Проверьте новую версию, загрузите её прямо здесь и нажмите «Установить». Пакет проверяется по подписи и хешу; перед установкой создаётся копия. На Android последнее подтверждение показывает система.",
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
