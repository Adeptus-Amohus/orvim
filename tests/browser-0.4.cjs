const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
let browser;
(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 950 },
  });
  page.setDefaultTimeout(5000);
  const errors = [],
    layouts = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let checks = 0;
  const check = (value, label) => {
    assert.ok(value, label);
    checks++;
  };
  const close = async () => {
    if (await page.locator(".overlay:visible").count())
      await page.keyboard.press("Escape");
  };
  await page.goto("http://127.0.0.1:5180/tests/browser-harness.html");
  await page.locator("#all-tasks-open").waitFor();
  check(
    (await page.locator("#task-list .task").count()) === 1,
    "Only dated/timed current task on Home",
  );
  await page.locator("#all-tasks-open").click();
  check(
    (await page
      .locator("#all-tasks-dialog")
      .getByRole("button", { name: "Без времени", exact: true })
      .count()) === 1,
    "Untimed task accessible in general list",
  );
  await close();
  await page.locator(".ai-open:visible").first().click();
  await page.locator("#ai-context-open").click();
  await page.locator('[data-ai-source="projectTasks"]').click();
  await page.locator("#ai-context-items input").last().check();
  await page.locator(".ai-context-presets summary").click();
  await page.locator("#ai-context-name").fill("Мой проект");
  await page.locator("#ai-context-save").click();
  check(
    (await page.locator("#ai-context-preset option").count()) === 2,
    "Context preset saved",
  );
  await page.locator("#ai-context-done").click();
  await page.locator("#ai-prompt").fill("Проанализируй");
  await page.locator("#ai-send").click();
  await page.locator("#ai-messages li").last().waitFor();
  check(
    (await page.locator("#ai-messages li").count()) === 2,
    "Markdown list is rendered",
  );
  check(
    (await page.evaluate(() => testRequests.at(-1).context.tasks.length)) === 2,
    "Project context includes both tasks",
  );
  await page.evaluate(() => {
    testRuntime.snapshot();
    window.testAnswer = {
      message: "Создам настоящий проект",
      changes: [
        {
          operation: "upsert",
          collection: "projects",
          id: null,
          data: JSON.stringify({
            name: "ИИ проект",
            description: "План",
            tone: "pine",
          }),
        },
        {
          operation: "upsert",
          collection: "tasks",
          id: null,
          data: JSON.stringify({
            title: "Первый шаг",
            context: "ИИ проект",
            date: window.testDay,
            done: false,
          }),
        },
      ],
    };
  });
  await page.locator("#ai-prompt").fill("Создай проект с задачей");
  await page.locator("#ai-send").click();
  await page.locator("#ai-changes .ai-change").first().waitFor();
  check(
    await page.evaluate(
      () =>
        !testRuntime
          .snapshot()
          .data.projects.some((p) => p.name === "ИИ проект"),
    ),
    "Proposal does not mutate records",
  );
  await page
    .locator("#ai-changes")
    .getByRole("button", { name: "Применить изменения", exact: true })
    .click();
  await page
    .locator("#project-name")
    .filter({ hasText: "ИИ проект" })
    .waitFor();
  check(
    await page.evaluate(() =>
      testRuntime
        .snapshot()
        .data.tasks.some(
          (t) => t.title === "Первый шаг" && t.context === "ИИ проект",
        ),
    ),
    "AI creates linked task and opens real project",
  );
  await page.reload();
  await page.locator("#project-name").waitFor();
  check(
    await page.evaluate(() =>
      testRuntime.snapshot().data.projects.some((p) => p.name === "ИИ проект"),
    ),
    "Created project survives browser restart",
  );
  await page.locator(".ai-open:visible").first().click();
  await page.evaluate(() => (testProviderError = true));
  await page.locator("#ai-prompt").fill("Не потерять запрос");
  await page.locator("#ai-send").click();
  await page.locator(".ai-message-error").filter({ hasText: "401" }).waitFor();
  check(
    (await page.locator("#ai-prompt").inputValue()) === "Не потерять запрос",
    "Error preserves draft",
  );
  await page.evaluate(() => (testProviderError = false));
  await close();
  for (const width of [320, 360, 390, 768, 1100, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.locator(".ai-open:visible").first().click();
    await page.waitForTimeout(100);
    const bounds = await page.locator("#ai-dialog .dialog").boundingBox(),
      overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth + 2,
      );
    check(
      bounds.x >= -1 && bounds.x + bounds.width <= width + 1 && !overflow,
      "AI fits viewport " + width,
    );
    layouts.push({ width, bounds });
    await close();
    await page.locator('[data-open="settings-dialog"]:visible').first().click();
    await page.locator('[data-settings-tab="data"]:visible').click();
    const box = await page.locator("#settings-dialog .dialog").boundingBox();
    check(
      box.x >= -1 && box.x + box.width <= width + 1,
      "Data settings fit " + width,
    );
    await close();
  }
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.locator(".ai-open:visible").first().click();
  await page.evaluate(() => (document.documentElement.style.zoom = "1.5"));
  await page.waitForTimeout(100);
  check(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 2,
    ),
    "AI at 150% zoom fits",
  );
  await page.screenshot({ path: ".artifacts/ai-0.4.png" });
  await page.evaluate(() => (document.documentElement.style.zoom = ""));
  await close();
  await page.evaluate(() => {
    const snapshot = testRuntime.snapshot();
    snapshot.data.activePage = "home";
    snapshot.data.tasks = Array.from({ length: 1000 }, (_, index) => ({
      id: 100 + index,
      title: "Задача " + index,
      context: "Проверка",
      date: testDay,
      time: "08:00",
      done: false,
    }));
    snapshot.data.events = Array.from({ length: 300 }, (_, index) => ({
      id: 2000 + index,
      title: "Событие " + index,
      context: "Проверка",
      date: testDay,
      start: "10:00",
      end: "11:00",
      tone: "sun",
    }));
    snapshot.data.nextId = 3000;
    testRuntime.applyRemote(snapshot);
    testServices.persist(snapshot);
  });
  await page.reload();
  await page.locator("#task-list .task").last().waitFor();
  check(
    (await page.locator("#task-list .task").count()) === 1300,
    "1000 timed tasks plus 300 scheduled events remain accessible",
  );
  const box = await page.locator("#task-list").boundingBox();
  check(box.height < 900, "Task list remains bounded under stress");
  await page.locator("#task-list .task-more").nth(999).click();
  check(
    (await page.locator("#item-actions-dialog:visible").count()) === 1,
    "Deep list action menu visible",
  );
  await close();
  await page.locator('[data-open="settings-dialog"]:visible').first().click();
  await page.locator('[data-settings-tab="data"]:visible').click();
  const networkDetails = page
    .locator("#lan-settings")
    .locator("xpath=ancestor::details[1]");
  if (await networkDetails.count())
    await networkDetails.evaluate((el) => (el.open = true));
  await page.evaluate(() => {
    // This scenario supplies a conflict directly to the UI. Stop the mock
    // polling loop so a subsequent empty status cannot overwrite the fixture.
    window.testLan();
    const before = {
      id: 42,
      _syncId: "review-task",
      title: "Локальная задача",
      date: testDay,
      time: "08:00",
      done: false,
    };
    const after = { ...before, title: "Версия телефона" };
    window.dispatchEvent(
      new CustomEvent("life-os:lan-status", {
        detail: {
          mode: "off",
          review: {
            transport: "lan",
            source: { "tasks/review-task": "Тестовый телефон" },
            changes: [
              {
                key: "tasks/review-task",
                collection: "tasks",
                label: "Задачи",
                type: "Конфликт",
                title: after.title,
                before,
                after,
                conflicts: [],
              },
            ],
          },
        },
      }),
    );
  });
  await page
    .getByRole("button", { name: "Сравнить изменения", exact: true })
    .click();
  check(
    await page.locator("#sync-review-dialog").isVisible(),
    "WebDAV comparison accessible while LAN is off",
  );
  check(
    (await page.locator(".sync-review-columns").textContent()).includes(
      "Время: 08:00",
    ),
    "Comparison fields have readable labels",
  );
  const compareChoices = page.locator(
    '#sync-review-dialog input[type="checkbox"]',
  );
  await compareChoices.nth(1).check();
  await compareChoices.nth(0).uncheck();
  check(
    (await compareChoices.nth(1).isDisabled()) &&
      !(await compareChoices.nth(1).isChecked()),
    "Rejecting a record disables the redundant second copy",
  );
  await page.setViewportSize({ width: 320, height: 568 });
  const comparisonBox = await page
    .locator("#sync-review-dialog .dialog")
    .boundingBox();
  check(
    comparisonBox.x >= -1 && comparisonBox.x + comparisonBox.width <= 321,
    "Comparison fits 320px viewport",
  );
  await close();
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.evaluate(() =>
    window.dispatchEvent(
      new CustomEvent("life-os:lan-status", { detail: { review: null } }),
    ),
  );
  check(!errors.length, "No browser errors: " + errors.join("; "));
  await page.screenshot({
    path: ".artifacts/home-stress-0.4.png",
  });
  fs.writeFileSync(
    ".artifacts/browser-0.4.json",
    JSON.stringify(
      {
        checks,
        layouts,
        errors,
        scope:
          "Real desktop Chrome with 320–1920px mobile viewports, mocked native services; no physical Android",
      },
      null,
      2,
    ),
  );
  console.log("Browser 0.4: " + checks + " checks passed.");
  await browser.close();
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
