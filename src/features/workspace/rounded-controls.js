import { dateFormat } from "./formatters.js";

// Keep the real form controls for validation and existing application handlers.
// Their popups are replaced with the same rounded picker on desktop and Android.
export function installRoundedControls(ctx) {
  const { root, make, listen } = ctx;
  const viewport = root.ownerDocument.defaultView;
  for (const [ru, en] of [
    ["Выбрать", "Choose"],
    ["Сбросить", "Clear"],
    ["Найти вариант", "Find an option"],
    ["Год", "Year"],
    ["Часы", "Hours"],
    ["Минуты", "Minutes"],
    ["Оттенок", "Hue"],
    ["Насыщенность", "Saturation"],
    ["Яркость", "Lightness"],
    ["Назад", "Previous"],
    ["Далее", "Next"],
    ["Выберите значение", "Choose a value"],
  ]) {
    ctx.translations[ru] = en;
  }
  const t = (ru, en) => ctx.translate(ru, en),
    records = new Map();
  const layer = make("div", "rounded-picker-layer");
  layer.hidden = true;
  const card = make("section", "rounded-picker"),
    head = make("div", "rounded-picker-head"),
    title = make("h2"),
    body = make("div", "rounded-picker-content");
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-modal", "true");
  title.id = "rounded-picker-title";
  card.setAttribute("aria-labelledby", title.id);
  const button = (label, callback, cls = "button") => {
    const node = make("button", cls, label);
    node.type = "button";
    listen(node, "click", callback);
    return node;
  };
  const closeButton = button("×", () => close(), "close");
  closeButton.setAttribute("aria-label", t("Закрыть", "Close"));
  head.append(title, closeButton);
  card.append(head, body);
  layer.append(card);
  root.append(layer);
  let active = null,
    frame = 0,
    disposed = false;
  function labelOf(source) {
    if (source.getAttribute("aria-label"))
      return source.getAttribute("aria-label");
    const label = source.labels?.[0];
    if (!label) return t("Выберите значение", "Choose a value");
    // Read the label without cloning every option and picker SVG inside it.
    const walker = document.createTreeWalker(
      label,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node.nodeType === 1)
            return node.matches("input,select,button,.control-trigger")
              ? NodeFilter.FILTER_REJECT
              : NodeFilter.FILTER_SKIP;
          return NodeFilter.FILTER_ACCEPT;
        },
      },
    );
    let text = "",
      node;
    while ((node = walker.nextNode())) text += node.nodeValue;
    return text.trim() || t("Выберите значение", "Choose a value");
  }
  function textOf(source) {
    if (source.type === "text" || source.type === "search")
      return source.value || t("Выбрать", "Choose");
    if (source.tagName === "SELECT")
      return source.selectedOptions[0]?.textContent || t("Выбрать", "Choose");
    if (!source.value)
      return source.type === "time" ? "—:—" : t("Выбрать", "Choose");
    if (source.type === "color") return source.value.toUpperCase();
    if (source.type === "time") return source.value.slice(0, 5);
    const date = new Date(
      source.value + (source.type === "month" ? "-01" : "") + "T12:00:00",
    );
    return Number.isFinite(date.getTime())
      ? dateFormat(
          ctx.displayLocale(),
          source.type === "month"
            ? { month: "long", year: "numeric" }
            : { day: "numeric", month: "short", year: "numeric" },
        ).format(date)
      : source.value;
  }
  function sync(record) {
    const { source, trigger, caption } = record,
      text = textOf(source);
    if (caption.textContent !== text) caption.textContent = text;
    const disabled = Boolean(source.disabled || source.readOnly);
    if (trigger.disabled !== disabled) trigger.disabled = disabled;
    if (trigger.hidden !== source.hidden) trigger.hidden = source.hidden;
    const label = labelOf(source) + ": " + text;
    if (trigger.getAttribute("aria-label") !== label)
      trigger.setAttribute("aria-label", label);
    const expanded = String(active?.source === source);
    if (trigger.getAttribute("aria-expanded") !== expanded)
      trigger.setAttribute("aria-expanded", expanded);
  }
  function close(focus = true) {
    const previous = active;
    active = null;
    layer.hidden = true;
    if (previous) {
      sync(previous);
      if (focus && previous.trigger.isConnected)
        previous.trigger.focus({ preventScroll: true });
    }
  }
  function commit(value) {
    if (!active) return;
    const { source } = active,
      previous = source.value;
    if (
      source.tagName === "SELECT" &&
      [...source.options].find((option) => option.value === value)?.dataset
        .controlAction
    ) {
      close();
      source.dispatchEvent(
        new CustomEvent("control-action", { bubbles: true, detail: value }),
      );
      return;
    }
    source.value = value;
    if (source.value !== value || !source.checkValidity()) {
      source.value = previous;
      return;
    }
    source.dispatchEvent(new Event("input", { bubbles: true }));
    source.dispatchEvent(new Event("change", { bubbles: true }));
    source.removeAttribute("aria-invalid");
    close();
  }
  function footer(value, paint) {
    const row = make("div", "rounded-picker-actions");
    const clear = button(
      t("Сбросить", "Clear"),
      () => commit(""),
      "text-button",
    );
    clear.hidden =
      active.source.required ||
      active.source.type === "color" ||
      !active.source.closest("form");
    row.append(
      clear,
      button(t("Отмена", "Cancel"), () => close()),
      button(
        t("Выбрать", "Choose"),
        () => {
          const next = value();
          if (next) commit(next);
          else paint?.();
        },
        "button button-primary",
      ),
    );
    return row;
  }
  function openSelect(source) {
    const optionText = (item) => item.label || item.textContent || item.value;
    const record = records.get(source),
      entries = () =>
        record?.listId
          ? [
              ...(root.ownerDocument.getElementById(record.listId)?.options ||
                []),
            ]
          : [...source.options];
    const search = make("input"),
      list = make("div", "rounded-options");
    search.type = "search";
    search.placeholder = t("Найти вариант", "Find an option");
    search.setAttribute("aria-label", search.placeholder);
    search.hidden = entries().length <= 8;
    list.setAttribute("role", "listbox");
    list.setAttribute("aria-label", labelOf(source));
    let shown = 100;
    function paint() {
      list.replaceChildren();
      const query = search.value.trim().toLocaleLowerCase(),
        options = entries().filter(
          (item) =>
            !item.hidden &&
            (!query || optionText(item).toLocaleLowerCase().includes(query)),
        );
      for (const option of options.slice(0, shown)) {
        const node = button(
          optionText(option),
          () => commit(option.value),
          "rounded-option",
        );
        node.dataset.userContent = "";
        node.setAttribute("role", "option");
        node.setAttribute(
          "aria-selected",
          String(
            record?.listId ? source.value === option.value : option.selected,
          ),
        );
        node.disabled =
          option.disabled || option.closest("optgroup")?.disabled || false;
        list.append(node);
      }
      if (options.length > shown)
        list.append(
          button(t("Показать ещё", "Show more"), () => {
            shown += 100;
            paint();
          }),
        );
      if (!options.length)
        list.append(
          make(
            "p",
            "aux-note",
            t("Ничего не найдено.", "No matching entries."),
          ),
        );
    }
    listen(search, "input", () => {
      shown = 100;
      paint();
    });
    listen(list, "keydown", (event) => {
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const options = [...list.querySelectorAll("button:not(:disabled)")],
        index = options.indexOf(document.activeElement);
      const next =
        event.key === "Home"
          ? 0
          : event.key === "End"
            ? options.length - 1
            : Math.max(
                0,
                Math.min(
                  options.length - 1,
                  index + (event.key === "ArrowDown" ? 1 : -1),
                ),
              );
      options[next]?.focus();
    });
    body.append(search, list);
    paint();
    (search.hidden
      ? list.querySelector('[aria-selected="true"]') ||
        list.querySelector("button:not(:disabled)")
      : search
    )?.focus({ preventScroll: true });
  }
  function dateKey(date) {
    return (
      String(date.getFullYear()).padStart(4, "0") +
      "-" +
      String(date.getMonth() + 1).padStart(2, "0") +
      "-" +
      String(date.getDate()).padStart(2, "0")
    );
  }
  function openDate(source) {
    const monthOnly = source.type === "month",
      today = dateKey(new Date());
    let draft = source.value || (monthOnly ? today.slice(0, 7) : today),
      view = new Date(draft + (monthOnly ? "-01" : "") + "T12:00:00");
    if (!Number.isFinite(view.getTime())) view = new Date(today + "T12:00:00");
    view.setDate(1);
    const navigation = make("div", "rounded-date-navigation"),
      heading = make("strong"),
      grid = make(
        "div",
        monthOnly ? "rounded-month-grid" : "rounded-date-grid",
      ),
      year = make("input");
    year.type = "number";
    year.min = "1";
    year.max = "9999";
    year.step = "1";
    year.value = String(view.getFullYear());
    year.setAttribute("aria-label", t("Год", "Year"));
    const available = (value) =>
      (!source.min || value >= source.min) &&
      (!source.max || value <= source.max);
    function paint() {
      grid.replaceChildren();
      year.value = String(view.getFullYear());
      heading.textContent = dateFormat(ctx.displayLocale(), {
        month: "long",
      }).format(view);
      heading.hidden = monthOnly;
      if (!monthOnly) {
        for (let day = 0; day < 7; day++) {
          const label = make(
            "small",
            "rounded-weekday",
            dateFormat(ctx.displayLocale(), {
              weekday: "short",
            }).format(new Date(2024, 0, 1 + day)),
          );
          grid.append(label);
        }
        const offset = (view.getDay() + 6) % 7;
        for (let i = 0; i < offset; i++) grid.append(make("span"));
      }
      const count = monthOnly
        ? 12
        : new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (let i = 0; i < count; i++) {
        const date = new Date(view);
        if (monthOnly) date.setMonth(i);
        else date.setDate(i + 1);
        const value = dateKey(date).slice(0, monthOnly ? 7 : 10),
          text = monthOnly
            ? dateFormat(ctx.displayLocale(), {
                month: "short",
              }).format(date)
            : String(i + 1),
          day = button(
            text,
            () => {
              draft = value;
              paint();
            },
            "rounded-date-option",
          );
        day.disabled = !available(value);
        day.setAttribute("aria-pressed", String(draft === value));
        day.setAttribute("aria-label", value);
        grid.append(day);
      }
    }
    const move = (offset) => {
      if (monthOnly)
        view.setFullYear(
          Math.max(1, Math.min(9999, view.getFullYear() + offset)),
        );
      else view.setMonth(view.getMonth() + offset);
      paint();
    };
    navigation.append(
      button("‹", () => move(-1)),
      heading,
      year,
      button("›", () => move(1)),
    );
    listen(year, "change", () => {
      if (year.checkValidity() && year.value) {
        view.setFullYear(Number(year.value));
        paint();
      }
    });
    const current = button(
      t("Сегодня", "Today"),
      () => {
        draft = monthOnly ? today.slice(0, 7) : today;
        view = new Date(today + "T12:00:00");
        view.setDate(1);
        paint();
      },
      "text-button",
    );
    current.disabled = !available(monthOnly ? today.slice(0, 7) : today);
    body.append(
      navigation,
      grid,
      current,
      footer(() => (available(draft) ? draft : ""), paint),
    );
    paint();
  }
  function openTime(source) {
    const row = make("div", "rounded-time-fields"),
      hour = make("input"),
      minute = make("input"),
      parts = (source.value || "09:00").split(":");
    for (const [input, label, max, value] of [
      [hour, t("Часы", "Hours"), 23, parts[0]],
      [minute, t("Минуты", "Minutes"), 59, parts[1]],
    ]) {
      input.type = "number";
      input.min = "0";
      input.max = String(max);
      input.step = "1";
      input.required = true;
      input.inputMode = "numeric";
      input.value = value;
      const wrapper = make("label", "field", label);
      wrapper.append(input);
      row.append(wrapper);
    }
    body.append(
      row,
      footer(() =>
        hour.reportValidity() && minute.reportValidity()
          ? String(Number(hour.value)).padStart(2, "0") +
            ":" +
            String(Number(minute.value)).padStart(2, "0")
          : "",
      ),
    );
    hour.focus({ preventScroll: true });
  }
  function openColor(source) {
    const preview = make("div", "rounded-color-preview"),
      hex = make("input"),
      hue = make("input"),
      saturation = make("input"),
      light = make("input");
    hex.type = "text";
    hex.maxLength = 7;
    hex.pattern = "#[0-9a-fA-F]{6}";
    hex.required = true;
    hex.value = source.value;
    hex.setAttribute("aria-label", "HEX");
    const rgb = [1, 3, 5].map(
        (start) => parseInt(source.value.slice(start, start + 2), 16) / 255,
      ),
      max = Math.max(...rgb),
      min = Math.min(...rgb),
      d = max - min,
      l = (max + min) / 2;
    let h = 0;
    if (d) {
      h =
        max === rgb[0]
          ? (rgb[1] - rgb[2]) / d + (rgb[1] < rgb[2] ? 6 : 0)
          : max === rgb[1]
            ? (rgb[2] - rgb[0]) / d + 2
            : (rgb[0] - rgb[1]) / d + 4;
      h *= 60;
    }
    function paintColor() {
      const l = Number(light.value) / 100,
        a = (Number(saturation.value) / 100) * Math.min(l, 1 - l);
      const color = [0, 8, 4]
        .map((n) => {
          const k = (n + Number(hue.value) / 30) % 12;
          return Math.round(
            255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))),
          )
            .toString(16)
            .padStart(2, "0");
        })
        .join("");
      hex.value = "#" + color;
      preview.style.background = hex.value;
    }
    for (const [input, label, maximum, value] of [
      [hue, t("Оттенок", "Hue"), 360, h],
      [
        saturation,
        t("Насыщенность", "Saturation"),
        100,
        d ? (d / (1 - Math.abs(2 * l - 1))) * 100 : 0,
      ],
      [light, t("Яркость", "Lightness"), 100, l * 100],
    ]) {
      input.type = "range";
      input.min = "0";
      input.max = String(maximum);
      input.step = "1";
      input.value = String(Math.round(value));
      const field = make("label", "rounded-color-range", label);
      field.append(input);
      body.append(field);
      listen(input, "input", paintColor);
    }
    listen(hex, "input", () => {
      if (/^#[0-9a-f]{6}$/i.test(hex.value)) {
        preview.style.background = hex.value;
        const values = [1, 3, 5].map(
            (start) => parseInt(hex.value.slice(start, start + 2), 16) / 255,
          ),
          hi = Math.max(...values),
          lo = Math.min(...values),
          diff = hi - lo,
          brightness = (hi + lo) / 2;
        let angle = 0;
        if (diff) {
          angle =
            hi === values[0]
              ? (values[1] - values[2]) / diff + (values[1] < values[2] ? 6 : 0)
              : hi === values[1]
                ? (values[2] - values[0]) / diff + 2
                : (values[0] - values[1]) / diff + 4;
          angle *= 60;
        }
        hue.value = String(Math.round(angle));
        saturation.value = String(
          Math.round(
            diff ? (diff / (1 - Math.abs(2 * brightness - 1))) * 100 : 0,
          ),
        );
        light.value = String(Math.round(brightness * 100));
      }
    });
    preview.style.background = source.value;
    body.prepend(preview, hex);
    body.append(
      footer(() => (hex.reportValidity() ? hex.value.toLowerCase() : "")),
    );
  }
  function open(record) {
    if (record.source.disabled || record.source.readOnly) return;
    active = record;
    body.replaceChildren();
    title.textContent = labelOf(record.source);
    layer.hidden = false;
    if (record.source.tagName === "SELECT" || record.listId)
      openSelect(record.source);
    else if (record.source.type === "color") openColor(record.source);
    else if (record.source.type === "time") openTime(record.source);
    else openDate(record.source);
    if (!card.contains(document.activeElement))
      (
        body.querySelector('input:not([hidden]),button[aria-pressed="true"]') ||
        closeButton
      ).focus({ preventScroll: true });
    sync(record);
  }
  function refresh() {
    frame = 0;
    if (disposed) return;
    for (const [source, record] of records) {
      if (!source.isConnected) {
        records.delete(source);
        if (active === record) close(false);
        continue;
      }
      if (record.listId && source.hasAttribute("list")) {
        record.listId = source.getAttribute("list");
        source.removeAttribute("list");
      }
      sync(record);
    }
    for (const source of root.querySelectorAll(
      'select,input[type="date"],input[type="month"],input[type="time"],input[type="color"],input[list]',
    )) {
      if (records.has(source) || layer.contains(source)) continue;
      const trigger = button("", () => open(record), "control-trigger"),
        caption = make("span", "control-caption"),
        arrow = make("span", "control-chevron", "⌄");
      caption.dataset.userContent = "";
      arrow.setAttribute("aria-hidden", "true");
      trigger.append(caption, arrow);
      trigger.dataset.controlFor = source.id || "";
      trigger.setAttribute("aria-haspopup", "dialog");
      const listId = source.getAttribute("list");
      let shell = null;
      if (listId) {
        source.removeAttribute("list");
        shell = make("div", "rounded-combobox");
        source.before(shell);
        shell.append(source, trigger);
        trigger.classList.add("control-datalist-trigger");
        caption.hidden = true;
      } else {
        source.classList.add("native-control-source");
        source.after(trigger);
      }
      const record = { source, trigger, caption, listId, shell };
      if (!listId) {
        const tabIndex = source.getAttribute("tabindex"),
          ariaHidden = source.getAttribute("aria-hidden");
        source.tabIndex = -1;
        source.setAttribute("aria-hidden", "true");
        record.restoreAccessibility = () => {
          if (tabIndex === null) source.removeAttribute("tabindex");
          else source.setAttribute("tabindex", tabIndex);
          if (ariaHidden === null) source.removeAttribute("aria-hidden");
          else source.setAttribute("aria-hidden", ariaHidden);
        };
      }
      records.set(source, record);
      const proto = Object.getPrototypeOf(source),
        descriptor = Object.getOwnPropertyDescriptor(proto, "value");
      if (
        descriptor?.get &&
        descriptor?.set &&
        !Object.hasOwn(source, "value")
      ) {
        Object.defineProperty(source, "value", {
          configurable: true,
          get() {
            return descriptor.get.call(this);
          },
          set(value) {
            descriptor.set.call(this, value);
            sync(record);
          },
        });
        record.restoreValue = () => {
          delete source.value;
        };
      }
      listen(source, "change", () => sync(record));
      if (!listId)
        listen(source, "focus", () => trigger.focus({ preventScroll: true }));
      listen(source, "invalid", (event) => {
        event.preventDefault();
        if (listId) {
          source.setAttribute("aria-invalid", "true");
          source.focus();
          return;
        }
        trigger.setAttribute("aria-invalid", "true");
        if (!active) open(record);
      });
      sync(record);
    }
  }
  const queue = () => {
    if (!frame && !disposed) frame = viewport.requestAnimationFrame(refresh);
  };
  const controlSelector =
    'select,input[type="date"],input[type="month"],input[type="time"],input[type="color"],input[list],datalist,option';
  const observer = new MutationObserver((mutations) => {
    if (
      mutations.some((mutation) => {
        const target =
          mutation.target.nodeType === 1
            ? mutation.target
            : mutation.target.parentElement;
        if (!target || target.closest(".control-trigger,.rounded-picker-layer"))
          return false;
        if (mutation.type === "attributes")
          return (
            records.has(target) ||
            (target === root && mutation.attributeName === "lang") ||
            target.matches("option,datalist")
          );
        if (target.closest("label,select,datalist")) return true;
        return [...mutation.addedNodes, ...mutation.removedNodes].some(
          (node) =>
            node.nodeType === 1 &&
            (node.matches(controlSelector) ||
              node.querySelector(controlSelector)),
        );
      })
    )
      queue();
  });
  observer.observe(root, {
    subtree: true,
    childList: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "disabled",
      "readonly",
      "hidden",
      "selected",
      "aria-label",
      "min",
      "max",
      "list",
      "lang",
    ],
  });
  listen(root, "reset", queue);
  listen(root, "change", queue);
  listen(layer, "click", (event) => {
    if (event.target === layer) close();
  });
  listen(
    document,
    "keydown",
    (event) => {
      if (!active) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        close();
      }
      if (event.key === "Tab") {
        const nodes = [
          ...card.querySelectorAll(
            "button:not(:disabled),input:not(:disabled)",
          ),
        ].filter((node) => !node.hidden && node.getClientRects().length);
        if (!nodes.length) return;
        const index = nodes.indexOf(document.activeElement),
          next = event.shiftKey
            ? index <= 0
              ? nodes.length - 1
              : index - 1
            : (index + 1) % nodes.length;
        event.preventDefault();
        event.stopImmediatePropagation();
        nodes[next].focus();
      }
    },
    true,
  );
  refresh();
  return {
    refresh,
    dispose() {
      disposed = true;
      observer.disconnect();
      viewport.cancelAnimationFrame(frame);
      for (const record of records.values()) {
        record.restoreValue?.();
        record.restoreAccessibility?.();
        record.source.classList.remove("native-control-source");
        record.trigger.remove();
        if (record.listId) record.source.setAttribute("list", record.listId);
        record.shell?.replaceWith(record.source);
      }
      records.clear();
      layer.remove();
    },
  };
}
