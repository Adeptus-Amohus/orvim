const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  const errors = [];
  try {
    for (const width of [320, 390, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
      );
      await page.evaluate((stress) => {
        window.usbStress = stress;
        window.fileOps = [];
        const old = window.testServices.lan;
        window.testServices.lan = async (op, args, doc) => {
          if (!op.startsWith("file")) return old(op, args, doc);
          window.fileOps.push(op);
          if (op === "fileExport")
            return { document: doc, content: "encrypted test fixture" };
          if (op === "fileImport") {
            window.beforeFile = structuredClone(doc);
            window.afterFile = structuredClone(doc);
            for (let i = 0; i < (window.usbStress ? 1000 : 1); i++)
              window.afterFile.data.tasks.push({
                id: 9001 + i,
                title: i === 0 ? "Задача с телефона" : "Из файла " + i,
                date: window.testDay,
                done: false,
                context: "Личное",
              });
            window.afterFile.data.nextId = 10002;
            window.changedTaskId = window.afterFile.data.tasks[0].id;
            window.oldTaskDate = window.afterFile.data.tasks[0].date;
            window.afterFile.data.tasks[0].date = "2026-11-02";
            return {
              document: window.afterFile,
              receipt: "file-receipt",
              comparison: { local: doc },
              conflicts: [
                {
                  id: "date-choice",
                  collection: "tasks",
                  uid: window.changedTaskId,
                  field: "date",
                  title: window.afterFile.data.tasks[0].title,
                  kept: "2026-11-02",
                  alternative: window.oldTaskDate,
                },
              ],
            };
          }
          if (op === "fileReview") {
            const result = structuredClone(window.afterFile);
            if (args.rejected.includes("tasks/" + window.changedTaskId))
              result.data.tasks.find(
                (t) => t.id === window.changedTaskId,
              ).date = window.oldTaskDate;
            return { document: result, receipt: "file-final" };
          }
          return { acknowledged: true };
        };
        window.testServices.saveFile = async () => true;
        window.testServices.openFile = async () =>
          new File(["encrypted test fixture"], "Orvim-transfer.json");
      }, width === 1280);
      await page
        .locator('[data-open="settings-dialog"]:visible')
        .first()
        .click();
      await page.locator('[data-settings-tab="data"]').click();
      await page
        .locator(".file-transfer-card")
        .evaluate((e) => (e.closest("details").open = true));
      await page.locator("#file-transfer-export").click();
      const fields = page.locator("#file-transfer-dialog input");
      await fields.nth(0).fill("Orvim transfer test");
      await fields.nth(1).fill("different passphrase");
      await page
        .locator("#file-transfer-dialog button")
        .filter({ hasText: "Сохранить файл" })
        .click();
      assert.match(
        await page.locator("#file-transfer-dialog").innerText(),
        /совпадать/,
      );
      checks++;
      await fields.nth(1).fill("Orvim transfer test");
      await page
        .locator("#file-transfer-dialog button")
        .filter({ hasText: "Сохранить файл" })
        .click();
      await page
        .getByText(
          "Файл переноса сохранён. Передайте его по USB на другое устройство.",
        )
        .waitFor();
      checks++;
      await page.locator("#file-transfer-import").click();
      await fields.nth(0).fill("Orvim transfer test");
      await page
        .locator("#file-transfer-dialog button")
        .filter({ hasText: "Сравнить записи" })
        .click();
      await page.locator("#sync-review-dialog").waitFor();
      assert.equal(
        await page.evaluate(() =>
          window.testRuntime.snapshot().data.tasks.some((t) => t.id === 9001),
        ),
        false,
      );
      checks++;
      assert.match(
        await page.locator("#sync-review-dialog").innerText(),
        /Задача с телефона/,
      );
      checks++;
      assert(
        await page
          .getByRole("button", { name: "Применить выбранное" })
          .isDisabled(),
      );
      checks++;
      await page
        .getByRole("button", { name: "Оставить на этом устройстве" })
        .click();
      assert(
        await page
          .getByRole("button", { name: "Применить выбранное" })
          .isEnabled(),
      );
      checks++;
      if (width === 1280) {
        assert.equal(await page.locator(".sync-review-object").count(), 50);
        checks++;
        await page
          .locator(".sync-review-pages button")
          .filter({ hasText: "Далее" })
          .click();
        assert.equal(await page.locator(".sync-review-object").count(), 50);
        checks++;
        assert(
          await page
            .getByRole("button", { name: "Применить выбранное" })
            .isEnabled(),
        );
        checks++;
        await page
          .locator(".sync-review-pages button")
          .filter({ hasText: "Назад" })
          .click();
        assert.equal(
          await page
            .locator('.sync-review-object[data-file-choice="local"]')
            .count(),
          1,
        );
        checks++;
      }
      await page.getByRole("button", { name: "Применить выбранное" }).click();
      await page.getByText("Данные из файла объединены и сохранены.").waitFor();
      assert(
        await page.evaluate(() =>
          window.testRuntime
            .snapshot()
            .data.tasks.some((t) => t.title === "Задача с телефона"),
        ),
      );
      checks++;
      assert(
        await page.evaluate(
          () =>
            window.testRuntime
              .snapshot()
              .data.tasks.find((t) => t.id === window.changedTaskId).date ===
            window.oldTaskDate,
        ),
      );
      checks++;
      assert.deepEqual(await page.evaluate(() => window.fileOps), [
        "fileExport",
        "fileImport",
        "fileReview",
        "fileAck",
      ]);
      checks++;
      await page
        .locator("#lan-settings")
        .evaluate((e) => (e.closest("details").open = true));
      await page.evaluate(() => {
        window.testServices.platform = async () => ({
          link: "lifeos://pair?id=11111111-1111-4111-8111-111111111111&address=192.168.0.11%3A42673&code=12345678",
        });
      });
      await page.locator("#lan-scan-qr").click();
      assert.equal(
        await page.locator("#lan-address").inputValue(),
        "192.168.0.11:42673",
      );
      checks++;
      assert.equal(await page.locator("#lan-code").inputValue(), "12345678");
      checks++;
      await page.evaluate(() => {
        window.testLan();
        window.dispatchEvent(
          new CustomEvent("life-os:lan-status", {
            detail: {
              mode: "host",
              conflicts: [
                {
                  id: "food",
                  collection: "@settings",
                  uid: "foodTarget",
                  field: "value",
                  title: "@settings",
                  kept: 2600,
                  alternative: 0,
                },
              ],
            },
          }),
        );
      });
      assert.match(
        await page.locator(".lan-conflicts").innerText(),
        /Дневная цель калорий/,
      );
      checks++;
      assert.match(
        await page.locator(".lan-conflicts").innerText(),
        /2600 ккал в день/,
      );
      checks++;
      assert.match(
        await page.locator(".lan-conflicts").innerText(),
        /Цель не задана/,
      );
      checks++;
      assert(
        !/\@settings/.test(await page.locator(".lan-conflicts").innerText()),
      );
      checks++;
      assert(
        await page
          .locator("#settings-dialog .dialog")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
      );
      checks++;
      await page.screenshot({
        path: ".artifacts/usb-029-conflict-" + width + ".png",
      });
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed: true,
        checks,
        widths: [320, 390, 1280],
        scope:
          "Synthetic browser: protected file dialog, mismatched password, merge preview before apply, file acknowledgements, QR form and readable calorie conflict. No physical cable/camera.",
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
