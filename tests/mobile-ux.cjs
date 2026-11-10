const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM, VirtualConsole } = require("jsdom");
const source = require("./fixture.cjs")().replace(
  "    })();",
  "window.__qa={snapshotData,makeBackup,validateBackup,showPage,openDialog,closeDialog};    })();",
);
let checks = 0,
  now = new Date("2026-10-16T12:00:00").valueOf(),
  hidden = false;
const errors = [],
  minutes = [],
  vc = new VirtualConsole();
vc.on("jsdomError", (error) => {
  if (!error.message.includes("CSS")) errors.push(error.message);
});
const check = (value, description) => {
  assert.ok(value, description);
  checks++;
};
const wait = (ms = 35) => new Promise((resolve) => setTimeout(resolve, ms));
const dom = new JSDOM(source, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    const RealDate = w.Date;
    w.Date = class extends RealDate {
      constructor(...args) {
        super(...(args.length ? args : [now]));
      }
      static now() {
        return now;
      }
    };
    Object.defineProperty(w.navigator, "language", { value: "ru-RU" });
    Object.defineProperty(w.document, "hidden", { get: () => hidden });
    w.matchMedia = (query) => ({
      matches:
        query.includes("hover: none") || query.includes("pointer: coarse"),
      addEventListener() {},
      removeEventListener() {},
    });
    w.setInterval = (fn, ms) => {
      if (ms === 60000) minutes.push(fn);
      return 0;
    };
    w.clearInterval = () => {};
    w.HTMLCanvasElement.prototype.getContext = () =>
      new Proxy(
        {},
        {
          get: (_, key) =>
            key.startsWith("create") ? () => ({ addColorStop() {} }) : () => {},
        },
      );
    w.openai = {
      widgetState: {
        privateContent: {
          version: 31,
          activePage: "home",
          selectedDate: "2026-10-15",
          range: "six",
          languageMode: "ru",
        },
      },
      setWidgetState: async () => {},
    };
    w.__services = {
      mobile: true,
      platform: async () => ({
        status: "unavailable",
        granted: [],
        calendars: [],
        copies: [],
      }),
    };
  },
});
(async () => {
  try {
    const w = dom.window,
      $ = (s) => w.document.querySelector(s),
      all = (s) => [...w.document.querySelectorAll(s)];
    await wait();
    check(!errors.length, "Mobile application initializes");
    check(
      $("#calendar-date").value === "2026-10-16",
      "Startup replaces a saved yesterday with today",
    );
    $("#calendar-date").value = "2026-10-10";
    $("#calendar-date").dispatchEvent(new w.Event("change", { bubbles: true }));
    check(
      w.__qa.snapshotData().selectedDate === "2026-10-10",
      "Browsing a historical date still works",
    );
    w.__qa.openDialog("capture-dialog");
    $("#capture-text").value = "Не потерять черновик";
    w.dispatchEvent(new w.Event("life-os:resume"));
    check(
      w.__qa.snapshotData().selectedDate === "2026-10-10",
      "Native resume preserves the selected date while an editor is open",
    );
    check(
      !$("#capture-dialog").hidden &&
        $("#capture-text").value === "Не потерять черновик",
      "Resume preserves the active editor and draft",
    );
    w.__qa.closeDialog();
    w.dispatchEvent(new w.Event("life-os:resume"));
    check(
      w.__qa.snapshotData().selectedDate === "2026-10-16",
      "Native resume returns the schedule to today after the editor closes",
    );
    $("#calendar-date").value = "2026-10-11";
    $("#calendar-date").dispatchEvent(new w.Event("change", { bubbles: true }));
    hidden = true;
    w.document.dispatchEvent(new w.Event("visibilitychange"));
    hidden = false;
    w.document.dispatchEvent(new w.Event("visibilitychange"));
    check(
      $("#calendar-date").value === "2026-10-16",
      "Browser visibility return uses today's date",
    );
    now += 86400000;
    minutes.forEach((fn) => fn());
    check(
      w.__qa.snapshotData().selectedDate === "2026-10-17",
      "An open app follows midnight",
    );
    $("#state-open").focus();
    check(
      $("#workspace-button-hint").hidden,
      "Touch focus never leaves a floating tooltip on the phone",
    );
    check(
      $("#state-open").hasAttribute("aria-label"),
      "Accessible button labels remain available",
    );
    w.__qa.showPage("projects");
    const input = $("#project-task-search");
    check(
      input &&
        input.closest(".project-search-field") &&
        $(".project-search-field i,.project-search-field svg"),
      "Project search has one rounded wrapper and search icon",
    );
    const cards = all(".project-board-card");
    input.value = "несуществующая строка 987654";
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
    check(
      cards.length && cards.every((card) => card.hidden),
      "Project search filters the current project",
    );
    check(!$(".project-search-clear").hidden, "A typed query exposes Clear");
    $(".project-search-clear").click();
    check(
      input.value === "" && cards.every((card) => !card.hidden),
      "Clear restores the project cards",
    );
    input.value = "строка";
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
    input.focus();
    input.dispatchEvent(
      new w.KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
      }),
    );
    check(
      w.document.activeElement !== input && input.value === "строка",
      "Keyboard search confirms without clearing the query",
    );
    w.__qa.validateBackup(w.__qa.makeBackup());
    check(!errors.length, "No runtime errors across the tested mobile flows");
  } finally {
    dom.window.close();
  }

  const chartDom = new JSDOM('<div id="host"></div>', {
    pretendToBeVisual: true,
  });
  globalThis.window = chartDom.window;
  globalThis.document = chartDom.window.document;
  let controller;
  try {
    const w = chartDom.window,
      calls = [],
      selectedDays = [];
    w.matchMedia = () => ({ matches: false });
    const { installStepHistory } =
      await import("../src/features/workspace/step-history.js");
    const ctx = {
      make: (tag, cls, text) => {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text !== undefined) n.textContent = text;
        return n;
      },
      listen: (node, type, fn, options) =>
        node.addEventListener(type, fn, options),
      translate: (ru) => ru,
      displayLocale: () => "ru-RU",
      shortDate: (day) => day,
    };
    const data = [
      { date: "2026-10-15", count: 6000 },
      { date: "2026-10-16", count: 0 },
    ];
    let selected = "2026-10-16";
    controller = installStepHistory(
      ctx,
      document.querySelector("#host"),
      (day) => {
        selectedDays.push(day);
        selected = day;
        controller.render(data, selected);
      },
    );
    const viewport = document.querySelector("#steps-history");
    Object.defineProperty(viewport, "clientWidth", { get: () => 328 });
    Object.defineProperty(viewport, "scrollWidth", {
      get: () => viewport.children.length * 48 - 8,
    });
    Object.defineProperty(w.HTMLElement.prototype, "offsetLeft", {
      get() {
        return this.matches(".training-step-day")
          ? [...this.parentElement.children].indexOf(this) * 48
          : 0;
      },
    });
    Object.defineProperty(w.HTMLElement.prototype, "offsetWidth", {
      get() {
        return this.matches(".training-step-day") ? 40 : 0;
      },
    });
    viewport.scrollTo = ({ left, behavior }) => {
      calls.push({ left, behavior });
      viewport.scrollLeft = Math.max(
        0,
        Math.min(left, viewport.scrollWidth - viewport.clientWidth),
      );
      viewport.dispatchEvent(new w.Event("scroll"));
    };
    const capture = new Set();
    viewport.setPointerCapture = (id) => capture.add(id);
    viewport.hasPointerCapture = (id) => capture.has(id);
    viewport.releasePointerCapture = (id) => capture.delete(id);
    const pointer = (type, x, y, pointerType) => {
      const e = new w.Event(type, { bubbles: true, cancelable: true });
      for (const [key, value] of Object.entries({
        pointerId: 2,
        pointerType,
        button: 0,
        clientX: x,
        clientY: y,
      }))
        Object.defineProperty(e, key, { value });
      viewport.dispatchEvent(e);
      return e;
    };
    controller.render(data, selected);
    check(
      viewport.children.length === 92,
      "Step chart provides history beyond one week",
    );
    check(
      document.querySelector(
        '.training-step-day[data-step-day="2026-10-16"] .training-step-track > span',
      ).style.height === "0%",
      "Zero steps remain a zero-height bar",
    );
    const before = viewport.scrollLeft;
    pointer("pointerdown", 200, 10, "mouse");
    pointer("pointermove", 104, 10, "mouse");
    pointer("pointerup", 104, 10, "mouse");
    check(
      viewport.scrollLeft > before,
      "Mouse drag pans the actual steps chart",
    );
    check(
      selectedDays.length === 0 && selected === "2026-10-16",
      "Panning does not silently select a different day",
    );
    const afterPan = viewport.scrollLeft;
    controller.render(data, selected);
    check(
      viewport.scrollLeft === afterPan,
      "A refresh does not snap a browsed chart back to today",
    );
    const touch = pointer("pointerdown", 150, 10, "touch"),
      touchMove = pointer("pointermove", 70, 10, "touch");
    check(
      !touch.defaultPrevented && !touchMove.defaultPrevented,
      "Touch is delegated to native pan and inertia",
    );
    const vertical = pointer("pointermove", 150, 100, "touch");
    check(
      !vertical.defaultPrevented,
      "Vertical touch scrolling is not captured",
    );
    const wheel = new w.WheelEvent("wheel", {
      deltaY: -90,
      bubbles: true,
      cancelable: true,
    });
    viewport.dispatchEvent(wheel);
    check(
      wheel.defaultPrevented && calls.at(-1).behavior === "smooth",
      "Mouse wheel requests smooth horizontal scrolling",
    );
    viewport.scrollLeft = 0;
    viewport.dispatchEvent(new w.Event("scroll"));
    await wait(230);
    check(
      viewport.children.length > 92 && viewport.scrollLeft > 0,
      "Earlier dates extend while the visible anchor is preserved",
    );
    const rowCount = viewport.children.length;
    check(
      rowCount <= 365 &&
        [...viewport.children].every((n) => n.tabIndex === -1) &&
        viewport.tabIndex === 0,
      "Date history stays bounded and has one Tab stop",
    );
    await wait(450);
    viewport.children[20].click();
    check(
      selectedDays.length === 1 &&
        viewport.children[20].getAttribute("aria-pressed") === "true",
      "Tapping a bar selects its date explicitly",
    );
    check(
      document
        .querySelector(".training-step-period")
        .textContent.includes("2026"),
      "Visible dates include month and year",
    );
  } finally {
    controller?.dispose();
    chartDom.window.close();
    delete globalThis.window;
    delete globalThis.document;
  }
  console.log(
    JSON.stringify(
      {
        passed: true,
        assertions: checks,
        scope:
          "DOM, controlled dates, mocked chart geometry and scroll commands; native touch inertia and actual Android notifications require a device",
      },
      null,
      2,
    ),
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
