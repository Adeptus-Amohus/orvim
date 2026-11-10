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
    for (const width of [320, 390, 768, 1024, 1440, 1920]) {
      for (const theme of ["light", "dark"]) {
        const page = await browser.newPage({
          viewport: { width, height: 900 },
        });
        page.on("pageerror", (error) => errors.push(error.message));
        await page.goto(
          "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
        );
        await page.evaluate((theme) => {
          const doc = testRuntime.snapshot(),
            day = doc.data.selectedDate;
          doc.data.appearanceMode = theme;
          doc.data.thoughts = Array.from({ length: 1000 }, (_, i) => ({
            id: 10000 + i,
            title: "Мысль " + i,
            body: "Длинный текст мысли " + i,
            date: day,
            context: "Личное",
          }));
          doc.data.workouts = [
            {
              id: 6000,
              trainingKey: "whole-session",
              name: "Вся тренировка",
              date: day,
              time: "17:00",
              duration: 30,
              done: false,
              entries: [
                {
                  exerciseKey: "pull",
                  name: "Подтягивания",
                  unit: "раз",
                  sets: 1,
                  value: 10,
                  done: false,
                },
                {
                  exerciseKey: "squat",
                  name: "Приседания",
                  unit: "раз",
                  sets: 1,
                  value: 20,
                  done: false,
                },
              ],
            },
          ];
          doc.data.nextId = 12000;
          testRuntime.applyRemote(doc);
        }, theme);
        await page.locator('[data-page="life"]:visible').first().click();
        check(
          await page
            .locator(".life-core")
            .evaluate(
              (e) =>
                getComputedStyle(e).borderRadius === "50%" &&
                Math.abs(e.clientWidth - e.clientHeight) < 1,
            ),
          "round Life center " + width,
        );
        check(
          await page
            .locator(".life-tile")
            .first()
            .evaluate(
              (e) => parseFloat(getComputedStyle(e).borderRadius) >= 24,
            ),
          "soft Life tiles",
        );
        if ([390, 1440].includes(width))
          await page.screenshot({
            path: `.artifacts/ui033-life-${theme}-${width}.png`,
          });
        await page.locator('[data-life-tab="training"]').first().click();
        check(
          (await page.locator(".workout-effort").count()) === 0,
          "rating absent before completion",
        );
        await page
          .locator('[data-training-toggle="whole-session"]')
          .first()
          .click();
        check(
          (await page
            .locator(".training-plan-list .workout-effort")
            .count()) === 1,
          "one rating for complete session",
        );
        check(
          (await page.locator(".exercise-effort").count()) === 0,
          "no individual exercise ratings",
        );
        await page.locator(".workout-effort summary").click();
        await page
          .locator(".workout-effort-options")
          .getByRole("button", { name: "Тяжело", exact: true })
          .click();
        check(
          await page.evaluate(
            () =>
              testRuntime.snapshot().data.workouts[0].effort === 4 &&
              testRuntime
                .snapshot()
                .data.workouts[0].entries.every((e) => e.effort === undefined),
          ),
          "session rating saved without touching exercises",
        );
        await page.evaluate(() =>
          testRuntime.applyRemote(testRuntime.snapshot()),
        );
        check(
          await page.evaluate(
            () => testRuntime.snapshot().data.workouts[0].effort === 4,
          ),
          "rating survives rehydrate",
        );
        await page.locator('[data-page="thoughts"]:visible').first().click();
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        const header = await page.locator(".header").boundingBox();
        check(
          (await page.locator("#thoughts-list .thought-feed-note").count()) ===
            60,
          "first batch only",
        );
        const scroller = page.locator(".thought-feed-scroll");
        check(
          await scroller.evaluate(
            (e) => e.scrollHeight > e.clientHeight && e.clientHeight > 80,
          ),
          "bounded feed viewport",
        );
        await scroller.hover();
        await page.mouse.wheel(0, 100000);
        await page.waitForFunction(
          () =>
            document.querySelectorAll("#thoughts-list .thought-feed-note")
              .length >= 120,
        );
        check(
          Math.abs((await page.locator(".header").boundingBox()).y - header.y) <
            1,
          "scrolling notes keeps page header still " + width + " " + theme,
        );
        check(
          await page.evaluate(
            () =>
              document.documentElement.scrollTop === 0 &&
              document.documentElement.scrollHeight <= innerHeight + 1,
          ),
          "page itself does not grow",
        );
        if (width === 390 && theme === "light") {
          for (let batch = 2; batch < 17; batch++) {
            await scroller.evaluate((e) => {
              e.scrollTop = e.scrollHeight;
            });
            await page.waitForFunction(
              (minimum) =>
                document.querySelectorAll("#thoughts-list .thought-feed-note")
                  .length >= minimum,
              Math.min(1000, (batch + 1) * 60),
            );
          }
          check(
            (await page
              .locator("#thoughts-list .thought-feed-note")
              .count()) === 1000,
            "all thousand notes load while scrolling",
          );
        }
        await page.locator("#thought-feed-search").fill("Мысль 0");
        check(
          (await page.locator("#thoughts-list .thought-feed-note").count()) ===
            1,
          "search reaches notes outside first batch",
        );
        await page.locator("#thoughts-list .thought-feed-note").click();
        check(
          await page.locator(".thought-feed-detail").isVisible(),
          "searched note opens",
        );
        check(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          "no horizontal overflow",
        );
        if ([390, 1440].includes(width))
          await page.screenshot({
            path: `.artifacts/ui033-thoughts-${theme}-${width}.png`,
          });
        await page
          .locator('[data-open="settings-dialog"]:visible')
          .first()
          .click();
        await page.locator("#settings-tab-data").click();
        check(
          await page
            .locator("#settings-panel-data #personal-day-settings")
            .isVisible(),
          "My day prominent in Data",
        );
        await page.locator("#personal-day-settings").click();
        await page.locator("#personal-day-enabled").check();
        await page.locator("#personal-day-start").fill("22:00");
        await page.locator("#personal-day-dialog button[type=submit]").click();
        check(
          await page.evaluate(
            () =>
              testRuntime.snapshot().data.lifePreferences.personalDay.start ===
              "22:00",
          ),
          "My day still saves",
        );
        await page.close();
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " UI 0.4.33 checks passed; circle, session effort, 1000 thoughts, fixed header, My day; six widths, light/dark",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
