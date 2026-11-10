export function installFileTransfer(ctx, panel, ui) {
  const { make, action, services } = ctx;
  const card = make("section", "settings-data-card file-transfer-card"),
    status = make("p", "connection-status"),
    form = ui.dialog("file-transfer-dialog", "Перенос через файл"),
    info = make("p", "aux-note"),
    password = make("input"),
    repeat = make("input"),
    result = make("p", "connection-status");
  status.setAttribute("role", "status");
  password.type = repeat.type = "password";
  password.minLength = repeat.minLength = 12;
  password.maxLength = repeat.maxLength = 1024;
  password.autocomplete = repeat.autocomplete = "new-password";
  password.placeholder = "Пароль файла — от 12 символов";
  repeat.placeholder = "Повторите пароль";
  password.setAttribute("aria-label", "Пароль файла переноса");
  repeat.setAttribute("aria-label", "Повторите пароль файла переноса");
  let mode = "fileExport",
    content = "",
    busy = false;
  const go = action(
    "Сохранить файл",
    () => {
      if (busy) return;
      if (
        password.value.length < 12 ||
        (mode === "fileExport" && password.value !== repeat.value)
      ) {
        result.textContent =
          "Введите пароль от 12 символов. При создании оба поля должны совпадать.";
        return;
      }
      const args = {
        password: password.value,
        ...(content ? { content } : {}),
      };
      password.value = repeat.value = "";
      content = "";
      ctx.closeDialog();
      window.dispatchEvent(
        new CustomEvent("life-os:lan-action", {
          detail: { operation: mode, args },
        }),
      );
    },
    "button button-primary",
  );
  form.append(info, password, repeat, result, go);
  form.onsubmit = (e) => {
    e.preventDefault();
    go.click();
  };
  function open(operation, text = "") {
    mode = operation;
    content = text;
    password.value = repeat.value = "";
    result.textContent = "";
    repeat.hidden = mode !== "fileExport";
    info.textContent =
      mode === "fileExport"
        ? "Файл содержит записи и изображения. API-ключи и переписка ИИ не передаются. Сохраните пароль: он понадобится на другом устройстве."
        : "После ввода пароля появится сравнение. Совпадающие записи объединяются, разные версии можно выбрать. До подтверждения ваши записи не изменятся.";
    go.textContent =
      mode === "fileExport" ? "Сохранить файл" : "Сравнить записи";
    ctx.openDialog("file-transfer-dialog");
    ctx.fitDialog();
  }
  const create = action(
      "Подготовить файл",
      () => open("fileExport"),
      "button button-primary",
    ),
    receive = action(
      "Открыть файл и объединить",
      async () => {
        try {
          const file = await services.openFile("backup");
          if (!file) return;
          if (file.size > 110 * 1024 * 1024)
            throw Error("Выберите файл до 110 МБ.");
          open("fileImport", await file.text());
        } catch (error) {
          status.textContent = String(error);
        }
      },
      "button",
    );
  create.id = "file-transfer-export";
  receive.id = "file-transfer-import";
  const actions = make("div", "connection-actions");
  actions.append(create, receive);
  card.append(
    make("h3", "", "Перенос по USB"),
    make(
      "p",
      "aux-note",
      "Без сети: подготовьте файл, передайте его по кабелю и откройте в Orvim на другом устройстве.",
    ),
    actions,
    status,
  );
  const help = make("details", "settings-secondary");
  help.append(
    make("summary", "", "Как передать по кабелю?"),
    make(
      "p",
      "aux-note",
      "На телефоне сохраните файл в «Загрузки». Подключите USB и выберите на телефоне «Передача файлов». На ПК скопируйте файл из памяти телефона в обычную папку через Проводник, затем нажмите «Открыть файл и объединить». В обратную сторону — скопируйте файл с ПК в «Загрузки» телефона и откройте его здесь.",
    ),
    make(
      "p",
      "aux-note",
      "Это перенос через файл, а не автоматическое USB-подключение. Отладка USB и интернет не нужны. Настройки оформления, ключи API и переписка остаются на каждом устройстве. Записи, отсутствующие в файле, не удаляются.",
    ),
  );
  card.append(help);
  panel.prepend(card);
  const overlay = form.closest(".overlay");
  const observer = new MutationObserver(() => {
    if (overlay.hidden) {
      password.value = repeat.value = "";
      content = "";
    }
  });
  observer.observe(overlay, { attributes: true, attributeFilter: ["hidden"] });
  const update = (e) => {
    busy = Boolean(e.detail.busy);
    create.disabled =
      receive.disabled =
      go.disabled =
        busy || !services.localSync;
    if (e.detail.fileMessage || e.detail.fileError)
      status.textContent = e.detail.fileError || e.detail.fileMessage;
    if (
      (e.detail.fileMessage || e.detail.fileError) &&
      !e.detail.review &&
      !e.detail.openFileReview
    ) {
      ui.openDataSettings();
      card.closest("details").open = true;
    }
  };
  window.addEventListener("life-os:lan-status", update);
  update({ detail: {} });
  return {
    dispose() {
      observer.disconnect();
      password.value = repeat.value = "";
      content = "";
      window.removeEventListener("life-os:lan-status", update);
    },
  };
}
