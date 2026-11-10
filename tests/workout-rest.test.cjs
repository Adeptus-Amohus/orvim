const assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const source = require("./fixture.cjs")().replace(
  "    })();",
  "window.__qa={snapshotData,makeBackup,validateBackup,training,goalState,createId:()=>nextId++,showPage};    })();",
);
const errors = [],
  sounds = [],
  ticks = [];
let now = Date.now(),
  assertions = 0;
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
    w.Date.now = () => now;
    w.matchMedia = () => ({
      matches: false,
      addEventListener() {},
      removeEventListener() {},
    });
    w.setInterval = (fn, ms) => {
      if (ms === 250) ticks.push(fn);
      return 0;
    };
    w.clearInterval = () => {};
    w.Audio = class {
      constructor(src) {
        this.src = src;
      }
      play() {
        sounds.push({ src: this.src, muted: this.muted });
        return Promise.resolve();
      }
      pause() {}
      removeAttribute() {}
    };
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
    w.Element.prototype.scrollTo = function ({ left, top }) {
      if (left !== undefined) this.scrollLeft = left;
      if (top !== undefined) this.scrollTop = top;
    };
    w.HTMLCanvasElement.prototype.getContext = () =>
      new Proxy(
        {},
        {
          get: (_, key) =>
            key.startsWith("create") ? () => ({ addColorStop() {} }) : () => {},
        },
      );
    w.__services = {
      platform: async () => ({
        status: "unavailable",
        copies: [],
        calendars: [],
        granted: [],
      }),
    };
  },
});
const w = dom.window,
  $ = (s) => w.document.querySelector(s),
  all = (s) => [...w.document.querySelectorAll(s)];
const wait = () => new Promise((r) => setTimeout(r, 35));
const check = (ok, message) => {
  assert.ok(ok, message);
  assertions++;
};
const click = (s) => {
  const n = typeof s === "string" ? $(s) : s;
  assert.ok(n, "Missing " + s);
  n.click();
};
const set = (s, value) => {
  $(s).value = String(value);
  $(s).dispatchEvent(new w.Event("change", { bubbles: true }));
};
const key = (node, value) =>
  node.dispatchEvent(
    new w.KeyboardEvent("keydown", {
      key: value,
      bubbles: true,
      cancelable: true,
    }),
  );
