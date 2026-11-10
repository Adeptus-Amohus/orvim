const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  const errors = [];
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
      );
      await page.locator("#home-sleep-prompt").click();
      await page.locator('[data-sleep-hours="8"]').click();
      await page.locator("#sleep-form button[type=submit]").click();
      assert.equal(
        await page.locator("#sleep-entry-disclosure").evaluate((e) => e.open),
        false,
      );
      checks++;
      assert.match(
        await page.locator("#sleep-entry-summary").innerText(),
        /8 ч/,
      );
      checks++;
      await page.screenshot({
        path: ".artifacts/refined-sleep-" + width + ".png",
      });
      await page.locator("#sleep-entry-disclosure > summary").click();
      assert.equal(await page.locator("#sleep-hours").inputValue(), "8");
      checks++;
      await page.locator("#sleep-entry-disclosure > summary").click();
      await page.locator(".ai-open:visible").click();
      assert.equal(await page.locator(".ai-context-bar button").count(), 1);
      checks++;
      await page.locator("#ai-context-open").click();
      await page.locator('[data-ai-source="lifeData"]').click();
      await page.locator("#ai-context-items input").check();
      assert(await page.locator(".ai-period-row").isVisible());
      checks++;
      await page.locator("#ai-context-done").click();
      assert.equal(await page.locator(".ai-period-row").isVisible(), false);
      checks++;
      await page.locator("#ai-dialog .close").click();
      await page.locator(".ai-open:visible").click();
      assert(
        await page.evaluate(() =>
          window.testRuntime
            .snapshot()
            .data.uiPreferences.aiSelection.lifeData.includes("*"),
        ),
      );
      checks++;
      await page.evaluate(() => {
        window.testAnswer = {
          message: "Предлагаю записи",
          changes: Array.from({ length: 12 }, (_, i) => ({
            operation: "upsert",
            collection: "foodLogs",
            id: null,
            data: JSON.stringify({
              date: window.testDay,
              name: "Порция " + i,
              calories: 100,
              protein: 2,
              fat: 4,
              carbs: 14,
            }),
          })),
        };
      });
      await page.locator("#ai-prompt").fill("Тест");
      await page.locator("#ai-dialog-form").evaluate((e) => e.requestSubmit());
      await page.getByText("Предложение ИИ · ещё не сохранено").waitFor();
      assert.equal(await page.locator(".ai-change").count(), 12);
      checks++;
      await page
        .getByRole("button", { name: "Применить изменения" })
        .scrollIntoViewIfNeeded();
      const bounds = await page.evaluate(() => {
        const r = (s) => {
          const a = document.querySelector(s).getBoundingClientRect();
          return { top: a.top, bottom: a.bottom, height: a.height };
        };
        return {
          scroll: r("#ai-chat-scroll"),
          compose: r(".ai-compose"),
          changes: r("#ai-changes"),
          shell: r("#ai-dialog-form"),
        };
      });
      assert(bounds.scroll.height > 150, JSON.stringify(bounds));
      checks++;
      assert(
        bounds.scroll.bottom <= bounds.compose.top + 1,
        JSON.stringify(bounds),
      );
      checks++;
      assert(
        await page
          .locator("#ai-dialog-form")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
      checks++;
      await page.screenshot({
        path: ".artifacts/refined-chat-" + width + ".png",
      });
      if (width < 500) {
        await page.setViewportSize({ width, height: 520 });
        assert(
          await page
            .locator("#ai-chat-scroll")
            .evaluate((e) => e.clientHeight >= 80),
        );
        checks++;
        await page.setViewportSize({ width, height: 844 });
      }
      await page.evaluate(() => (window.testProviderError = true));
      await page.locator("#ai-prompt").fill("Тест ошибки");
      await page.locator("#ai-dialog-form").evaluate((e) => e.requestSubmit());
      await page.locator(".ai-message-error").waitFor();
      assert.match(await page.locator(".ai-message-error").innerText(), /401/);
      checks++;
      assert(await page.locator("#ai-send").isEnabled());
      checks++;
      await page.locator("#ai-dialog .close").click();
      await page.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1",
      );
      await page.locator(".ai-open:visible").click();
      assert(
        await page.evaluate(() =>
          window.testRuntime
            .snapshot()
            .data.uiPreferences.aiSelection.lifeData.includes("*"),
        ),
      );
      checks++;
      await page.locator("#ai-context-open").click();
      await page.locator("#ai-context-clear").click();
      await page.locator("#ai-context-done").click();
      assert.deepEqual(
        await page.evaluate(
          () => window.testRuntime.snapshot().data.uiPreferences.aiSelection,
        ),
        {},
      );
      checks++;
      await page.locator("#ai-dialog .close").click();
      await page.locator('[data-page="life"]:visible').first().click();
      await page.locator('[data-life-tab="finances"]:visible').first().click();
      await page.screenshot({
        path: ".artifacts/refined-finance-" + width + ".png",
      });
      assert(
        await page
          .locator(".finance-panel")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
      checks++;
      for (const mode of ["year", "range", "month"]) {
        await page.locator("#finance-period-mode").evaluate((e, v) => {
          e.value = v;
          e.dispatchEvent(new Event("change", { bubbles: true }));
        }, mode);
        await page.waitForTimeout(80);
        assert.equal(
          await page.locator(".finance-range-controls").isVisible(),
          mode === "range",
        );
        checks++;
        assert.equal(
          await page.locator(".finance-period-value").isVisible(),
          mode !== "range",
        );
        checks++;
        assert(
          await page
            .locator(".finance-period")
            .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        );
        checks++;
      }
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed: true,
        checks,
        widths: [320, 390, 1280],
        scope:
          "Synthetic browser fixture, mocked provider; context persistence, long proposals, errors, compact sleep, finance filters; no physical phone or live AI",
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
