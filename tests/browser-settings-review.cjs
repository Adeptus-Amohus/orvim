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
    for (const width of [320, 390, 1020, 1280]) {
      const page = await browser.newPage({ viewport: { width, height: 844 } });
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=" +
          (width < 600 ? 1 : 0) +
          "&ux22=1",
      );
      if (width >= 1000) {
        const rect = await page.evaluate(() => {
          const a = document
              .querySelector(".quick-row")
              .getBoundingClientRect(),
            b = document.querySelector(".tasks").getBoundingClientRect();
          return { a: a.bottom, b: b.top };
        });
        assert(rect.b - rect.a >= 12, JSON.stringify(rect));
        checks++;
        await page.screenshot({
          path: ".artifacts/settings-review-home-" + width + ".png",
        });
      }
      await page
        .locator('[data-open="settings-dialog"]:visible')
        .first()
        .click();
      assert.equal(
        await page.locator('#language-select option[value="kk"]').count(),
        0,
      );
      checks++;
      await page.locator('[data-settings-tab="connections"]').click();
      const spacing = await page
        .locator(".settings-connection-choices")
        .evaluate((e) => {
          const rows = [...e.children].map((e) => e.getBoundingClientRect());
          return rows.slice(1).map((r, i) => r.top - rows[i].bottom);
        });
      assert.equal(spacing.length, 3);
      checks++;
      assert(spacing.every((x) => x >= 8));
      checks++;
      await page.screenshot({
        path: ".artifacts/settings-review-connections-" + width + ".png",
      });
      await page.locator('[data-settings-tab="data"]').click();
      assert(
        !/WebDAV|между разными сетями/i.test(
          await page.locator("#settings-panel-data").innerText(),
        ),
      );
      checks++;
      assert(
        await page
          .locator(".settings-disclosure summary strong")
          .filter({ hasText: "Удаление данных" })
          .isVisible(),
      );
      checks++;
      await page.locator("#delete-all-data").evaluate((e) => {
        e.closest("details").open = true;
      });
      await page.locator("#delete-all-data").click();
      await page.locator("#backup-confirm-dialog").waitFor();
      assert.match(
        await page.locator("#backup-confirm-dialog").innerText(),
        /телефон|других устройствах/,
      );
      checks++;
      await page.locator("#backup-confirm-dialog input").fill("wrong");
      await page
        .locator("#backup-confirm-dialog button")
        .filter({ hasText: "Подтвердить" })
        .click();
      assert.match(
        await page.locator("#backup-confirm-dialog").innerText(),
        /Введите Orvim/,
      );
      checks++;
      if (width === 390) {
        await page.evaluate(() => {
          window.wipeSequence = [];
          window.addEventListener("life-os:before-wipe", () =>
            window.wipeSequence.push("pause"),
          );
          window.addEventListener("life-os:wipe-failed", () =>
            window.wipeSequence.push("resume"),
          );
          const previous = window.testServices.backups;
          window.testServices.backups = async (op, ...args) => {
            if (op === "wipe") {
              window.wipeSequence.push("wipe");
              throw Error("Synthetic reset refusal");
            }
            return previous(op, ...args);
          };
          const lan = window.testServices.lan;
          window.testServices.lan = async (op, ...args) => {
            if (op === "stop") window.wipeSequence.push("stop");
            return lan(op, ...args);
          };
        });
        await page.locator("#backup-confirm-dialog input").fill("Orvim");
        await page
          .locator("#backup-confirm-dialog button")
          .filter({ hasText: "Подтвердить" })
          .click();
        await page
          .getByText("Error: Synthetic reset refusal", { exact: true })
          .waitFor();
        assert.deepEqual(await page.evaluate(() => window.wipeSequence), [
          "pause",
          "stop",
          "wipe",
          "resume",
        ]);
        checks++;
        assert(
          (await page.evaluate(
            () => window.testRuntime.snapshot().data.tasks.length,
          )) > 0,
        );
        checks++;
      }
      await page.locator("#backup-confirm-dialog .close").click();
      const overflow = await page
        .locator("#settings-dialog .dialog")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1);
      assert(overflow);
      checks++;
      await page.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed: true,
        checks,
        widths: [320, 390, 1020, 1280],
        scope:
          "Synthetic browser fixtures; spacing, supported languages, settings organization and reset cancellation. No real personal data deleted.",
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
