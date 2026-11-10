const assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const fixture = require("./fixture.cjs")().replace(
  "    })();",
  "window.__qa={snapshotData,makeBackup,validateBackup,renderTasks,renderCalendar,persistState};    })();",
);
let count = 0;
const check = (value, message) => {
  assert.ok(value, message);
  count++;
};
const errors = [],
  requests = [],
  saved = [];
let answer = { message: "План готов", changes: [] };
const vc = new VirtualConsole();
vc.on("jsdomError", (error) => {
  if (!error.message.includes("CSS")) errors.push(error.message);
});
const dom = new JSDOM(fixture, {
  runScripts: "dangerously",
  pretendToBeVisual: true,
  virtualConsole: vc,
  beforeParse(w) {
    Object.defineProperty(w.navigator, "language", { value: "ru-RU" });
    w.matchMedia = () => ({
      matches: true,
      addEventListener() {},
      removeEventListener() {},
    });
    w.__services = {
      mobile: false,
      credential: async () => ({ configured: true }),
      request: async (args) => {
        requests.push(args);
        return args.operation === "models"
          ? { models: ["example-model"] }
          : answer;
      },
      platform: async (operation) => ({
        text: "Запиши мысль",
        active: operation !== "speechStop",
        listening: true,
      }),
    };
    w.openai = {
      widgetState: {},
      setWidgetState: (state) => saved.push(state.privateContent),
    };
    w.HTMLCanvasElement.prototype.getContext = () =>
      new Proxy(
        {},
        {
          get: (_, key) =>
            key.startsWith("create") ? () => ({ addColorStop() {} }) : () => {},
        },
      );
  },
});
const w = dom.window,
  $ = (s) => w.document.querySelector(s),
  all = (s) => [...w.document.querySelectorAll(s)],
  click = (s) => {
    const n = typeof s === "string" ? $(s) : s;
    assert.ok(n, "Missing " + s);
    n.click();
  },
  set = (s, v) => {
    $(s).value = String(v);
    $(s).dispatchEvent(new w.Event("change", { bubbles: true }));
  },
  submit = (s) =>
    $(s).dispatchEvent(
      new w.Event("submit", { bubbles: true, cancelable: true }),
    ),
  wait = () => new Promise((resolve) => setTimeout(resolve, 30));
