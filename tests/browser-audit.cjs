const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const out = ".artifacts/ui-audit";
fs.mkdirSync(out, { recursive: true });
const report = {
  checks: 0,
  errors: [],
  failures: [],
  layouts: [],
  scroll: [],
  scope:
    "Isolated Chrome, desktop and mobile viewports; native services mocked; no physical Android",
};
let browser;
const check = (condition, label) => {
  assert.ok(condition, label);
  report.checks++;
};
async function scenario(label, run) {
  try {
    await run();
    console.log("PASS " + label);
  } catch (error) {
    report.failures.push({ label, error: error.message });
    console.log("FAIL " + label + ": " + error.message);
  }
}
(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  page.setDefaultTimeout(4000);
  page.on("pageerror", (error) => {
    report.errors.push(error.stack || error.message);
    console.log("RUNTIME " + (error.stack || error.message));
  });
  await page.goto("http://127.0.0.1:5180/tests/browser-harness.html");
  await page.locator("#all-tasks-open").waitFor();
  const seed = await page.evaluate(() => {
    const snap = structuredClone(testRuntime.snapshot()),
      d = snap.data,
      day = testDay;
    d.version = 31;
    d.nextId = 10000;
    d.activePage = "home";
    d.projects = [
      {
        id: 1,
        name: "Проект с материалами",
        description: "Проверка этапов и задач",
        tone: "pine",
      },
    ];
    d.tasks = Array.from({ length: 12 }, (_, i) => ({
      id: 10 + i,
      title: i === 0 ? "Проверить задачу" : "Обычная задача " + i,
      description:
        i === 1 ? "Длинное описание для проверки переносов ".repeat(5) : "",
      context: d.projects[0].name,
      date: day,
      time: "09:00",
      done: false,
      status: i % 2 ? "active" : "next",
    }));
    d.exercises = [
      {
        id: 100,
        exerciseKey: "pull",
        name: "Подтягивания",
        unit: "раз",
        duration: 15,
      },
      {
        id: 101,
        exerciseKey: "press",
        name: "Жим с очень длинным названием упражнения",
        unit: "кг",
        duration: 15,
      },
    ];
    d.trainingGoals = [
      {
        id: 102,
        goalKey: "pull-goal",
        name: "20 подтягиваний",
        kind: "result",
        exerciseKey: "pull",
        unit: "раз",
        calculation: "latest",
        target: 20,
        baseline: 0,
        current: 0,
        history: [],
      },
    ];
    d.workouts = [
      {
        id: 103,
        trainingKey: "workout-demo",
        name: "Тренировка",
        date: day,
        time: "08:00",
        duration: 30,
        done: false,
        entries: [
          {
            exerciseKey: "pull",
            name: "Подтягивания",
            unit: "раз",
            plannedValue: 12,
            value: null,
            sets: 1,
            done: false,
          },
          {
            exerciseKey: "press",
            name: d.exercises[1].name,
            unit: "кг",
            plannedValue: 24,
            value: null,
            sets: 1,
            done: false,
          },
        ],
      },
    ];
    d.events = [
      {
        id: 104,
        title: "Тренировка",
        workoutId: 103,
        date: day,
        start: "08:00",
        end: "08:30",
        done: false,
        context: "Личное",
        tone: "pine",
      },
      {
        id: 105,
        title: "Встреча",
        date: day,
        start: "09:30",
        end: "10:30",
        done: false,
        context: d.projects[0].name,
        tone: "sun",
      },
    ];
    d.financeLogs = Array.from({ length: 40 }, (_, i) => ({
      id: 200 + i,
      date: day,
      type: i % 3 ? "expense" : "income",
      amount: i % 3 ? 1200 : 9000,
      currency: "KZT",
      category: i % 3 ? "Еда" : "Работа",
      note: "Операция " + i,
    }));
    d.financeCategories = Array.from({ length: 45 }, (_, i) => ({
      name: i < 2 ? ["Еда", "Работа"][i] : "Категория " + i,
      color: ["#31936b", "#ac7e47", "#678abb"][i % 3],
    }));
    d.thoughts = [
      {
        id: 300,
        title: "Мысль для проекта",
        body: "Материалы и длинное содержание ".repeat(12),
        date: day,
        context: "Личное",
        pinned: true,
      },
    ];
    d.archiveItems = [
      {
        id: 400,
        name: "Книга с длинным названием",
        category: "Книги",
        date: day,
        rating: 4.5,
        review: "Тестовая заметка",
        status: "Прочитано",
      },
    ];
    d.sleepLogs = [
      { date: day, hours: 7.5, quality: 4, note: "Спал нормально" },
    ];
    d.foodLogs = [
      {
        id: 500,
        date: day,
        name: "Завтрак",
        calories: 500,
        protein: 25,
        fat: 20,
        carbs: 50,
      },
    ];
    d.waterLogs = [{ date: day, amount: 750 }];
    d.appearance = "light";
    d.palette = "pine";
    d.languageMode = "ru";
    d.lifeDetailOpen = false;
    d.uiPreferences.databaseInitialized = true;
    return snap;
  });
  async function reset(snapshot = seed) {
    await page.evaluate((snap) => {
      testRuntime.dispose();
      localStorage.setItem("test-workspace", JSON.stringify(snap));
    }, snapshot);
    await page.reload();
    await page.locator("#all-tasks-open").waitFor({ state: "attached" });
    await page.evaluate(() => document.fonts.ready);
  }
  async function close() {
    for (
      let i = 0;
      i < 3 && (await page.locator(".overlay:visible").count());
      i++
    )
      await page.keyboard.press("Escape");
  }
  async function nav(key) {
    await close();
    await page
      .locator('[data-page="' + key + '"]:visible')
      .first()
      .click();
  }
  async function life(key) {
    await nav("life");
    if (await page.locator("#life-overview-back:visible").count())
      await page.locator("#life-overview-back").click();
    await page.locator('[data-life-tab="' + key + '"]:visible').click();
  }
  async function layout(label, dialog = false) {
    const result = await page.evaluate(
      ({ label, dialog }) => {
        const visible = (el) =>
          el.getClientRects().length && !el.closest("[hidden]");
        const selectors = dialog
          ? ".overlay:not([hidden]) .dialog, .overlay:not([hidden]) input:not([type=hidden]), .overlay:not([hidden]) select, .overlay:not([hidden]) textarea"
          : ".main .panel, .training-inline-entry, .db-toolbar, .finance-entry, .thought-card, .project-board-card";
        const violations = [...document.querySelectorAll(selectors)]
          .filter(visible)
          .flatMap((el) => {
            const r = el.getBoundingClientRect();
            if (r.width && (r.x < -1 || r.right > innerWidth + 1))
              return [{ node: el.id || el.className, x: r.x, right: r.right }];
            return [];
          });
        return {
          label,
          width: innerWidth,
          zoom: document.documentElement.style.zoom || "1",
          overflow: document.documentElement.scrollWidth > innerWidth + 2,
          violations,
        };
      },
      { label, dialog },
    );
    report.layouts.push(result);
    check(
      !result.overflow && !result.violations.length,
      "Layout " + JSON.stringify(result),
    );
  }
  await reset();
  await scenario(
    "Detached scroll events after workspace disposal",
    async () => {
      const previousErrors = report.errors.length;
      await page.evaluate(() => {
        const timeline = document.querySelector("#timeline-window");
        testRuntime.dispose();
        timeline.dispatchEvent(new Event("scroll"));
        timeline.dispatchEvent(new WheelEvent("wheel", { deltaY: 100 }));
      });
      check(
        report.errors.length === previousErrors,
        "Disposed listeners ignore queued events",
      );
      await page.reload();
      await page.locator("#all-tasks-open").waitFor();
    },
  );
  await scenario("Workout checks, quick results and persistence", async () => {
    const row = page.locator('#task-list [data-task-id="104"]');
    await row.locator(".training-exercise-check").first().click();
    check(
      (await row
        .locator('.training-exercise-check[aria-pressed="true"] > svg')
        .count()) === 1,
      "Exercise has one vector check",
    );
    check(
      (await row.locator(".training-exercise-check").first().textContent()) ===
        "",
      "No text check underneath",
    );
    check(
      await page.evaluate(
        () => testRuntime.snapshot().data.workouts[0].entries[0].value === 12,
      ),
      "Quick completion records planned result",
    );
    await row.locator(".training-inline-value").first().fill("15");
    await row.locator(".training-inline-value").first().blur();
    await row.locator(".training-exercise-check").last().click();
    check(
      (await row
        .locator(':scope > .task-check[aria-pressed="true"] > svg')
        .count()) === 1,
      "Whole workout has one check",
    );
    const centers = await row
      .locator('.task-check[aria-pressed="true"]')
      .evaluateAll((buttons) =>
        buttons.map((button) => {
          const a = button.getBoundingClientRect(),
            b = button.querySelector("svg").getBoundingClientRect();
          return (
            Math.abs(a.x + a.width / 2 - b.x - b.width / 2) < 0.6 &&
            Math.abs(a.y + a.height / 2 - b.y - b.height / 2) < 0.6
          );
        }),
      );
    check(centers.every(Boolean), "Check marks are centered in their buttons");
    check(
      (await row.locator(".task-title").textContent()) === "Тренировка",
      "Completed workout retains its original title",
    );
    check(
      (await row.locator(".training-inline-results").count()) === 0,
      "Completed workout is compact on Home",
    );
    check(
      await page.locator("#task-list > .task").evaluateAll((rows) => {
        const firstCompleted = rows.findIndex(
          (row) => row.dataset.done === "true",
        );
        return (
          firstCompleted > 0 &&
          rows.slice(firstCompleted).every((row) => row.dataset.done === "true")
        );
      }),
      "Completed workout moves below every unfinished task",
    );
    await page.screenshot({ path: out + "/completed-home.png" });
    await nav("life");
    await page.locator('[data-life-tab="training"]').click();
    check(
      (await page.locator(".training-goal-card").textContent()).includes("75%"),
      "Goal follows actual result",
    );
    await page.locator(".training-workout-name").first().click();
    check(
      (await page
        .locator('#training-results-dialog .task-check[aria-pressed="true"]')
        .count()) === 3,
      "Result dialog preserves completion",
    );
    check(
      (await page
        .locator(
          '#training-results-dialog .task-check[aria-pressed="true"] > svg',
        )
        .count()) === 3,
      "Each completed control has exactly one icon",
    );
    await close();
    await page.reload();
    check(
      await page.evaluate(
        () => testRuntime.snapshot().data.workouts[0].entries[0].value === 15,
      ),
      "Result survives restart",
    );
  });
  await reset();
  await scenario("Task menu edit, complete, delete and undo", async () => {
    await page.locator('#task-list [data-task-id="10"] .task-more').click();
    await page
      .locator("#item-actions-dialog")
      .getByRole("button", { name: "Изменить", exact: true })
      .click();
    await page.locator("#task-name").fill("Исправленная задача");
    await page.locator('#task-dialog button[type="submit"]').click();
    check(
      (await page
        .locator('#task-list [data-task-id="10"] .task-title')
        .textContent()) === "Исправленная задача",
      "Task edits are visible",
    );
    const originalTaskOrder = await page
      .locator("#task-list > .task")
      .evaluateAll((rows) => rows.map((row) => row.dataset.taskId));
    await page.locator('#task-list [data-task-id="10"] > .task-check').click();
    check(
      (await page
        .locator('#task-list [data-task-id="10"] > .task-check > svg')
        .count()) === 1,
      "Task mark centered vector",
    );
    check(
      (await page
        .locator('#task-list [data-task-id="10"] .task-title')
        .textContent()) === "Исправленная задача",
      "Completion preserves the edited title",
    );
    check(
      await page.locator("#task-list").evaluate((list) => {
        const rows = [...list.querySelectorAll(":scope > .task")];
        const completed = rows.findIndex((row) => row.dataset.done === "true");
        return (
          completed === rows.length - 1 &&
          list.scrollTop === 0 &&
          document.activeElement?.closest(".task")?.dataset.done === "false"
        );
      }),
      "Completed task goes last without scrolling or moving focus to finished work",
    );
    await page.locator('#task-list [data-task-id="10"] > .task-check').click();
    check(
      JSON.stringify(
        await page
          .locator("#task-list > .task")
          .evaluateAll((rows) => rows.map((row) => row.dataset.taskId)),
      ) === JSON.stringify(originalTaskOrder),
      "Unchecking restores the task to its unfinished position",
    );
    await page.locator('#task-list [data-task-id="10"] > .task-check').click();
    await page.locator('#task-list [data-task-id="10"] .task-more').click();
    await page
      .locator("#item-actions-dialog")
      .getByRole("button", { name: "Удалить", exact: true })
      .click();
    check(
      !(await page.locator('#task-list [data-task-id="10"]').count()),
      "Task removed",
    );
    await page
      .locator(".global-notice")
      .getByRole("button", { name: "Отменить", exact: true })
      .click();
    check(
      (await page.locator('#task-list [data-task-id="10"]').count()) === 1,
      "Undo restores task",
    );
  });
  await reset();
  await scenario("Finance category picker, colors and valid form", async () => {
    await life("finances");
    check(
      (await page.locator(".finance-flow-ring").count()) === 2,
      "Separate income / spending shares",
    );
    await page.locator("#finance-add").click();
    await page.locator(".finance-category-trigger").click();
    check(
      (await page.locator(".finance-category-options").boundingBox()).height <=
        161,
      "Categories are compact",
    );
    await page
      .locator('.finance-category-popover input[type="search"]')
      .fill("Категория 44");
    await page
      .getByRole("option", { name: "Категория 44", exact: true })
      .click();
    await page.locator("#finance-amount").fill("123.45");
    await page.locator('#finance-dialog button[type="submit"]').click();
    check(
      await page.evaluate(() =>
        testRuntime
          .snapshot()
          .data.financeLogs.some(
            (item) =>
              item.category === "Категория 44" && item.amount === 123.45,
          ),
      ),
      "Category and amount persist",
    );
  });
  const sections = [
    "home",
    "thoughts",
    "projects",
    "archive",
    "life",
    "sleep",
    "food",
    "finances",
    "training",
    "mood",
  ];
  for (const width of [320, 390, 768, 1440, 1920]) {
    await page.setViewportSize({ width, height: width < 500 ? 844 : 900 });
    await reset();
    for (const section of sections)
      await scenario("Layout " + section + " " + width, async () => {
        if (["sleep", "food", "finances", "training"].includes(section))
          await life(section);
        else if (section === "mood") {
          await nav("life");
          if (await page.locator("#life-overview-back:visible").count())
            await page.locator("#life-overview-back").click();
          await page.locator("#life-checkin-open").click();
          if (await page.locator("#state-dialog:visible").count())
            await page.locator('#state-form button[type="submit"]').click();
        } else await nav(section);
        await layout(section);
        if (
          (width === 390 || width === 1440) &&
          ["home", "training", "finances"].includes(section)
        )
          await page.screenshot({
            path: out + "/" + section + "-" + width + ".png",
            fullPage: true,
          });
      });
    await scenario("Forms and settings " + width, async () => {
      await nav("home");
      await page.locator("#task-add").click();
      await layout("task-form", true);
      await close();
      await page
        .getByRole("button", { name: "+ Событие", exact: true })
        .click();
      await layout("event-form", true);
      await close();
      await nav("projects");
      await page.locator("#project-add").click();
      await layout("project-form", true);
      await close();
      await nav("archive");
      await page.locator("#archive-item-add").click();
      await layout("database-form", true);
      await close();
      await life("training");
      await page
        .getByRole("button", { name: "+ Запланировать", exact: true })
        .click();
      await layout("workout-form", true);
      await close();
      await page.getByRole("button", { name: "+ Цель", exact: true }).click();
      await layout("goal-form", true);
      await close();
      await page
        .getByRole("button", { name: "Упражнения", exact: true })
        .click();
      await layout("exercises", true);
      await page
        .getByRole("button", { name: "+ Своё упражнение", exact: true })
        .click();
      await layout("exercise-form", true);
      await close();
      for (const tab of [
        "appearance",
        "notifications",
        "data",
        "connections",
      ]) {
        await page
          .locator('[data-open="settings-dialog"]:visible')
          .first()
          .click();
        await page.locator('[data-settings-tab="' + tab + '"]').click();
        await layout("settings-" + tab, true);
        await close();
      }
      await page.locator(".ai-open:visible").first().click();
      await layout("AI", true);
      await page.locator("#ai-context-open").click();
      await layout("AI-context", true);
      await close();
    });
  }
  await scenario(
    "Calendar day, week, month and task panel alignment",
    async () => {
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await reset();
        for (const view of ["day", "week", "month"]) {
          await page.locator("#" + view + "-toggle").click();
          await layout("calendar-" + view);
          if (width > 720) {
            const aligned = await page.evaluate(() => {
              const calendar = document
                .querySelector("#calendar-body")
                .closest(".panel")
                .getBoundingClientRect();
              const tasks = document
                .querySelector("#task-list")
                .closest(".panel")
                .getBoundingClientRect();
              return Math.abs(calendar.bottom - tasks.bottom) < 2;
            });
            check(aligned, "Task panel aligns with " + view + " calendar");
          }
        }
      }
    },
  );
  await page.setViewportSize({ width: 1440, height: 700 });
  for (const zoom of [0.8, 1.25, 1.5]) {
    await reset();
    await page.evaluate(
      (value) => (document.documentElement.style.zoom = String(value)),
      zoom,
    );
    for (const section of [
      "home",
      "projects",
      "archive",
      "food",
      "finances",
      "training",
    ])
      await scenario("Zoom " + zoom + " " + section, async () => {
        if (["food", "finances", "training"].includes(section))
          await life(section);
        else await nav(section);
        await layout(section);
      });
    await scenario("Zoom " + zoom + " dialogs", async () => {
      await nav("home");
      await page.locator("#task-add").click();
      await layout("task-form", true);
      await close();
      await page.locator(".ai-open:visible").first().click();
      await layout("AI", true);
      await close();
    });
    await page.evaluate(() => (document.documentElement.style.zoom = ""));
  }
  await scenario("Themes and fonts", async () => {
    await reset();
    for (const appearance of ["light", "dark"])
      for (const palette of ["sun", "winter", "scarlet", "pine"]) {
        await page.evaluate(
          ({ appearance, palette }) => {
            const s = structuredClone(testRuntime.snapshot());
            s.data.appearance = appearance;
            s.data.palette = palette;
            testRuntime.applyRemote(s);
          },
          { appearance, palette },
        );
        await layout(appearance + "/" + palette);
      }
    for (const font of ["system", "soft", "strict", "libron"]) {
      await page
        .locator('[data-open="settings-dialog"]:visible')
        .first()
        .click();
      await page.locator('[data-settings-tab="appearance"]').click();
      await page.locator("#font-select").selectOption(font);
      await close();
      await layout("font " + font);
    }
  });
  await scenario(
    "1000 tasks, 300 overlapping events and scroll chaining",
    async () => {
      await page.setViewportSize({ width: 390, height: 600 });
      const large = structuredClone(seed);
      large.data.tasks = Array.from({ length: 1000 }, (_, i) => ({
        ...seed.data.tasks[0],
        id: 1000 + i,
        title: "Задача " + i,
        done: i % 2 === 0,
      }));
      large.data.events = Array.from({ length: 300 }, (_, i) => ({
        ...seed.data.events[1],
        id: 3000 + i,
        title: "Событие " + i,
      }));
      large.data.workouts = [];
      large.data.nextId = 5000;
      const start = Date.now();
      await reset(large);
      check(
        (await page.locator("#task-list .task").count()) === 1300,
        "No lost tasks or events",
      );
      check(Date.now() - start < 15000, "Stress initialization bounded");
      await layout("1300 items");
      check(
        (await page.locator("#task-list").boundingBox()).height < 700,
        "Inner task list remains bounded",
      );
      // Leave room in the parent after the widget so reaching the document's own
      // edge cannot be mistaken for a trapped inner scroll.
      await page.evaluate(() => {
        const space = document.createElement("div");
        space.style.height = "700px";
        space.dataset.testScrollSpace = "";
        document.querySelector(".main").append(space);
      });
      for (const selector of [
        "#task-list",
        "#timeline-window",
        "#window-range",
      ])
        for (const edge of ["top", "bottom"]) {
          await page.locator(selector).scrollIntoViewIfNeeded();
          await page.evaluate(
            ({ selector, edge }) => {
              const el = document.querySelector(selector);
              if (selector === "#window-range") {
                el.value = edge === "top" ? "0" : "18";
                el.dispatchEvent(new Event("input", { bubbles: true }));
              } else el.scrollTop = edge === "top" ? 0 : el.scrollHeight;
              const b = el.getBoundingClientRect();
              window.scrollBy(0, b.top - 120);
            },
            { selector, edge },
          );
          await page.waitForTimeout(120);
          const pos = await page.locator(selector).boundingBox();
          const before = await page.evaluate(() => scrollY);
          const scrollDebug = await page.evaluate(
            ({ selector }) => {
              const el = document.querySelector(selector),
                r = el.getBoundingClientRect();
              return {
                max: document.documentElement.scrollHeight - innerHeight,
                position: el.scrollTop,
                innerMax: el.scrollHeight - el.clientHeight,
                overscroll: getComputedStyle(el).overscrollBehaviorY,
                point: document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + Math.min(r.height / 2, 80),
                )?.className,
              };
            },
            { selector },
          );
          await page.mouse.move(
            pos.x + pos.width / 2,
            pos.y + Math.min(pos.height / 2, 80),
          );
          await page.mouse.wheel(0, edge === "top" ? -260 : 260);
          await page.waitForTimeout(200);
          const after = await page.evaluate(() => scrollY);
          report.scroll.push({ selector, edge, before, after, ...scrollDebug });
          check(
            edge === "top" ? after < before : after > before,
            "Parent scroll continues at " +
              selector +
              " " +
              edge +
              ": " +
              before +
              " -> " +
              after,
          );
        }
      await page.locator("#task-list .task-more").nth(999).click();
      await layout("Deep task menu", true);
      await close();
      await page.screenshot({
        path: out + "/stress-mobile.png",
        fullPage: true,
      });
    },
  );
  await scenario(
    "Android-style touch viewport and swipe chaining",
    async () => {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      });
      const touch = await context.newPage();
      touch.on("pageerror", (error) =>
        report.errors.push(error.stack || error.message),
      );
      await touch.addInitScript(
        (snap) => localStorage.setItem("test-workspace", JSON.stringify(snap)),
        seed,
      );
      await touch.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1",
      );
      await touch.locator("#all-tasks-open").waitFor();
      await touch.locator("#backup-folder-setup-dialog").waitFor();
      await touch
        .locator("#backup-folder-setup-dialog")
        .getByRole("button", { name: "Позже", exact: true })
        .tap();
      check(
        await touch.evaluate(
          () =>
            matchMedia("(pointer:coarse)").matches &&
            document.querySelector("#life-os-workspace").dataset.platform ===
              "mobile",
        ),
        "Touch CSS and mobile platform are active",
      );
      for (const section of [
        "home",
        "thoughts",
        "projects",
        "archive",
        "life",
      ]) {
        await touch
          .locator('[data-page="' + section + '"]:visible')
          .first()
          .tap();
        check(
          await touch.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 2,
          ),
          "Touch layout " + section,
        );
      }
      await touch.locator('[data-page="home"]:visible').first().tap();
      await touch.evaluate(() => {
        const space = document.createElement("div");
        space.style.height = "800px";
        space.dataset.testScrollSpace = "";
        document.querySelector(".main").append(space);
      });
      const session = await context.newCDPSession(touch);
      for (const edge of ["top", "bottom"]) {
        await touch.locator("#timeline-window").scrollIntoViewIfNeeded();
        await touch.evaluate((edge) => {
          const el = document.querySelector("#timeline-window");
          el.scrollTop = edge === "top" ? 0 : el.scrollHeight;
          scrollBy(0, el.getBoundingClientRect().top - 120);
        }, edge);
        await touch.waitForTimeout(120);
        const bounds = await touch.locator("#timeline-window").boundingBox(),
          before = await touch.evaluate(() => scrollY);
        const x = bounds.x + bounds.width / 2,
          y = bounds.y + 90;
        // Headless Windows Chrome may ignore synthesizeScrollGesture for touch.
        // Deliver the actual touch start/move/end sequence instead.
        await session.send("Input.dispatchTouchEvent", {
          type: "touchStart",
          touchPoints: [{ x, y }],
        });
        for (let step = 1; step <= 7; step++) {
          await session.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ x, y: y + (edge === "top" ? 1 : -1) * step * 20 }],
          });
          await touch.waitForTimeout(25);
        }
        await session.send("Input.dispatchTouchEvent", {
          type: "touchEnd",
          touchPoints: [],
        });
        await touch.waitForTimeout(200);
        const after = await touch.evaluate(() => scrollY);
        check(
          edge === "top" ? after < before : after > before,
          "Touch swipe leaves calendar at " + edge,
        );
      }
      await touch.evaluate(() => {
        document
          .querySelectorAll("[data-test-scroll-space]")
          .forEach((el) => el.remove());
        scrollTo(0, 0);
      });
      await touch.screenshot({ path: out + "/touch-home.png", fullPage: true });
      await context.close();
    },
  );
  check(
    !report.errors.length,
    "No runtime errors: " + report.errors.join("; "),
  );
  fs.writeFileSync(out + "/report.json", JSON.stringify(report, null, 2));
  check(!report.failures.length, "Audit failures: " + report.failures.length);
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    fs.writeFileSync(out + "/report.json", JSON.stringify(report, null, 2));
    console.log(
      JSON.stringify({
        checks: report.checks,
        failures: report.failures.length,
        runtimeErrors: report.errors.length,
      }),
    );
    await browser?.close();
  });
