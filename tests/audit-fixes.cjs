const assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const source = require("./fixture.cjs")().replace(
  "    })();",
  "window.__audit={snapshotData,training,showPage};    })();",
);
const intervals = [],
  errors = [],
  requests = [],
  cancelled = [],
  replies = [];
let saves = 0,
  checks = 0;
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
    w.setInterval = (fn, ms) => {
      intervals.push({ fn, ms });
      return intervals.length;
    };
    w.clearInterval = () => {};
    w.__services = {
      mobile: true,
      persist: () => saves++,
      flush: async () => {},
      credential: async () => ({ configured: true }),
      request: (args) => {
        requests.push(args);
        return new Promise((resolve) => replies.push(resolve));
      },
      cancelRequest: async (id) => cancelled.push(id),
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
            String(key).startsWith("create")
              ? () => ({ addColorStop() {} })
              : () => {},
        },
      );
  },
});
const w = dom.window,
  $ = (s) => w.document.querySelector(s),
  all = (s) => [...w.document.querySelectorAll(s)];
const wait = (ms = 25) => new Promise((resolve) => setTimeout(resolve, ms));
const check = (value, label) => {
  assert.ok(value, label);
  checks++;
};
const set = (selector, value, type = "change") => {
  $(selector).value = value;
  $(selector).dispatchEvent(new w.Event(type, { bubbles: true }));
};
(async () => {
  try {
    await wait();
    check(!errors.length, "App starts without errors");
    const data = w.__audit.snapshotData(),
      day = data.selectedDate;
    data.exercises.push({
      id: 700,
      exerciseKey: "audit-pull",
      name: "Подтягивания",
      unit: "раз",
      duration: 10,
    });
    data.workouts.push({
      id: 701,
      trainingKey: "audit-session",
      name: "Проверка",
      date: day,
      time: "12:00",
      duration: 30,
      done: false,
      entries: [
        {
          exerciseKey: "audit-pull",
          name: "Подтягивания",
          unit: "раз",
          sets: 2,
          plannedValue: 5,
          value: null,
          done: false,
        },
      ],
    });
    w.__audit.showPage("life");
    $('[data-life-tab="training"]').click();
    await wait();
    const details = $(".training-workout-details");
    details.open = true;
    details.dispatchEvent(new w.Event("toggle"));
    await wait();
    const input = $(".training-workout-body input[type=number]");
    input.focus();
    input.value = "17";
    input.dispatchEvent(new w.Event("input", { bubbles: true }));
    intervals.find((timer) => timer.ms === 60000).fn();
    await wait();
    check(
      input.isConnected &&
        w.document.activeElement === input &&
        input.value === "17",
      "Minute refresh retains original input, focus and unfinished value",
    );
    check(
      $(".training-plan").compareDocumentPosition($(".training-goals")) & 4,
      "Training plan precedes goals",
    );
    w.__audit.showPage("home");
    $(".ai-open").click();
    await wait();
    const before = saves;
    for (let i = 0; i < 20; i++) set("#ai-prompt", "а".repeat(i + 1), "input");
    await wait(50);
    check(saves === before, "Typing does not persist on each character");
    await wait(450);
    check(saves === before + 1, "Burst of input persists once after a pause");
    set("#ai-prompt", "Последний ввод", "input");
    $("#ai-prompt").dispatchEvent(new w.Event("blur"));
    check(
      saves === before + 2 && data.uiPreferences.aiDraft === "Последний ввод",
      "Blur flushes final draft",
    );
    data.connectionSettings.aiModel = "test-model";
    set("#ai-prompt", "Сколько шагов с 12 по 18 октября?", "input");
    check(
      $("#ai-period-from").value.endsWith("-10-12") &&
        $("#ai-period-until").value.endsWith("-10-18"),
      "Inferred period is visible before sending",
    );
    set("#ai-period-from", day);
    set("#ai-period-until", day);
    check(
      !requests.length &&
        !$("#ai-context-suggestion") &&
        $("#ai-context-summary").textContent === "Без записей Orvim",
      "Imported preferences cannot authorize context sharing",
    );
    $("#ai-context-open").click();
    $('[data-ai-source="lifeData"]').click();
    $('#ai-context-items input[value="*"]').click();
    $("#ai-context-done").click();
    $("#ai-dialog-form").requestSubmit();
    await wait();
    check(
      requests.length === 1 &&
        requests[0].context.lifeSummary.period.from === day,
      "Manual period controls actual request context",
    );
    check(
      $("#ai-send").type === "button" && !$("#ai-send").disabled,
      "Waiting exposes an enabled Stop action",
    );
    $("#ai-send").click();
    await wait();
    check(
      cancelled[0] === requests[0].requestId && !$("#ai-waiting"),
      "Stop cancels matching native request and removes waiting state",
    );
    set("#ai-prompt", "Новое сообщение", "input");
    $("#ai-dialog-form").requestSubmit();
    await wait();
    check(requests.length === 2, "A new request can start after cancellation");
    replies[0]({ message: "Отменённый ответ", changes: [] });
    await wait();
    check(
      !$("#ai-messages").textContent.includes("Отменённый ответ") &&
        $("#ai-send").type === "button",
      "Late cancelled answer neither appears nor clears newer request",
    );
    replies[1]({ message: "Актуальный ответ", changes: [] });
    await wait();
    check(
      $("#ai-messages").textContent.includes("Актуальный ответ") &&
        $("#ai-send").type === "submit",
      "New response completes normally",
    );
    set("#ai-prompt", "Сколько шагов с 31 по 32 февраля?", "input");
    $("#ai-dialog-form").requestSubmit();
    await wait();
    check(
      requests.length === 2 && !$("#ai-status").hidden,
      "Malformed period cannot send an unbounded request",
    );
    $("#ai-dialog .close").click();
    data.tasks.splice(
      0,
      data.tasks.length,
      ...Array.from({ length: 201 }, (_, i) => ({
        id: 10000 + i,
        title: "Задача " + i,
        context: "Дом",
        date: i === 200 ? "" : day,
        done: false,
      })),
    );
    data.events.splice(0);
    $("#all-tasks-open").click();
    check(
      all(".all-task-row").length === 200,
      "All tasks starts with a bounded page",
    );
    all("#all-tasks-dialog button")
      .find((node) => node.textContent === "Показать ещё")
      .click();
    check(
      all(".all-task-row").length === 201,
      "Task 201 is accessible without knowing its title",
    );
    const filter = $('[aria-label="Фильтр задач"]');
    filter.value = "undated";
    filter.dispatchEvent(new w.Event("change"));
    check(
      all(".all-task-row").length === 1 &&
        $(".all-task-row").textContent.includes("Задача 200"),
      "Undated task filter works beyond first page",
    );
    $("#all-tasks-dialog .close").click();
    data.uiPreferences.financeAccounts = [
      {
        key: "a",
        name: "Основной",
        currency: "KZT",
        from: day.slice(0, 4) + "-01-01",
      },
    ];
    data.financeLogs.splice(
      0,
      data.financeLogs.length,
      {
        id: 9001,
        date: day.slice(0, 4) + "-01-01",
        type: "income",
        amount: 100,
        currency: "KZT",
        accountKey: "a",
        category: "Доход",
      },
      {
        id: 9002,
        date: day,
        type: "expense",
        amount: 20,
        currency: "KZT",
        accountKey: "a",
        category: "Еда",
      },
    );
    w.__audit.showPage("life");
    $('[data-life-tab="finances"]').click();
    set("#finance-period-mode", "year");
    check(
      all(".finance-year-month").length === 12 &&
        $(".finance-total[data-type=income] strong").textContent.includes(
          "100",
        ),
      "Annual finances include earlier months and twelve chart points",
    );
    check(
      $(".finance-breakdown h3").textContent === "Расходы по категориям" &&
        $("#finance-record-title").textContent === "Записи года",
      "Period labels do not overwrite category heading",
    );
    $(".finance-year-month").click();
    check(
      $("#finance-period-mode").value === "month" &&
        $("#finance-month").value.endsWith("-01"),
      "Annual chart opens selected month's operations",
    );
    check(
      $("#sleep-form")
        .closest("section")
        .parentElement.firstElementChild.contains($("#sleep-form")),
      "Sleep entry precedes map",
    );
    check(
      $("#food-form")
        .closest("section")
        .parentElement.firstElementChild.contains($("#food-form")),
      "Food entry precedes history",
    );
    check(
      all(".settings-disclosure").length >= 5 &&
        all(".settings-disclosure").every((node) => !node.open),
      "Data settings start as compact closed sections",
    );
    check(!errors.length, JSON.stringify(errors));
    console.log(
      JSON.stringify({
        passed: true,
        checks,
        scope:
          "DOM, timers and mocked AI/native bridge; no physical device or live provider",
      }),
    );
  } finally {
    dom.window.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
