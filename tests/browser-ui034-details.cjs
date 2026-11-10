const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  const ok = (v, m) => {
    assert.ok(v, m);
    checks++;
  };
  try {
    for (const width of [390, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      const errors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
      );
      await page.waitForFunction(() => !!window.testRuntime);
      await page.evaluate(() => {
        const d = testRuntime.snapshot();
        d.data.projects = [{ id: 1, name: "Проект", tone: "pine" }];
        d.data.tasks = [
          {
            id: 9101,
            title: "Вредные привычки · V",
            context: "Проект",
            date: d.data.selectedDate,
            done: false,
            status: "planned",
          },
        ];
        d.data.workouts = [
          {
            id: 9201,
            trainingKey: "refine-workout",
            name: "Тренировка",
            date: d.data.selectedDate,
            time: "17:00",
            duration: 30,
            done: false,
            entries: [
              {
                exerciseKey: "pull",
                name: "Подтягивания",
                unit: "раз",
                sets: 3,
                value: 10,
                done: false,
              },
            ],
          },
        ];
        testRuntime.applyRemote(d);
      });
      await page.locator('[data-page="life"]:visible').first().click();
      await page.locator('[data-life-tab="training"]').first().click();
      await page
        .getByRole("button", { name: "Действия с тренировкой", exact: true })
        .first()
        .click();
      const labels = await page
        .locator("#training-actions-dialog .button")
        .allTextContents();
      ok(
        labels.join("|") ===
          "Изменить|Повторить|Удалить|Удалить несколько занятий…",
        "minimal workout actions",
      );
      await page.locator("#training-actions-dialog .close").click();
      await page.locator('[data-page="projects"]:visible').first().click();
      const title = page
        .locator(".project-card-title .project-item-name")
        .first();
      ok(
        await title.evaluate(
          (e) =>
            getComputedStyle(e).overflow === "visible" &&
            parseFloat(getComputedStyle(e).paddingTop) >= 4,
        ),
        "Kanban text has glyph padding and no clipping",
      );
      await page.screenshot({
        path: ".artifacts/ui034-kanban-" + width + ".png",
      });
      await page.locator('[data-page="archive"]:visible').first().click();
      await page.locator("#archive-category-add").click();
      ok(
        (await page.locator(".collection-status-field").count()) === 6,
        "labelled fields for all three statuses",
      );
      await page.screenshot({
        path: `.artifacts/ui034-collection-${width}.png`,
      });
      ok(
        await page
          .locator("#archive-category-dialog .dialog")
          .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
        "collection no overflow",
      );
      await page.locator("#archive-category-dialog .close").click();
      await page
        .locator('[data-open="settings-dialog"]:visible')
        .first()
        .click();
      await page
        .locator("#custom-font-file")
        .setInputFiles("src/assets/fonts/libron/Libron-Regular.woff2");
      await page.waitForFunction(() =>
        document.querySelector("#font-select").value.startsWith("custom-"),
      );
      const id = await page.locator("#font-select").inputValue();
      const saved = await page.evaluate(() => testRuntime.snapshot());
      await page.reload();
      await page.waitForFunction(() => !!window.testRuntime);
      await page.evaluate((s) => testRuntime.applyRemote(s), saved);
      await page.waitForFunction(
        (id) => document.querySelector("#font-select").value === id,
        id,
      );
      ok(
        await page
          .locator("#life-os-workspace")
          .evaluate((e) => e.style.fontFamily.includes("OrvimCustom")),
        "font survives reopen and restore",
      );
      await page
        .locator('[data-open="settings-dialog"]:visible')
        .first()
        .click();
      await page
        .getByRole("button", { name: "Удалить свой шрифт", exact: true })
        .click();
      await page.waitForFunction(
        () => document.querySelector("#font-select").value === "system",
      );
      ok(
        (await page.locator("#font-select").inputValue()) === "system",
        "custom font removed and system restored",
      );
      await page.locator("#custom-font-file").setInputFiles({
        name: "invalid.ttf",
        mimeType: "font/ttf",
        buffer: Buffer.from("<script>bad</script>"),
      });
      await page.waitForFunction(() =>
        document
          .querySelector('.custom-font-tools [role="status"]')
          .textContent.includes("Не удалось"),
      );
      ok(
        (await page
          .locator('#font-select option[value^="custom-"]')
          .count()) === 0,
        "invalid font rejected",
      );
      ok(errors.length === 0, errors.join("\n"));
      await page.close();
    }
    console.log(JSON.stringify({ passed: true, checks }));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
