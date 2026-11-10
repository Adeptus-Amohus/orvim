const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  const ok = (v, m) => {
    assert.ok(v, m);
    checks++;
  };
  try {
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 850 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
      );
      await page.waitForFunction(() => !!window.testRuntime);
      await page.evaluate(() => {
        const d = testRuntime.snapshot(),
          day = d.data.selectedDate;
        d.data.events = [
          {
            id: 8001,
            title: "Удалить сразу",
            date: day,
            start: "10:00",
            end: "11:00",
            context: "Личное",
            done: false,
          },
        ];
        testRuntime.applyRemote(d);
      });
      await page.locator("#task-list .task-more").first().click();
      ok(
        (
          await page
            .locator("#item-actions-dialog .entity-actions button")
            .allTextContents()
        ).join("|") === "Изменить|Перенести|Дублировать|Удалить",
        "four actions",
      );
      await page
        .locator("#item-actions-dialog")
        .getByRole("button", { name: "Удалить", exact: true })
        .click();
      ok(
        (await page
          .locator("#task-list")
          .getByText("Удалить сразу", { exact: true })
          .count()) === 0,
        "immediate removal",
      );
      await page.locator('[data-page="life"]:visible').first().click();
      await page.locator('[data-life-tab="food"]').first().click();
      ok(
        (await page.locator("#life-tracking-settings svg").count()) === 1,
        "nutrition settings icon",
      );
      await page.locator('[data-page="life"]:visible').first().click();
      await page.locator('[data-life-tab="sleep"]').first().click();
      await page.locator("#sleep-extra").evaluate((e) => (e.open = true));
      ok(
        (await page.locator('.sleep-moon-rating [role="slider"]').count()) ===
          1,
        "moon picker",
      );
      const slider = page.locator('.sleep-moon-rating [role="slider"]');
      await slider.focus();
      await page.keyboard.press("End");
      ok(
        (await page.locator("#sleep-quality").inputValue()) === "5",
        "moon five",
      );
      await page.keyboard.press("ArrowLeft");
      ok(
        (await page.locator("#sleep-quality").inputValue()) === "4",
        "moon integer steps",
      );
      await page.locator('[data-page="life"]:visible').first().click();
      await page.locator('[data-life-tab="finances"]').first().click();
      ok(
        !(await page.locator(".finance-account-tools").isVisible()),
        "finance controls hidden",
      );
      ok(await page.locator("#finance-add").isVisible(), "add visible");
      const add = await page.locator("#finance-add").boundingBox();
      ok(add.y + add.height < 850, "add above fold");
      await page.screenshot({ path: `.artifacts/ui034-finance-${width}.png` });
      await page.locator("#finance-options summary").click();
      ok(
        await page.locator(".finance-account-tools").isVisible(),
        "finance settings available",
      );
      ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "finance no horizontal overflow",
      );
      await page
        .locator('[data-open="settings-dialog"]:visible')
        .first()
        .click();
      ok(
        (await page.locator("button[data-appearance] svg").count()) === 3,
        "appearance icons",
      );
      await page
        .locator("#custom-font-file")
        .setInputFiles("src/assets/fonts/libron/Libron-Regular.woff2");
      await page.waitForFunction(() =>
        document.querySelector("#font-select").value.startsWith("custom-"),
      );
      ok(
        await page
          .locator("#life-os-workspace")
          .evaluate((e) => e.style.fontFamily.includes("OrvimCustom")),
        "custom font applies",
      );
      await page.locator("#settings-tab-notifications").click();
      ok(
        (await page.locator("#wellbeing-daily-count").inputValue()) === "3",
        "three default",
      );
      await page
        .locator("#wellbeing-daily-count")
        .selectOption("2", { force: true });
      ok(
        await page.evaluate(
          () =>
            testRuntime.snapshot().data.notificationSettings.wellbeingCount ===
            2,
        ),
        "frequency persists",
      );
      await page.locator("#notifications-timer-sound").uncheck();
      ok(
        await page.evaluate(
          () =>
            testRuntime.snapshot().data.notificationSettings.timerSound ===
            false,
        ),
        "timer sound persists",
      );
      ok(errors.length === 0, errors.join("\n"));
      await page.close();
    }
    console.log(JSON.stringify({ passed: true, checks }));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
