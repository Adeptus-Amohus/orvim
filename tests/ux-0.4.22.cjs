const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  { JSDOM, VirtualConsole } = require("jsdom");
const source = require("./fixture.cjs")().replace(
  "    })();",
  "window.__qa={snapshotData,training,usability,renderTasks,renderLife,showPage,createId:()=>nextId++};    })();",
);
const errors = [],
  requests = [],
  timers = [],
  vc = new VirtualConsole();
let checks = 0;
vc.on("jsdomError", (e) => {
  if (!e.message.includes("CSS")) errors.push(e.message);
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
    const actualTimeout = w.setTimeout.bind(w);
    w.setTimeout = (fn, ms, ...args) => {
      if ([2200, 8000, 5000].includes(ms)) {
        timers.push({ fn, ms });
        return 999 + timers.length;
      }
      return actualTimeout(fn, ms, ...args);
    };
    w.__services = {
      mobile: true,
      credential: async () => ({ configured: true }),
      flush: async () => {},
      request: async (args) => {
        requests.push(args);
        return { message: "Тестовая сводка", changes: [] };
      },
      platform: async () => ({
        status: "unavailable",
        copies: [],
        calendars: [],
        granted: [],
      }),
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
  $ = (s) => w.document.querySelector(s),
  all = (s) => [...w.document.querySelectorAll(s)],
  wait = () => new Promise((r) => setTimeout(r, 40));
const check = (v, msg) => {
    assert.ok(v, msg);
    checks++;
  },
  click = (s) => {
    const n = typeof s === "string" ? $(s) : s;
    assert.ok(n, "Missing " + s);
    n.click();
  },
  set = (s, v) => {
    $(s).value = v;
    $(s).dispatchEvent(new w.Event("change", { bubbles: true }));
  };
(async () => {
  try {
    await wait();
    check(!errors.length, "Application initializes");
    const data = w.__qa.snapshotData(),
      day = data.selectedDate;
    check(
      !$(".calendar-now").hidden,
      "Now remains visible in centered calendar",
    );
    for (const value of [0, 5, 12, 23.9]) {
      $("#window-range").value = value;
      $("#window-range").dispatchEvent(new w.Event("input", { bubbles: true }));
      check(
        !$(".calendar-now").hidden,
        "Slider does not hide or remove Now at " + value,
      );
    }
    click(".calendar-now");
    check(
      !$(".calendar-now").hidden && w.__qa.snapshotData().selectedDate === day,
      "Now returns to today and remains visible",
    );
    w.__qa.usability.notify("Сохранено");
    await wait();
    check(
      !$(".global-notice").hidden && !$(".global-notice .close"),
      "Save notice has no close cross",
    );
    check(
      $(".global-notice").dataset.quiet === "true" &&
        $(".global-notice .text-button").hidden,
      "Save is a quiet notice without an undo button",
    );
    const quiet = timers.findLast((t) => t.ms === 2200);
    quiet.fn();
    check($(".global-notice").hidden, "Quiet notice disappears automatically");
    let restored = false;
    w.__qa.usability.notify("Запись удалена", () => (restored = true));
    check(
      !$(".global-notice .text-button").hidden &&
        $(".global-notice").dataset.undoable === "true",
      "Destructive operation keeps Undo",
    );
    w.__qa.usability.notify("Сохранено");
    await wait();
    check(
      !$(".global-notice .text-button").hidden &&
        $(".global-notice span").textContent === "Запись удалена",
      "Background Save cannot replace an active Undo",
    );
    click(".global-notice .text-button");
    check(restored && $(".global-notice").hidden, "Undo remains functional");
    const workout = {
      id: w.__qa.createId(),
      trainingKey: "empty-stretch",
      name: "Растяжка",
      focus: "Растяжка",
      date: day,
      time: "17:00",
      duration: 30,
      done: false,
      result: "",
      entries: [],
    };
    data.workouts.push(workout);
    data.events.push({
      id: w.__qa.createId(),
      workoutId: workout.id,
      title: workout.name,
      date: day,
      start: "17:00",
      end: "17:30",
      done: false,
      tone: "pine",
      context: "Личное",
    });
    w.__qa.renderTasks();
    const row = all("#task-list .task").find(
      (n) => n.querySelector(".task-title").textContent === "Растяжка",
    );
    check(
      row &&
        !row.querySelector(".training-inline-results") &&
        !row.textContent.includes("Занятие без упражнений"),
      "Empty session stays a regular aligned row without extra controls",
    );
    data.uiPreferences.homeView = "thoughts";
    data.homeView = "thoughts";
    for (let i = 0; i < 15; i++)
      data.thoughts.push({
        id: w.__qa.createId(),
        title: "Очень длинная мысль ".repeat(15),
        body: "Подробный текст ".repeat(30),
        context: "Личное",
        date: day,
      });
    click('[data-home-view="thoughts"]');
    const cards = all("#home-thought-list .thought-card");
    check(
      cards.length === 15 &&
        cards.every(
          (card) => card.querySelector(".thought-card-copy small").textContent,
        ),
      "Every thought card contains its own date",
    );
    const css = fs.readFileSync(
      "src/features/workspace/interactions.css",
      "utf8",
    );
    check(
      css.includes("grid-auto-rows: max-content") &&
        css.includes(".thought-card-copy small"),
      "Thought tracks cannot shrink below content and dates stay separate",
    );
    check(
      /\.tasks \.task\s*\{[^}]*grid-template-columns:\s*auto auto minmax\(0, 1fr\) auto auto/s.test(
        css,
      ),
      "Tasks and workouts share columns that accommodate mobile touch targets",
    );
    data.stepLogs.splice(
      0,
      data.stepLogs.length,
      { date: day.slice(0, 7) + "-01", count: 1000, manualOverride: true },
      { date: day.slice(0, 7) + "-02", count: 0, manualOverride: true },
      { date: day.slice(0, 4) + "-01-01", count: 500, manualOverride: true },
    );
    w.__qa.showPage("life");
    click('[data-life-tab="training"]');
    click("#steps-statistics-open");
    check(
      !$("#training-step-stats-dialog").hidden &&
        $("#steps-stats-mode").value === "month",
      "Step heading opens monthly statistics",
    );
    const number = (s) => Number(s.replace(/[^0-9]/g, ""));
    check(
      number($("#steps-stats-totals strong").textContent) === 1000,
      "Monthly step total excludes other months",
    );
    check(
      number(all("#steps-stats-totals strong")[1].textContent) === 500,
      "Average includes recorded zero but excludes missing days",
    );
    check(
      all(".steps-stat-point").length ===
        new Date(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0).getDate(),
      "Month chart represents every calendar day",
    );
    const point = all(".steps-stat-point").find((n) =>
      n.getAttribute("aria-label").startsWith(day.slice(0, 7) + "-02"),
    );
    click(point);
    check(
      $(".steps-stat-selected").textContent.includes("0 шагов"),
      "A recorded zero is visible as zero",
    );
    set("#steps-stats-mode", "year");
    check(
      number($("#steps-stats-totals strong").textContent) === 1500 &&
        all(".steps-stat-point").length === 12,
      "Year shows complete sum and twelve months",
    );
    click(all(".steps-stat-point")[0]);
    check(
      $("#steps-stats-mode").value === "month" &&
        $("#steps-stats-month").value === day.slice(0, 4) + "-01",
      "Year chart drills into a selected month",
    );
    click("#training-step-stats-dialog .close");
    workout.done = true;
    workout.win = true;
    w.__qa.training.render();
    click(
      all(".training-workout-row button").find(
        (n) => n.getAttribute("aria-label") === "Действия с тренировкой",
      ),
    );
    check(
      !$("#training-actions-dialog")
        .textContent.toLocaleLowerCase()
        .includes("побед"),
      "Completed workout menu has no victories actions",
    );
    click("#training-actions-dialog .close");
    const strip = $("#training-days");
    Object.defineProperty(strip, "clientWidth", {
      configurable: true,
      value: 300,
    });
    const pointer = (type, x) => {
      const e = new w.Event(type, { bubbles: true, cancelable: true });
      for (const [k, v] of Object.entries({
        pointerId: 9,
        pointerType: "touch",
        button: 0,
        clientX: x,
        clientY: 10,
      }))
        Object.defineProperty(e, k, { value: v });
      strip.dispatchEvent(e);
      return e;
    };
    pointer("pointerdown", 200);
    const move = pointer("pointermove", 50);
    pointer("pointerup", 50);
    check(
      !move.defaultPrevented && !strip.classList.contains("is-dragging"),
      "Touch date scrolling is delegated to native browser inertia",
    );
    check(
      fs
        .readFileSync("src/features/workspace/training.css", "utf8")
        .includes("touch-action: pan-x pan-y"),
      "Date strip permits native horizontal and vertical gestures",
    );
    data.connectionSettings.aiProvider = "deepseek";
    data.connectionSettings.aiModel = "test-model";
    click(".ai-open");
    click("#ai-context-open");
    click('[data-ai-source="lifeData"]');
    click('#ai-context-items input[value="*"]');
    click("#ai-context-done");
    set("#ai-prompt", "Общая статистика за сегодня: шаги и тренировки");
    $("#ai-dialog-form").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    check(
      !$("#ai-context-suggestion"),
      "Manually attached life statistics send without an extra context prompt",
    );
    await wait();
    await wait();
    check(
      requests.length === 1 &&
        requests[0].context.lifeSummary &&
        requests[0].context.stepLogs,
      "Explicit attach sends step records and computed summary",
    );
    check(
      requests[0].context.lifeSummary.period.from === day &&
        requests[0].context.lifeSummary.period.until === day,
      "Chat request uses actual requested date",
    );
    check(
      requests[0].context.workouts[0].trainingKey === "empty-stretch" &&
        !requests[0].context.archiveItems &&
        !requests[0].context.financeLogs,
      "Workout data attaches without unrelated database or finances",
    );
    click("#ai-context-open");
    click("[data-ai-source=lifeData]");
    check(
      $("#ai-context-kind").value === "lifeData" &&
        !$("#ai-context-panel").hidden &&
        $("#ai-context-search").hidden,
      "Life has an obvious source picker without a meaningless search",
    );
    check(!errors.length, "No uncaught DOM exceptions");
    console.log(
      JSON.stringify(
        {
          passed: true,
          checks,
          scope:
            "DOM/events and mocked native services; browser rendering checked separately, no physical phone or live AI",
        },
        null,
        2,
      ),
    );
  } catch (e) {
    console.error(e, errors);
    process.exitCode = 1;
  } finally {
    dom.window.close();
  }
})();
