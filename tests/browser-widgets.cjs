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
      "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1",
    );
    await page.waitForFunction(() => !!window.testRuntime);
    const action = async (detail) =>
      page.evaluate(
        (detail) =>
          window.dispatchEvent(
            new CustomEvent("orvim:widget-action", { detail }),
          ),
        detail,
      );
    await action({ action: "task" });
    assert.equal(await page.locator("#capture-dialog").isVisible(), true);
    assert.equal(
      await page
        .locator("#capture-text")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await action({ action: "thought" });
    assert.equal(
      await page
        .locator("#thought-feed-capture")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    await action({ action: "food" });
    assert.equal(
      await page
        .locator("#food-name")
        .evaluate((e) => e === document.activeElement),
      true,
    );
    assert.equal(
      await page.locator("#food-entry-disclosure").evaluate((e) => e.open),
      true,
    );
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    assert.equal(await page.locator("#food-date").inputValue(), today);
    await action({ action: "complete", kind: "task", id: 2, done: true });
    assert.equal(
      await page.evaluate(
        () => testRuntime.snapshot().data.tasks.find((t) => t.id === 2).done,
      ),
      true,
    );
    // Re-delivery of the same intent must not toggle a completed task back.
    await action({ action: "complete", kind: "task", id: 2, done: true });
    assert.equal(
      await page.evaluate(
        () => testRuntime.snapshot().data.tasks.find((t) => t.id === 2).done,
      ),
      true,
    );
    await action({ action: "item", kind: "task", id: 2 });
    assert.equal(await page.locator("#task-dialog").isVisible(), true);
    assert.deepEqual(errors, []);
    console.log(
      "Widgets: task/thought/food routes, focus, date, completion and repeated intent passed.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
