const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  const errors = [];
  const check = (ok, label) => {
    assert.ok(ok, label);
    checks++;
  };
  try {
    const p = await b.newPage({ viewport: { width: 390, height: 900 } });
    p.on("pageerror", (e) => errors.push(e.message));
    await p.addInitScript(() => {
      const NativeDate = Date;
      window.testNow = new NativeDate("2026-10-30T04:00:00").getTime();
      window.Date = class extends NativeDate {
        constructor(...a) {
          super(...(a.length ? a : [window.testNow]));
        }
        static now() {
          return window.testNow;
        }
      };
    });
    await p.goto(
      "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
    );
    await p.evaluate(() => {
      window.healthCalls = [];
      window.pendingHealth = null;
      window.healthFail = false;
      testServices.platform = async (op, args) => {
        if (op === "healthRead") {
          healthCalls.push(args);
          if (window.healthFail) throw Error("Нет подключения");
          if (args.dayStartMinutes === 1320)
            return await new Promise((r) => (window.pendingHealth = r));
          return {
            status: "available",
            granted: ["steps"],
            steps: [
              {
                date: "2026-10-29",
                count: 700,
                dayStartMinutes: args.dayStartMinutes,
              },
            ],
            at: Date.now(),
          };
        }
        return { status: "available", granted: ["steps"] };
      };
      const d = testRuntime.snapshot();
      d.data.uiPreferences.healthConnect = {
        enabled: true,
        steps: true,
        sleep: false,
        workouts: false,
      };
      d.data.foodLogs = [
        {
          id: 6001,
          date: "2026-10-29",
          name: "До границы",
          calories: 100,
          protein: 0,
          fat: 0,
          carbs: 0,
          occurredAt: new Date("2026-10-29T19:00:00").getTime(),
        },
        {
          id: 6002,
          date: "2026-10-30",
          name: "Ночной завтрак",
          calories: 200,
          protein: 0,
          fat: 0,
          carbs: 0,
          occurredAt: new Date("2026-10-30T03:00:00").getTime(),
        },
      ];
      d.data.sleepLogs = [
        {
          date: "2026-10-30",
          hours: 7,
          quality: null,
          note: "",
          healthSource: {
            provider: "health-connect",
            end: new Date("2026-10-30T03:00:00").getTime(),
            sessions: ["night"],
          },
        },
      ];
      d.data.stepLogs = [
        {
          date: "2026-10-29",
          count: 5000,
          source: "health-connect",
          dayStartMinutes: 0,
        },
      ];
      d.data.workouts = [
        {
          id: 6003,
          trainingKey: "night-workout",
          name: "Ночная тренировка",
          date: "2026-10-30",
          time: "03:00",
          duration: 20,
          done: false,
          entries: [],
        },
      ];
      testRuntime.applyRemote(d);
    });
    const changeStart = async (time) => {
      await p.locator('[data-open="settings-dialog"]:visible').first().click();
      await p.locator("#settings-tab-data").click();
      await p.locator("#personal-day-settings").click();
      await p.locator("#personal-day-enabled").check();
      await p.locator("#personal-day-start").fill(time);
      await p.locator("#personal-day-dialog button[type=submit]").click();
    };
    await changeStart("22:00");
    await p.waitForFunction(() => window.pendingHealth);
    check(
      await p.evaluate(() => healthCalls[0].dayStartMinutes === 1320),
      "new boundary automatically sent to Health Connect",
    );
    await changeStart("20:00");
    await p.evaluate(() =>
      pendingHealth({
        status: "available",
        granted: ["steps"],
        steps: [{ date: "2026-10-29", count: 9999, dayStartMinutes: 1320 }],
        at: Date.now(),
      }),
    );
    await p.waitForFunction(
      () =>
        healthCalls.length === 2 &&
        testRuntime
          .snapshot()
          .data.stepLogs.some((r) => r.dayStartMinutes === 1200),
    );
    check(
      await p.evaluate(
        () =>
          !testRuntime.snapshot().data.stepLogs.some((r) => r.count === 9999),
      ),
      "obsolete in-flight result discarded",
    );
    check(
      await p.evaluate(() => testRuntime.snapshot().data.stepLogs.length === 1),
      "replacement total does not duplicate steps",
    );
    await p.locator('[data-page="life"]:visible').first().click();
    await p.locator('[data-life-tab="food"]').first().click();
    check(
      (await p.locator("#food-day").inputValue()) === "2026-10-29",
      "food date follows personal day",
    );
    check(
      (await p.locator("#food-day-total").innerText()).startsWith("200"),
      "food before start excluded, night meal included",
    );
    await p.locator("#life-overview-back").click();
    await p.locator('[data-life-tab="sleep"]').first().click();
    check(
      (await p.locator("#sleep-entry-summary").innerText()).includes("7 ч"),
      "watch sleep follows new day without waiting for reimport",
    );
    await p.locator("#life-overview-back").click();
    await p.locator('[data-life-tab="training"]').first().click();
    check(
      (await p.locator("#training-plan-date").inputValue()) === "2026-10-29",
      "training day follows personal day",
    );
    check(
      (await p.locator(".training-plan-list").innerText()).includes(
        "Ночная тренировка",
      ),
      "night workout is in previous personal day",
    );
    check(
      (await p.locator("#steps-date").inputValue()) === "2026-10-29",
      "step day follows personal day",
    );
    check(
      (await p.locator(".training-step-body").innerText()).includes("700"),
      "correct rebucketed total shown",
    );
    await p.evaluate(() => (window.healthFail = true));
    await changeStart("23:00");
    await p.waitForFunction(() => healthCalls.length === 3);
    await p.locator('[data-page="home"]:visible').first().click();
    await p.locator('[data-page="life"]:visible').first().click();
    await p.locator('[data-life-tab="training"]').first().click();
    check(
      !(await p.locator(".training-step-body").innerText()).includes("700"),
      "failed refresh never shows old boundary as current",
    );
    check(
      await p.evaluate(
        () => testRuntime.snapshot().data.stepLogs[0].count === 700,
      ),
      "failed refresh preserves saved data",
    );
    // Resume after the user's day boundary, not calendar midnight.
    await p.evaluate(() => {
      window.testNow = new Date("2026-10-30T23:01:00").getTime();
      document.activeElement.blur();
      window.dispatchEvent(new Event("life-os:resume"));
    });
    await p.locator('[data-page="home"]:visible').first().click();
    await p.locator('[data-page="life"]:visible').first().click();
    await p.locator('[data-life-tab="food"]').first().click();
    check(
      (await p.locator("#food-day").inputValue()) === "2026-10-30",
      "rollover advances food day",
    );
    check(
      (await p.locator("#food-day-total").innerText()).startsWith("0"),
      "old personal-day meals not counted after rollover",
    );
    await p.evaluate(() => {
      window.healthFail = false;
      const d = testRuntime.snapshot();
      d.data.lifePreferences.personalDay.start = "21:00";
      testRuntime.applyRemote(d);
    });
    await p.waitForFunction(() =>
      healthCalls.some((c) => c.dayStartMinutes === 1260),
    );
    check(
      await p.evaluate(
        () =>
          healthCalls.filter((c) => c.dayStartMinutes === 1260).length === 1,
      ),
      "settings from sync also trigger one refresh",
    );
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " personal-day browser checks passed (mocked Health Connect; request race, rollover, food, sleep, workouts, steps)",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
