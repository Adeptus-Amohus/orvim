const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const b = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  let checks = 0;
  const errors = [];
  try {
    for (const width of [320, 390, 720, 1024, 1920]) {
      const p = await b.newPage({ viewport: { width, height: 900 } });
      p.on("pageerror", (e) => errors.push(e.message));
      await p.goto(
        "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
      );
      await p.evaluate(() => {
        const d = testRuntime.snapshot(),
          day = d.data.selectedDate;
        d.data.tasks = Array.from({ length: 1000 }, (_, i) => ({
          id: 10000 + i,
          title:
            "Задача " +
            i +
            " " +
            (i % 5
              ? "Длинное описание"
              : "ОченьДлинноеНазваниеБезПробелов".repeat(5)),
          context: "Проверка",
          date: day,
          done: false,
        }));
        d.data.events = Array.from({ length: 100 }, (_, i) => ({
          id: 20000 + i,
          title: "Событие " + i,
          context: "Проверка",
          date: day,
          start: "12:00",
          end: "13:00",
          tone: "pine",
          done: false,
        }));
        testRuntime.applyRemote(d);
      });
      for (const period of ["day", "week", "month"]) {
        await p.locator("#" + period + "-toggle").click();
        assert(
          await p.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth + 1,
          ),
          "overflow " + width + " " + period,
        );
        checks++;
        if (width <= 720) {
          assert(
            await p.evaluate(() => {
              const c = document
                  .querySelector(".calendar")
                  .getBoundingClientRect(),
                t = document.querySelector(".tasks").getBoundingClientRect();
              return t.top - c.bottom >= 12 && t.top - c.bottom <= 18;
            }),
            "gap " + width + " " + period,
          );
          checks++;
        }
      }
      await p.locator(".task-list").scrollIntoViewIfNeeded();
      await p
        .locator(".task-list")
        .evaluate((e) => (e.scrollTop = e.scrollHeight));
      assert(
        await p
          .locator(".task-list")
          .evaluate((e) => e.clientHeight > 100 && e.clientHeight <= 600),
        "bounded list",
      );
      checks++;
      await p.evaluate(
        () =>
          new Promise((r) =>
            requestAnimationFrame(() => requestAnimationFrame(r)),
          ),
      );
      assert(
        await p
          .locator(".task-list")
          .innerText()
          .then((t) => t.includes("Задача 999")),
        "last task remains available",
      );
      checks++;
      assert(
        await p.evaluate(() => {
          return [...document.querySelectorAll(".task-list .task-name")].every(
            (e) => e.scrollWidth <= e.clientWidth + 1,
          );
        }),
        "task text stays inside its column",
      );
      checks++;
      await p.locator(".task-list .task-title").last().scrollIntoViewIfNeeded();
      await p.waitForFunction(() => {
        const title = [...document.querySelectorAll(".task-list .task-title")]
          .at(-1)
          .getBoundingClientRect();
        const list = document
          .querySelector(".task-list")
          .getBoundingClientRect();
        return title.top >= list.top - 1 && title.bottom <= list.bottom + 1;
      });
      await p.screenshot({
        path: ".artifacts/ui032-stress-" + width + ".png",
        fullPage: false,
      });
      await p.close();
    }
    assert.deepEqual(errors, []);
    console.log(
      checks +
        " layout stress checks passed; 1000 tasks, 100 simultaneous events, day/week/month",
    );
  } finally {
    await b.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
