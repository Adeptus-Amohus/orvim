const assert = require("node:assert/strict"),
  fs = require("node:fs");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const origin = process.env.UI_TEST_URL || "http://127.0.0.1:5180";
const out = ".artifacts/interaction-audit";
fs.mkdirSync(out, { recursive: true });
const report = {
  checks: 0,
  errors: [],
  scope:
    "Isolated Chromium profiles. Mobile viewport and VisualViewport simulated; no real Android, IME or installed Windows application.",
};
const check = (condition, label) => {
  assert.ok(condition, label);
  report.checks++;
};
const collections = [
  "tasks",
  "events",
  "projects",
  "thoughts",
  "checkins",
  "sleepLogs",
  "foodLogs",
  "waterLogs",
  "workouts",
  "trainingGoals",
  "archiveItems",
  "savedMeals",
  "taskTemplates",
  "financeLogs",
  "exercises",
  "recoveryLogs",
  "stepLogs",
];
const day = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const empty = () => ({
  data: {
    ...Object.fromEntries(collections.map((c) => [c, []])),
    version: 31,
    nextId: 5000,
    activePage: "home",
    languageMode: "ru",
    selectedDate: day(),
    selectedLifeDay: day(),
    uiPreferences: { backupFolderPrompted: true },
    archiveCategories: ["Книги"],
    waterTarget: 2000,
    foodTarget: 0,
  },
  covers: [],
});
let browser;
async function open(options = {}, document = empty(), query = "") {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 900 },
    ...options,
  });
  await context.addInitScript(
    (doc) => localStorage.setItem("test-workspace", JSON.stringify(doc)),
    document,
  );
  const page = await context.newPage();
  page.setDefaultTimeout(7000);
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(origin + "/tests/browser-harness.html" + query);
  await page.waitForFunction(() => window.testRuntime);
  return { page, context };
}
const escape = async (page) => {
  await page.locator("#page-title").evaluate((n) => {
    n.tabIndex = -1;
    n.focus();
  });
  await page.keyboard.press("Escape");
};
const back = async (page) =>
  page.evaluate(
    () =>
      !window.dispatchEvent(new Event("life-os:back", { cancelable: true })),
  );
