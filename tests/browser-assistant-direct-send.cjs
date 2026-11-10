const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    for (const width of [390, 1280]) {
      const page = await browser.newPage({
        viewport: { width, height: 844 },
        locale: "ru-RU",
      });
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1",
      );
      await page.waitForFunction(() => !!window.testRuntime);
      await page.evaluate(() => {
        const snapshot = testRuntime.snapshot();
        snapshot.data.foodLogs = [
          {
            id: 900,
            date: testDay,
            name: "Уже записанный обед",
            calories: 400,
            protein: 10,
            fat: 10,
            carbs: 40,
          },
        ];
        snapshot.data.nextId = 1000;
        testRuntime.applyRemote(snapshot);
        testRequests.length = 0;
      });
      await page.locator(".ai-open:visible").first().click();
      for (const [index, name] of ["Банан", "Конфеты"].entries()) {
        await page.evaluate((name) => {
          window.testAnswer = {
            message: "Предлагаю добавить " + name,
            changes: [
              {
                operation: "upsert",
                collection: "foodLogs",
                id: null,
                data: JSON.stringify({
                  date: testDay,
                  name,
                  calories: 90,
                  protein: 1,
                  fat: 1,
                  carbs: 20,
                }),
              },
            ],
          };
        }, name);
        await page
          .locator("#ai-prompt")
          .fill(
            "Запиши питание за " +
              (await page.evaluate(() => testDay)) +
              ": " +
              name,
          );
        await page.locator("#ai-send").click();
        await page.waitForFunction(
          (count) => testRequests.length === count,
          index + 1,
        );
        await page
          .getByRole("button", { name: "Применить изменения", exact: true })
          .waitFor();
        assert.equal(await page.locator("#ai-context-suggestion").count(), 0);
        assert.equal(
          await page.evaluate(
            (index) => !!testRequests[index].context.foodLogs,
            index,
          ),
          false,
          "Sending must not silently attach local records",
        );
        assert.equal(
          await page.evaluate(
            () => testRuntime.snapshot().data.foodLogs.length,
          ),
          index + 1,
          "Proposal must not save before Apply",
        );
        await page
          .getByRole("button", { name: "Применить изменения", exact: true })
          .click();
        await page.waitForFunction(
          (count) => testRuntime.snapshot().data.foodLogs.length === count,
          index + 2,
        );
      }
      await page.screenshot({
        path: `.artifacts/tray/assistant-direct-send-${width}.png`,
      });
      await page.locator("#ai-context-open").click();
      await page.locator('[data-ai-source="lifeData"]').click();
      await page.locator('#ai-context-items input[value="*"]').check();
      await page.locator("#ai-context-done").click();
      await page.evaluate(() => {
        window.testAnswer = { message: "Сводка", changes: [] };
      });
      await page.locator("#ai-prompt").fill("Сколько калорий за сегодня?");
      await page.locator("#ai-send").click();
      await page.waitForFunction(() => testRequests.length === 3);
      assert.equal(
        await page.evaluate(() => testRequests[2].context.foodLogs.length),
        3,
        "Explicit manual attachment must still work",
      );
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log(
      "Assistant: two consecutive food messages send directly, unselected records stay local, Apply saves once, manual attachment works (390/1280px).",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
