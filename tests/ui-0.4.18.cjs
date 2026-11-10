const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM, VirtualConsole } = require("jsdom");
const source = require("./fixture.cjs")().replace(
  "    })();",
  "window.__qa={snapshotData,makeBackup,validateBackup,training,createId:()=>nextId++,showPage,renderArchive};    })();",
);
const errors = [],
  requests = [];
let answer = { message: "Предложение", changes: [] },
  count = 0;
const image =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6n0UAAAAASUVORK5CYII=";
const vc = new VirtualConsole();
vc.on("jsdomError", (error) => {
  if (!error.message.includes("CSS")) errors.push(error.message);
});
const dom = new JSDOM(source, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    Object.defineProperty(w.navigator, "language", { value: "ru-RU" });
    w.matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    });
    const captures = new WeakMap();
    w.Element.prototype.setPointerCapture = function (id) {
      captures.set(this, id);
    };
    w.Element.prototype.hasPointerCapture = function (id) {
      return captures.get(this) === id;
    };
    w.Element.prototype.releasePointerCapture = function () {
      captures.delete(this);
    };
    w.__services = {
      credential: async () => ({ configured: true }),
      request: async (args) => {
        requests.push(args);
        return args.operation === "cover"
          ? { image, title: "Пробный фильм", catalog: "Wikipedia" }
          : answer;
      },
      platform: async (operation) => {
        requests.push({ operation });
        if (operation === "speechPoll")
          return {
            active: false,
            error: "Для выбранного языка не установлен речевой пакет.",
            needsModel: true,
            canDownload: true,
          };
        if (operation === "speechDownload")
          return {
            message: "Запрос на установку речевого пакета отправлен Android.",
          };
        return {
          active: operation === "speechStart",
          status: "unavailable",
          copies: [],
          calendars: [],
          granted: [],
        };
      },
    };
    w.HTMLCanvasElement.prototype.getContext = () =>
      new Proxy(
        {},
        {
          get: (_, key) =>
            key.startsWith("create") ? () => ({ addColorStop() {} }) : () => {},
        },
      );
  },
});
const w = dom.window,
  $ = (selector) => w.document.querySelector(selector),
  all = (selector) => [...w.document.querySelectorAll(selector)],
  wait = () => new Promise((resolve) => setTimeout(resolve, 40)),
  check = (value, message) => {
    assert.ok(value, message);
    count++;
  },
  click = (selector) => {
    const node = typeof selector === "string" ? $(selector) : selector;
    assert.ok(node, "Missing " + selector);
    node.click();
  },
  set = (selector, value) => {
    $(selector).value = String(value);
    $(selector).dispatchEvent(new w.Event("change", { bubbles: true }));
  },
  submit = (selector) =>
    $(selector).dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    ),
  pointer = (node, type, x, y = 10) => {
    const event = new w.Event(type, { bubbles: true, cancelable: true });
    for (const [key, value] of Object.entries({
      pointerId: 1,
      pointerType: "touch",
      button: 0,
      clientX: x,
      clientY: y,
    }))
      Object.defineProperty(event, key, { value });
    node.dispatchEvent(event);
  };
