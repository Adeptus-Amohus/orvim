const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(
      "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
    );
    await page.evaluate(() => {
      window.testLan();
      const snapshot = window.testRuntime.snapshot();
      // Optional null ratings can be absent after a legacy LAN wire roundtrip.
      snapshot.data.archiveItems = [
        {
          id: 777,
          name: "Книга без оценки",
          category: "Книги",
          date: window.testDay,
        },
      ];
      window.testRuntime.applyRemote(snapshot);
      window.testAnswer = {
        message: "Предлагаю добавить банан.",
        changes: [
          {
            operation: "upsert",
            collection: "foodLogs",
            id: null,
            data: JSON.stringify({
              date: window.testDay,
              name: "Банан",
              calories: 105,
              protein: 1.3,
              fat: 0.3,
              carbs: 27,
            }),
          },
        ],
      };
      window.testServices.readDocument = async () => ({
        ...window.testRuntime.snapshot(),
        revision: 1,
      });
    });
    await page.locator(".ai-open:visible").click();
    await page.locator("#ai-prompt").fill("Добавь банан в еду");
    await page.locator("#ai-dialog-form").evaluate((e) => e.requestSubmit());
    const proposal = page.getByText("Предложение ИИ · ещё не сохранено");
    if (process.env.EXPECT_OLD_BUG === "1") {
      await page.getByText(/Некорректные записи: archiveItems/).waitFor();
      console.log(
        "Reproduced: a food-only proposal is blocked by an existing unrated database item.",
      );
      return;
    }
    await proposal.waitFor();
    await page.getByRole("button", { name: "Применить изменения" }).click();
    await page.getByText("Сохранено · проверено в базе").waitFor();
    const snapshot = await page.evaluate(() => window.testRuntime.snapshot());
    assert(
      snapshot.data.foodLogs.some(
        (row) => row.name === "Банан" && row.calories === 105,
      ),
    );
    assert.equal(snapshot.data.archiveItems[0].name, "Книга без оценки");
    assert.equal(snapshot.data.archiveItems[0].rating, undefined);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: ".artifacts/post-sync-banana-fixed.png" });
    console.log(
      JSON.stringify({
        passed: true,
        checks: 4,
        scope:
          "Browser: food-only AI proposal with legacy unrated archive item, explicit apply and persisted readback. No live provider request.",
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
