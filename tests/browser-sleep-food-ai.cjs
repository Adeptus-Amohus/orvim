const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const origin = process.env.UI_TEST_URL || "http://127.0.0.1:5180";
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
      page.on("pageerror", (error) => errors.push(error.message));
      await page.addInitScript(() => {
        const NativeDate = Date;
        const now = new NativeDate(2026, 9, 27, 10).getTime();
        window.Date = class extends NativeDate {
          constructor(...args) {
            super(...(args.length ? args : [now]));
          }
          static now() {
            return now;
          }
        };
      });
      await page.goto(`${origin}/tests/browser-harness.html?mobile=1&ux22=1`);
      await page.evaluate(() => {
        window.testServices.readDocument = async () => {
          const d = structuredClone(window.testRuntime.snapshot());
          if (window.mismatch) {
            d.data.foodLogs.at(-1).calories = 999;
          }
          return { ...d, revision: 1 };
        };
      });
      const prompt = page.locator("#home-sleep-prompt");
      assert(await prompt.isVisible());
      checks++;
      await page.screenshot({ path: `.artifacts/sleep-home-${width}.png` });
      await prompt.click();
      assert(await page.locator("#life-sleep-view").isVisible());
      checks++;
      await page.screenshot({ path: `.artifacts/sleep-entry-${width}.png` });
      assert.match(
        await page.locator("#sleep-entry-status").innerText(),
        /ещё не записан/,
      );
      checks++;
      await page.locator("#sleep-hours").fill("7.37");
      assert(
        await page
          .locator("#sleep-hours")
          .evaluate((input) => input.validity.valid),
      );
      checks++;
      await page.locator('[data-sleep-hours="8"]').click();
      assert.equal(await page.locator("#sleep-hours").inputValue(), "8");
      checks++;
      await page.locator("#sleep-form button[type=submit]").click();
      assert.match(
        await page.locator("#sleep-entry-status").textContent(),
        /сохранён/,
      );
      checks++;
      assert.equal(
        await page.evaluate(
          () =>
            window.testRuntime
              .snapshot()
              .data.sleepLogs.find((x) => x.date === window.testDay)
              .manualOverride,
        ),
        true,
      );
      checks++;
      await page.locator("#sleep-entry-disclosure > summary").click();
      await page.locator("#sleep-date").evaluate((input) => {
        input.value = "2026-10-26";
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      assert.equal(await page.locator("#sleep-hours").inputValue(), "");
      checks++;
      await page.locator("#sleep-date").evaluate((input) => {
        input.value = "2026-10-27";
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      assert.equal(await page.locator("#sleep-hours").inputValue(), "8");
      checks++;
      await page.locator('[data-page="home"]:visible').first().click();
      assert.equal(await prompt.isVisible(), false);
      checks++;
      await page.locator('[data-page="life"]:visible').first().click();
      await page.locator('[data-life-tab="food"]:visible').first().click();
      assert.equal(
        await page.locator("#food-entry-disclosure").evaluate((e) => e.open),
        false,
      );
      checks++;
      await page.screenshot({ path: `.artifacts/food-compact-${width}.png` });
      await page.locator("#food-ai-open").click();
      assert(await page.locator("#ai-dialog").isVisible());
      checks++;
      assert.match(
        await page.locator("#ai-prompt").inputValue(),
        /Запиши питание за/,
      );
      checks++;
      await page.evaluate(() => {
        window.mismatch = true;
        window.testAnswer = {
          message: "Готово",
          changes: [
            {
              operation: "upsert",
              collection: "foodLogs",
              id: null,
              data: JSON.stringify({
                date: window.testDay,
                name: "Банан",
                calories: 250,
                protein: 1,
                fat: 0,
                carbs: 27,
              }),
            },
          ],
        };
      });
      await page.locator("#ai-prompt").fill("Добавь банан");
      await page.locator("#ai-dialog-form").evaluate((e) => e.requestSubmit());
      await page.getByText("Предложение ИИ · ещё не сохранено").waitFor();
      assert.match(await page.locator("#ai-changes").innerText(), /250 ккал/);
      checks++;
      assert.match(
        await page.locator("#ai-changes").innerText(),
        /БЖУ дают примерно 112 ккал/,
      );
      checks++;
      await page.getByRole("button", { name: "Применить изменения" }).click();
      await page
        .getByText("Не удалось подтвердить состав записи повторным чтением.", {
          exact: false,
        })
        .waitFor();
      checks++;
      assert(
        !(await page.locator("#ai-changes").innerText()).includes(
          "проверено в базе",
        ),
      );
      checks++;
      await page.evaluate(() => {
        window.mismatch = false;
        window.testAnswer = {
          message: "Записал",
          changes: [
            {
              operation: "upsert",
              collection: "foodLogs",
              id: null,
              data: JSON.stringify({
                date: window.testDay,
                name: "Яблоко",
                calories: 80,
                protein: 0,
                fat: 0,
                carbs: 20,
              }),
            },
          ],
        };
      });
      await page.locator("#ai-prompt").fill("Добавь яблоко");
      await page.locator("#ai-dialog-form").evaluate((e) => e.requestSubmit());
      await page.getByText("Предложение ИИ · ещё не сохранено").waitFor();
      await page.getByRole("button", { name: "Применить изменения" }).click();
      await page.getByText("Сохранено · проверено в базе").waitFor();
      assert.match(
        await page.locator("#ai-changes").innerText(),
        /Яблоко · 80 ккал/,
      );
      checks++;
      assert(
        await page
          .locator("#ai-dialog .assistant-shell")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
      checks++;
      await page.screenshot({ path: `.artifacts/sleep-food-ai-${width}.png` });
      await page.evaluate(() => {
        const item = window.testRuntime
          .snapshot()
          .data.foodLogs.find((x) => x.name === "Яблоко");
        window.testAnswer = {
          message: "Изменение",
          changes: [
            {
              operation: "upsert",
              collection: "foodLogs",
              id: item.id,
              data: JSON.stringify({ calories: 90 }),
            },
          ],
        };
      });
      await page.locator("#ai-prompt").fill("Правка");
      await page.locator("#ai-dialog-form").evaluate((e) => e.requestSubmit());
      await page.getByText("Предложение ИИ · ещё не сохранено").waitFor();
      assert.match(await page.locator("#ai-changes").innerText(), /90 ккал/);
      checks++;
      await page.getByRole("button", { name: "Применить изменения" }).click();
      await page.getByText("Сохранено · проверено в базе").waitFor();
      assert.match(
        await page.locator("#ai-changes").innerText(),
        /Яблоко · 90 ккал/,
      );
      checks++;
      await page.evaluate(() => {
        const item = window.testRuntime
          .snapshot()
          .data.foodLogs.find((x) => x.name === "Яблоко");
        window.testAnswer = {
          message: "Удаление",
          changes: [
            {
              operation: "delete",
              collection: "foodLogs",
              id: item.id,
              data: null,
            },
          ],
        };
      });
      await page.locator("#ai-prompt").fill("Удаление");
      await page.locator("#ai-dialog-form").evaluate((e) => e.requestSubmit());
      await page.getByText("Предложение ИИ · ещё не сохранено").waitFor();
      await page.getByRole("button", { name: "Применить изменения" }).click();
      await page.getByText("Сохранено · проверено в базе").waitFor();
      assert.match(
        await page.locator("#ai-changes").innerText(),
        /Удалено .* Яблоко .* 90 ккал/,
      );
      checks++;
      await page.evaluate(
        () =>
          (window.testAnswer = { message: "Всё уже записано", changes: [] }),
      );
      await page.locator("#ai-prompt").fill("Спасибо");
      await page.locator("#ai-dialog-form").evaluate((e) => e.requestSubmit());
      await page
        .getByText(
          "Данные не изменены: ИИ не предложил записей для сохранения.",
        )
        .waitFor();
      checks++;
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed: true,
        checks,
        widths: [320, 390, 1280],
        scope:
          "Chromium, simulated viewport and mocked AI and persistence; no real provider or phone",
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