(async () => {
  try {
    await wait();
    check(!errors.length, "All modules initialize");
    for (const page of [
      "home",
      "life",
      "thoughts",
      "projects",
      "archive",
      "completed",
      "settings",
    ]) {
      w.__qa.showPage(page);
      await wait();
      check(!$(".app").inert && !errors.length, "Page opens: " + page);
    }
    const sources = all(
      'select,input[type="date"],input[type="month"],input[type="time"],input[type="color"]',
    );
    check(
      sources.length > 35 &&
        sources.every((node) =>
          node.classList.contains("native-control-source"),
        ),
      "Every native select/date/month/time/color receives a rounded proxy",
    );
    check(
      sources.every(
        (node) =>
          node.tabIndex === -1 && node.getAttribute("aria-hidden") === "true",
      ),
      "Hidden sources cannot trap reverse Tab or duplicate accessible controls",
    );
    for (const kind of [
      "select",
      'input[type="date"]',
      'input[type="month"]',
      'input[type="time"]',
      'input[type="color"]',
    ]) {
      const source = $(kind),
        trigger = source.nextElementSibling;
      click(trigger);
      await wait();
      check(
        !$(".rounded-picker-layer").hidden &&
          $(".rounded-picker").getAttribute("aria-modal") === "true",
        "Rounded picker opens: " + kind,
      );
      check(
        $(".rounded-picker").contains(w.document.activeElement),
        "Picker receives keyboard focus: " + kind,
      );
      w.document.dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
      );
      check($(".rounded-picker-layer").hidden, "Escape closes only the picker");
    }
    w.__qa.showPage("archive");
    await wait();
    check(
      $(".collection-menu").contains($('[aria-label="Удалить коллекцию"]')),
      "Collection delete is inside overflow menu",
    );
    check(
      $("#archive-item-add").classList.contains("button-primary") &&
        $("#archive-item-add").textContent.includes("Добавить запись"),
      "Add entry is the primary action",
    );
    click("#archive-item-add");
    set("#archive-item-name", "Пробный фильм");
    const rating = $("#archive-item-rating").parentElement.querySelector(
      '[role="slider"]',
    );
    rating.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 200,
      height: 40,
    });
    pointer(rating, "pointerdown", 10);
    pointer(rating, "pointermove", 180);
    pointer(rating, "pointerup", 180);
    check(
      $("#archive-item-rating").value === "4.5",
      "Finger drag chooses a half-star score",
    );
    submit("#archive-item-form");
    await wait();
    const record = w.__qa
      .snapshotData()
      .archiveItems.find((entry) => entry.name === "Пробный фильм");
    check(record.rating === 4.5, "Editor saves chosen rating");
    check(
      $(".db-card-rating .db-rating-number").textContent === "4,5",
      "Catalog uses numeric badge",
    );
    click(".db-card-rating");
    const quick = $("#db-quick-dialog [role=slider]");
    quick.dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "Home", bubbles: true }),
    );
    check(
      record.rating === 4.5 && !$("#db-quick-dialog").hidden,
      "Quick rating edits a draft without closing",
    );
    click(
      all("#db-quick-dialog button").find(
        (button) => button.textContent === "Отмена",
      ),
    );
    check(record.rating === 4.5, "Cancel preserves rating");
    click(".db-card-rating");
    $("#db-quick-dialog [role=slider]").dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
    click(
      all("#db-quick-dialog button").find(
        (button) => button.textContent === "Сохранить",
      ),
    );
    check(record.rating === 5, "Quick rating persists only with Save");
    const data = w.__qa.snapshotData();
    data.connectionSettings.aiProvider = "deepseek";
    data.connectionSettings.aiModel = "example-model";
    answer = {
      message: "Предлагаю обложку",
      changes: [
        {
          operation: "upsert",
          collection: "archiveItems",
          id: record.id,
          data: JSON.stringify({ coverQuery: "Пробный фильм", kind: "film" }),
        },
      ],
    };
    click(".ai-open");
    click("#ai-settings");
    const modelInput = $("#ai-model"),
      modelOption = w.document.createElement("option");
    modelInput.focus();
    check(
      w.document.activeElement === modelInput,
      "Model field keeps free text focus",
    );
    modelOption.value = "example-model";
    $("#ai-model-options").append(modelOption);
    await wait();
    check(
      !modelInput.hasAttribute("list"),
      "Native square suggestion popup is disabled",
    );
    click(modelInput.closest(".rounded-combobox").querySelector("button"));
    const suggestion = all(".rounded-option").find(
      (node) => node.textContent === "example-model",
    );
    check(suggestion, "Suggestion with only a value receives a readable label");
    click(suggestion);
    check(
      modelInput.value === "example-model" && $(".rounded-picker-layer").hidden,
      "Rounded suggestion commits through original form handlers",
    );
    click("#connections-dialog .close");
    click(".ai-open");
    click("#ai-context-open");
    click('[data-ai-source="archiveItems"]');
    click(`#ai-context-items input[value="${record._syncId ?? record.id}"]`);
    click("#ai-context-done");
    set("#ai-prompt", "Добавь обложку фильма");
    submit("#ai-dialog-form");
    check(
      !$("#ai-context-suggestion"),
      "Sending uses manually selected catalog context without an extra prompt",
    );
    await wait();
    await wait();
    check(
      !requests.some((request) => request.operation === "cover"),
      "AI proposal cannot send catalog requests before explicit approval",
    );
    check(
      $("[data-approve-cover]"),
      "Cover request has an explicit approval button",
    );
    click("[data-approve-cover]");
    await wait();
    await wait();
    check(
      requests.some((request) => request.operation === "cover") &&
        $(".ai-cover-preview"),
      "AI searches and previews the cover before applying",
    );
    check(
      !w.__qa.makeBackup().covers.length,
      "Cover proposal does not mutate saved data",
    );
    click(
      all("#ai-changes button").find(
        (button) => button.textContent === "Применить изменения",
      ),
    );
    await wait();
    check(
      w.__qa
        .makeBackup()
        .covers.some(([id, value]) => id === record.id && value === image),
      "AI confirmation saves cover with existing ID",
    );
    check(
      !Object.hasOwn(
        w.__qa
          .snapshotData()
          .archiveItems.find((entry) => entry.id === record.id),
        "coverQuery",
      ),
      "Lookup fields do not leak into stored records",
    );
    click("#ai-dialog .close");
    click(".ai-open");
    check(
      $("#ai-context-summary").textContent !== "Без записей Orvim",
      "Reopening assistant retains the explicit context selection",
    );
    answer = { message: "Здравствуйте", changes: [] };
    set("#ai-prompt", "Привет");
    submit("#ai-dialog-form");
    await wait();
    await wait();
    let request = requests
      .filter((row) => row.operation === "assistant")
      .at(-1);
    check(
      request.history.length > 0 && request.context.archiveItems?.length > 0,
      "Reopening preserves conversation and selected database context",
    );
    set("#ai-prompt", "Продолжим разговор");
    submit("#ai-dialog-form");
    await wait();
    await wait();
    request = requests.filter((row) => row.operation === "assistant").at(-1);
    check(
      request.history.length >= 2,
      "Current conversation retains its messages",
    );
    click("#ai-dialog .close");
    click(".ai-open");
    $("#ai-share-history").checked = true;
    set("#ai-prompt", "Продолжим старый разговор");
    submit("#ai-dialog-form");
    await wait();
    await wait();
    request = requests.filter((row) => row.operation === "assistant").at(-1);
    check(
      request.history.length >= 4,
      "Old history is shared only after explicit opt-in",
    );
    w.confirm = () => true;
    click("#ai-clear-chat");
    check(
      !w.__qa.snapshotData().uiPreferences.aiHistory.length,
      "Clear removes persisted conversation",
    );
    check(
      !Object.values(
        w.__qa.snapshotData().uiPreferences.aiSelection || {},
      ).some((ids) => ids.length),
      "Clearing the conversation also clears the saved context selection",
    );
    check(
      !$("#ai-voice") && !$(".ai-voice-options"),
      "No built-in microphone or cloud speech controls",
    );
    check(
      !requests.some((row) => /^speech/.test(row.operation)),
      "Chat does not invoke speech services",
    );
    click("#ai-dialog-form .close");
    const state = w.__qa.snapshotData(),
      entries = ["Подтягивания", "Приседания"].map((name, index) => ({
        exerciseKey: "reorder-" + index,
        name,
        unit: "раз",
        plannedValue: 5 + index,
        sets: 3,
        value: null,
      }));
    const workout = {
      id: w.__qa.createId(),
      trainingKey: "session-reorder",
      name: "Порядок упражнений",
      date: state.selectedDate,
      time: "09:00",
      duration: 45,
      done: false,
      entries,
      goalKeys: [],
    };
    state.workouts.push(workout);
    w.__qa.training.openWorkout(workout);
    await wait();
    const original = workout.entries.map((entry) => entry.exerciseKey);
    const draftHost = $(".workout-draft-entries");
    for (const row of all(".workout-draft-entries [data-exercise-order-key]"))
      row.getBoundingClientRect = () => ({
        top: [...draftHost.children].indexOf(row) * 100,
        height: 100,
      });
    const secondGrip = all(".workout-draft-entries .exercise-order-handle")[1];
    pointer(secondGrip, "pointerdown", 10, 150);
    pointer(secondGrip, "pointermove", 10, 5);
    pointer(secondGrip, "pointerup", 10, 5);
    check(
      all(".workout-draft-entries [data-exercise-order-key]")[0].dataset
        .exerciseOrderKey === original[1],
      "Touch-pointer drag reorders the complete exercise row",
    );
    $(".workout-draft-entries .exercise-order-handle").dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    $(".workout-draft-entries .exercise-order-handle").dispatchEvent(
      new w.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );
    check(
      all(".workout-draft-entries [data-exercise-order-key]")[0].dataset
        .exerciseOrderKey === original[1],
      "Editor reorders without deleting exercises",
    );
    submit("#training-edit-dialog form");
    check(
      workout.entries[0].exerciseKey === original[1] &&
        workout.entries[0].sets === 3 &&
        workout.entries[0].plannedValue === 6,
      "Reordering preserves planned values and sets",
    );
    w.__qa.validateBackup(w.__qa.makeBackup());
    check(true, "Updated document passes backup validation");
    await wait();
    check(!errors.length, "No DOM/runtime errors across tested pages");
    const css = fs.readFileSync("src/features/workspace/controls.css", "utf8");
    check(
      css.includes("border-radius: 20px") &&
        css.includes("rounded-options") &&
        css.includes("--rating-size"),
      "Shared picker rounding and aligned star sizes exist",
    );
    console.log(
      JSON.stringify(
        {
          passed: true,
          assertions: count,
          pages: [
            "home",
            "life",
            "thoughts",
            "projects",
            "database",
            "archive",
            "settings",
          ],
          scope:
            "DOM, event and source checks; Windows browser automation blocked, no rendered viewport or physical Android verification",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.stack);
    if (errors.length) console.error(errors);
    process.exitCode = 1;
  } finally {
    dom.window.close();
  }
})();
