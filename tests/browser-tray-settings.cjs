const assert = require("node:assert/strict");
const fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1100, height: 850 },
    });
    const errors = [];
    page.on("pageerror", (e) => {
      errors.push(e.message);
      console.error(e.message);
    });
    await page.route("**/tests/browser-harness.html*", async (route) => {
      const response = await route.fetch();
      const html = (await response.text()).replace(
        "window.testRuntime = mountWorkspace(",
        `
        services.desktopTray = true;
        const originalPlatform = services.platform;
        window.trayEnabled = localStorage.getItem('test-tray-enabled') !== 'false';
        services.platform = async (operation, args) => {
          if (operation !== 'traySettings') return originalPlatform(operation, args);
          if (window.trayFail) throw Error('test write failed');
          if (typeof args.enabled === 'boolean') {
            window.trayEnabled = args.enabled;
            localStorage.setItem('test-tray-enabled', String(args.enabled));
          }
          window.trayLanguage = args.language || window.trayLanguage;
          return { enabled: window.trayEnabled, available: true };
        };
        window.testRuntime = mountWorkspace(`,
      );
      await route.fulfill({ response, body: html });
    });
    await page.goto("http://127.0.0.1:5180/tests/browser-harness.html");
    await page.waitForFunction(() => !!window.testRuntime);
    const open = async () =>
      page.locator('[data-open="settings-dialog"]:visible').first().click();
    await open();
    const checkbox = page.locator("#close-to-tray");
    assert.equal(await checkbox.isChecked(), true);
    await checkbox.uncheck();
    await page.waitForFunction(() => window.trayEnabled === false);
    await page.reload();
    await page.waitForFunction(() => !!window.testRuntime);
    await open();
    assert.equal(await checkbox.isChecked(), false);
    await page.locator("#language-select").selectOption("en", { force: true });
    await page.waitForFunction(() => window.trayLanguage === "en");
    assert.match(
      await page.locator(".tray-setting-label").innerText(),
      /Minimize to tray/,
    );
    await page.evaluate(() => (window.trayFail = true));
    await checkbox.click();
    await page.waitForFunction(
      () =>
        !document.querySelector("#close-to-tray").checked &&
        !document.querySelector("#close-to-tray").disabled,
    );
    assert.match(
      await page.locator(".tray-setting-label").locator("..").innerText(),
      /Could not change/,
    );
    fs.mkdirSync(".artifacts/tray", { recursive: true });
    await page.screenshot({ path: ".artifacts/tray/settings.png" });
    assert.deepEqual(errors, []);
    const mobile = await browser.newPage();
    await mobile.goto(
      "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1",
    );
    await mobile.waitForFunction(() => !!window.testRuntime);
    assert.equal(await mobile.locator("#close-to-tray").count(), 0);
    console.log(
      "Tray settings: default, save/reload, English, rollback after failure, mobile absence passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
