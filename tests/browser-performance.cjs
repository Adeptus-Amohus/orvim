const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const url = process.env.ORVIM_BENCH_URL || "http://127.0.0.1:5182";

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const errors = [];
  try {
    await fs.mkdir(".artifacts/performance", { recursive: true });
    for (const [name, width, height] of [
      ["desktop", 1440, 900],
      ["mobile", 390, 844],
    ]) {
      const page = await browser.newPage({
        viewport: { width, height },
        locale: "ru-RU",
      });
      page.setDefaultTimeout(12000);
      page.on("pageerror", (e) => errors.push(e.message));
      let release;
      const gate = new Promise((resolve) => {
        release = resolve;
      });
      await page.route("**/assets/FullApp-*.js", async (route) => {
        await gate;
        await route.continue();
      });
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.locator(".startup-emblem").waitFor();
      assert.equal(await page.locator(".startup").innerText(), "");
      assert.equal(
        await page
          .locator(".startup-emblem")
          .evaluate((e) => e.complete && e.naturalWidth > 0),
        true,
      );
      const before = await page
        .locator(".startup-emblem")
        .evaluate((e) => getComputedStyle(e).transform);
      await page.waitForTimeout(100);
      assert.notEqual(
        await page
          .locator(".startup-emblem")
          .evaluate((e) => getComputedStyle(e).transform),
        before,
      );
      await page.screenshot({
        path: `.artifacts/performance/loading-${name}.png`,
      });
      await page.emulateMedia({ reducedMotion: "reduce" });
      assert.equal(
        await page
          .locator(".startup-emblem")
          .evaluate((e) => getComputedStyle(e).animationName),
        "none",
      );
      release();
      console.log(name + ": loading verified, opening workspace");
      await page.locator("#life-os-workspace").waitFor({ state: "visible" });
      for (const target of ["projects", "archive", "home"]) {
        console.log(name + ": " + target);
        await page.locator(`[data-page="${target}"]:visible`).first().click();
      }
      for (const tab of ["food", "sleep", "training", "finances"]) {
        console.log(name + ": life/" + tab);
        await page.locator('[data-page="life"]:visible').first().click();
        await page.locator(`[data-life-tab="${tab}"]:visible`).first().click();
        assert.equal(await page.locator(`#life-${tab}-view`).isVisible(), true);
      }
      await page.locator('[data-page="home"]:visible').first().click();
      await page.screenshot({
        path: `.artifacts/performance/workspace-${name}.png`,
      });
      await page.close();
    }
    const english = await browser.newPage({ locale: "en-US" });
    english.on("pageerror", (e) => errors.push(e.message));
    await english.goto(url);
    await english.locator("#life-os-workspace").waitFor({ state: "visible" });
    english.setDefaultTimeout(12000);
    await english.locator('[data-page="archive"]:visible').first().click();
    await english.locator('[data-page="home"]:visible').first().click();
    await english.waitForTimeout(300);
    const mutations = await english.evaluate(
      () =>
        new Promise((resolve) => {
          let count = 0;
          const observer = new MutationObserver((records) => {
            count += records.length;
          });
          observer.observe(document.getElementById("life-os-workspace"), {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
          });
          setTimeout(() => {
            observer.disconnect();
            resolve(count);
          }, 800);
        }),
    );
    assert.ok(
      mutations < 30,
      `English interface should settle, observed ${mutations} mutations`,
    );
    // The localized picker label must preserve a Russian user-owned collection.
    const label = await english
      .locator('[data-control-for="db-move-collection"]')
      .getAttribute("aria-label");
    assert.ok(label.includes("Фильмы"), label);
    assert.ok(label.startsWith("Move to collection"), label);
    await english.close();

    const recovery = await browser.newPage({ locale: "ru-RU" });
    recovery.setDefaultTimeout(12000);
    recovery.on("pageerror", (e) => errors.push(e.message));
    await recovery.addInitScript(() => {
      window.restoreStorage = indexedDB.open.bind(indexedDB);
      indexedDB.open = () => {
        const request = {
          error: Error("Storage unavailable for regression check"),
        };
        queueMicrotask(() => request.onerror?.());
        return request;
      };
    });
    await recovery.goto(url);
    await recovery
      .getByText("Storage unavailable for regression check", { exact: false })
      .waitFor();
    assert.equal(await recovery.locator(".startup-emblem").count(), 0);
    await recovery.evaluate(() => {
      indexedDB.open = window.restoreStorage;
    });
    await recovery
      .getByRole("button", { name: "Повторить", exact: true })
      .click();
    await recovery.locator("#life-os-workspace").waitFor({ state: "visible" });
    await recovery.close();
    assert.deepEqual(errors, []);
    console.log(
      JSON.stringify({
        passed: true,
        englishIdleMutations: mutations,
        checked: [
          "animated text-free loading",
          "reduced motion",
          "desktop/mobile navigation",
          "food, sleep, training and finance views",
          "English observer settles",
          "user-owned collection labels",
          "failed storage retry",
        ],
        scope:
          "Production build in desktop Chrome with two viewport sizes; physical Android refresh rate is not measured.",
      }),
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
