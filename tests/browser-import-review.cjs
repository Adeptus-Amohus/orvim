const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  const errors = [];
  const check = (value, label) => {
    assert.ok(value, label);
    checks++;
  };
  try {
    for (const width of [390, 1440]) {
      const p = await b.newPage({ viewport: { width, height: 900 } });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
      );
      await p.evaluate((mobile) => {
        testServices.mobile = mobile;
        window.importCalls = [];
        window.importFailure = false;
        window.importPayload = {
          results: [
            {
              id: "notion-row",
              properties: {
                Name: {
                  type: "title",
                  title: [{ plain_text: "Импорт из Notion" }],
                },
                Status: { type: "status", status: { name: "Done" } },
                Date: { type: "date", date: { start: "2026-11-02" } },
              },
            },
          ],
        };
        window.calendarPayload = {
          items: [
            {
              id: "calendar-row",
              summary: "Событие календаря",
              start: { dateTime: "2026-11-02T12:00:00+05:00" },
              end: { dateTime: "2026-11-02T13:00:00+05:00" },
            },
          ],
        };
        const request = async (args) => {
          importCalls.push(args);
          if (importFailure) throw Error("HTTP 401 — нет доступа к источнику");
          if (args.operation === "import") return importPayload;
          if (args.operation === "calendarList")
            return { items: [{ id: "primary", summary: "Основной" }] };
          if (args.operation === "calendarRead") return calendarPayload;
          return {};
        };
        testServices.request = request;
        const platform = testServices.platform;
        testServices.platform = async (op, args) =>
          op.startsWith("calendar")
            ? request({ ...args, operation: op })
            : platform(op, args);
        testServices.googleLogin = async () => ({});
      }, width < 720);
      const open = async (tab) => {
        await p
          .locator('[data-open="settings-dialog"]:visible')
          .first()
          .click();
        await p.locator("#settings-tab-connections").click();
        await p.locator(`[data-settings-connection="${tab}"]`).click();
        for (const details of await p
          .locator("#connections-dialog .connection-details:visible")
          .all()) {
          if (!(await details.evaluate((e) => e.open)))
            await details.locator(":scope > summary").click();
        }
      };
      const apply = async () =>
        p
          .locator("#import-preview-dialog")
          .getByRole("button", { name: "Применить импорт", exact: true })
          .click();
      await open("notion");
      await p
        .locator("#notion-source-id")
        .fill("1234567890abcdef1234567890abcdef");
      await p.locator("#import-kind").selectOption("tasks");
      await p.locator("#import-fetch").click();
      check(
        await p.locator("#import-preview-dialog").isVisible(),
        "Notion preview opens",
      );
      check(
        await p.evaluate(
          () =>
            !testRuntime
              .snapshot()
              .data.tasks.some((r) => r.source?.provider === "notion"),
        ),
        "preview makes no changes",
      );
      await apply();
      check(
        await p.evaluate(() =>
          testRuntime
            .snapshot()
            .data.tasks.some((r) => r.title === "Импорт из Notion" && r.done),
        ),
        "Notion task and status applied",
      );
      await open("notion");
      await p.locator("#import-fetch").click();
      await apply();
      check(
        await p.evaluate(
          () =>
            testRuntime
              .snapshot()
              .data.tasks.filter((r) => r.source?.provider === "notion")
              .length === 1,
        ),
        "repeat UI import deduplicates",
      );
      await open("notion");
      await p.locator("#import-provider").selectOption("json");
      await p.locator("#json-endpoint").fill("https://example.test/api");
      await p.locator("#import-kind").selectOption("thoughts");
      await p.evaluate(() => {
        importPayload = {
          data: [
            {
              id: 0,
              title: "<img src=x onerror=alert(1)>",
              body: "Безопасный текст",
              date: "2026-11-02",
            },
          ],
        };
      });
      await p.locator("#import-fetch").click();
      check(
        (await p.locator("#import-preview-dialog img").count()) === 0,
        "import title is plain text",
      );
      await apply();
      check(
        await p.evaluate(() =>
          testRuntime
            .snapshot()
            .data.thoughts.some(
              (r) => r.source?.provider === "json" && r.source.id === "0",
            ),
        ),
        "JSON data envelope applied",
      );
      await open("notion");
      await p.evaluate(() => (window.importFailure = true));
      await p.locator("#import-fetch").click();
      check(
        (await p.locator("#connection-status").innerText()).includes("401"),
        "request errors visible",
      );
      check(
        !(await p.locator("#import-preview-dialog").isVisible()),
        "failure never shows a success preview",
      );
      await p.evaluate(() => (window.importFailure = false));
      await p.locator("#connections-dialog .close").click();
      await open("google");
      if (width < 720) await p.locator("#google-device-connect").click();
      else {
        await p
          .locator("#google-client-id")
          .fill("synthetic.apps.googleusercontent.com");
        await p.locator("#google-connect").click();
      }
      await p.locator("#calendar-from").fill("2026-11-01");
      await p.locator("#calendar-until").fill("2026-11-03");
      await p.locator("#google-pull").click();
      check(
        await p.locator("#import-preview-dialog").isVisible(),
        "calendar preview opens",
      );
      await apply();
      check(
        await p.evaluate(() =>
          testRuntime
            .snapshot()
            .data.events.some((r) => r.title === "Событие календаря"),
        ),
        "calendar event applied",
      );
      await open("google");
      await p.locator("#google-pull").click();
      await apply();
      check(
        await p.evaluate(
          () =>
            testRuntime
              .snapshot()
              .data.events.filter((r) => r.source?.id === "calendar-row")
              .length === 1,
        ),
        "calendar repeat deduplicates",
      );
      check(
        await p.evaluate(() =>
          importCalls.some(
            (c) =>
              c.operation === "calendarRead" &&
              c.from === "2026-11-01" &&
              c.until === "2026-11-03",
          ),
        ),
        "chosen calendar range forwarded",
      );
      check(
        await p.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "import UI fits screen",
      );
      await p.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " import UI checks passed; mobile calendar and desktop Google paths use mocked services",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