const life = async (page, tab) => {
  await page.locator('[data-page="life"]:visible').first().click();
  if (tab) await page.locator(`[data-life-tab="${tab}"]`).click();
};
(async () => {
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  // Full React app: a blocked document read cannot expose partially mounted controls.
  const startupContext = await browser.newContext({
      viewport: { width: 1366, height: 900 },
    }),
    startup = await startupContext.newPage();
  startup.on("pageerror", (e) => report.errors.push(e.message));
  await startup.route("**/src/features/workspace/native.ts*", async (route) => {
    const response = await route.fetch(),
      source = await response.text();
    const changed = source.replace(
      "async function loadDocument() {",
      "async function loadDocument() { await new Promise(resolve => { window.__releaseDocument = resolve; });",
    );
    assert.notEqual(
      changed,
      source,
      "Startup delay was injected into the actual loader",
    );
    await route.fulfill({ response, body: changed });
  });
  await startup.goto(origin + "/");
  await startup.waitForFunction(() => window.__releaseDocument);
  check(
    await startup.locator(".startup").isVisible(),
    "Loading state visible during blocked document read",
  );
  check(
    !(await startup.locator("#life-os-workspace").isVisible()),
    "Partially initialized workspace is inaccessible",
  );
  await startup.evaluate(() => window.__releaseDocument());
  await startup.locator("#state-open").click();
  check(
    await startup.locator("#state-dialog").isVisible(),
    "First click opens wellbeing after delayed initialization",
  );
  await startup.locator("#state-dialog .close").click();
  await startup.locator("#task-add").click();
  check(
    await startup.locator("#capture-dialog").isVisible(),
    "Adding a task works immediately afterwards",
  );
  await startupContext.close();
  const firstMobile = empty();
  firstMobile.data.uiPreferences = {};
  const delayedSetup = await open(
    { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    firstMobile,
    "?mobile=1&deferSetup=1",
  );
  await delayedSetup.page.waitForFunction(() => window.testReleaseSetup);
  await delayedSetup.page.locator("#state-open").click();
  await delayedSetup.page.evaluate(() =>
    window.testReleaseSetup({ configured: false }),
  );
  await delayedSetup.page.waitForTimeout(50);
  check(
    (await delayedSetup.page.locator("#state-dialog").isVisible()) &&
      !(await delayedSetup.page
        .locator("#backup-folder-setup-dialog")
        .isVisible()),
    "Late first-run setup cannot replace wellbeing dialog",
  );
  await delayedSetup.page.locator("#state-dialog .close").click();
  await delayedSetup.page.locator("#task-add").click();
  check(
    await delayedSetup.page.locator("#capture-dialog").isVisible(),
    "Late setup response cannot block adding a task",
  );
  await delayedSetup.context.close();
  // Optional native services can remain unresolved without blocking the workspace.
  const { page, context } = await open({}, empty(), "?slow=1");
  for (let i = 0; i < 3; i++) {
    await page.locator("#state-open").click();
    check(
      await page.locator("#state-dialog").isVisible(),
      "First-run wellbeing is usable with pending native services",
    );
    await page.locator("#state-dialog .close").click();
  }
  await page.evaluate(() => {
    const node = document.querySelector('input[name="mood"][value="3"]');
    const original = node.focus;
    node.focus = function () {
      node.focus = original;
      throw Error("Injected focus failure");
    };
  });
  await page.locator("#state-open").click();
  check(
    await page.locator(".app").evaluate((n) => !n.inert),
    "Failed dialog initialization releases background controls",
  );
  await page.locator("#task-add").click();
  check(
    await page.locator("#capture-dialog").isVisible(),
    "Task form stays available after injected failure",
  );
  await page.locator("#capture-text").fill("Запись после первого запуска");
  for (const mode of ["dark", "light"]) {
    await page.evaluate(
      (mode) => document.querySelector(`[data-appearance="${mode}"]`).click(),
      mode,
    );
    const outline = await page
      .locator("#capture-text")
      .evaluate((n) => getComputedStyle(n).outlineColor);
    check(
      outline !== "rgb(0, 0, 0)" && outline !== "rgba(0, 0, 0, 0)",
      `Textarea focus follows ${mode} theme`,
    );
  }
  await page.keyboard.press("Escape");
  check(
    await page.locator("#capture-dialog").isVisible(),
    "Escape during text entry preserves the form",
  );
  await page.locator("#capture-dialog [data-close]").first().click();
  await page.locator('[data-page="projects"]:visible').first().click();
  await life(page, "sleep");
  await escape(page);
  check(
    await page.locator("#life-overview").isVisible(),
    "Escape from Sleep returns to Life overview",
  );
  await escape(page);
  check(
    await page.locator("#projects-screen").isVisible(),
    "Next Escape returns to the actual previous Projects screen",
  );
  await life(page, "food");
  await page.locator("#food-name").focus();
  await page.keyboard.press("Escape");
  check(
    await page.locator("#life-food-view").isVisible(),
    "Escape does not navigate away from active text input",
  );
  await back(page);
  check(
    await page.locator("#life-overview").isVisible(),
    "Android back uses the same screen history",
  );
  await page.locator('.header-actions button[aria-label="Поиск"]').focus();
  check(
    await page.locator('[role="tooltip"]').isVisible(),
    "Keyboard focus shows search hint",
  );
  await page.locator('.header-actions button[aria-label="Поиск"]').hover();
  check(
    await page.locator('[role="tooltip"]').isVisible(),
    "Hover shows search hint",
  );
  await page.locator('[data-life-tab="sleep"]').focus();
  check(
    !(await page.locator('[role="tooltip"]').isVisible()),
    "Clear labeled action has no duplicate hint",
  );
  await context.close();
  const dense = empty();
  dense.data.projects = Array.from({ length: 300 }, (_, i) => ({
    id: i + 1,
    name: `Проект ${i + 1} ${"длинное название ".repeat(3)}`,
    description: "",
    tone: "pine",
  }));
  dense.data.tasks = Array.from({ length: 200 }, (_, i) => ({
    id: 1000 + i,
    title: `Задача ${i}`,
    context: dense.data.projects[0].name,
    date: day(),
    createdDate: day(),
    done: false,
  }));
  for (const viewport of [
    { width: 1366, height: 900 },
    { width: 390, height: 844 },
    { width: 320, height: 640 },
  ]) {
    const run = await open(
      {
        viewport,
        isMobile: viewport.width < 500,
        hasTouch: viewport.width < 500,
      },
      dense,
      viewport.width < 500 ? "?mobile=1" : "",
    );
    await run.page.locator('[data-page="projects"]:visible').first().click();
    for (const zoom of [1, 0.8, 1.25]) {
      await run.page
        .locator("#life-os-workspace")
        .evaluate((n, z) => (n.style.zoom = z), zoom);
      const bounds = await run.page.evaluate(() => {
        const l = document.querySelector("#project-list"),
          p = document.querySelector(".project-list-panel"),
          d = document.querySelector(".project-detail");
        return {
          overflow: l.scrollHeight > l.clientHeight,
          body: document.documentElement.scrollWidth,
          width: innerWidth,
          panel: p.getBoundingClientRect().height,
          detail: d.getBoundingClientRect().width,
        };
      });
      check(
        bounds.overflow,
        `300 projects scroll in allocated area at ${viewport.width}, zoom ${zoom}`,
      );
      check(
        bounds.body <= bounds.width + 2,
        `No page overflow at ${viewport.width}, zoom ${zoom}`,
      );
      check(bounds.detail > 0, "Project detail remains available");
    }
    await run.page
      .locator("#life-os-workspace")
      .evaluate((n) => (n.style.zoom = 1));
    await run.page
      .locator('#project-list .project-option[data-project-id="300"]')
      .click();
    check(
      (await run.page.locator("#project-name").innerText()).includes(
        "Проект 300",
      ),
      "Last project is reachable",
    );
    if (viewport.width < 500) {
      await run.page
        .getByRole("button", { name: "Из базы данных", exact: true })
        .click();
      check(
        await run.page
          .locator("#db-reference-search")
          .evaluate((n) => n !== document.activeElement),
        "Choosing a project material does not open a keyboard automatically",
      );
      await run.page
        .locator("#db-reference-dialog .dialog-head button")
        .click();
    }
    await run.page.screenshot({
      path: `${out}/projects-${viewport.width}.png`,
    });
    await run.context.close();
  }
  const finance = empty();
  finance.data.uiPreferences.financeLedgerVersion = 1;
  finance.data.uiPreferences.financeAccounts = [
    { key: "cash", name: "Кошелёк", currency: "KZT", from: day(), opening: 0 },
    { key: "usd", name: "Доллары", currency: "USD", from: day(), opening: 0 },
  ];
  finance.data.financeCategories = Array.from({ length: 30 }, (_, i) => ({
    name: `Категория ${i + 1}`,
    color: "#688b85",
  }));
  finance.data.financeLogs = [
    {
      id: 2,
      date: day(),
      type: "income",
      amount: 100,
      currency: "KZT",
      category: "Зарплата",
      accountKey: "cash",
      postedAt: 1,
    },
  ];
  const mobile = await open(
    { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true },
    finance,
    "?mobile=1",
  );
  const m = mobile.page;
  await life(m, "finances");
  check(
    await m.locator("#finance-account-add").isVisible(),
    "Add account is a visible action",
  );
  await m.locator("#finance-add").click();
  await m.locator("#finance-account").selectOption("cash");
  check(
    await m.locator("#finance-entry-currency").isDisabled(),
    "Currency belongs to the selected account",
  );
  await m.locator("#finance-account").selectOption("usd");
  check(
    (await m.locator("#finance-entry-currency").inputValue()) === "USD",
    "Account choice sets its currency",
  );
  await m.locator("#finance-account").selectOption("cash");
  await m.locator(".finance-category-trigger").click();
  check(
    await m.locator(".finance-category-popover").isVisible(),
    "Category picker opens inside the form",
  );
  check(
    await m
      .locator(".finance-category-popover input")
      .evaluate((n) => n !== document.activeElement),
    "Opening category picker does not focus search or request a keyboard",
  );
  const savedBefore = await m.evaluate(() =>
    JSON.stringify(window.testRuntime.snapshot().data.financeLogs),
  );
  await m.locator(".finance-category-popover input").focus();
  await m.evaluate(() => {
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 380, offsetTop: 0, width: 390 });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    window.__viewport = viewport;
    viewport.dispatchEvent(new Event("resize"));
  });
  // Rebind listeners by remounting in a fresh document with a controllable viewport.
  await mobile.context.close();
  const keyboard = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  await keyboard.addInitScript((doc) => {
    localStorage.setItem("test-workspace", JSON.stringify(doc));
    const viewport = new EventTarget();
    Object.assign(viewport, { height: 844, offsetTop: 0, width: 390 });
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    window.__viewport = viewport;
  }, finance);
  const k = await keyboard.newPage();
  k.setDefaultTimeout(7000);
  k.on("pageerror", (e) => report.errors.push(e.message));
  await k.goto(origin + "/tests/browser-harness.html?mobile=1");
  await k.waitForFunction(() => window.testRuntime);
  await life(k, "finances");
  await k.locator("#finance-add").click();
  await k.locator("#finance-account").selectOption("cash");
  await k.locator(".finance-category-trigger").click();
  await k.locator(".finance-category-popover input").fill("Категория");
  await k.evaluate(() => {
    window.__viewport.height = 380;
    window.__viewport.dispatchEvent(new Event("resize"));
  });
  await k.waitForTimeout(100);
  await k
    .locator(".finance-category-options")
    .evaluate((n) => (n.scrollTop = 120));
  check(
    await k.locator(".finance-category-popover").isVisible(),
    "List stays open while scrolling with keyboard viewport",
  );
  check(
    await k
      .locator(".finance-category-popover input")
      .evaluate((n) => n === document.activeElement),
    "Scrolling preserves active search",
  );
  const picker = await k.locator(".finance-category-popover").boundingBox();
  check(
    picker.y >= 0 && picker.y + picker.height <= 380,
    "Search and category options are inside visible viewport",
  );
  await back(k);
  check(
    !(await k.locator(".finance-category-popover").isVisible()) &&
      (await k.locator("#finance-dialog").isVisible()),
    "First Android back closes picker and preserves operation",
  );
  await k.locator("#finance-amount").fill("1000");
  await k.locator("#finance-note").fill("Сохранить введённое");
  await k.locator('#finance-dialog-form button[type="submit"]').click();
  await k.waitForTimeout(100);
  const error = await k.locator("#finance-form-error").boundingBox();
  check(
    await k
      .locator("#finance-form-error")
      .innerText()
      .then((t) => t.includes("Недостаточно средств")),
    "Insufficient funds error is explicit",
  );
  check(
    error.y >= 0 && error.y + error.height <= 380 - 40,
    "Error visible above simulated keyboard and actions",
  );
  check(
    (await k.locator("#finance-amount").inputValue()) === "1000" &&
      (await k.locator("#finance-note").inputValue()) === "Сохранить введённое",
    "Rejected operation preserves entered values",
  );
  check(
    (await k.evaluate(() =>
      JSON.stringify(window.testRuntime.snapshot().data.financeLogs),
    )) === savedBefore,
    "Rejected operation changes no records",
  );
  await k.screenshot({ path: `${out}/finance-keyboard.png` });
  await k.locator("#finance-amount").fill("20");
  await k.locator('#finance-dialog-form button[type="submit"]').click();
  check(
    !(await k.locator("#finance-dialog").isVisible()),
    "Corrected affordable operation saves",
  );
  check(
    (await k.evaluate(
      () => window.testRuntime.snapshot().data.financeLogs.length,
    )) === 2,
    "Exactly one operation appended",
  );
  await keyboard.close();
  const fallback = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  await fallback.addInitScript((doc) => {
    localStorage.setItem("test-workspace", JSON.stringify(doc));
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: undefined,
    });
  }, finance);
  const f = await fallback.newPage();
  f.on("pageerror", (e) => report.errors.push(e.message));
  await f.goto(origin + "/tests/browser-harness.html?mobile=1");
  await f.waitForFunction(() => window.testRuntime);
  await life(f, "finances");
  await f.locator("#finance-add").click();
  await f.setViewportSize({ width: 390, height: 380 });
  const fallbackHeight = await f.locator("#finance-dialog").boundingBox();
  check(
    fallbackHeight.height <= 380,
    "Keyboard resize works without VisualViewport on older WebViews",
  );
  await fallback.close();
  // Edge gesture on blank content; form controls and vertical swipes must be ignored.
  const gesture = await open(
    { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
    empty(),
    "?mobile=1",
  );
  await life(gesture.page, "sleep");
  async function swipe(target, start, end) {
    await gesture.page.locator(target).evaluate(
      (node, { start, end }) => {
        for (const [type, point] of [
          ["touchstart", start],
          ["touchend", end],
        ]) {
          const e = new Event(type, { bubbles: true });
          Object.defineProperties(e, {
            touches: {
              value:
                type === "touchstart"
                  ? [{ clientX: point[0], clientY: point[1] }]
                  : [],
            },
            changedTouches: {
              value: [{ clientX: point[0], clientY: point[1] }],
            },
          });
          node.dispatchEvent(e);
        }
      },
      { start, end },
    );
  }
  await swipe("#sleep-note", [12, 200], [150, 205]);
  check(
    await gesture.page.locator("#life-sleep-view").isVisible(),
    "Gesture does not navigate from form fields",
  );
  await swipe("#life-screen", [12, 200], [130, 300]);
  check(
    await gesture.page.locator("#life-sleep-view").isVisible(),
    "Vertical scrolling does not trigger back",
  );
  await swipe("#life-screen", [12, 200], [150, 205]);
  check(
    await gesture.page.locator("#life-overview").isVisible(),
    "Intentional edge swipe returns to previous screen",
  );
  await gesture.context.close();
  check(report.errors.length === 0, "No uncaught browser errors");
  report.passed = true;
})()
  .catch((error) => {
    report.passed = false;
    report.failure = error.stack;
    process.exitCode = 1;
    console.error(error);
  })
  .finally(async () => {
    await browser?.close();
    fs.writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  });
