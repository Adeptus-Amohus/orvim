const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    for (const width of [390, 1440]) {
      const p = await b.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
      );
      await p.waitForFunction(() => !!window.testRuntime);
      await p.locator(".ai-open:visible").first().click();
      assert.equal(await p.locator("#ai-voice").count(), 0);
      await p.locator("#ai-prompt").fill("Текст с клавиатуры — поправленный");
      await p.locator("#ai-dialog-form .close").click();
      await p.locator(".ai-open:visible").first().click();
      assert.equal(
        await p.locator("#ai-prompt").inputValue(),
        "Текст с клавиатуры — поправленный",
      );
      assert.ok(await p.locator("#ai-send").isVisible());
      const overflow = await p
        .locator("#ai-dialog-form")
        .evaluate((e) => e.scrollWidth > e.clientWidth + 1);
      assert.equal(overflow, false);
      assert.deepEqual(errors, []);
      await p.screenshot({
        path: ".artifacts/keyboard-chat-" + width + ".png",
      });
      await p.close();
    }
    console.log("Keyboard chat: 12 browser checks passed");
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