(async () => {
  try {
    check(!errors.length, "Strict fixture initializes without errors");
    click("#task-list .task-title");
    check($("#task-name").value === "Оплатить счёт", "Title opens task editor");
    set("#task-name", "Исправленный счёт");
    submit("#task-dialog form");
    check(
      w.__qa.snapshotData().tasks.some((t) => t.title === "Исправленный счёт"),
      "Task edit persists",
    );
    click("#task-list .task-more");
    click("#item-actions-dialog .entity-actions button");
    check(!$("#task-dialog").hidden, "Ellipsis Edit works");
    click("#task-dialog [data-close]");
    click('[data-page="projects"]');
    click("#project-name");
    check(!$("#project-dialog").hidden, "Project heading opens editor");
    click("#project-dialog [data-close]");
    check(
      !$("[data-project-view='archive']"),
      "Archive is removed from project tabs",
    );
    check(
      $(".nav [data-page='archive'] i").dataset.lucide === "database",
      "Database has its own storage icon",
    );
    click('[data-page="archive"]');
    click('[data-database-view="completed"]');
    check(
      !$("#completed-screen").hidden &&
        $("#projects-screen").hidden &&
        $("#page-title").textContent === "База данных",
      "Completed archive is accessible within the database",
    );
    check(
      $("#completed-list").textContent.includes("Проверить документы"),
      "Archive contains completed work from all projects",
    );
    set("#completed-project-filter", "Дом");
    check(!$("#completed-list .completed-row"), "Archive filters by project");
    set("#completed-project-filter", "Поездка");
    click("#completed-list .project-item-name");
    set("#task-name", "Документы проверены");
    submit("#task-dialog form");
    check(
      $("#completed-list").textContent.includes("Документы проверены"),
      "Archive updates immediately after edit",
    );
    click("#completed-list .project-item-name");
    click("#task-delete");
    check(
      !$(".global-notice").hidden && !$("#completed-list .completed-row"),
      "Deleted archive entry exposes undo",
    );
    click(".global-notice .text-button");
    check(
      $("#completed-list").textContent.includes("Документы проверены"),
      "Archive deletion can be undone",
    );
    click("#completed-list .completed-restore");
    check(
      !w.__qa.snapshotData().tasks.find((item) => item.id === 12).done,
      "Archived task returns to active work",
    );
    click('[data-open="settings-dialog"]');
    check(
      !$("#settings-panel-appearance").hidden &&
        $("#settings-panel-data").hidden,
      "Settings opens with a focused appearance panel",
    );
    click('[data-settings-tab="data"]');
    check(
      !$("#settings-panel-data").hidden &&
        $("#settings-panel-appearance").hidden &&
        $("#settings-panel-data #backup-download"),
      "Backup and export have their own settings section",
    );
    click('[data-settings-tab="connections"]');
    check(
      all(".settings-connection-choice").length === 4,
      "Settings separates AI, import, calendar and Health Connect",
    );
    click('[data-settings-connection="google"]');
    check(
      $("#settings-dialog").hidden &&
        !$("[data-connection-view='google']").hidden &&
        $("[data-connection-view='ai']").hidden,
      "Calendar card opens calendar settings directly",
    );
    check(
      $("[data-connection-view='ai'] #ai-key-save") &&
        $("[data-connection-view='google'] #google-pull"),
      "Grouping preserves each service's controls",
    );
    click(".connections-back");
    check(
      !$("#settings-dialog").hidden && !$("#settings-panel-connections").hidden,
      "Connections return to their settings section",
    );
    click('[data-settings-connection="ai"]');
    check(
      !$("[data-connection-view='ai']").hidden &&
        $("[data-connection-tab='ai']").getAttribute("aria-pressed") === "true",
      "AI card opens its own settings",
    );
    click("#connections-dialog .close");
    click('[data-page="thoughts"]');
    set("#thought-feed-capture", "Мысль для поездки\nУточнить маршрут");
    click('[data-thought-action="capture"]');
    check(w.__qa.snapshotData().thoughts.length === 1, "Thought saved");
    check(
      $("#thoughts-list").textContent.includes("Уточнить маршрут"),
      "Thought visible in feed",
    );
    click('[data-thought-action="open"]');
    click('[data-thought-action="edit"]');
    set("#thought-feed-editor", "Маршрут изменился");
    $("#thought-feed-editor").dispatchEvent(
      new w.Event("focusout", { bubbles: true }),
    );
    check(
      w.__qa.snapshotData().thoughts[0].body === "Маршрут изменился",
      "Thought editable and autosaved",
    );
    click('[data-page="life"]');
    click('[data-life-tab="finances"]');
    check(
      !$("#life-finances-view").hidden && $("#life-overview").hidden,
      "Finances owns category view",
    );
    click("#finance-account-add");
    set("#account-name", "Тестовый счёт");
    set("#account-currency", "KZT");
    submit("#finance-accounts-dialog form");
    click("#finance-add");
    set(
      "#finance-account",
      w.__qa.snapshotData().uiPreferences.financeAccounts[0].key,
    );
    set("#finance-amount", "1000.15");
    set("#finance-category", "Зарплата");
    set("#finance-type", "income");
    submit("#finance-dialog-form");
    click("#finance-add");
    set("#finance-amount", "300.10");
    set("#finance-category", "Питание");
    submit("#finance-dialog-form");
    check(
      w.__qa.snapshotData().financeLogs.length === 2,
      "Income and spending saved",
    );
    check(
      $("#finance-totals").textContent.includes("700"),
      "Balance calculated",
    );
    click("#finance-log .finance-entry-copy");
    check(!$("#finance-dialog").hidden, "Financial transaction editable");
    click("#finance-dialog .close");
    click('[data-life-tab="training"]');
    check(
      $("#life-os-workspace").dataset.trainingVersion === "2" &&
        $(".training-workspace"),
      "Exercise library replaces the legacy form",
    );
    click(
      all(".training-toolbar button").find(
        (node) => node.textContent === "Упражнения",
      ),
    );
    click("#exercise-library-dialog .button-primary");
    set("#exercise-new-name", "Мои подтягивания");
    set("#exercise-new-unit", "раз");
    submit("#exercise-edit-dialog form");
    check(
      w.__qa.snapshotData().exercises[0].name === "Мои подтягивания",
      "Exercise reusable",
    );
    click("#exercise-library-dialog .close");
    click(
      all(".training-toolbar button").find(
        (node) => node.textContent === "+ Запланировать",
      ),
    );
    set(
      "#workout-exercise-picker",
      w.__qa.snapshotData().exercises[0].exerciseKey,
    );
    click(".training-exercise-picker .button");
    check(
      $(".workout-draft-entries").textContent.includes("Мои подтягивания"),
      "Saved exercise fills workout plan",
    );
    click("#training-edit-dialog .close");
    click('[data-page="archive"]');
    click("#archive-item-add");
    set("#archive-item-name", "Мой фильм");
    $("#archive-item-rating")
      .parentElement.querySelector('[role="slider"]')
      .dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "End", bubbles: true }),
      );
    $("#archive-item-rating")
      .parentElement.querySelector('[role="slider"]')
      .dispatchEvent(
        new w.KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
      );
    check($("#archive-item-rating").value === "4.5", "Half-star selected");
    submit("#archive-item-dialog form");
    check(
      w.__qa.snapshotData().archiveItems[0].rating === 4.5,
      "Half-star persisted",
    );
    check(
      $(".db-card-rating .db-rating-number").textContent === "4,5" &&
        $(".db-card-rating .db-rating-maximum").textContent === "/5",
      "Card shows one star and the numeric score",
    );
    click('[data-page="home"]');
    click('[data-home-view="thoughts"]');
    check(
      $("#task-list").hidden && !$("#home-thought-list").hidden,
      "Home thoughts tab works",
    );
    click('[data-home-view="tasks"]');
    check(!$("#task-list").hidden, "Home tasks restored");
    click('button[data-appearance="light"]');
    check(
      $("#life-os-workspace").dataset.renderedAppearance === "light",
      "Light overrides dark OS",
    );
    click('[data-appearance="dark"]');
    check(
      $("#life-os-workspace").dataset.renderedAppearance === "dark",
      "Dark manual appearance",
    );
    set("#font-select", "libron");
    check(
      $("#life-os-workspace").dataset.font === "libron",
      "Libron available",
    );
    click(".ai-open");
    click("#ai-settings");
    set("#ai-model", "example-model");
    click("#connections-dialog .close");
    click(".ai-open");
    answer = {
      message: "Предлагаю",
      changes: [
        {
          operation: "upsert",
          collection: "tasks",
          id: null,
          data: JSON.stringify({
            title: "Черновик от ИИ",
            context: "Личное",
            date: w.__qa.snapshotData().selectedDate,
            done: false,
          }),
        },
      ],
    };
    set("#ai-prompt", "Добавь задачу");
    submit("#ai-dialog-form");
    await wait();
    check(
      !w.__qa.snapshotData().tasks.some((t) => t.title === "Черновик от ИИ"),
      "AI does not mutate before approval",
    );
    check(!$("#ai-changes").hidden, "Changes previewed");
    click("#ai-changes button");
    await wait();
    check(
      w.__qa.snapshotData().tasks.some((t) => t.title === "Черновик от ИИ"),
      "Reviewed change applied",
    );
    check(!$("#ai-voice"), "App microphone removed; keyboard input remains");
    set("#ai-prompt", "Запиши мысль");
    check(
      $("#ai-prompt").value === "Запиши мысль",
      "Keyboard transcript is editable",
    );
    check(!requests[0].context.financeLogs, "Finances excluded without scope");
    check(
      w.__qa.validateBackup(w.__qa.makeBackup()).data.version === 32,
      "Complete current backup validates",
    );
    check(
      !JSON.stringify(w.__qa.makeBackup()).includes("apiKey"),
      "Keys absent from backup",
    );
    check(!errors.length, "No runtime errors");
    await wait();
    check(
      saved.at(-1).thoughts.length === 1 &&
        saved.at(-1).financeLogs.length === 2,
      "New records included in persistence",
    );
    console.log(
      JSON.stringify(
        {
          passed: true,
          assertions: count,
          scope:
            "Strict DOM actions and mocked native services. No live accounts or physical devices.",
        },
        null,
        2,
      ),
    );
  } finally {
    dom.window.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
