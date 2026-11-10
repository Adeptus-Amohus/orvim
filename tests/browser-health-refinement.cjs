const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  const errors = [];
  const check = (value, label) => {
    assert.ok(value, label);
    checks++;
  };
  try {
    for (const width of [320, 390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 960 } });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
      );
      await page.locator("#home-illness").click();
      check(
        await page.locator("#illness-start-now").isVisible(),
        "quick illness action",
      );
      check(
        !(await page.locator("#illness-from").isVisible()),
        "date editor collapsed",
      );
      await page.locator("#illness-skip-today").click();
      const single = await page.evaluate(
        () => testRuntime.snapshot().data.illnessLogs[0],
      );
      check(single.date === single.until, "one-day skip is bounded");
      check(
        (await page.locator("#home-illness").getAttribute("aria-pressed")) ===
          "true",
        "active home icon",
      );
      check(
        !(await page.locator("#home-sleep-prompt").isVisible()),
        "no sleep nag during illness",
      );
      await page.locator('[data-page="life"]:visible').first().click();
      await page.locator('[data-life-tab="sleep"]').first().click();
      check(
        await page.locator("#sleep-illness-notice").isVisible(),
        "sleep knows illness",
      );
      check(
        !(await page
          .locator("#sleep-entry-disclosure")
          .evaluate((e) => e.open)),
        "optional sleep is collapsed",
      );
      await page.locator("#sleep-entry-disclosure > summary").click();
      await page.locator("#sleep-hours").fill("9");
      await page.locator("#sleep-form button[type=submit]").click();
      check(
        await page.evaluate(() =>
          testRuntime.snapshot().data.sleepLogs.some((r) => r.hours === 9),
        ),
        "sleep can still be recorded",
      );
      await page.locator("#life-overview-back").click();
      await page.locator('[data-life-tab="training"]').first().click();
      check(
        await page.locator("#training-illness-notice").isVisible(),
        "training knows illness even without plans",
      );
      await page.locator("#life-overview-back").click();
      await page.locator('[data-life-tab="food"]').first().click();
      check(
        await page.locator("#food-illness-notice").isVisible(),
        "nutrition knows illness",
      );
      check(
        (await page
          .locator("#life-food-view > .life-layout > .panel")
          .count()) === 1,
        "one nutrition panel",
      );
      check(
        await page.locator(".food-journal-panel #food-day-total").isVisible(),
        "calories inside nutrition",
      );
      check(
        await page
          .locator(".food-journal-actions #saved-meals-open")
          .isVisible(),
        "saved meals remain directly reachable",
      );
      check(
        await page
          .getByRole("button", { name: "Повторить вчера", exact: true })
          .isVisible(),
        "repeat action preserved",
      );
      const collapsed = await page
        .locator("#food-entry-disclosure")
        .boundingBox();
      check(collapsed.height < 80, "manual editor is compact");
      await page.locator("#food-entry-disclosure > summary").click();
      await page.locator("#food-name").fill("Тестовый завтрак");
      await page.locator("#food-calories").fill("350");
      await page.locator("#food-form button[type=submit]").click();
      check(
        await page.evaluate(() =>
          testRuntime
            .snapshot()
            .data.foodLogs.some(
              (r) => r.name === "Тестовый завтрак" && r.calories === 350,
            ),
        ),
        "actual calories retained on illness day",
      );
      check(
        (await page.locator("#food-day-total").innerText()).includes("350"),
        "journal calories updated",
      );
      await page
        .locator("#food-entry-disclosure")
        .evaluate((e) => (e.open = false));
      check(
        (await page.locator("#micronutrients-panel").count()) === 0,
        "removed nutrient panel",
      );
      await page.screenshot({
        path: ".artifacts/health-refinement-food-" + width + ".png",
        fullPage: true,
      });
      check(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "no horizontal overflow",
      );
      await page.locator('[data-page="home"]:visible').first().click();
      // Ended one-day period stays excused today but is not an ongoing illness.
      await page.locator("#home-illness").click();
      check(
        !(await page.locator("#illness-recover").isVisible()),
        "one-day skip is not ongoing illness",
      );
      await page.locator(".illness-period-details > summary").click();
      await page
        .locator("#illness-dialog .life-tracking-records")
        .getByRole("button", { name: "Удалить", exact: true })
        .click();
      await page.locator("#illness-start-now").click();
      await page.locator("#home-illness").click();
      check(
        await page.locator("#illness-recover").isVisible(),
        "ongoing illness offers recovery",
      );
      await page.screenshot({
        path: ".artifacts/health-refinement-illness-" + width + ".png",
      });
      await page.locator("#illness-recover").click();
      check(
        await page.evaluate(() =>
          Boolean(testRuntime.snapshot().data.illnessLogs[0].until),
        ),
        "recovery saved",
      );
      await page.screenshot({
        path: ".artifacts/health-refinement-home-" + width + ".png",
      });
      check(
        await page.locator("#home-illness #local-time").isVisible(),
        "clock is the illness entry point",
      );
      await page.evaluate(() => {
        const d = testRuntime.snapshot();
        d.data.illnessLogs[0].until = "2099-12-31";
        testRuntime.applyRemote(d);
      });
      await page.locator("#home-illness").click();
      check(
        await page.locator("#illness-recover").isVisible(),
        "future end date still offers recovery today",
      );
      await page.locator("#illness-recover").click();
      check(
        await page.evaluate(
          () =>
            testRuntime.snapshot().data.illnessLogs[0].until !== "2099-12-31",
        ),
        "recovery shortens future-dated period",
      );
      await page.locator('[data-page="life"]:visible').first().click();
      await page.locator('[data-life-tab="food"]').first().click();
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(checks + " health refinement browser checks passed");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
