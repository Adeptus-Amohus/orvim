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
    for (const width of [320, 390, 430, 720, 768, 1024, 1440, 1920]) {
      for (const theme of ["light", "dark"]) {
        const p = await b.newPage({ viewport: { width, height: 900 } });
        p.on("pageerror", (e) => errors.push(e.message));
        await p.goto(
          "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
        );
        await p.evaluate((theme) => {
          const d = testRuntime.snapshot();
          d.data.appearance = theme;
          testRuntime.applyRemote(d);
        }, theme);
        const overflow = async (label) =>
          check(
            await p.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth + 1,
            ),
            width + " " + theme + " " + label + " overflow",
          );
        for (const page of [
          "home",
          "life",
          "thoughts",
          "projects",
          "archive",
        ]) {
          await p
            .locator('[data-page="' + page + '"]:visible')
            .first()
            .click();
          await overflow(page);
          if (page === "home") {
            if (width <= 720)
              check(
                await p.evaluate(() => {
                  const a = document
                      .querySelector(".calendar")
                      .getBoundingClientRect(),
                    t = document
                      .querySelector(".tasks")
                      .getBoundingClientRect();
                  return t.top - a.bottom >= 12 && t.top - a.bottom <= 18;
                }),
                "calendar/tasks gap",
              );
            else
              check(
                await p.evaluate(() => {
                  const a = document
                      .querySelector(".quick-row")
                      .getBoundingClientRect(),
                    t = document
                      .querySelector(".tasks")
                      .getBoundingClientRect();
                  return t.top - a.bottom >= 12 && t.top - a.bottom <= 18;
                }),
                "desktop header/tasks gap",
              );
            check(
              await p.locator("#home-illness #local-time").isVisible(),
              "clock opens illness",
            );
            await p.locator("#home-illness").click();
            check(
              await p.locator(".recovery-emblem svg").isVisible(),
              "flat recovery emblem",
            );
            await overflow("illness");
            await p.locator("#illness-dialog .close").click();
          }
          if (page === "life") {
            check(
              (await p.locator(".life-tracking-toolbar").count()) === 0,
              "no persistent personal-day toolbar",
            );
            check(
              (await p.locator("#nutrition-weight").isVisible()) === false,
              "weight optional default",
            );
            for (const tab of ["sleep", "food", "training", "finances"]) {
              await p
                .locator('[data-life-tab="' + tab + '"]:visible')
                .first()
                .click();
              await overflow(tab);
              if (tab === "food") {
                await p.locator("#life-tracking-settings").click();
                check(
                  (await p
                    .locator(
                      "#life-tracking-settings-dialog input[type=checkbox]",
                    )
                    .count()) === 3,
                  "only 3 additions",
                );
                check(
                  (await p
                    .locator(
                      "#track-calories,#track-micronutrients,#micronutrients-panel",
                    )
                    .count()) === 0,
                  "no calorie switch or minerals",
                );
                await p.locator("#track-weight").check();
                await p.locator("#track-water").uncheck();
                await p.locator("#track-macros").uncheck();
                await p
                  .locator("#life-tracking-settings-dialog button[type=submit]")
                  .click();
                check(
                  await p.locator("#nutrition-weight").isVisible(),
                  "weight inside nutrition",
                );
                check(
                  await p.locator("#food-day-total").isVisible(),
                  "calories always visible",
                );
                check(
                  !(await p.locator("#hydration-view").isVisible()),
                  "water can be hidden",
                );
                await p.locator("#nutrition-weight").click();
                await p.locator("#body-weight-kg").fill("73.4");
                await p
                  .locator("#body-weight-dialog button[type=submit]")
                  .click();
                check(
                  (
                    await p.locator(".life-tracking-value").innerText()
                  ).includes("73.4"),
                  "weight persisted",
                );
                await overflow("weight");
                await p.locator("#body-weight-dialog .close").click();
              }
              if ([390, 1440].includes(width))
                await p.screenshot({
                  path:
                    ".artifacts/ui032-" +
                    tab +
                    "-" +
                    theme +
                    "-" +
                    width +
                    ".png",
                  fullPage: true,
                });
              await p.locator("#life-overview-back").click();
            }
          }
          if ([390, 1440].includes(width))
            await p.screenshot({
              path:
                ".artifacts/ui032-" + page + "-" + theme + "-" + width + ".png",
              fullPage: true,
            });
        }
        await p
          .locator('[data-open="settings-dialog"]:visible')
          .first()
          .click();
        await p.locator("#settings-tab-data").click();
        await p.locator("#personal-day-settings").click();
        check(
          await p.locator("#personal-day-dialog").isVisible(),
          "day setting is in settings",
        );
        await overflow("personal day");
        await p.locator("#personal-day-dialog .close").click();
        await p.close();
      }
    }
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " responsive checks passed; 8 widths, light/dark, all main and Life tabs",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
