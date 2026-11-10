const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    const page = await browser.newPage({
        viewport: { width: 390, height: 844 },
      }),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1",
    );
    await page.waitForFunction(() => !!window.testRuntime);
    const result = await page.evaluate(() => {
      const before = structuredClone(testRuntime.snapshot());
      const date = new Date().toLocaleDateString("en-CA");
      const commands = [
        {
          key: "thought-one",
          action: "thought",
          text: "Первая строка\nПодробности",
          date,
          at: Date.now(),
        },
        {
          key: "task-one",
          action: "task",
          text: "Задача из виджета",
          date,
          time: "19:30",
        },
        {
          key: "food-one",
          action: "food",
          text: "Омлет",
          date,
          at: Date.now(),
          calories: 270,
          protein: 18.5,
          fat: 12,
          carbs: 22,
          estimated: true,
        },
        {
          key: "check-one",
          action: "complete",
          targetOperation: "task-one",
          kind: "task",
          done: true,
          date,
        },
      ];
      const accepted = testRuntime.importWidgetCommands(commands);
      const once = structuredClone(testRuntime.snapshot());
      const twice = testRuntime.importWidgetCommands(commands);
      const after = testRuntime.snapshot();
      return {
        before: before.data,
        once: once.data,
        after: after.data,
        accepted,
        twice,
      };
    });
    assert.equal(result.accepted.length, 4);
    assert.equal(
      result.after.thoughts.length,
      result.before.thoughts.length + 1,
    );
    assert.equal(
      result.after.thoughts.at(-1).body,
      "Первая строка\nПодробности",
    );
    assert.equal(
      result.after.tasks.find((t) => t.title === "Задача из виджета").done,
      true,
    );
    assert.equal(result.after.foodLogs.at(-1).calories, 270);
    assert.equal(result.after.foodLogs.at(-1).nutritionSource, "estimate");
    assert.equal(result.after.foodLogs.at(-1).protein, 18.5);
    assert.equal(result.after.foodLogs.at(-1).fat, 12);
    assert.equal(result.after.foodLogs.at(-1).carbs, 22);
    const invalid = await page.evaluate(() =>
      testRuntime.importWidgetCommands([
        {
          key: "invalid-macros",
          action: "food",
          text: "Invalid",
          calories: 100,
          protein: "a",
        },
        {
          key: "negative-macros",
          action: "food",
          text: "Invalid",
          calories: 100,
          fat: -2,
        },
      ]),
    );
    assert.deepEqual(invalid, []);
    assert.equal(result.twice.length, 4);
    assert.deepEqual(result.once.tasks, result.after.tasks);
    assert.deepEqual(result.once.foodLogs, result.after.foodLogs);
    const edited = await page.evaluate(() => {
      const command = {
        key: "edit-one",
        action: "edit",
        kind: "task",
        targetOperation: "task-one",
        text: "Перенесённая задача",
        date: "2026-12-01",
        time: "21:15",
        duration: 75,
      };
      const count = testRuntime.snapshot().data.tasks.length;
      const first = testRuntime.importWidgetCommands([command]);
      testRuntime.importWidgetCommands([command]);
      return { first, count, after: testRuntime.snapshot().data.tasks };
    });
    assert.deepEqual(edited.first, ["edit-one"]);
    assert.equal(edited.after.length, edited.count);
    const updated = edited.after.find(
      (row) => row.title === "Перенесённая задача",
    );
    assert.equal(updated.date, "2026-12-01");
    assert.equal(updated.time, "21:15");
    assert.equal(updated.duration, 75);
    // The saved receipt survives a reload and stops journal re-delivery from duplicating a record.
    await page.waitForTimeout(150);
    await page.reload();
    await page.waitForFunction(() => !!window.testRuntime);
    const count = await page.evaluate(() => {
      testRuntime.importWidgetCommands([
        {
          key: "thought-one",
          action: "thought",
          text: "Первая строка\nПодробности",
        },
      ]);
      return testRuntime
        .snapshot()
        .data.thoughts.filter((t) => t.title === "Первая строка").length;
    });
    assert.equal(count, 1);
    assert.deepEqual(errors, []);
    console.log(
      "Widget journal: task/thought/food, completion, idempotency and restart passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
