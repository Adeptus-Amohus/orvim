const fs = require("node:fs");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const out = "presentation/demo-2026-11-04",
  anchor = "2026-11-04";
const day = (n) =>
  new Date(Date.parse(anchor + "T12:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
const at = (n, time = "12:00") => Date.parse(day(n) + "T" + time + ":00+05:00");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("http://127.0.0.1:5180/tests/browser-harness.html");
    await page.waitForFunction(() => !!window.testRuntime);
    const data = (await page.evaluate(() => testRuntime.snapshot())).data;
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
      "weightLogs",
      "illnessLogs",
      "nutrientLogs",
    ];
    for (const key of collections) data[key] = [];
    for (const key of [
      "connectionSettings",
      "lanSettings",
      "webdavSettings",
      "updateSettings",
    ])
      delete data[key];
    let next = 800000;
    const id = () => ++next;
    Object.assign(data, {
      version: 32,
      selectedDate: anchor,
      selectedLifeDay: anchor,
      activePage: "home",
      range: "six",
      lifeTab: "mood",
      lifeDetailOpen: false,
      palette: "pine",
      appearance: "light",
      languageMode: "ru",
      fontMode: "soft",
      customColor: "#20876b",
      foodTarget: 2200,
      waterTarget: 2200,
      financeCurrency: "KZT",
      projectView: "board",
      homeView: "tasks",
      archiveCategories: ["Книги", "Фильмы", "Идеи для выходных"],
      selectedArchiveCategory: "Книги",
      lifePreferences: {
        personalDay: { enabled: false, start: "00:00" },
        nutrition: {
          water: true,
          calories: true,
          macros: true,
          micronutrients: false,
        },
        weight: true,
        illness: true,
        nutrientTargets: [],
      },
      uiPreferences: {
        taskDatesVersion: 1,
        financeLedgerVersion: 1,
        financeAccounts: [
          {
            key: "demo-card",
            name: "Основной счёт",
            currency: "KZT",
            opening: 0,
            from: day(-60),
          },
          {
            key: "demo-save",
            name: "На путешествие",
            currency: "KZT",
            opening: 0,
            from: day(-60),
          },
        ],
      },
    });
    const projects = [
      [
        "Запуск личного сайта",
        "Собрать портфолио и показать три лучших проекта.",
        "pine",
      ],
      [
        "Выходные в горах",
        "Небольшая поездка: маршрут, бюджет и всё необходимое.",
        "winter",
      ],
      [
        "Учиться каждый день",
        "Четыре небольших занятия в неделю без перегруза.",
        "sun",
      ],
      ["Задачи без проекта и даты", "", "neutral"],
    ];
    for (const [name, description, tone] of projects)
      data.projects.push({
        id: id(),
        name,
        description,
        tone,
        ...(name.startsWith("Задачи без") ? { system: "unassigned" } : {}),
      });
    data.selectedProjectId = data.projects[0].id;
    const task = (title, p, n, status = "planned", time) => {
      const row = {
        id: id(),
        title,
        context: projects[p][0],
        date: n === null ? "" : day(n),
        done: status === "done",
        status,
        description: "",
        createdAt: at(n ?? 0),
        duration: 45,
        ...(time ? { time } : {}),
      };
      if (!time) data.tasks.push(row);
      if (time)
        data.events.push({
          id: id(),
          taskId: row.id,
          title,
          context: row.context,
          date: row.date,
          start: time,
          end:
            String(Number(time.slice(0, 2)) + 1).padStart(2, "0") +
            ":" +
            time.slice(3),
          tone: projects[p][2],
          done: row.done,
          description: row.description,
        });
    };
    [
      ["Собрать референсы", -7, "done"],
      ["Выбрать структуру страниц", -4, "done"],
      ["Подготовить первый кейс", 0, "active"],
      ["Проверить мобильную версию", 2, "planned"],
      ["Опубликовать портфолио", 7, "planned"],
    ].forEach(([t, n, s]) =>
      task(t, 0, n, s, t.includes("первый") ? "11:00" : undefined),
    );
    [
      ["Выбрать маршрут", -2, "done"],
      ["Составить список вещей", 0, "planned"],
      ["Забронировать домик", 1, "planned"],
      ["Купить продукты в дорогу", 3, "planned"],
    ].forEach(([t, n, s]) => task(t, 1, n, s));
    task("Практика английского · 20 минут", 2, 0, "planned", "16:00");
    task("Прочитать главу книги", 2, 1);
    task("Подобрать следующий курс", 2, null);
    task("Забрать заказ", 3, 0, "planned", "14:00");
    task("Полить растения", 3, 0, "done");
    for (const [i, title] of [
      "Идея для главной страницы",
      "Что помогает сохранять фокус",
      "Маршрут выходного дня",
      "Книги, к которым хочется вернуться",
      "Маленький шаг лучше идеального плана",
      "Идея для следующего проекта",
      "Вопросы перед поездкой",
      "Что получилось на этой неделе",
    ].entries())
      data.thoughts.push({
        id: id(),
        title,
        body:
          [
            "Начать с одной понятной фразы и примера работы. Детали можно раскрыть ниже.",
            "Оставлять в плане место для отдыха и неожиданных дел.",
            "Сначала короткий маршрут, затем смотровая площадка и чай.",
          ][i % 3] + "\n\nВымышленная заметка для демонстрации.",
        context: "Личное",
        date: day(i < 2 ? 0 : -i),
        pinned: i === 0,
        createdAt: at(i < 2 ? 0 : -i),
      });
    const meals = [
      ["Овсянка с ягодами", 420, 16, 12, 62],
      ["Рис с курицей и овощами", 640, 43, 18, 76],
      ["Йогурт и яблоко", 230, 13, 6, 31],
      ["Рыба с картофелем", 560, 38, 19, 59],
    ];
    for (const [name, calories, protein, fat, carbs] of meals)
      data.savedMeals.push({ id: id(), name, calories, protein, fat, carbs });
    for (let n = -59; n <= 0; n++) {
      const q = Math.abs(n);
      data.sleepLogs.push({
        id: id(),
        date: day(n),
        hours: Math.round((7.1 + (q % 7) * 0.15) * 10) / 10,
        quality: q % 6 === 0 ? 3 : 4,
        note: n === 0 ? "Проснулся без будильника." : "",
      });
      data.stepLogs.push({
        id: id(),
        date: day(n),
        count: n === 0 ? 4560 : 6100 + ((q * 733) % 5200),
        source: "manual",
      });
      for (let k = 0; k < (n === 0 ? 2 : 3); k++)
        data.checkins.push({
          id: id(),
          at: at(n, ["09:00", "14:00", "20:00"][k]),
          mood: 3 + ((q + k) % 3),
          energy: 3 + ((q + k + 1) % 3),
          stress: 1 + ((q + k) % 3),
          note: "",
        });
      for (let k = 0; k < (n === 0 ? 2 : 4); k++) {
        const [name, calories, protein, fat, carbs] = meals[(k + q) % 4];
        data.foodLogs.push({
          id: id(),
          date: day(n),
          name,
          calories,
          protein,
          fat,
          carbs,
          occurredAt: at(n, ["08:30", "13:00", "16:30", "19:30"][k]),
          nutritionSource: "estimate",
        });
      }
      data.waterLogs.push({
        id: id(),
        date: day(n),
        ml: n === 0 ? 1100 : 1800 + (q % 5) * 150,
      });
      if (q % 4 === 0)
        data.weightLogs.push({
          id: id(),
          date: day(n),
          kg: Math.round((76.2 + q * 0.025 + Math.sin(q) * 0.2) * 10) / 10,
        });
    }
    const ex = [
      ["pull", "Подтягивания", "раз", 8],
      ["squat", "Приседания", "раз", 15],
      ["plank", "Планка", "мин", 1],
    ];
    for (const [key, name, unit, target] of ex)
      data.exercises.push({
        id: id(),
        exerciseKey: "demo-" + key,
        name,
        unit,
        duration: 10,
        description: "Демонстрационное упражнение",
      });
    for (let n = -56; n <= 14; n += 4) {
      const done = n < 0,
        w = {
          id: id(),
          trainingKey: "demo-workout-" + day(n),
          seriesKey: "demo-strength",
          name: "Силовая · всё тело",
          date: day(n),
          time: "18:30",
          duration: 45,
          done,
          restSeconds: 60,
          restAutomatic: true,
          restSound: true,
          entries: ex.map(([key, name, unit, target]) => {
            const value =
              key === "pull"
                ? Math.min(10, 5 + Math.floor((n + 56) / 12))
                : target;
            return {
              exerciseKey: "demo-" + key,
              name,
              unit,
              plannedValue: target,
              sets: 3,
              value: done ? value : null,
              done,
              setResults: Array.from({ length: 3 }, () => ({
                done,
                value: done ? value : null,
              })),
            };
          }),
          ...(done ? { effort: 3, effortRatedAt: at(n, "19:15") } : {}),
        };
      data.workouts.push(w);
      data.events.push({
        id: id(),
        workoutId: w.id,
        title: w.name,
        date: w.date,
        start: "18:30",
        end: "19:15",
        context: "Задачи без проекта и даты",
        tone: "pine",
        done,
      });
    }
    data.trainingGoals.push({
      id: id(),
      goalKey: "demo-pull-goal",
      name: "12 подтягиваний",
      focus: "Сила",
      unit: "раз",
      kind: "result",
      exerciseKey: "demo-pull",
      baseline: 4,
      current: 9,
      target: 12,
      calculation: "latest",
      history: [],
    });
    data.uiPreferences.workoutTemplates = [
      {
        key: "demo-strength-template",
        name: "Силовая · всё тело",
        duration: 45,
        note: "Три упражнения, по три подхода.",
        entries: ex.map(([key, name, unit, plannedValue]) => ({
          exerciseKey: "demo-" + key,
          name,
          unit,
          plannedValue,
          sets: 3,
          value: null,
          done: false,
        })),
      },
    ];
    const money = (n, type, amount, category, note, extra = {}) =>
      data.financeLogs.push({
        id: id(),
        date: day(n),
        type,
        amount,
        currency: "KZT",
        category,
        note,
        accountKey: "demo-card",
        ...extra,
      });
    money(-60, "income", 450000, "Работа", "Демонстрационный доход");
    money(-30, "income", 450000, "Работа", "Демонстрационный доход");
    money(-3, "income", 450000, "Работа", "Демонстрационный доход");
    money(-2, "transfer", 80000, "Перевод", "На будущую поездку", {
      toAccountKey: "demo-save",
    });
    for (let n = -59; n <= 0; n++) {
      money(
        n,
        "expense",
        1800 + (Math.abs(n) % 6) * 650,
        "Еда",
        "Продукты и обед",
      );
      if (n % 3 === 0)
        money(n, "expense", 1200, "Транспорт", "Поездки по городу");
      if (n % 10 === 0) money(n, "expense", 6500, "Досуг", "Кино и выходные");
    }
    money(-1, "expense", 18000, "Образование", "Учебные материалы");
    const books = [
      "Тихий город",
      "Искусство замечать",
      "За горизонтом",
      "Атлас маленьких идей",
    ];
    const films = [
      "Северный свет",
      "Один день у моря",
      "После дождя",
      "Дорога домой",
    ];
    for (const category of data.archiveCategories) {
      const titles =
        category === "Книги"
          ? books
          : category === "Фильмы"
            ? films
            : ["Пешая прогулка", "Музей и кофе", "Выезд за город"];
      for (const [i, name] of titles.entries())
        data.archiveItems.push({
          id: id(),
          name,
          category,
          date: day(-i * 3),
          rating: i < 2 ? 4.5 : null,
          ratingMax: 5,
          status: i < 2 ? "done" : i === 2 ? "active" : "planned",
          review: "Вымышленный материал для презентации Orvim.",
          genres: [
            category === "Книги"
              ? "Нон-фикшн"
              : category === "Фильмы"
                ? "Приключения"
                : "Отдых",
          ],
        });
    }
    data.taskTemplates.push({
      id: id(),
      name: "Спокойное начало недели",
      items: [
        { title: "Выбрать три главных дела", description: "", duration: 15 },
        { title: "Проверить расписание", description: "", duration: 10 },
      ],
    });
    data.trainingGoals.push({
      id: id(),
      goalKey: "demo-plank-goal",
      name: "Планка 2 минуты",
      focus: "Выносливость",
      unit: "мин",
      kind: "result",
      exerciseKey: "demo-plank",
      baseline: 0,
      current: 1,
      target: 2,
      calculation: "latest",
      history: [],
    });
    data.nextId = next + 100;
    const covers = await page.evaluate(
      (items) =>
        items.map((item, i) => {
          const c = document.createElement("canvas");
          c.width = 360;
          c.height = 520;
          const x = c.getContext("2d");
          const colors = ["#1d5148", "#344b66", "#986145", "#675b78"];
          x.fillStyle = colors[i % 4];
          x.fillRect(0, 0, 360, 520);
          x.strokeStyle = "#ffffff60";
          x.lineWidth = 2;
          for (let k = 0; k < 6; k++) {
            x.beginPath();
            x.arc(280, 150, 45 + k * 22, 0, Math.PI * 2);
            x.stroke();
          }
          x.fillStyle = "#ffffff";
          x.font = "18px sans-serif";
          x.fillText("ORVIM / DEMO", 28, 40);
          x.font = "bold 32px sans-serif";
          const words = item.name.split(" ");
          let line = "",
            y = 360;
          for (const word of words) {
            if (x.measureText(line + " " + word).width > 300) {
              x.fillText(line, 28, y);
              y += 40;
              line = word;
            } else line += (line ? " " : "") + word;
          }
          x.fillText(line, 28, y);
          x.font = "16px sans-serif";
          x.fillText("Вымышленная обложка", 28, 490);
          return [item.id, c.toDataURL("image/png")];
        }),
      data.archiveItems,
    );
    const backup = {
      format: "life-os-backup",
      schemaVersion: 1,
      createdAt: at(0),
      data,
      covers,
    };
    const file = out + "/Orvim-demo-backup-2026-11-04.json";
    fs.writeFileSync(file, JSON.stringify(backup, null, 2));
    // Import through the real file picker and validation path, not applyRemote.
    await page.locator("#backup-file").setInputFiles(file);
    await page.waitForFunction(
      () =>
        !document.querySelector("#backup-preview").hidden ||
        document
          .querySelector("#backup-status")
          .textContent.includes("Некоррект"),
    );
    const status = await page.locator("#backup-status").textContent();
    assert.match(status, /готова к восстановлению/, status);
    await page.locator("#backup-preview button").evaluate((e) => e.click());
    await page.waitForTimeout(400);
    const restored = await page.evaluate(() => testRuntime.snapshot());
    for (const key of collections)
      assert.equal(restored.data[key].length, data[key].length, key);
    assert.equal(restored.covers.length, covers.length);
    assert.deepEqual(errors, []);
    await page.screenshot({ path: out + "/preview-home.png", fullPage: true });
    for (const section of ["projects", "archive", "thoughts"]) {
      await page
        .locator('[data-page="' + section + '"]:visible')
        .first()
        .click();
      await page.screenshot({
        path: out + "/preview-" + section + ".png",
        fullPage: true,
      });
    }
    for (const tab of ["food", "finances", "training", "sleep"]) {
      await page.locator('[data-page="life"]:visible').first().click();
      await page
        .locator('[data-life-tab="' + tab + '"]')
        .first()
        .click();
      await page.screenshot({
        path: out + "/preview-" + tab + ".png",
        fullPage: true,
      });
    }
    assert.deepEqual(errors, []);
    await page.locator('[data-page="home"]:visible').first().click();
    await page.reload();
    await page.waitForFunction(() => !!window.testRuntime);
    const persisted = await page.evaluate(() => testRuntime.snapshot());
    for (const key of collections)
      assert.equal(
        persisted.data[key].length,
        data[key].length,
        "reload " + key,
      );
    for (const key of collections)
      assert.deepEqual(
        persisted.data[key],
        restored.data[key],
        "content after reload " + key,
      );
    assert.deepEqual(persisted.covers, covers);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      out + "/verification.json",
      JSON.stringify(
        {
          anchor,
          historyFrom: day(-60),
          plansUntil: day(14),
          synthetic: true,
          format: backup.format,
          workspaceVersion: 32,
          importViaFilePicker: true,
          persistedAfterReload: true,
          covers: covers.length,
          counts: Object.fromEntries(
            collections.map((k) => [k, data[k].length]),
          ),
          browserErrors: errors,
          physicalDeviceTested: false,
        },
        null,
        2,
      ),
    );
    console.log(fs.readFileSync(out + "/verification.json", "utf8"));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
