const assert = require("node:assert/strict");
const fs = require("fs");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    const p = await browser.newPage({
      viewport: { width: 390, height: 844 },
      locale: "ru-RU",
    });
    const errors = [];
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(
      "http://127.0.0.1:5180/tests/browser-harness.html?mobile=1&ux22=1",
    );
    await p.waitForFunction(() => !!window.testRuntime);
    await p.evaluate(() => {
      const doc = testRuntime.snapshot(),
        d = doc.data,
        day = testDay;
      for (const rows of [
        d.tasks,
        d.events,
        d.projects,
        d.thoughts,
        d.workouts,
      ])
        for (const row of rows) {
          for (const key of [
            "title",
            "body",
            "description",
            "context",
            "name",
            "focus",
          ])
            if (row[key]) row[key] = "Sample " + key;
        }
      d.foodLogs = [
        {
          id: 501,
          date: day,
          name: "Sample meal",
          calories: 858,
          protein: 40,
          fat: 20,
          carbs: 130,
        },
      ];
      d.waterLogs = [{ id: 502, date: day, amount: 800 }];
      d.sleepLogs = [
        {
          id: 503,
          date: day,
          hours: 8,
          quality: 4,
          bedtime: "23:00",
          wakeTime: "07:00",
          note: "Sample sleep",
        },
      ];
      d.checkins = [
        {
          id: 504,
          date: day,
          at: Date.now(),
          mood: 4,
          energy: 3,
          stress: 2,
          note: "Sample note",
        },
      ];
      d.tasks[0].title = "Моя задача 858 ккал";
      d.languageMode = "en";
      window.testCopies = [
        { name: "sample.json", at: new Date().toISOString(), bytes: 500 },
      ];
      testRuntime.applyRemote(doc);
    });
    await p.evaluate(() =>
      window.dispatchEvent(new Event("life-os:workspace-saved")),
    );
    await p.waitForTimeout(2200);
    const originalTasks = await p.evaluate(() =>
      JSON.stringify(testRuntime.snapshot().data.tasks),
    );
    const found = new Map();
    async function scan(stage) {
      await p.waitForTimeout(100);
      const rows = await p.evaluate(() => {
        const w = document.createTreeWalker(
            document.querySelector("#life-os-workspace"),
            NodeFilter.SHOW_TEXT,
          ),
          out = [];
        let n;
        while ((n = w.nextNode())) {
          const e = n.parentElement,
            t = n.nodeValue.trim();
          if (
            /[А-Яа-яЁё]/.test(t) &&
            !e.closest(
              "script,style,[data-user-content],.task-title,.project-option-name,#project-name,#project-description,.archive-item-copy,.archive-card-title,#archive-view-title,#archive-view-review,.wins-item,.project-item-name",
            )
          )
            out.push({
              text: t,
              at: e.id || e.className,
              visible: !!e.getClientRects().length,
            });
        }
        return out;
      });
      for (const row of rows) found.set(row.text, { ...row, stage });
    }
    await scan("initial");
    await p.evaluate(() => {
      window.dispatchEvent(
        new CustomEvent("life-os:reminder-status", {
          detail: {
            message:
              "Напоминания включены. Для точного времени разрешите Orvim «Будильники и напоминания» в настройках Android.",
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent("life-os:lan-status", {
          detail: {
            mode: "client",
            hostName: "Orvim · ПК",
            address: "192.168.0.11:42673",
            lastSync: Date.now(),
            error:
              "ПК недоступен. Подключите оба устройства к одной сети и разрешите Orvim в частной сети Windows.",
          },
        }),
      );
    });
    await scan("native statuses");
    for (const page of [
      "home",
      "life",
      "thoughts",
      "projects",
      "archive",
      "completed",
    ]) {
      await p.evaluate(
        (page) => document.querySelector(`[data-page="${page}"]`)?.click(),
        page,
      );
      await scan(page);
    }
    await p.evaluate(() =>
      document.querySelector('[data-page="life"]')?.click(),
    );
    for (const life of ["sleep", "food", "training", "finances"]) {
      await p.evaluate(
        (life) => document.querySelector(`[data-life-tab="${life}"]`)?.click(),
        life,
      );
      await scan(life);
    }
    await p.evaluate(() =>
      document.querySelector('[data-open="settings-dialog"]')?.click(),
    );
    for (const tab of ["appearance", "notifications", "data", "connections"]) {
      await p.evaluate(
        (tab) =>
          document.querySelector(`[data-settings-tab="${tab}"]`)?.click(),
        tab,
      );
      await scan("settings " + tab);
    }
    const ids = await p
      .locator("[data-open]")
      .evaluateAll((es) => [...new Set(es.map((e) => e.dataset.open))]);
    for (const id of ids) {
      await p.evaluate((id) => {
        document
          .querySelectorAll(".overlay:not([hidden]) [data-close]")
          .forEach((e) => e.click());
        document.querySelector(`[data-open="${id}"]`)?.click();
      }, id);
      await scan("dialog " + id);
    }
    const rows = [...found.values()];
    fs.writeFileSync(
      ".artifacts/english-audit-populated.json",
      JSON.stringify({ errors, rows }, null, 2),
    );
    assert.deepEqual(
      rows,
      [],
      "Untranslated interface: " + JSON.stringify(rows),
    );
    assert.deepEqual(errors, []);
    assert.equal(
      await p.evaluate(() => JSON.stringify(testRuntime.snapshot().data.tasks)),
      originalTasks,
    );
    await p.evaluate(() =>
      document.querySelector('[data-open="settings-dialog"]')?.click(),
    );
    for (const lang of ["ru", "en"]) {
      await p.evaluate((lang) => {
        const e = document.querySelector("#language-select");
        e.value = lang;
        e.dispatchEvent(new Event("change", { bubbles: true }));
      }, lang);
      await p.waitForTimeout(200);
      assert.equal(
        await p.locator("#life-os-workspace").getAttribute("lang"),
        lang,
      );
    }
    assert.equal(
      await p.evaluate(() => JSON.stringify(testRuntime.snapshot().data.tasks)),
      originalTasks,
    );
    assert.equal(
      await p.evaluate(async () => {
        const m = await import("/src/features/workspace/ui-language.js");
        return m.interfaceLanguage();
      }),
      "en",
    );
    console.log(
      "English audit passed: pages, Life sections, settings, dialogs, native statuses, units and user data preservation under Russian OS locale.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
