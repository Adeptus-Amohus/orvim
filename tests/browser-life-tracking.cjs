const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const errors = [];
  let checks = 0;
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
      );
      await page.locator('[data-page="life"]:visible').first().click();
      await page
        .locator('[data-open="settings-dialog"]:visible')
        .first()
        .click();
      await page.locator("#settings-tab-data").click();
      await page.locator("#personal-day-settings").click();
      await page.locator("#personal-day-enabled").check();
      await page.locator("#personal-day-start").fill("22:00");
      await page.locator("#personal-day-dialog button[type=submit]").click();
      await page.locator('[data-page="life"]:visible').first().click();
      await page.locator('[data-life-tab="food"]').first().click();
      await page.locator("#life-tracking-settings").click();
      await page.locator("#track-water").uncheck();
      await page.locator("#track-macros").uncheck();
      await page.locator("#track-weight").check();
      await page
        .locator("#life-tracking-settings-dialog button[type=submit]")
        .click();
      assert.equal(
        await page.evaluate(
          () => testRuntime.snapshot().data.lifePreferences.personalDay.start,
        ),
        "22:00",
      );
      checks++;
      await page.locator("#nutrition-weight").click();
      await page.locator("#body-weight-kg").fill("75.25");
      await page.locator("#body-weight-dialog button[type=submit]").click();
      assert.equal(
        await page.locator(".life-tracking-value").innerText(),
        "75.25 кг",
      );
      checks++;
      await page.locator("#body-weight-date").fill(
        await page.evaluate(() => {
          const d = new Date();
          d.setDate(d.getDate() - 5);
          return d.toLocaleDateString("en-CA");
        }),
      );
      await page.locator("#body-weight-kg").fill("76");
      await page.locator("#body-weight-dialog button[type=submit]").click();
      assert(await page.locator(".body-weight-chart svg").isVisible());
      checks++;
      await page.locator("#body-weight-dialog .close").click();
      await page.locator('[data-page="home"]:visible').first().click();
      await page.locator("#home-illness").click();
      await page.locator("#illness-start-now").click();
      assert.equal(
        await page.evaluate(
          () => testRuntime.snapshot().data.illnessLogs.length,
        ),
        1,
      );
      checks++;
      await page.locator("#home-illness").click();
      await page.locator("#illness-recover").click();
      assert(
        await page.evaluate(() =>
          Boolean(testRuntime.snapshot().data.illnessLogs[0].until),
        ),
      );
      checks++;
      await page.locator('[data-page="life"]:visible').first().click();
      await page.locator('[data-life-tab="food"]').first().click();
      assert.equal(await page.locator("#hydration-view").isVisible(), false);
      assert.equal(await page.locator("#food-day-total").isVisible(), true);
      checks += 2;
      const saved = await page.evaluate(() => testRuntime.snapshot());
      assert.equal(saved.data.weightLogs.length, 2);
      checks++;
      await page.screenshot({
        path: `.artifacts/life-tracking-032-nutrition-${width}.png`,
        fullPage: true,
      });
      await page.locator("#life-tracking-settings").click();
      await page.locator("#track-weight").uncheck();
      await page
        .locator("#life-tracking-settings-dialog button[type=submit]")
        .click();
      assert.equal(await page.locator("#nutrition-weight").isVisible(), false);
      checks++;
      await page.evaluate(() => {
        const snap = testRuntime.snapshot();
        testRuntime.applyRemote(snap);
      });
      assert.equal(
        await page.evaluate(
          () => testRuntime.snapshot().data.weightLogs.length,
        ),
        2,
      );
      checks++;
      await page.locator("#life-tracking-settings").click();
      await page.locator("#track-weight").check();
      await page
        .locator("#life-tracking-settings-dialog button[type=submit]")
        .click();
      await page.locator("#nutrition-weight").click();
      await page.screenshot({
        path: `.artifacts/life-tracking-032-weight-${width}.png`,
        fullPage: true,
      });
      await page.locator("#body-weight-dialog .close").click();
      await page.evaluate(() => {
        const doc = testRuntime.snapshot(),
          day = doc.data.selectedLifeDay;
        doc.data.workouts = [
          {
            id: 5000,
            trainingKey: "effort-test",
            date: day,
            time: "23:00",
            name: "Моя тренировка",
            duration: 30,
            done: true,
            entries: [
              {
                exerciseKey: "pull",
                name: "Подтягивания",
                unit: "раз",
                sets: 1,
                value: 10,
                done: true,
                effort: undefined,
              },
            ],
          },
        ];
        doc.data.nextId = 6000;
        testRuntime.applyRemote(doc);
      });
      await page.locator("#life-overview-back").click();
      await page.locator('[data-life-tab="training"]').first().click();
      await page.locator(".training-workout-row summary").first().click();
      await page.locator(".workout-effort summary").click();
      await page
        .locator(".workout-effort-options button")
        .filter({ hasText: /^Тяжело$/ })
        .click();
      assert.equal(
        await page.evaluate(
          () => testRuntime.snapshot().data.workouts[0].effort,
        ),
        4,
      );
      checks++;
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      );
      checks++;
      await page.screenshot({
        path: `.artifacts/life-tracking-032-${width}.png`,
        fullPage: true,
      });
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(`${checks} health tracking browser checks passed`);
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
