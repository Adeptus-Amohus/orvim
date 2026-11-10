const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  try {
    for (const width of [320, 390, 1440]) {
      const p = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
      );
      await p.waitForFunction(() => !!window.testRuntime);
      const titles = await p.evaluate(() =>
        testRuntime.snapshot().data.tasks.map((t) => t.title),
      );
      await p.locator('[data-open="settings-dialog"]:visible').first().click();
      for (const lang of ["en", "ru", "en"]) {
        await p.locator("#language-select").selectOption(lang, { force: true });
        await p.waitForTimeout(150);
        const gaps = await p
          .locator(".themes .appearance-icon-choice")
          .evaluateAll((es) =>
            es.map((e) => {
              const icon = e
                  .querySelector(".appearance-choice-icon")
                  .getBoundingClientRect(),
                label = e
                  .querySelector(".appearance-choice-label")
                  .getBoundingClientRect();
              return label.left - icon.right;
            }),
          );
        assert.ok(
          gaps.length >= 4 && gaps.every((n) => Math.abs(n - 10) < 1),
          JSON.stringify(gaps),
        );
        checks++;
        const label = await p.locator("#personal-day-settings").textContent();
        assert.ok(
          lang === "en" ? !/[А-Яа-я]/.test(label) : /[А-Яа-я]/.test(label),
          label,
        );
        checks++;
      }
      assert.deepEqual(
        await p.evaluate(() =>
          testRuntime.snapshot().data.tasks.map((t) => t.title),
        ),
        titles,
      );
      checks++;
      assert.deepEqual(errors, []);
      checks++;
      await p.screenshot({
        path: ".artifacts/english-settings-" + width + ".png",
        fullPage: true,
      });
      await p.close();
    }
    console.log(checks + " checks passed");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
