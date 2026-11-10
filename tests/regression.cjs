const fs = require("node:fs");
const assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const html = require("./fixture.cjs")();
const windows = [];
let assertions = 0;
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (condition, message) => {
  assert.ok(condition, message);
  assertions++;
};
function runtime(state, initialNow) {
  const errors = [],
    snapshots = [],
    vc = new VirtualConsole();
  let now = initialNow;
  vc.on("jsdomError", (error) => {
    if (!error.message.includes("Could not parse CSS stylesheet"))
      errors.push(error.message);
  });
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      Object.defineProperty(window.navigator, "language", { value: "ru-RU" });
      window.Date = class extends Date {
        constructor(...args) {
          super(...(args.length ? args : [now]));
        }
        static now() {
          return now;
        }
      };
      window.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      });
      Object.assign(window, {
        TextEncoder,
        Blob,
        Response,
        CompressionStream,
        DecompressionStream,
      });
      window.lucide = { createIcons() {} };
      window.openai = {
        widgetState: state ? { privateContent: state } : {},
        setWidgetState: async (snapshot) => {
          snapshots.push(JSON.parse(JSON.stringify(snapshot)));
        },
      };
      window.HTMLCanvasElement.prototype.getContext = () =>
        new Proxy(
          {},
          {
            get(target, name) {
              if (
                name === "createLinearGradient" ||
                name === "createRadialGradient"
              )
                return () => ({ addColorStop() {} });
              return () => {};
            },
          },
        );
    },
  });
  windows.push(dom.window);
  const $ = (selector) => dom.window.document.querySelector(selector),
    all = (selector) => [...dom.window.document.querySelectorAll(selector)];
  const click = (selector) => {
    const node = typeof selector === "string" ? $(selector) : selector;
    assert.ok(node, "Missing target " + selector);
    node.click();
  };
  const set = (selector, value, event) => {
    const node = $(selector);
    node.value = String(value);
    if (event)
      node.dispatchEvent(new dom.window.Event(event, { bubbles: true }));
    return node;
  };
  const visible = (selector) => !$(selector).closest("[hidden]");
  return {
    window: dom.window,
    $,
    all,
    click,
    set,
    visible,
    snapshots,
    errors,
    setNow(value) {
      now = value;
    },
    submit(id) {
      click(id + ' button[type="submit"]');
    },
  };
}
(async () => {
  const oldAt = new Date(2026, 8, 30, 8).getTime(),
    morningAt = new Date(2026, 9, 1, 8).getTime(),
    latestAt = new Date(2026, 9, 1, 12).getTime();
  const r = runtime(
    {
      version: 23,
      activePage: "life",
      lifeDetailOpen: false,
      checkins: [
        { at: oldAt, mood: 2, energy: 2, stress: 4, note: "Старая запись" },
        { at: morningAt, mood: 3, energy: 3, stress: 3, note: "Утро" },
        { at: latestAt, mood: 4, energy: 4, stress: 2, note: "Последняя" },
      ],
    },
    latestAt + 30 * 60 * 1000,
  );
  const { $, all, click, set, submit, visible } = r;
  check(r.errors.length === 0, "Startup without script errors");
  click("#life-checkin-open");
  check(
    visible("#life-mood-view"),
    "Center opens statistics during period interval",
  );
  check(
    !visible("#state-dialog") && !$("#win-dialog"),
    "No fresh check-in or win overlay before due",
  );
  const firstDay = all("#mood-month-grid button").find(
    (button) => button.textContent === "1",
  );
  click(firstDay);
  check(
    all("#life-day-detail .life-checkin-entry").length === 2,
    "Selected date shows every record in right panel",
  );
  click('[data-checkin-at="' + morningAt + '"]');
  check(visible("#state-dialog"), "Day entry opens edit controls");
  check(
    $("#state-title").textContent.startsWith("Самочувствие ·"),
    "Historical editor has date heading",
  );
  check(
    $('input[name="mood"]:checked').value === "3",
    "Editor loads selected morning entry",
  );
  click('input[name="mood"][value="5"]');
  set("#checkin-note", "Исправленное утро");
  submit("#state-form");
  check(
    !visible("#state-dialog") && visible("#life-mood-view"),
    "Editing returns to selected day statistics",
  );
  check(
    $('[data-checkin-at="' + morningAt + '"] small').textContent.includes(
      "Настроение 5/5",
    ),
    "Exact selected record changed",
  );
  check(
    $('[data-checkin-at="' + latestAt + '"] small').textContent.includes(
      "Настроение 4/5",
    ),
    "Latest record untouched",
  );
  await pause(450);
  let state = r.snapshots.at(-1).privateContent;
  check(state.checkins.length === 3, "Edit does not create another record");
  check(
    state.checkins.find((entry) => entry.at === morningAt).note ===
      "Исправленное утро",
    "Edited note persists",
  );
  check(
    state.checkins.at(-1).at === latestAt,
    "Editing preserves reminder clock",
  );

  r.setNow(latestAt + 6 * 60 * 60 * 1000 - 1);
  click('[data-page="life"]');
  click("#life-checkin-open");
  check(
    !visible("#state-dialog") && !$("#win-dialog"),
    "Blocked one millisecond before the next period",
  );
  r.setNow(latestAt + 6 * 60 * 60 * 1000);
  click('[data-page="life"]');
  click("#life-checkin-open");
  check(
    visible("#state-dialog") && !$("#win-dialog"),
    "Score form opens directly at exact period boundary",
  );
  check(visible("#life-mood-view"), "Statistics available behind due check-in");
  check(
    visible("#state-dialog") &&
      $("#state-title").textContent === "Как вы сейчас?",
    "Fresh check-in shown only when due",
  );
  click('input[name="energy"][value="5"]');
  submit("#state-form");
  check(visible("#life-mood-view"), "Fresh Save opens wellbeing statistics");
  r.setNow(latestAt + 6 * 60 * 60 * 1000 + 60 * 1000);
  click('[data-page="life"]');
  click("#life-checkin-open");
  check(!visible("#state-dialog"), "Fresh dialog cannot repeat after Save");
  click('[data-page="home"]');
  click("#state-open");
  check(
    visible("#life-mood-view") && !visible("#state-dialog"),
    "Home uses same interval restriction",
  );
  set("#life-day-date", "2026-09-30", "change");
  click('[data-checkin-at="' + oldAt + '"]');
  click('input[name="mood"][value="4"]');
  submit("#state-form");
  check(
    $("#life-day-date").value === "2026-09-30",
    "Old date remains selected after correction",
  );
  await pause(450);
  state = r.snapshots.at(-1).privateContent;
  check(state.checkins.length === 4, "One new record added at the next period");
  check(
    state.checkins.find((entry) => entry.at === oldAt).mood === 4,
    "Previous month record corrected",
  );
  check(
    state.checkins.at(-1).at === latestAt + 6 * 60 * 60 * 1000,
    "Old edit does not move latest timestamp",
  );

  click('[data-page="life"]');
  click('[data-life-tab="food"]');
  check(
    visible("#hydration-view") && visible("#life-food-view"),
    "Water shown above food",
  );
  check(
    all("#hydration-view input").length === 0,
    "Compact water strip has no permanent form",
  );
  check(
    $("#hydration-view").compareDocumentPosition($("#life-food-view")) &
      r.window.Node.DOCUMENT_POSITION_FOLLOWING,
    "Water precedes food in document",
  );
  click("#water-bottle");
  click("#water-add-250");
  check(
    $("#water-total").textContent.startsWith("500"),
    "Small bottle and quick button retain functionality",
  );
  click("#water-settings");
  check(visible("#water-dialog"), "Water details open separately");
  set("#water-amount", "350");
  submit("#water-form");
  check(
    $("#water-total").textContent.startsWith("850"),
    "Custom amount updates compact counter",
  );
  click("#water-undo");
  check($("#water-total").textContent.startsWith("500"), "Water undo works");
  set("#water-target", "1000", "change");
  check(
    $("#water-total").textContent.includes("1000"),
    "Water target editable in dialog",
  );
  click("#water-dialog [data-close]");
  check(visible("#life-food-view"), "Water dialog closes back to food");
  set("#food-name", "Завтрак");
  set("#food-calories", "400");
  submit("#food-form");
  check(
    $("#food-day-total").textContent.includes("400"),
    "Food entry remains functional",
  );

  click('[data-page="life"]');
  click('[data-life-tab="training"]');
  check(
    visible("#training-goals-view") && visible("#life-training-view"),
    "Compact goals and training plan visible",
  );
  check(
    all("#training-goals-view input").length === 0,
    "Goal editor removed from main page",
  );
  check(
    $("#goal-form").closest("#goals-dialog"),
    "Goal form lives in separate dialog",
  );
  click("#goals-manage");
  check(visible("#goals-dialog"), "Goal management opens");
  set("#goal-name", "10 подтягиваний");
  set("#goal-focus", "Подтягивания");
  set("#goal-baseline", "3");
  set("#goal-target", "10");
  submit("#goal-form");
  check(!visible("#goals-dialog"), "Saving goal returns to training page");
  check(
    all(".goal-chips .goal-wheel").length === 1 &&
      $(".goal-wheel span").textContent === "0%",
    "New goal shown as small percent wheel",
  );
  click(".goal-chip[data-goal-id]");
  check(visible("#goals-dialog"), "Wheel opens its goal");
  check(
    $("#goal-name").value === "10 подтягиваний" &&
      $("#goal-focus").value === "Подтягивания",
    "Correct goal selected for editing",
  );
  set(".goal-measure input", "6");
  click(".goal-measure button");
  check(
    $(".goal-wheel span").textContent === "43%",
    "Measurement updates ring progress",
  );
  set("#goal-target", "12");
  submit("#goal-form");
  check(
    $(".goal-wheel span").textContent === "33%",
    "Changing target updates progress without losing current result",
  );
  click("#goals-manage");
  set("#goal-name", "Приседание 80 кг");
  set("#goal-focus", "Ноги");
  set("#goal-baseline", "40");
  set("#goal-target", "80");
  set("#goal-unit", "кг");
  submit("#goal-form");
  check(
    all(".goal-chips .goal-wheel").length === 2,
    "Separate goal added for legs",
  );
  for (const focus of ["Спина", "Руки"]) {
    click("#goals-manage");
    set("#goal-name", focus + " — своя цель");
    set("#goal-focus", focus);
    set("#goal-baseline", "0");
    set("#goal-target", "20");
    submit("#goal-form");
  }
  check(
    all(".goal-chips .goal-wheel").length === 3 &&
      $(".goal-chip-more").textContent === "+1",
    "Compact strip limits visible wheels and retains extra goals",
  );
  click(".goal-chip-more");
  check(
    all("#goals-list .goal-item").length === 4,
    "All goals accessible in dialog",
  );
  const input = $(".goal-measure input"),
    key = new r.window.KeyboardEvent("keydown", {
      key: "e",
      bubbles: true,
      cancelable: true,
    });
  input.dispatchEvent(key);
  check(
    key.defaultPrevented,
    "Dynamic numeric measurement rejects exponent letter",
  );
  set(".goal-measure input", "-1");
  click(".goal-measure button");
  check(
    $(".goal-meta").textContent.includes("6 / 12"),
    "Negative measurement rejected",
  );
  click("#goals-dialog [data-close]");
  await pause(450);
  state = r.snapshots.at(-1).privateContent;
  check(
    state.trainingGoals.length === 4 && state.trainingGoals[1].focus === "Ноги",
    "Goal categories persist",
  );
  check(
    state.trainingGoals[0].current === 6 &&
      state.trainingGoals[0].history.length === 2,
    "Goal history retained",
  );
  check(
    state.waterLogs.length === 2 && state.waterTarget === 1000,
    "Water entries and target persist",
  );
  check(r.errors.length === 0, "All interactions without runtime errors");
  check(
    new Set(all("[id]").map((node) => node.id)).size === all("[id]").length,
    "No duplicate element IDs",
  );
  const report = {
    passed: true,
    assertions,
    checked: [
      "period boundary",
      "exact historical record editing",
      "timestamp preservation",
      "compact water controls",
      "goal rings and separate editor",
      "goal directions",
      "numeric constraints",
      "state persistence",
    ],
    scope: "DOM/event checks; physical layout and touch not measured",
  };
  console.log(JSON.stringify(report, null, 2));
})()
  .catch((error) => {
    console.error(error.stack);
    process.exitCode = 1;
  })
  .finally(() => windows.forEach((window) => window.close()));
