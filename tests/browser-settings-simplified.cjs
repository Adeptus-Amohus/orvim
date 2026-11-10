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
    for (const width of [320, 390, 1280])
      for (const theme of ["light", "dark"]) {
        const page = await browser.newPage({
          viewport: { width, height: 980 },
        });
        page.on("pageerror", (e) => errors.push(e.message));
        await page.goto(
          "http://127.0.0.1:5180/tests/browser-harness.html?ux22=1&mobile=" +
            (width < 600 ? 1 : 0),
        );
        await page
          .locator('[data-open="settings-dialog"]:visible')
          .first()
          .click();
        await page.locator('button[data-appearance="' + theme + '"]').click();
        await page.locator('[data-settings-tab="data"]').click();
        await page
          .locator("#lan-settings")
          .evaluate((e) => (e.closest("details").open = true));
        await page
          .locator(".backup-card")
          .evaluate((e) => (e.closest("details").open = true));
        await page.evaluate(() => {
          window.testLan();
          window.lanCalls = [];
          window.addEventListener(
            "life-os:lan-action",
            (e) => {
              window.lanCalls.push(e.detail);
              e.stopImmediatePropagation();
            },
            { capture: true },
          );
          window.dispatchEvent(
            new CustomEvent("life-os:lan-status", {
              detail: {
                mode: "host",
                id: "babd6d27-afa3-4731-96db-8ef8621c6820",
                addresses: ["192.168.0.11"],
                port: 42673,
                lastSync: Date.now(),
                code: "12345678",
                expires: Date.now() - 1000,
                peers: [{ name: "Мой телефон", id: "phone" }],
                error: "",
                busy: false,
              },
            }),
          );
        });
        assert.equal(await page.locator(".lan-pairing-box").isVisible(), false);
        checks++;
        assert.equal(
          await page
            .getByText("Идентификатор ПК:", { exact: false })
            .isVisible(),
          false,
        );
        checks++;
        assert.equal(
          await page.locator(".lan-technical input").isVisible(),
          false,
        );
        checks++;
        assert.equal(await page.locator("#lan-error").isVisible(), false);
        checks++;
        const statusHeight = await page
          .locator(".lan-status-box")
          .evaluate((e) => e.getBoundingClientRect().height);
        await page.evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("life-os:lan-status", { detail: { busy: true } }),
          ),
        );
        assert.equal(
          await page
            .locator(".lan-status-box")
            .evaluate((e) => e.getBoundingClientRect().height),
          statusHeight,
        );
        checks++;
        await page.evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("life-os:lan-status", { detail: { busy: false } }),
          ),
        );
        assert.equal(
          await page
            .getByText("Копия нужна для восстановления всех записей", {
              exact: false,
            })
            .count(),
          0,
        );
        checks++;
        assert(await page.locator("#save-protected-backup").isVisible());
        checks++;
        assert(await page.locator("#export-csv").isVisible());
        checks++;
        assert.equal(await page.locator("#backup-download").isVisible(), false);
        checks++;
        await page.locator("#lan-add-device").click();
        await page
          .locator(".connection-actions button")
          .filter({ hasText: "Синхронизировать" })
          .click();
        assert.deepEqual(
          await page.evaluate(() => window.lanCalls.map((e) => e.operation)),
          ["host", "exchange"],
        );
        checks++;
        if (width !== 320)
          await page.screenshot({
            path: ".artifacts/settings-028-" + width + "-" + theme + ".png",
          });
        await page.locator(".lan-technical > summary").click();
        assert.equal(
          await page.locator(".lan-technical input").inputValue(),
          "192.168.0.11:42673",
        );
        checks++;
        await page
          .locator(".lan-technical button")
          .filter({ hasText: "Отключить" })
          .click();
        assert.equal(
          await page.evaluate(() => window.lanCalls.at(-1).operation),
          "stop",
        );
        checks++;
        await page.locator(".lan-technical > summary").click();
        await page.evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("life-os:lan-status", {
              detail: { code: "87654321", expires: Date.now() + 300000 },
            }),
          ),
        );
        assert(await page.locator(".lan-pairing-box").isVisible());
        checks++;
        assert.equal(
          await page.locator(".lan-pair-code strong").innerText(),
          "87654321",
        );
        checks++;
        await page.evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("life-os:lan-status", {
              detail: {
                error: "Сеть недоступна. Изменения сохранены на устройстве.",
              },
            }),
          ),
        );
        assert(await page.locator("#lan-error").isVisible());
        checks++;
        assert(
          !/недоступна|192\.168|Идентификатор/.test(
            await page
              .locator("#lan-settings")
              .evaluate(
                (e) => e.closest("details").querySelector("summary").innerText,
              ),
          ),
        );
        checks++;
        await page.locator("#save-protected-backup").click();
        assert(await page.locator("#protected-backup-dialog").isVisible());
        checks++;
        await page.locator("#protected-backup-dialog .close").click();
        await page
          .locator('[data-open="settings-dialog"]:visible')
          .first()
          .click();
        await page.locator('[data-settings-tab="data"]').click();
        await page.locator(".backup-formats > summary").click();
        assert(await page.locator("#backup-download").isVisible());
        checks++;
        assert(await page.locator("#backup-file").isVisible());
        checks++;
        await page.locator(".backup-formats > summary").click();
        assert(
          await page
            .locator("#settings-dialog .dialog")
            .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        );
        checks++;
        await page.evaluate(() =>
          window.dispatchEvent(
            new CustomEvent("life-os:lan-status", {
              detail: {
                mode: "client",
                hostName: "Мой ПК",
                address: "192.168.0.11:42673",
                error: "",
                code: null,
                expires: 0,
              },
            }),
          ),
        );
        assert.equal(await page.locator("#lan-add-device").isVisible(), false);
        checks++;
        await page.locator(".lan-client-options > summary").click();
        assert(
          await page
            .locator(".lan-client-options button")
            .filter({ hasText: "Отключить" })
            .isVisible(),
        );
        checks++;
        await page.close();
      }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed: true,
        checks,
        widths: [320, 390, 1280],
        themes: ["light", "dark"],
        scope:
          "Synthetic browser: host/client, expired/live pairing code, actions, visible failures, backup dialogs, hidden technical/legacy details, overflow.",
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
