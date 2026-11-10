const sourceIncludes = (source, text) =>
  source
    .replace(/\s/g, "")
    .replace(/;}/g, "}")
    .replace(/0\.(\d)/g, ".$1")
    .includes(
      text
        .replace(/\s/g, "")
        .replace(/;}/g, "}")
        .replace(/0\.(\d)/g, ".$1"),
    );
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const source = require("./fixture.cjs")();
const html = source.replace(
  "    })();",
  "      window.__qa={snapshotData,makeBackup,validateBackup,statisticsCsv,renderLifeInsights,readRepeat,tasks,renderTasks};\n    })();",
);
const windows = [];
let assertions = 0;
const check = (value, message) => {
    assert.ok(value, message);
    assertions++;
  },
  pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function runtime(state) {
  const errors = [],
    snapshots = [],
    downloads = [],
    vc = new VirtualConsole();
  vc.on("jsdomError", (error) => {
    if (!error.message.includes("Could not parse CSS stylesheet"))
      errors.push(error.message);
  });
  const now = Date.UTC(2026, 9, 1, 12);
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
        setWidgetState: async (snapshot) =>
          snapshots.push(JSON.parse(JSON.stringify(snapshot))),
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
      window.URL.createObjectURL = (blob) => {
        downloads.push(blob);
        return "blob:qa";
      };
      window.URL.revokeObjectURL = () => {};
      window.HTMLAnchorElement.prototype.click = function () {};
    },
  });
  windows.push(dom.window);
  const $ = (selector) => dom.window.document.querySelector(selector),
    all = (selector) => [...dom.window.document.querySelectorAll(selector)],
    click = (selector) => {
      const node = typeof selector === "string" ? $(selector) : selector;
      assert.ok(node, "Missing target " + selector);
      node.click();
    },
    set = (selector, value, event) => {
      const node = $(selector);
      if (node.type === "checkbox") node.checked = Boolean(value);
      else node.value = String(value);
      node.dispatchEvent(
        new dom.window.Event(
          event ||
            (node.type === "checkbox" || node.tagName === "SELECT"
              ? "change"
              : "input"),
          { bubbles: true },
        ),
      );
    };
  return {
    window: dom.window,
    $,
    all,
    click,
    set,
    submit(selector) {
      click(selector + ' button[type="submit"]');
    },
    errors,
    snapshots,
    downloads,
    qa: dom.window.__qa,
    visible(selector) {
      return !$(selector).closest("[hidden]");
    },
    pointer(node, type, x, y) {
      const event = new dom.window.Event(type, {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperties(event, {
        clientX: { value: x },
        clientY: { value: y },
        button: { value: 0 },
        pointerId: { value: 1 },
        pointerType: { value: "mouse" },
      });
      node.dispatchEvent(event);
    },
  };
}
(async () => {
  try {
    const r = runtime(),
      { $, all, click, set, submit, qa } = r,
      date = qa.snapshotData().selectedDate;
    check(r.errors.length === 0, "Startup without errors");
    check(
      sourceIncludes(source, '[data-page="wins"],') &&
        sourceIncludes(source, ".task-win,#life-os-workspace .win-toggle"),
      "Achievements removed from visible navigation and task actions",
    );
    const count = qa.snapshotData().tasks.length;
    click("#task-add");
    set("#capture-text", "Прогулка");
    set("#capture-description", "Спокойный маршрут у дома");
    set("#capture-duration", 45);
    set("#capture-repeat", "weekly");
    set("#capture-repeat-until", date.slice(0, 8) + "29");
    set("#capture-save-template", true);
    submit("#capture-form");
    const repeated = qa
      .snapshotData()
      .tasks.filter((task) => task.title === "Прогулка");
    check(
      repeated.length === 5,
      "Weekly repeat creates five explicit occurrences through end date",
    );
    check(
      repeated.every(
        (task) =>
          task.description === "Спокойный маршрут у дома" &&
          task.duration === 45,
      ),
      "Repeat preserves description and duration",
    );
    check(
      new Set(repeated.map((task) => task.id)).size === 5 &&
        new Set(repeated.map((task) => task.seriesId)).size === 1,
      "Unique IDs and one series identity",
    );
    check(
      qa.snapshotData().taskTemplates.length === 1,
      "Custom task template saved",
    );
    click("#templates-open");
    check(
      all(".template-option").length === 3,
      "Two example templates and saved template visible",
    );
    const saved = all(".template-option").find(
      (node) => node.querySelector("strong").textContent === "Прогулка",
    );
    click(saved.querySelector("button"));
    check(
      qa.snapshotData().tasks.length === count + 6,
      "Saved template creates one task on selected date",
    );
    click("#templates-open");
    click(all(".template-option")[0].querySelector("button"));
    check(
      qa.snapshotData().tasks.length === count + 9,
      "Trip template creates three separate tasks",
    );
    click("#event-open");
    set("#event-name", "Тест ежедневного повтора");
    set("#event-start", "10:00");
    set("#event-end", "10:30");
    set("#event-repeat", "daily");
    set("#event-repeat-until", date.slice(0, 8) + "03");
    submit("#event-form");
    check(
      qa
        .snapshotData()
        .events.filter((item) => item.title === "Тест ежедневного повтора")
        .length === 3,
      "Daily events generated inclusively",
    );
    $("#life-os-workspace").getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      right: 1024,
      bottom: 900,
      width: 1024,
      height: 900,
    });
    $("#timeline-window").getBoundingClientRect = () => ({
      left: 100,
      top: 100,
      right: 550,
      bottom: 316,
      width: 450,
      height: 216,
    });
    $("#timeline").getBoundingClientRect = () => ({ height: 864 });
    Object.defineProperty($("#timeline-window"), "clientHeight", {
      configurable: true,
      value: 216,
    });
    const timedTask = qa.tasks.find((item) => item.title === "Прогулка");
    timedTask.time = "08:00";
    qa.renderTasks();
    const taskRow = all("#task-list .task").find((node) =>
        node.textContent.includes("Прогулка"),
      ),
      taskId = Number(taskRow.dataset.taskId),
      beforeDrag = qa.snapshotData().events.length;
    r.pointer(taskRow.querySelector(".task-drag"), "pointerdown", 750, 180);
    r.pointer(r.window, "pointermove", 300, 190);
    check($(".calendar-drop-preview"), "Drop preview visible");
    r.pointer(r.window, "pointerup", 300, 190);
    check(
      qa.snapshotData().events.length === beforeDrag + 1 &&
        !qa.snapshotData().tasks.some((item) => item.id === taskId),
      "Drop converts one task into one scheduled event",
    );
    const scheduled = qa.snapshotData().events.at(-1);
    check(
      scheduled.description === "Спокойный маршрут у дома" &&
        scheduled.duration === 45,
      "Drag preserves task description and duration",
    );
    let eventNode = $('[data-event-id="' + scheduled.id + '"]');
    const oldStart = scheduled.start;
    r.pointer(eventNode.querySelector(".event-grip"), "pointerdown", 300, 160);
    r.pointer(r.window, "pointermove", 300, 190);
    r.pointer(r.window, "pointerup", 300, 190);
    check(
      scheduled.start !== oldStart && scheduled.duration === 45,
      "Dragging event shifts time without changing duration",
    );
    eventNode = $('[data-event-id="' + scheduled.id + '"]');
    r.pointer(
      eventNode.querySelector(".event-resize"),
      "pointerdown",
      300,
      160,
    );
    r.pointer(r.window, "pointermove", 300, 190);
    r.pointer(r.window, "pointerup", 300, 190);
    check(
      scheduled.duration === 95,
      "Resize adjusts duration in five-minute increments",
    );
    const rowsBefore = qa.snapshotData().tasks.length,
      another = $("#task-list .task");
    r.pointer(another.querySelector(".task-drag"), "pointerdown", 750, 170);
    r.pointer(r.window, "pointermove", 720, 190);
    r.pointer(r.window, "pointerup", 720, 190);
    check(
      qa.snapshotData().tasks.length === rowsBefore,
      "Dropping outside calendar keeps task",
    );
    click('[data-page="life"]');
    click('[data-life-tab="food"]');
    set("#food-name", "Мой завтрак");
    set("#food-calories", 450);
    set("#food-protein", 25);
    set("#food-fat", 15);
    set("#food-carbs", 50);
    set("#food-save-meal", true);
    submit("#food-form");
    check(
      qa.snapshotData().savedMeals.length === 1 &&
        qa.snapshotData().foodLogs.length === 1,
      "Food entry saved as reusable meal",
    );
    click("#saved-meals-open");
    click("[data-meal-add]");
    check(
      qa.snapshotData().foodLogs.length === 2 &&
        $("#food-day-total").textContent.includes("900"),
      "One click adds exact meal portion",
    );
    check(
      qa.snapshotData().foodLogs.at(-1).protein === 25 &&
        qa.snapshotData().foodLogs.at(-1).carbs === 50,
      "Saved portion restores macros",
    );
    click("#saved-meals-open");
    click('.saved-meal [aria-label^="Изменить"]');
    set("#food-calories", 500);
    submit("#food-form");
    check(
      qa.snapshotData().savedMeals[0].calories === 500 &&
        qa.snapshotData().foodLogs.length === 2,
      "Editing recipe does not log an extra portion",
    );
    click("#saved-meals-open");
    click("[data-meal-add]");
    check(
      $("#food-day-total").textContent.includes("1400"),
      "Updated recipe used for later portions",
    );
    set("#food-day", date.slice(0, 8) + "02", "change");
    click("#saved-meals-open");
    click("[data-meal-add]");
    check(
      qa.snapshotData().foodLogs.at(-1).date.endsWith("-02"),
      "Meal added to chosen day",
    );
    const data = JSON.parse(JSON.stringify(qa.snapshotData()));
    data.activePage = "life";
    data.lifeTab = "mood";
    data.lifeDetailOpen = true;
    data.selectedLifeDay = date;
    data.checkins = [];
    data.sleepLogs = [];
    for (let day = 1; day <= 6; day++) {
      data.checkins.push({
        at: Date.UTC(2026, 9, day, 8),
        mood: 3,
        energy: day % 2 ? 2 : 4,
        stress: 3,
        note: "",
      });
      data.sleepLogs.push({
        date: date.slice(0, 8) + String(day).padStart(2, "0"),
        hours: day % 2 ? 6 : 8,
        quality: null,
        note: "",
      });
    }
    const insight = runtime(data);
    check(
      insight
        .all(".insight-value")
        .map((node) => node.textContent)
        .join("|") === "4.0 / 5|2.0 / 5",
      "Sleep comparison uses matched daily energy averages",
    );
    check(
      insight.$("#insight-result").textContent.includes("по 6 дням"),
      "Comparison shows sample size",
    );
    check(insight.all(".insight-date").length === 6, "Source days available");
    insight.$("#life-insights").open = true;
    insight.$(".insight-dates").open = true;
    insight.click(".insight-date");
    check(
      insight.$("#life-day-detail").textContent.includes("ч"),
      "Comparison date opens its day details",
    );
    insight.set("#insight-question", "training");
    check(
      insight.$("#insight-result").textContent.includes("Отсутствие записи"),
      "Missing workout logs not treated as proven inactivity",
    );
    insight.set("#insight-question", "load");
    check(
      insight.$("#insight-result").textContent.includes("Запланировано"),
      "Schedule load comparison available",
    );
    const backup = JSON.parse(JSON.stringify(qa.makeBackup()));
    check(
      qa.validateBackup(backup).data.version === 32,
      "Own complete backup validates",
    );
    const broken = JSON.parse(JSON.stringify(backup));
    broken.data.savedMeals[0].calories = "abc";
    assert.throws(() => qa.validateBackup(broken));
    assertions++;
    const malicious = JSON.parse(JSON.stringify(backup));
    malicious.covers = [[1, "data:image/svg+xml;base64,abc"]];
    assert.throws(() => qa.validateBackup(malicious));
    assertions++;
    click('[data-open="settings-dialog"]');
    click('[data-settings-tab="data"]');
    click("#backup-download");
    click("#export-csv");
    check(
      r.downloads.length === 2,
      "Backup and CSV generate downloadable files",
    );
    check(
      JSON.parse(await r.downloads[0].text()).data.savedMeals.length === 1,
      "Backup includes reusable meals",
    );
    const csvBytes = new Uint8Array(await r.downloads[1].arrayBuffer());
    check(
      csvBytes[0] === 239 &&
        csvBytes[1] === 187 &&
        csvBytes[2] === 191 &&
        (await r.downloads[1].text()).startsWith('"Тип";'),
      "CSV has UTF-8 BOM and Excel delimiter",
    );
    check(
      qa.statisticsCsv().includes('"Питание"') &&
        qa.statisticsCsv().includes('"Самочувствие"') === false,
      "CSV exports present data categories",
    );
    const importData = JSON.parse(JSON.stringify(backup));
    importData.data.tasks[0].title = "Восстановленная задача";
    const file = new r.window.File(
      [JSON.stringify(importData)],
      "backup.json",
      { type: "application/json" },
    );
    Object.defineProperty($("#backup-file"), "files", {
      configurable: true,
      value: [file],
    });
    $("#backup-file").dispatchEvent(
      new r.window.Event("change", { bubbles: true }),
    );
    const importDeadline = performance.now() + 10000;
    while ($("#backup-preview").hidden && performance.now() < importDeadline) {
      await pause(25);
    }
    check(
      !$("#backup-preview").hidden,
      "Validated import waits for Restore button",
    );
    check(
      !qa
        .snapshotData()
        .tasks.some((item) => item.title === "Восстановленная задача"),
      "Import preview does not overwrite data",
    );
    click("#backup-preview button");
    check(
      qa.snapshotData().tasks[0].title === "Восстановленная задача",
      "Restore applies imported records",
    );
    click("#backup-undo");
    check(
      qa.snapshotData().tasks[0].title !== "Восстановленная задача",
      "Undo restores earlier data",
    );
    qa.snapshotData().tasks[0].title = '=HYPERLINK("bad")';
    check(
      qa.statisticsCsv().includes("'=HYPERLINK"),
      "CSV escapes formula-like text",
    );
    await pause(450);
    check(
      r.snapshots.at(-1).privateContent.version === 32,
      "Current state format persists",
    );
    check(
      r.snapshots.at(-1).privateContent.savedMeals.length === 1,
      "Saved meals persist",
    );
    const stressData = JSON.parse(JSON.stringify(qa.snapshotData()));
    stressData.activePage = "home";
    stressData.selectedDate = date;
    stressData.tasks = Array.from({ length: 100 }, (_, index) => ({
      id: 1000 + index,
      title: "Задача " + index,
      context: "Личное",
      date,
      done: false,
      description: "Описание " + index,
      duration: 30,
    }));
    stressData.events = Array.from({ length: 100 }, (_, index) => ({
      id: 2000 + index,
      title: "Событие " + index,
      context: "Личное",
      date,
      start: "10:00",
      end: "11:00",
      tone: "pine",
    }));
    const start = performance.now(),
      stress = runtime(stressData),
      elapsed = performance.now() - start;
    check(
      stress.all('#task-list .task[data-kind="task"]').length === 100 &&
        stress.all('#task-list .task[data-kind="event"]').length === 100,
      "One hundred tasks and one hundred appointments remain inside the list",
    );
    check(
      stress.$(".event-cluster").dataset.clusterCount === "98",
      "One hundred overlaps use bounded visible lanes",
    );
    check(
      stress.errors.length === 0 &&
        r.errors.length === 0 &&
        insight.errors.length === 0,
      "No runtime errors after feature interactions and stress data",
    );
    [...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].forEach(
      (match) => new Function(match[1]),
    );
    check(true, "JavaScript syntax valid");
    const report = {
      passed: true,
      assertions,
      stress_render_ms: Math.round(elapsed),
      checked: [
        "task descriptions",
        "daily and weekly repeats",
        "built-in and custom templates",
        "task drop",
        "event move and resize",
        "saved meal edits and portions",
        "matched daily comparisons",
        "backup import preview and undo",
        "CSV escaping",
        "100 tasks and overlapping events",
        "state persistence",
      ],
      scope:
        "DOM and event logic with mocked drag rectangles; browser layout and actual touch not measured",
    };
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    windows.forEach((window) => window.close());
  }
})();
