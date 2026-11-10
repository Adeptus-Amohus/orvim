const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const source = require("./fixture.cjs")();
const html = source.replace(
  "    })();",
  "      window.__qa={snapshotData,positionTaskMenu,renderLifeInsights,makeBackup,validateBackup};\n    })();",
);
const windows = [];
let assertions = 0;
const check = (value, message) => {
  assert.ok(value, message);
  assertions++;
};
function runtime(state) {
  const errors = [],
    vc = new VirtualConsole();
  vc.on("jsdomError", (error) => {
    if (!error.message.includes("Could not parse CSS stylesheet"))
      errors.push(error.message);
  });
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      const now = Date.UTC(2026, 9, 1, 12);
      window.Date = class extends Date {
        constructor(...args) {
          super(...(args.length ? args : [now]));
        }
        static now() {
          return now;
        }
      };
      Object.defineProperty(window.navigator, "language", { value: "ru-RU" });
      window.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      });
      window.lucide = { createIcons() {} };
      Object.assign(window, {
        TextEncoder,
        Blob,
        Response,
        CompressionStream,
        DecompressionStream,
      });
      window.openai = {
        widgetState: state ? { privateContent: state } : {},
        setWidgetState: async () => {},
      };
      window.HTMLCanvasElement.prototype.getContext = () =>
        new Proxy(
          {},
          {
            get(target, name) {
              if (name.startsWith("create"))
                return () => ({ addColorStop() {} });
              return () => {};
            },
          },
        );
    },
  });
  windows.push(dom.window);
  const $ = (selector) => dom.window.document.querySelector(selector),
    all = (selector) => [...dom.window.document.querySelectorAll(selector)],
    click = (target) => {
      const node = typeof target === "string" ? $(target) : target;
      assert.ok(node, "Missing " + target);
      node.click();
    },
    set = (selector, value, type = "input") => {
      const node = $(selector);
      if (node.type === "checkbox") node.checked = value;
      else node.value = String(value);
      node.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
    };
  return {
    window: dom.window,
    $,
    all,
    click,
    set,
    errors,
    qa: dom.window.__qa,
    submit(selector) {
      click(selector + ' button[type="submit"]');
    },
    pointer(node, type) {
      const event = new dom.window.Event(type, {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperties(event, {
        clientX: { value: 200 },
        clientY: { value: 180 },
        button: { value: 0 },
        pointerId: { value: 1 },
        pointerType: { value: "mouse" },
      });
      node.dispatchEvent(event);
      return event;
    },
  };
}
(async () => {
  try {
    const r = runtime(),
      { $, all, click, set, submit, qa } = r,
      root = $("#life-os-workspace");
    Object.defineProperties(root, {
      clientWidth: { value: 320 },
      clientHeight: { value: 260 },
    });
    root.getBoundingClientRect = () => ({
      left: 50,
      top: 80,
      right: 690,
      bottom: 600,
      width: 640,
      height: 520,
    });
    const more = $("#task-list .task-more");
    click(more);
    check(
      $("#item-actions-dialog").parentElement === root,
      "Actions are outside the clipping task list",
    );
    check(
      !$("#item-actions-dialog").hidden && $(".app").inert,
      "Task actions open a modal with background disabled",
    );
    check(
      all("#item-actions-dialog .entity-actions button").length === 4,
      "Only edit, move, duplicate and delete are available",
    );
    root.dispatchEvent(
      new r.window.KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );
    check(
      $("#item-actions-dialog").hidden &&
        r.window.document.activeElement === more,
      "Escape closes and restores focus",
    );
    click(more);
    $("#task-list").dispatchEvent(new r.window.Event("scroll"));
    check(
      !$("#item-actions-dialog").hidden,
      "Modal actions remain usable when task list scrolls",
    );
    r.window.dispatchEvent(new r.window.Event("resize"));
    check(
      !$("#item-actions-dialog").hidden,
      "Modal actions remain usable on resize",
    );
    click("#item-actions-dialog .entity-actions button");
    check(
      !$("#task-dialog").hidden && $("#task-name").value === "Оплатить счёт",
      "Edit action loads selected task",
    );
    set("#task-name", "Оплатить электричество");
    set("#task-description", "Сверить сумму");
    submit("#task-form");
    check(
      $("#task-list .task-title").textContent === "Оплатить электричество",
      "Task title saved",
    );
    check(
      qa.snapshotData().tasks[0].description === "Сверить сумму",
      "Task description saved",
    );
    const taskCount = qa.snapshotData().tasks.length;
    click("#task-list .task-more");
    click("#item-actions-dialog .button-danger");
    check(
      qa.snapshotData().tasks.length === taskCount - 1 &&
        $("#item-actions-dialog").hidden,
      "Delete action removes task",
    );
    click(".global-notice .text-button");
    check(qa.snapshotData().tasks.length === taskCount, "Delete can be undone");
    let capture = 0;
    const eventBlock = $('[data-event-id="1"]'),
      title = eventBlock.querySelector(".event-open");
    eventBlock.setPointerCapture = () => capture++;
    title.setPointerCapture = () => capture++;
    const down = r.pointer(title, "pointerdown");
    r.pointer(title, "pointerup");
    click(title);
    check(
      !down.defaultPrevented && capture === 0,
      "Title click is not intercepted by drag capture",
    );
    check(
      !$("#event-dialog").hidden &&
        $("#event-name").value === "Подготовить отчёт",
      "Ordinary event click opens editor",
    );
    check(!$("#event-delete").hidden, "Existing event exposes Delete");
    set("#event-name", "Уточнённый отчёт");
    set("#event-description", "Новая заметка");
    set("#event-date", "2026-10-03");
    set("#event-start", "14:00");
    set("#event-end", "15:15");
    click('[data-event-tone="scarlet"]');
    submit("#event-form");
    const edited = qa.snapshotData().events.find((item) => item.id === 1);
    check(
      edited.title === "Уточнённый отчёт" &&
        edited.description === "Новая заметка",
      "Event text and description editable",
    );
    check(
      edited.date === "2026-10-03" &&
        edited.start === "14:00" &&
        edited.end === "15:15" &&
        edited.duration === 75,
      "Date time and duration update together",
    );
    check(edited.tone === "scarlet", "Event color editable");
    click('[data-event-id="1"] .event-open');
    click("#event-delete");
    check(
      !qa.snapshotData().events.some((item) => item.id === 1),
      "Event deletion works",
    );
    click(".global-notice .text-button");
    check(
      qa.snapshotData().events.some((item) => item.id === 1),
      "Event deletion can be undone",
    );
    click('[data-page="life"]');
    click('[data-life-tab="food"]');
    check(
      $("#saved-meals").closest("#saved-meals-dialog") &&
        $("#saved-meals-dialog").hidden,
      "Saved dishes hidden in separate dialog",
    );
    check(
      !$("#food-form").parentElement.querySelector("#saved-meals"),
      "Saved dishes do not occupy food form",
    );
    click("#saved-meals-open");
    check(
      !$("#saved-meals-dialog").hidden && $(".meal-empty"),
      "Empty meal library opens with explanation",
    );
    click("#saved-meals-dialog .close");
    set("#food-name", "Омлет");
    set("#food-calories", 300);
    set("#food-protein", 20);
    set("#food-fat", 18);
    set("#food-carbs", 12);
    set("#food-save-meal", true);
    submit("#food-form");
    check($("#saved-meals-dialog").hidden, "Saving meal does not open library");
    click("#saved-meals-open");
    click("[data-meal-add]");
    check(
      $("#saved-meals-dialog").hidden &&
        qa.snapshotData().foodLogs.length === 2,
      "Portion added and picker closes",
    );
    click("#saved-meals-open");
    click('.saved-meal [aria-label^="Изменить"]');
    check(
      $("#saved-meals-dialog").hidden &&
        $("#food-name").value === "Омлет" &&
        r.window.document.activeElement === $("#food-name"),
      "Recipe edit returns to food form",
    );
    set("#food-calories", 320);
    submit("#food-form");
    check(
      qa.snapshotData().savedMeals[0].calories === 320 &&
        qa.snapshotData().foodLogs.length === 2,
      "Editing recipe does not duplicate food log",
    );
    click("#saved-meals-open");
    click('.saved-meal [aria-label^="Удалить"]');
    check(
      !$("#saved-meals-dialog").hidden &&
        $(".meal-empty") &&
        qa.snapshotData().savedMeals.length === 0,
      "Deleting final recipe leaves empty picker usable",
    );
    click("#saved-meals-dialog .close");
    check(
      $("#life-insights").tagName === "DETAILS" && !$("#life-insights").open,
      "Comparisons collapsed by default",
    );
    $("#life-insights").open = true;
    check(
      $("#life-insights").open && $("#insight-question"),
      "Controls retained in disclosure",
    );
    set("#insight-question", "training", "change");
    check(
      $("#insight-summary-label").textContent === "Тренировки и настроение",
      "Collapsed summary tracks chosen comparison",
    );
    const oldBackup = JSON.parse(JSON.stringify(qa.makeBackup()));
    oldBackup.data.version = 27;
    check(
      qa.validateBackup(oldBackup).data.version === 27,
      "Prior version backup still accepted",
    );
    const dense = JSON.parse(JSON.stringify(qa.snapshotData()));
    dense.activePage = "home";
    dense.selectedDate = "2026-10-01";
    dense.tasks = Array.from({ length: 100 }, (_, index) => ({
      id: 1000 + index,
      title: "Задача " + index,
      context: "Личное",
      date: "2026-10-01",
      time: "00:00",
      done: false,
    }));
    const s = runtime(dense);
    for (const index of [0, 50, 99]) {
      s.click(s.all("#task-list .task-more")[index]);
      check(
        !s.$("#item-actions-dialog").hidden &&
          s.$("#item-actions-dialog").parentElement ===
            s.$("#life-os-workspace"),
        "Task popup works for dense row " + index,
      );
      s.click("#item-actions-dialog .entity-actions button");
      check(
        s.$("#task-name").value === "Задача " + index,
        "Correct dense row selected " + index,
      );
      s.click("#task-dialog [data-close]");
    }
    check(
      r.errors.length === 0 && s.errors.length === 0,
      "No runtime errors across revised actions",
    );
    check(
      new Set(all("[id]").map((node) => node.id)).size === all("[id]").length,
      "No duplicate IDs",
    );
    const report = {
      passed: true,
      assertions,
      checked: [
        "modal task actions outside clipped lists",
        "resize and scroll stability",
        "keyboard close and focus restoration",
        "task edit/delete/undo",
        "event ordinary click and editor",
        "event dates/colors/delete",
        "hidden meal picker and recipe editing",
        "compact comparisons",
        "old backup compatibility",
        "first/middle/last of 100 tasks",
      ],
      scope:
        "DOM/event logic with mocked bounds; actual browser layout and touch not verified",
    };
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    windows.forEach((window) => window.close());
  }
})();