const pointer = (node, type, x, y = 10, pointerType = "touch") => {
  const event = new w.Event(type, { bubbles: true, cancelable: true });
  for (const [name, value] of Object.entries({
    pointerId: 3,
    pointerType,
    button: 0,
    clientX: x,
    clientY: y,
  }))
    Object.defineProperty(event, name, { value });
  node.dispatchEvent(event);
};
(async () => {
  try {
    await wait();
    check(!errors.length, "Application initializes");
    w.__qa.showPage("projects");
    check($("#project-list").hidden, "Projects are collapsed initially");
    click("#project-list-toggle");
    check(!$("#project-list").hidden, "Project selector expands");
    const option = all(".project-option")[1],
      name = option.querySelector(".project-option-name").textContent;
    click(option);
    check(
      $("#project-list").hidden &&
        $("#project-selected-name").textContent === name,
      "Selecting a project collapses its list",
    );
    click("#project-list-toggle");
    key($("#project-list-toggle"), "Escape");
    check($("#project-list").hidden, "Escape collapses project selector");
    w.__qa.showPage("life");
    click('[data-life-tab="training"]');
    const state = w.__qa.snapshotData(),
      date = $("#training-plan-date").value;
    const workout = {
      id: w.__qa.createId(),
      trainingKey: "rest-session",
      date,
      name: "Планка и растяжка",
      focus: "Планка и растяжка",
      time: "09:00",
      duration: 30,
      result: "",
      done: false,
      restSeconds: 60,
      restAutomatic: true,
      restSound: true,
      entries: [
        {
          exerciseKey: "timed-plank",
          name: "Планка",
          unit: "мин",
          sets: 3,
          plannedValue: 1,
          value: null,
          done: false,
        },
      ],
    };
    state.exercises.push({
      id: w.__qa.createId(),
      exerciseKey: "timed-plank",
      name: "Планка",
      unit: "мин",
      duration: 1,
    });
    state.workouts.push(workout);
    const other = {
      ...structuredClone(workout),
      id: w.__qa.createId(),
      trainingKey: "other-rest",
      name: "Другое занятие",
      restSeconds: 120,
    };
    state.workouts.push(other);
    w.__qa.training.render();
    check(
      !$(".training-actions .training-timer-icon"),
      "No duplicate global timer",
    );
    check(
      all(".training-workout-summary").every(
        (n) => n.querySelectorAll(".training-timer-icon").length === 1,
      ),
      "Exactly one timer per session heading",
    );
    w.__qa.training.openResults(workout);
    check(
      all("#training-results-dialog .training-timer-icon").length === 1,
      "Results contain one session timer",
    );
    check(
      !$(".training-inline-name .training-timer-icon"),
      "Exercises no longer contain timer buttons",
    );
    click("#training-results-dialog .training-timer-icon");
    click(
      all("#rest-timer-dialog .experience-chip").find(
        (n) => n.textContent === "0:30",
      ),
    );
    check(
      workout.restSeconds === 30 && other.restSeconds === 120,
      "Rest duration belongs to the selected session",
    );
    click("#rest-timer-dialog .close");
    await wait();
    check(
      !$("#training-results-dialog").hidden,
      "Timer returns to results without reopening manually",
    );
    check(
      all("#training-results-dialog .training-set-row").length === 3,
      "Timed exercise exposes three sets",
    );
    click("#training-results-dialog .training-set-row .task-check");
    check(
      workout.entries[0].setResults[0].done &&
        workout.entries[0].setResults[0].value === 1,
      "Timed set is marked in one click",
    );
    check(
      !$(".training-rest").hidden &&
        $(".training-rest .rest-ring-value").textContent === "0:30",
      "Completed set starts the session timer",
    );
    await wait();
    now += 30000;
    ticks.forEach((fn) => fn());
    check(
      sounds.some(
        (s) => !s.muted && s.src === "/sounds/training/rest-ready.wav",
      ),
      "Timer uses its own sound",
    );
    check(
      $(".training-rest [role=status]").textContent === "Можно продолжать",
      "Timer reports completion",
    );
    click(all("#training-results-dialog .training-set-row .task-check")[1]);
    check(
      $(".training-rest .rest-ring-value").textContent === "0:30",
      "Next completed set restarts the same timer",
    );
    click(all("#training-results-dialog .training-set-row .task-check")[2]);
    check(
      workout.done &&
        all(".training-rest").length === 1 &&
        $(".training-rest .rest-ring-value").textContent === "0:30",
      "Last set also starts one timer",
    );
    const goal = {
      kind: "result",
      exerciseKey: "timed-plank",
      unit: "мин",
      calculation: "total",
      baseline: 0,
      target: 3,
      history: [],
    };
    check(
      w.__qa.goalState(goal, [workout]).percent === 100,
      "Completed timed sets advance the linked goal",
    );
    now += 6000;
    ticks.forEach((fn) => fn());
    click(all("#training-results-dialog .training-set-row .task-check")[0]);
    check(
      $(".training-rest .rest-ring-value").textContent === "0:24",
      "Undo does not restart rest",
    );
    click("#training-results-dialog .close");
    w.__qa.training.openWorkout(workout);
    const sets = $(".workout-draft-entries input[id^=entry-sets]");
    check(sets && sets.value === "3", "Timed exercise set count is editable");
    $("#workout-title").value = "Занятие с таймером";
    click(".workout-rest-setting .training-timer-icon");
    click(
      all("#rest-timer-dialog .experience-chip").find(
        (n) => n.textContent === "1:00",
      ),
    );
    check(
      workout.restSeconds === 30,
      "Editing the session timer keeps a draft until Save",
    );
    click("#rest-timer-dialog .close");
    await wait();
    check(
      !$("#training-edit-dialog").hidden &&
        $("#workout-title").value === "Занятие с таймером",
      "Timer returns to editor and preserves unsaved text",
    );
    $("#workout-save-template").checked = true;
    $("#training-edit-dialog form").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    check(
      workout.restSeconds === 60 && workout.entries[0].sets === 3,
      "Saving keeps timer and timed sets",
    );
    const template = state.uiPreferences.workoutTemplates[0];
    check(
      template.restSeconds === 60 && template.entries[0].sets === 3,
      "Saved session preserves its timer and full set plan",
    );
    click(
      all(".training-toolbar button").find(
        (node) => node.textContent === "Мои занятия",
      ),
    );
    click(".training-template-card .button-primary");
    set("#workout-repeat", "interval");
    set("#workout-repeat-days", "4");
    const until = new Date(date + "T12:00:00");
    until.setDate(until.getDate() + 8);
    set("#workout-repeat-until", until.toISOString().slice(0, 10));
    const beforeRepeat = state.workouts.length;
    $("#training-edit-dialog form").dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    );
    const repeated = state.workouts.slice(beforeRepeat);
    check(
      repeated.every(
        (row) => row.seriesKey && row.seriesKey === repeated[0].seriesKey,
      ),
      "Repeated sessions retain one stable series for bulk deletion",
    );
    check(
      repeated.length === 3 &&
        repeated.every(
          (row) => row.restSeconds === 60 && row.entries[0].sets === 3,
        ),
      "Scheduled repeats inherit session timer and timed sets",
    );
    check(
      repeated.every(
        (row) =>
          !row.done &&
          !row.entries[0].setResults &&
          row.entries[0].value === null,
      ),
      "Repeats do not copy completed set results",
    );
    other.restSound = false;
    w.__qa.training.openResults(other);
    click("#training-results-dialog .training-set-row .task-check");
    const audibleBefore = sounds.filter((sound) => !sound.muted).length;
    now += 120000;
    ticks.forEach((fn) => fn());
    check(
      sounds.filter((sound) => !sound.muted).length === audibleBefore,
      "Session sound can be disabled independently",
    );
    click(".training-rest .close");
    other.restAutomatic = false;
    click(all("#training-results-dialog .training-set-row .task-check")[1]);
    check(
      $(".training-rest").hidden,
      "Automatic rest can be disabled for one session",
    );
    click("#training-results-dialog .close");
    const strip = $("#training-days");
    Object.defineProperty(strip, "clientWidth", { value: 300 });
    const geometry = () =>
      all("#training-days .training-day").forEach((n, i) => {
        Object.defineProperty(n, "offsetLeft", {
          get: () => 124 + i * 58,
          configurable: true,
        });
        Object.defineProperty(n, "offsetWidth", {
          value: 52,
          configurable: true,
        });
      });
    geometry();
    w.__qa.training.render();
    const initialDay = $("#training-plan-date").value;
    pointer(strip.firstElementChild, "pointerdown", 210, 10, "mouse");
    pointer(strip, "pointermove", 94, 10, "mouse");
    pointer(strip, "pointerup", 94, 10, "mouse");
    const later = $("#training-plan-date").value;
    check(
      later > initialDay,
      "Dragging dates left with the mouse selects a later day",
    );
    click(strip.firstElementChild);
    check(
      $("#training-plan-date").value === later,
      "Drag does not produce an accidental date click",
    );
    pointer(strip.firstElementChild, "pointerdown", 100, 10, "mouse");
    pointer(strip, "pointermove", 216, 10, "mouse");
    pointer(strip, "pointerup", 216, 10, "mouse");
    check(
      $("#training-plan-date").value === initialDay,
      "Dragging right with the mouse returns to earlier days",
    );
    pointer(strip, "pointerdown", 100);
    pointer(strip, "pointermove", 102, 90);
    pointer(strip, "pointerup", 102, 90);
    check(
      $("#training-plan-date").value === initialDay,
      "Vertical scrolling does not change a training date",
    );
    key(strip, "ArrowRight");
    check(
      $("#training-plan-date").value > initialDay,
      "Keyboard moves between training dates",
    );
    now += 500;
    const edge = strip.lastElementChild,
      edgeDay = edge.dataset.trainingDay;
    click(edge);
    geometry();
    check(
      $("#training-plan-date").value === edgeDay &&
        strip.lastElementChild.dataset.trainingDay > edgeDay,
      "Date strip extends past its initial range",
    );
    w.__qa.validateBackup(w.__qa.makeBackup());
    check(true, "Timer fields and sets survive backup validation");
    const invalid = w.__qa.makeBackup();
    invalid.data.workouts[0].restSeconds = 1;
    assert.throws(() => w.__qa.validateBackup(invalid));
    assertions++;
    check(!errors.length, errors.join("\n"));
    console.log(
      JSON.stringify(
        {
          passed: true,
          assertions,
          scope:
            "DOM, events, controlled timer and sound calls; no physical device or rendered viewport",
        },
        null,
        2,
      ),
    );
  } finally {
    dom.window.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
