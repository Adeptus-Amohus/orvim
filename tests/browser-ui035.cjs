const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  const ok = (v, m) => {
    assert.ok(v, m);
    checks++;
  };
  try {
    for (const width of [320, 390, 1440])
      for (const appearance of ["light", "dark"]) {
        const p = await b.newPage({ viewport: { width, height: 900 } });
        const errors = [];
        p.on("pageerror", (e) => errors.push(e.message));
        await p.goto(
          "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
        );
        await p.waitForFunction(() => !!window.testRuntime);
        await p.evaluate((appearance) => {
          const d = testRuntime.snapshot();
          d.data.appearance = appearance;
          d.data.checkins = [
            { id: 99001, at: Date.now(), mood: 3, energy: 3, stress: 3 },
          ];
          testRuntime.applyRemote(d);
        }, appearance);
        await p
          .locator('[data-open="settings-dialog"]:visible')
          .first()
          .click();
        ok(
          (await p.locator(".settings-appearance button svg").count()) === 3,
          "all production appearance icons",
        );
        ok(
          (await p.locator(".themes button svg").count()) === 4,
          "all production color icons",
        );
        ok(
          (await p.locator(".themes button i[data-lucide]").count()) === 0,
          "no unrendered theme icons",
        );
        ok(
          await p
            .locator(".settings-appearance button")
            .evaluateAll((es) =>
              es.every(
                (e) =>
                  getComputedStyle(e).textAlign === "center" &&
                  getComputedStyle(e).alignItems === "center",
              ),
            ),
          "center labels",
        );
        ok(
          await p
            .locator(".themes .appearance-choice-icon")
            .evaluateAll(
              (es) =>
                new Set(es.map((e) => getComputedStyle(e).color)).size === 4,
            ),
          "distinct theme colors",
        );
        await p.screenshot({
          path: `.artifacts/ui035-settings-${width}-${appearance}.png`,
        });
        const originalFont = await p.locator("#font-select").inputValue();
        await p.locator('[data-control-for="font-select"]').click();
        const chosen = p.waitForEvent("filechooser");
        await p
          .getByRole("option", { name: "+ Свой шрифт…", exact: true })
          .click();
        const chooser = await chosen;
        ok(
          (await p.locator("#font-select").inputValue()) === originalFont,
          "upload action does not change font",
        );
        await chooser.setFiles("src/assets/fonts/libron/Libron-Regular.woff2");
        await p.waitForFunction(() =>
          document.querySelector("#font-select").value.startsWith("custom-"),
        );
        ok(
          await p
            .locator("#life-os-workspace")
            .evaluate((e) => e.style.fontFamily.includes("OrvimCustom")),
          "font upload from picker works",
        );
        await p.locator("#settings-dialog .close").click();
        await p.locator('[data-page="life"]:visible').first().click();
        for (const font of ["system", "soft", "strict", "libron"]) {
          await p.evaluate((font) => {
            const d = testRuntime.snapshot();
            d.data.fontMode = font;
            testRuntime.applyRemote(d);
          }, font);
          await p.evaluate(() => document.fonts.ready);
          ok(
            await p.locator(".life-core").evaluate((e) => {
              const r = e.getBoundingClientRect(),
                c = e
                  .querySelector(".life-core-caption")
                  .getBoundingClientRect();
              return (
                r.width >= 142 &&
                Math.abs(r.width - r.height) < 1 &&
                c.left >= r.left + 10 &&
                c.right <= r.right - 10 &&
                c.bottom < r.bottom - 10
              );
            }),
            "wellbeing caption inside circle " + font,
          );
        }
        await p.screenshot({
          path: `.artifacts/ui035-life-${width}-${appearance}.png`,
        });
        ok(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          "no overflow",
        );
        ok(errors.length === 0, errors.join("\n"));
        await p.close();
      }
    console.log(JSON.stringify({ passed: true, checks }));
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
