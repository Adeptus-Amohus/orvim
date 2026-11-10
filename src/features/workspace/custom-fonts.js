// Fonts are device-local binary files, never executable CSS or remote URLs.
export function installCustomFonts(ctx) {
  const { $, make, action, listen } = ctx,
    select = $("#font-select");
  const tools = make("div", "custom-font-tools"),
    file = make("input"),
    status = make("p", "aux-note");
  file.type = "file";
  file.accept = ".ttf,.otf,.woff,.woff2";
  file.hidden = true;
  file.id = "custom-font-file";
  status.setAttribute("role", "status");
  const add = make("option", "", "+ Свой шрифт…"),
    remove = action(
      "Удалить свой шрифт",
      async () => {
        const id = select.value;
        if (!id.startsWith("custom-")) return;
        try {
          await store("readwrite", (s) => s.delete(id));
          const face = loaded.get(id);
          if (face) document.fonts.delete(face);
          loaded.delete(id);
          select.querySelector(`option[value="${id}"]`)?.remove();
          select.value = "system";
          select.dispatchEvent(new Event("change", { bubbles: true }));
        } catch {
          status.textContent = "Не удалось удалить шрифт. Попробуйте ещё раз.";
        }
      },
      "text-button",
    );
  add.value = "add-custom-font";
  add.dataset.controlAction = "font-upload";
  select.append(add);
  listen(select, "control-action", () => file.click());
  listen(select, "change", () => {
    if (select.value !== add.value) return;
    select.value = ctx.root.dataset.font || "system";
    file.click();
  });
  tools.append(remove, file, status);
  select.closest(".settings-row").after(tools);
  const loaded = new Map();
  let disposed = false,
    database;
  async function db() {
    if (database) return database;
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open("orvim-custom-fonts", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("fonts", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return database;
  }
  async function store(mode, operation) {
    const connection = await db();
    return new Promise((resolve, reject) => {
      const transaction = connection.transaction("fonts", mode),
        request = operation(transaction.objectStore("fonts"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = transaction.onabort = () =>
        reject(transaction.error);
    });
  }
  async function load(record) {
    const face = new FontFace(
      "OrvimCustom" + record.id.replaceAll("-", ""),
      record.bytes,
    );
    await face.load();
    if (disposed) return;
    document.fonts.add(face);
    loaded.set(record.id, face);
    const option = make("option", "", record.name);
    option.value = record.id;
    select.append(option);
  }
  function apply() {
    const id = ctx.root.dataset.font,
      face = loaded.get(id);
    if (face) {
      ctx.root.style.fontFamily = `"${face.family}", system-ui, sans-serif`;
      select.value = id;
    } else {
      ctx.root.style.removeProperty("font-family");
      select.value = [...select.options].some((option) => option.value === id)
        ? id
        : "system";
    }
    remove.hidden = !face;
  }
  const observer = new MutationObserver(apply);
  observer.observe(ctx.root, {
    attributes: true,
    attributeFilter: ["data-font"],
  });
  listen(file, "change", async () => {
    const chosen = file.files?.[0];
    file.value = "";
    if (!chosen) return;
    if (
      !/\.(ttf|otf|woff2?)$/i.test(chosen.name) ||
      chosen.size > 5 * 1024 * 1024 ||
      !chosen.size
    ) {
      status.textContent =
        "Выберите TTF, OTF, WOFF или WOFF2 размером до 5 МБ.";
      return;
    }
    if (loaded.size >= 10) {
      status.textContent = "Можно добавить до 10 шрифтов. Удалите ненужный.";
      return;
    }
    add.disabled = true;
    try {
      const record = {
        id: "custom-" + crypto.randomUUID(),
        name: chosen.name.replace(/\.[^.]+$/, ""),
        bytes: await chosen.arrayBuffer(),
      };
      // Parse before storing. Invalid font files never become selectable.
      const probe = new FontFace("OrvimFontValidation", record.bytes);
      await probe.load();
      await store("readwrite", (s) => s.put(record));
      await load(record);
      select.value = record.id;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      apply();
      status.textContent =
        "Шрифт добавлен на это устройство. На другом устройстве его нужно добавить отдельно.";
    } catch {
      status.textContent =
        "Не удалось прочитать или сохранить шрифт. Проверьте файл.";
    } finally {
      add.disabled = false;
    }
  });
  if (typeof indexedDB !== "undefined" && typeof FontFace !== "undefined")
    store("readonly", (s) => s.getAll())
      .then(async (records) => {
        for (const record of records.slice(0, 10)) {
          try {
            await load(record);
          } catch {
            /* One damaged font must not block the others. */
          }
        }
        apply();
      })
      .catch(() => {
        status.textContent = "Хранилище своих шрифтов недоступно.";
      });
  apply();
  return {
    dispose() {
      disposed = true;
      observer.disconnect();
      for (const face of loaded.values()) document.fonts.delete(face);
      database?.close();
    },
  };
}
