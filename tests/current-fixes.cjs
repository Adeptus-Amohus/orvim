const assert = require("node:assert/strict"),
  { JSDOM, VirtualConsole } = require("jsdom");
const source = require("./fixture.cjs")().replace(
  "    })();",
  "window.__qa={snapshotData,training,renderTasks,renderFood,showPage,createId:()=>nextId++,validateBackup,makeBackup};    })();",
);
const errors = [],
  requests = [],
  vc = new VirtualConsole();
vc.on("jsdomError", (e) => {
  if (!e.message.includes("CSS")) errors.push(e.message);
});
let answer = { message: "Предлагаю оценку", changes: [] },
  checks = 0;
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
    w.confirm = () => true;
    w.__services = {
      mobile: true,
      credential: async () => ({ configured: true }),
      request: async (args) => {
        requests.push(args);
        return answer;
      },
      platform: async () => ({
        status: "unavailable",
        granted: [],
        copies: [],
        calendars: [],
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
const check = (v, label) => {
  assert.ok(v, label);
  checks++;
};
const click = (s) => {
  const n = typeof s === "string" ? $(s) : s;
  assert.ok(n, "Missing " + s);
  n.click();
};
const set = (s, value) => {
  $(s).value = value;
  $(s).dispatchEvent(new w.Event("change", { bubbles: true }));
};
const submit = (s) =>
  $(s).dispatchEvent(
    new w.Event("submit", { bubbles: true, cancelable: true }),
  );
(async () => {
  try {
    await wait();
    check(!errors.length, "Application initializes");
    const data = w.__qa.snapshotData(),
      date = data.selectedDate;
    const entries = Array.from({ length: 7 }, (_, i) => ({
      exerciseKey: "exercise-" + i,
      name: "Упражнение " + i,
      unit: "раз",
      sets: 3,
      plannedValue: 5,
      value: null,
      done: false,
    }));
    entries.forEach((e) =>
      data.exercises.push({
        id: w.__qa.createId(),
        exerciseKey: e.exerciseKey,
        name: e.name,
        unit: "раз",
        duration: 5,
      }),
    );
    for (let i = 0; i < 200; i++) {
      const day = new w.Date(date + "T12:00:00");
      day.setDate(day.getDate() + i);
      const dateValue =
        day.getFullYear() +
        "-" +
        String(day.getMonth() + 1).padStart(2, "0") +
        "-" +
        String(day.getDate()).padStart(2, "0");
      const workout = {
        id: w.__qa.createId(),
        trainingKey: "session-" + i,
        seriesKey: "series-a",
        name: "Силовая",
        focus: "Силовая",
        date: dateValue,
        time: "17:00",
        duration: 30,
        done: i === 2,
        result: "",
        entries: structuredClone(entries),
      };
      data.workouts.push(workout);
      data.events.push({
        id: w.__qa.createId(),
        workoutId: workout.id,
        title: workout.name,
        date: dateValue,
        start: "17:00",
        end: "17:30",
        tone: "pine",
        context: "Личное",
        done: workout.done,
      });
    }
    w.__qa.training.render();
    w.__qa.renderTasks();
    const home =
      $("#task-list .training-home-session") ||
      $(".tasks .training-home-session");
    check(
      home && !home.querySelector("details,input"),
      "Home session does not expand exercise controls inline",
    );
    check(
      home.textContent.includes("0 / 7") &&
        !home.textContent.includes("Упражнение 0"),
      "Home displays compact progress for all seven exercises",
    );
    click(home.querySelector(".training-home-results"));
    check(
      !$("#training-results-dialog").hidden,
      "Compact home session opens results dialog",
    );
    check(
      all("#training-results-dialog [data-training-entry-key]").length === 7,
      "All seven exercises are reachable in full results",
    );
    click(
      all("#training-results-dialog button").find(
        (n) => n.textContent === "Удалить несколько занятий…",
      ),
    );
    await wait();
    check(
      !$("#training-batch-delete-dialog").hidden,
      "Bulk deletion opens from schedule/home workout results",
    );
    check(
      !$("#training-batch-include-done").checked &&
        $("#training-batch-delete-dialog button[type=submit]").disabled,
      "Completed sessions and unselected deletion are protected by default",
    );
    check(
      $("#training-batch-delete-dialog").textContent.includes("Найдено: 199"),
      "Bulk selector finds the entire 200-day series beyond current month",
    );
    check(
      all("[data-batch-workout]").length === 100,
      "Large selection list initially renders only 100 rows",
    );
    click(
      all("#training-batch-delete-dialog button").find((n) =>
        n.textContent.startsWith("Выбрать все ·"),
      ),
    );
    check(
      $(
        "#training-batch-delete-dialog button[type=submit]",
      ).textContent.includes("199"),
      "Select all includes offscreen candidates explicitly",
    );
    submit("#training-batch-delete-dialog form");
    check(
      data.workouts.length === 1 &&
        data.workouts[0].done &&
        !data.events.some(
          (e) => e.workoutId && e.workoutId !== data.workouts[0].id,
        ),
      "Bulk removal preserves completed session and deletes all selected linked events",
    );
    click($(".global-notice button"));
    check(
      data.workouts.length === 200 &&
        data.events.filter((e) => e.workoutId).length === 200,
      "UI undo restores the full series and events",
    );
    data.connectionSettings.aiProvider = "deepseek";
    data.connectionSettings.aiModel = "test-model";
    data.archiveItems.push({
      id: w.__qa.createId(),
      name: "Камо грядеши",
      category: "Книги",
      rating: null,
      review: "",
      date,
    });
    if (!data.archiveCategories.includes("Книги"))
      data.archiveCategories.push("Книги");
    const book = data.archiveItems.at(-1);
    answer = {
      message: "Предлагаю оценку 5",
      changes: [
        {
          operation: "upsert",
          collection: "archiveItems",
          id: book.id,
          data: '{"rating":5}',
        },
      ],
    };
    click(".ai-open");
    check(
      $("#ai-context-summary").textContent === "Без записей Orvim" &&
        $("#ai-context-open"),
      "Chat explains empty access through one context entry",
    );
    click("#ai-context-open");
    click('[data-ai-source="archiveItems"]');
    click(`#ai-context-items input[value="${book._syncId ?? book.id}"]`);
    click("#ai-context-done");
    check(
      !requests.length && book.rating === null,
      "Manual context selection does not send or apply changes",
    );
    set("#ai-prompt", "Поставь оценку камо грядеши 5");
    submit("#ai-dialog-form");
    await wait();
    await wait();
    check(
      requests.length === 1 &&
        !$("#ai-context-suggestion") &&
        requests[0].context.archiveItems[0].name === book.name &&
        requests[0].context.archiveItems[0].id === book.id,
      "Explicit attach sends actual database record identity",
    );
    check(
      !requests[0].context.foodLogs && !requests[0].context.tasks,
      "Unselected nutrition and tasks remain private",
    );
    check(
      book.rating === null && $("#ai-changes"),
      "Rating remains a preview until confirmation",
    );
    click(
      all("#ai-changes button").find(
        (n) => n.textContent === "Применить изменения",
      ),
    );
    await wait();
    check(
      w.__qa.snapshotData().archiveItems.find((r) => r.id === book.id)
        .rating === 5,
      "Confirmed AI rating updates existing database record",
    );
    click("#ai-context-open");
    click("[data-ai-source=archiveItems]");
    check(
      !$("#ai-context-panel").hidden &&
        $("#ai-context-kind").value === "archiveItems" &&
        $("[data-ai-source=archiveItems]").getAttribute("aria-pressed") ===
          "true",
      "Unified context opens the database source picker",
    );
    click("#ai-context-back");
    click("#ai-dialog-form .close");
    const food = {
      id: w.__qa.createId(),
      name: "Лишний завтрак",
      date,
      calories: 600,
      protein: 20,
      fat: 10,
      carbs: 100,
    };
    w.__qa.snapshotData().foodLogs.push(food);
    set("#food-day", date);
    w.__qa.renderFood();
    click(all(".food-log-copy").find((n) => n.textContent.includes(food.name)));
    check(
      $("#food-edit-delete") && !$("#food-edit-dialog").hidden,
      "Nutrition editor has an explicit delete action",
    );
    click("#food-edit-delete");
    check(
      !w.__qa.snapshotData().foodLogs.some((r) => r.id === food.id),
      "Deleting a meal removes its logged calories",
    );
    click($(".global-notice button"));
    check(
      w.__qa.snapshotData().foodLogs.some((r) => r.id === food.id),
      "Meal deletion is undoable",
    );
    check(!errors.length, "No uncaught DOM errors");
    console.log(
      JSON.stringify(
        {
          passed: true,
          checks,
          sessions: 200,
          scope:
            "DOM/events with simulated device services; rendered layout and real microphone not verified",
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
