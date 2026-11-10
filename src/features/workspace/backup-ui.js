export function installBackupSettings(ctx, panel, ui) {
  const { make, action, services } = ctx;
  Object.assign(ctx.translations, {
    "Сохранить копию": "Save a backup",
    "Все записи и изображения · с паролем":
      "All records and images · password protected",
    "Восстановить данные": "Restore data",
    "Из сохранённой копии с паролем": "From a password-protected backup",
    "Выбрать файл": "Choose file",
    "Таблица для анализа": "Analysis spreadsheet",
    "Для Excel · без изображений и настроек":
      "For Excel · no images or settings",
    "Скачать CSV": "Download CSV",
    "История восстановления": "Restore history",
    "Управлять копиями": "Manage backups",
    "Дополнительные форматы": "Other formats",
    "Как работает история восстановления?": "How does restore history work?",
    "Копий пока нет — появятся после изменений":
      "No backups yet — created after changes",
    "JSON без пароля для переноса данных. Эти файлы не зашифрованы.":
      "Unencrypted JSON for transferring data. These files have no password protection.",
  });
  const card = make("section", "settings-data-card backup-card"),
    summary = make("p", "aux-note"),
    historyInfo = make("p", "aux-note", "Внутренняя история изменений"),
    list = make("div", "backup-list"),
    message = make("p", "connection-status"),
    importStatus = make("p", "connection-status");
  importStatus.setAttribute("role", "status");
  message.setAttribute("role", "status");
  const form = ui.dialog("backup-manager-dialog", "Резервные копии"),
    confirm = ui.dialog("backup-confirm-dialog", "Подтвердите действие"),
    copy = make("p"),
    text = make("input"),
    confirmStatus = make("p", "connection-status");
  text.placeholder = "Введите Orvim";
  let execute = null;
  const go = action(
    "Подтвердить",
    async () => {
      if (text.value !== "Orvim") {
        confirmStatus.textContent = "Введите Orvim для подтверждения.";
        return;
      }
      go.disabled = true;
      try {
        await execute();
        ctx.closeDialog();
        await refresh();
      } catch (error) {
        confirmStatus.textContent = String(error);
      } finally {
        go.disabled = false;
      }
    },
    "button button-primary",
  );
  confirm.append(copy, text, confirmStatus, go);
  confirm.onsubmit = (e) => e.preventDefault();
  function confirmation(description, handler) {
    copy.textContent = description;
    text.value = "";
    confirmStatus.textContent = "";
    execute = handler;
    ctx.openDialog("backup-confirm-dialog");
    ctx.fitDialog();
  }
  async function run(fn) {
    try {
      message.textContent = "Выполняем…";
      await services.flush();
      await fn();
      message.textContent = "Готово.";
      await refresh();
    } catch (error) {
      message.textContent = String(error);
    }
  }
  let external = { configured: false };
  let encrypted = false;
  async function refresh() {
    if (!services.localSync) {
      summary.textContent =
        "Автоматические копии доступны в установленном приложении. В браузере используйте экспорт JSON.";
      historyInfo.textContent = "Доступна в установленном приложении";
      return;
    }
    try {
      const result = await services.backups("list");
      encrypted = Boolean(result.encrypted);
      historyInfo.textContent = result.copies[0]
        ? "Копий: " +
          result.copies.length +
          " · последняя " +
          new Date(result.copies[0].at).toLocaleDateString(ctx.displayLocale())
        : "Копий пока нет — появятся после изменений";
      external = services.mobile
        ? await services.platform("backupFolderStatus", {})
        : { configured: true };
      summary.textContent =
        "Страховка от случайного удаления: после изменений приложение сохраняет снимок не чаще одного раза в час. Хранятся последние " +
        result.keep +
        " снимков, более старые заменяются. Если ничего не менялось, новая копия не создаётся. Папка: " +
        result.folder +
        ". " +
        (result.copies[0]
          ? "Последняя копия: " +
            new Date(result.copies[0].at).toLocaleString(ctx.displayLocale())
          : "Копий пока нет.") +
        (services.mobile
          ? external.configured
            ? " Внешняя папка: " + external.folder + "."
            : " Пока только внутри приложения: удаление приложения удалит эти копии."
          : " Сохраняются после удаления приложения.");
      managerSummary.textContent = summary.textContent;
      if (encrypted) {
        summary.textContent =
          "Страховка от случайного удаления. После изменений сохраняется снимок не чаще одного раза в час; без изменений копия не создаётся. Хранятся последние " +
          result.keep +
          " снимков, затем самый старый заменяется. Это история состояний, а не срок в часах. При перезапуске и перед важными изменениями возможен дополнительный снимок. Копии зашифрованы ключом устройства. Для другого устройства или переустановки создайте отдельную копию с паролем.";
        managerSummary.textContent = summary.textContent;
        folder.hidden = true;
      }
      if (result.error) message.textContent = result.error;
      list.replaceChildren();
      for (const item of result.copies) {
        const row = make("div", "backup-row");
        row.append(
          make(
            "span",
            "",
            new Date(item.at).toLocaleString(ctx.displayLocale()) +
              " · " +
              Math.ceil(item.bytes / 1024) +
              " КБ",
          ),
          action("Восстановить", () =>
            confirmation(
              "Текущие записи будут заменены копией от " +
                new Date(item.at).toLocaleString(ctx.displayLocale()) +
                ". Перед заменой сохранится новая копия.",
              async () => {
                await services.flush();
                const restored = await services.backups(
                  "prepareRestore",
                  item.name,
                );
                ctx.validateBackup({
                  format: "life-os-backup",
                  schemaVersion: 1,
                  ...restored,
                });
                ctx.applyDocument(restored);
                ctx.persistState();
                await services.flush();
              },
            ),
          ),
          action(
            "Удалить",
            () =>
              confirmation("Удалить эту резервную копию?", () =>
                services.backups("delete", item.name),
              ),
            "text-button",
          ),
        );
        list.append(row);
      }
      if (services.mobile && external.configured) {
        const result = await services.platform("backupExternalList", {});
        list.append(make("h3", "", "Во внешней папке"));
        for (const item of result.copies) {
          const row = make("div", "backup-row");
          row.append(
            make("span", "", item.name),
            action("Восстановить", () =>
              confirmation(
                "Восстановить эту внешнюю копию? Более поздние изменения будут заменены.",
                async () => {
                  await services.flush();
                  const value = await services.platform("backupExternalRead", {
                    name: item.name,
                  });
                  let parsed = JSON.parse(value.content);
                  if (parsed.format === "orvim-encrypted-backup") {
                    const decoded = await services.backups(
                      "decodeLocal",
                      undefined,
                      undefined,
                      value.content,
                    );
                    parsed = JSON.parse(decoded.content);
                  }
                  const backup = ctx.validateBackup(parsed);
                  await services.backups("create", "before-external-restore");
                  ctx.applyDocument(backup);
                  ctx.persistState();
                  await services.flush();
                },
              ),
            ),
            action(
              "Удалить",
              () =>
                confirmation("Удалить копию из внешней папки?", () =>
                  services.platform("backupExternalDelete", {
                    name: item.name,
                  }),
                ),
              "text-button",
            ),
          );
          list.append(row);
        }
      }
    } catch (error) {
      message.textContent = String(error);
    }
  }
  const folder = action(
    "Выбрать внешнюю папку",
    () =>
      run(async () => {
        const result = await services.platform("backupFolder", {});
        if (!result.configured)
          throw new Error(
            "Выбор папки отменён. Копии пока остаются внутри приложения.",
          );
        await services.backups("create", "external-setup");
      }),
    "button",
  );
  folder.hidden = !services.mobile;
  const manageCopies = action(
    "Управлять копиями",
    async () => {
      await refresh();
      ctx.openDialog("backup-manager-dialog");
      ctx.fitDialog();
    },
    "button",
  );
  function row(title, description, control, glyph, info) {
    const entry = make("div", "settings-action-row"),
      copy = make("div", "settings-action-copy"),
      icon = make("i");
    icon.dataset.lucide = glyph;
    icon.setAttribute("aria-hidden", "true");
    copy.append(
      make("strong", "", title),
      info || make("p", "aux-note", description),
    );
    entry.append(icon, copy, control);
    return entry;
  }
  card.append(make("h3", "", "Копии и экспорт"));
  const managerSummary = make("p", "aux-note");
  const protectedForm = ui.dialog(
      "protected-backup-dialog",
      "Защищённая копия",
    ),
    password = make("input"),
    repeat = make("input"),
    protectedInfo = make("p", "aux-note"),
    protectedStatus = make("p", "connection-status");
  password.type = repeat.type = "password";
  password.maxLength = repeat.maxLength = 1024;
  password.autocomplete = repeat.autocomplete = "new-password";
  password.placeholder = "Парольная фраза — от 12 символов";
  password.setAttribute("aria-label", "Пароль резервной копии");
  repeat.placeholder = "Повторите пароль";
  repeat.setAttribute("aria-label", "Повторите пароль резервной копии");
  const passwordField = make("label", "field"),
    repeatField = make("label", "field");
  passwordField.append(make("span", "", "Пароль копии"), password);
  repeatField.append(make("span", "", "Повторите пароль"), repeat);
  let importContent = null;
  const protectedGo = action(
    "Сохранить",
    async () => {
      protectedStatus.textContent = "";
      if (
        password.value.length < 12 ||
        (!importContent && password.value !== repeat.value)
      ) {
        protectedStatus.textContent =
          "Нужен пароль от 12 символов; при создании оба поля должны совпадать.";
        return;
      }
      protectedGo.disabled = true;
      try {
        await services.flush();
        if (importContent) {
          const restored = await services.backups(
            "importEncrypted",
            undefined,
            password.value,
            importContent,
          );
          const validated = ctx.validateBackup({
            format: "life-os-backup",
            schemaVersion: 1,
            ...restored,
          });
          ctx.applyDocument(validated);
          ctx.persistState();
          await services.flush();
          ctx.closeDialog();
        } else {
          const result = await services.backups(
            "exportEncrypted",
            undefined,
            password.value,
          );
          const saved = await services.saveFile(
            "Orvim-protected-" +
              new Date().toISOString().slice(0, 10) +
              ".json",
            "application/json",
            result.content,
          );
          if (saved) ctx.closeDialog();
          else
            protectedStatus.textContent =
              "Сохранение отменено. Копия не записана.";
        }
        await refresh();
      } catch (error) {
        protectedStatus.textContent = String(error);
      } finally {
        password.value = repeat.value = "";
        protectedGo.disabled = false;
      }
    },
    "button button-primary",
  );
  protectedForm.append(
    protectedInfo,
    passwordField,
    repeatField,
    protectedStatus,
    protectedGo,
  );
  protectedForm.onsubmit = (event) => {
    event.preventDefault();
    protectedGo.click();
  };
  const protectedOverlay = protectedForm.closest(".overlay");
  const protectedObserver = new MutationObserver(() => {
    if (protectedOverlay.hidden) {
      password.value = repeat.value = "";
      importContent = null;
    }
  });
  protectedObserver.observe(protectedOverlay, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
  function openProtected(content = null) {
    importContent = content;
    password.value = repeat.value = "";
    protectedStatus.textContent = "";
    repeatField.hidden = Boolean(content);
    protectedGo.textContent = content ? "Восстановить" : "Сохранить копию";
    protectedInfo.textContent = content
      ? "Текущие записи будут заменены. Перед заменой сохранится внутренняя копия. Неверный пароль или повреждённый файл не изменят данные."
      : "Эта копия открывается на другом устройстве. Сохраните пароль отдельно: без него восстановить данные нельзя. Ключи API не включаются.";
    ctx.openDialog("protected-backup-dialog");
    ctx.fitDialog();
  }
  const saveProtected = action(
    "Сохранить",
    () => openProtected(),
    "button button-primary",
  );
  saveProtected.id = "save-protected-backup";
  const restoreProtected = action(
    "Выбрать файл",
    async () => {
      importStatus.textContent = "";
      try {
        const file = await services.openFile("backup");
        if (!file) return;
        const content = await file.text();
        if (JSON.parse(content).format !== "orvim-encrypted-backup")
          throw Error(
            "Выберите защищённую копию Orvim. Обычные JSON импортируются через импорт данных.",
          );
        openProtected(content);
      } catch (error) {
        importStatus.textContent = String(error);
      }
    },
    "button",
  );
  restoreProtected.id = "restore-protected-backup";
  card.append(
    row(
      "Сохранить копию",
      "Все записи и изображения · с паролем",
      saveProtected,
      "shield-check",
    ),
    row(
      "Восстановить данные",
      "Из сохранённой копии с паролем",
      restoreProtected,
      "rotate-ccw",
    ),
  );
  if (ui.exports) {
    const csv = ui.exports.querySelector("#export-csv"),
      oldRow = csv?.closest("section");
    if (csv) {
      csv.textContent = "Скачать CSV";
      card.append(
        row(
          "Таблица для анализа",
          "Для Excel · без изображений и настроек",
          csv,
          "table-2",
        ),
      );
      oldRow?.remove();
    }
    const formats = make("details", "settings-secondary backup-formats");
    formats.append(
      make("summary", "", "Дополнительные форматы"),
      make(
        "p",
        "aux-note",
        "JSON без пароля для переноса данных. Эти файлы не зашифрованы.",
      ),
      ui.exports,
    );
    card.append(formats);
  }
  const policy = make("details", "settings-secondary backup-policy");
  policy.append(
    make("summary", "", "Как работает история восстановления?"),
    summary,
    folder,
  );
  card.append(
    row("История восстановления", "", manageCopies, "history", historyInfo),
    policy,
    importStatus,
  );
  saveProtected.disabled = restoreProtected.disabled = !services.localSync;
  form.append(
    managerSummary,
    action(
      "Создать копию сейчас",
      () => run(() => services.backups("create")),
      "button",
    ),
    list,
    message,
  );
  const wipe = action(
    "Удалить все личные данные",
    () =>
      confirmation(
        "Все записи, изображения, переписка ИИ, настройки, ключи API и внутренние резервные копии на этом устройстве будут удалены. Связь с ПК/телефоном будет разорвана: тестовые записи больше не смогут уйти через старое сопряжение. Данные на других устройствах и сохранённые отдельно файлы не удаляются. Это действие нельзя отменить.",
        async () => {
          window.dispatchEvent(new Event("life-os:before-wipe"));
          try {
            await services.flush();
            await services.lan("stop");
            await services.backups("wipe", "Orvim");
            window.location.reload();
          } catch (error) {
            window.dispatchEvent(new Event("life-os:wipe-failed"));
            throw error;
          }
        },
      ),
    "text-button danger",
  );
  const wipeCard = make("section", "settings-data-card settings-wipe-card");
  wipe.id = "delete-all-data";
  wipeCard.append(
    make("h3", "", "Удаление данных"),
    make(
      "p",
      "aux-note",
      "Очистить это устройство перед началом работы или убрать тестовые записи. Синхронизация отключится, телефон не очистится.",
    ),
    wipe,
  );
  panel.append(card);
  panel.append(wipeCard);
  let refreshTimer;
  const saved = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      await refresh();
      managerSummary.textContent = summary.textContent;
    }, 2000);
  };
  window.addEventListener("life-os:workspace-saved", saved);
  void refresh().then(() => (managerSummary.textContent = summary.textContent));
  return {
    dispose: () => {
      protectedObserver.disconnect();
      password.value = repeat.value = "";
      importContent = null;
      clearTimeout(refreshTimer);
      window.removeEventListener("life-os:workspace-saved", saved);
    },
  };
}
