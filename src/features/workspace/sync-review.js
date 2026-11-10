const collections = [
  "projects",
  "tasks",
  "events",
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
  "stepLogs",
  "recoveryLogs",
  "weightLogs",
  "illnessLogs",
  "nutrientLogs",
];
const labels = {
  "@settings": "Настройки",
  projects: "Проекты",
  tasks: "Задачи",
  events: "Расписание",
  thoughts: "Мысли",
  checkins: "Самочувствие",
  sleepLogs: "Сон",
  foodLogs: "Питание",
  waterLogs: "Вода",
  workouts: "Тренировки",
  trainingGoals: "Цели",
  archiveItems: "База данных",
  savedMeals: "Мои блюда",
  taskTemplates: "Шаблоны",
  financeLogs: "Финансы",
  exercises: "Упражнения",
  stepLogs: "Шаги",
  recoveryLogs: "Восстановление",
  weightLogs: "Вес тела",
  illnessLogs: "Болезнь и восстановление",
  nutrientLogs: "Витамины и минералы",
};
function clean(row) {
  if (!row) return null;
  return Object.fromEntries(
    Object.entries(row)
      .filter(
        ([key, value]) => value != null && !["id", "_syncId"].includes(key),
      )
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}
const fieldLabels = {
  title: "Название",
  name: "Название",
  description: "Описание",
  body: "Текст",
  date: "Дата",
  time: "Время",
  start: "Начало",
  end: "Окончание",
  done: "Выполнено",
  context: "Проект / область",
  status: "Статус",
  note: "Заметка",
  review: "Отзыв",
  rating: "Оценка",
  category: "Категория",
  amount: "Сумма",
  currency: "Валюта",
  hours: "Часы сна",
  quality: "Качество",
  mood: "Настроение",
  energy: "Энергия",
  stress: "Стресс",
  pinned: "Закреплено",
  calories: "Калории",
  protein: "Белки",
  fat: "Жиры",
  carbs: "Углеводы",
  ml: "Вода, мл",
  duration: "Длительность, мин",
  count: "Количество шагов",
  entries: "Упражнения и результаты",
  kg: "Вес, кг",
  until: "Выздоровление",
  unit: "Единица",
  nutrientKey: "Вещество",
  goalKeys: "Связанные цели",
  tone: "Цвет",
  url: "Ссылка",
};
const settingLabels = {
  foodTarget: "Дневная цель калорий",
  waterTarget: "Дневная цель воды",
  financeCurrency: "Валюта финансов",
  lifePreferences: "Мой учёт",
};
export function syncConflictTitle(conflict) {
  return conflict.collection === "@settings"
    ? settingLabels[conflict.uid] || "Настройка приложения"
    : conflict.title || labels[conflict.collection] || "Запись";
}
export function syncConflictValue(conflict, value) {
  if (value == null) return "Не задано";
  if (conflict.collection === "@settings") {
    if (conflict.uid === "lifePreferences" && typeof value === "object")
      return (
        "Начало дня: " +
        (value.personalDay?.enabled ? value.personalDay.start : "00:00") +
        " · Вода: " +
        (value.nutrition?.water === false ? "выкл." : "вкл.") +
        " · Калории: " +
        (value.nutrition?.calories === false ? "выкл." : "вкл.") +
        " · БЖУ: " +
        (value.nutrition?.macros === false ? "выкл." : "вкл.") +
        " · Витамины: " +
        (value.nutrition?.micronutrients ? "вкл." : "выкл.") +
        " · Вес: " +
        (value.weight ? "вкл." : "выкл.") +
        " · Болезнь: " +
        (value.illness ? "вкл." : "выкл.") +
        " · Целей веществ: " +
        (value.nutrientTargets?.length || 0)
      );
    if (conflict.uid === "foodTarget")
      return Number(value) === 0
        ? "Цель не задана"
        : String(value) + " ккал в день";
    if (conflict.uid === "waterTarget") return String(value) + " мл в день";
  }
  return (typeof value === "string" ? value : JSON.stringify(value)).slice(
    0,
    500,
  );
}
function readable(row, change) {
  if (change.collection === "@settings")
    return syncConflictValue(
      {
        collection: change.collection,
        uid: change.key.slice("@settings/".length),
      },
      row.value,
    );
  return Object.entries(clean(row))
    .map(
      ([key, value]) =>
        (fieldLabels[key] || key) +
        ": " +
        (typeof value === "boolean"
          ? value
            ? "Да"
            : "Нет"
          : typeof value === "object"
            ? JSON.stringify(value)
            : String(value ?? "—")),
    )
    .join("\n");
}
export function syncDifferences(local, incoming, conflicts = []) {
  const changes = [];
  function compare(collection, before, after, uid, title) {
    const related = conflicts.filter(
      (c) => c.collection === collection && c.uid === uid,
    );
    if (
      !related.length &&
      JSON.stringify(clean(before)) === JSON.stringify(clean(after))
    )
      return;
    const key = collection + "/" + uid;
    changes.push({
      key,
      collection,
      label: labels[collection] || "Настройки данных",
      before,
      after,
      title:
        title ||
        before?.title ||
        after?.title ||
        before?.name ||
        after?.name ||
        before?.date ||
        after?.date ||
        uid,
      type: related.length
        ? "Конфликт"
        : before
          ? after
            ? "Изменение"
            : "Удаление"
          : "Новая запись",
      conflicts: related,
    });
  }
  for (const collection of collections) {
    const key = (row) => row._syncId ?? row.id ?? row.at ?? row.date;
    const a = new Map(
        (local.data[collection] || []).map((row) => [key(row), row]),
      ),
      b = new Map(
        (incoming.data[collection] || []).map((row) => [key(row), row]),
      );
    for (const uid of new Set([...a.keys(), ...b.keys()]))
      compare(collection, a.get(uid), b.get(uid), uid);
  }
  for (const key of [
    "waterTarget",
    "foodTarget",
    "financeCurrency",
    "lifePreferences",
  ])
    compare(
      "@settings",
      { value: local.data[key] },
      { value: incoming.data[key] },
      key,
      settingLabels[key],
    );
  for (const [collection, field] of [
    ["@categories", "archiveCategories"],
    ["@financeCategories", "financeCategories"],
  ]) {
    const value = (doc) =>
      new Map(
        (doc.data[field] || []).map((item) =>
          typeof item === "string"
            ? [
                item,
                {
                  name: item,
                  config: doc.data.uiPreferences?.databaseCollections?.find(
                    (c) => c.name === item,
                  ),
                },
              ]
            : [item.name, item],
        ),
      );
    const a = value(local),
      b = value(incoming);
    for (const key of new Set([...a.keys(), ...b.keys()]))
      compare(collection, a.get(key), b.get(key), key, key);
  }
  return changes;
}
export function installSyncReview(ctx, ui) {
  const { make, action } = ctx,
    form = ui.dialog("sync-review-dialog", "Сравнение устройств"),
    list = make("div", "sync-review-list"),
    status = make("p", "connection-status");
  let review = null;
  const choices = new Map();
  const both = new Map();
  const decisions = new Set();
  function updateApply() {
    apply.disabled = Boolean(
      review?.transport === "file" &&
      review.changes.some((c) => c.conflicts.length && !decisions.has(c.key)),
    );
    if (apply.disabled)
      status.textContent = "Выберите версию для каждой записи с различиями.";
    else status.textContent = "";
  }
  form.append(
    make(
      "p",
      "aux-note",
      "Изменения ещё не применены. Выберите для каждой записи версию с другого устройства или оставьте локальную.",
    ),
    list,
    status,
  );
  const apply = action(
    "Применить выбранное",
    () => {
      if (!review) return;
      apply.disabled = true;
      window.dispatchEvent(
        new CustomEvent("life-os:lan-action", {
          detail: {
            operation: "review",
            args: {
              rejected: [...choices]
                .filter(([, accept]) => !accept.checked)
                .map(([key]) => key),
              both: [...both]
                .filter(([, choice]) => choice.checked)
                .map(([key]) => key),
            },
          },
        }),
      );
    },
    "button button-primary",
  );
  form.append(apply);
  form.onsubmit = (event) => event.preventDefault();
  function open(value, page = 0, preserve = false) {
    review = value;
    if (!preserve) {
      choices.clear();
      both.clear();
      decisions.clear();
    }
    list.replaceChildren();
    status.textContent = "";
    apply.disabled = false;
    const pageSize = 50,
      start = page * pageSize;
    if (value.changes.length > pageSize)
      list.append(
        make(
          "p",
          "aux-note",
          `Записи ${start + 1}–${Math.min(start + pageSize, value.changes.length)} из ${value.changes.length}`,
        ),
      );
    for (const change of value.changes.slice(start, start + pageSize)) {
      const item = make("section", "sync-review-object"),
        heading = make(
          "h3",
          "",
          change.type + " · " + change.label + " · " + change.title,
        ),
        choice = make("label", "sync-review-choice"),
        checkbox = make("input");
      checkbox.type = "checkbox";
      checkbox.checked = choices.get(change.key)?.checked ?? true;
      choices.set(change.key, checkbox);
      choice.append(checkbox, make("span", "", "Принять с другого устройства"));
      item.append(
        heading,
        make(
          "small",
          "",
          "Источник: " +
            (value.source?.[change.key] ||
              value.hostName ||
              "другое устройство"),
        ),
        choice,
      );
      const fileConflict =
        value.transport === "file" && change.conflicts.length > 0;
      if (fileConflict) {
        choice.hidden = true;
        if (decisions.has(change.key))
          item.dataset.fileChoice = checkbox.checked ? "incoming" : "local";
        const versions = make("div", "connection-actions");
        const choose = (incoming) => {
          checkbox.checked = incoming;
          decisions.add(change.key);
          checkbox.dispatchEvent(new Event("change", { bubbles: true }));
          item.dataset.fileChoice = incoming ? "incoming" : "local";
          updateApply();
        };
        versions.append(
          action("Оставить на этом устройстве", () => choose(false), "button"),
          action("Использовать из файла", () => choose(true), "button"),
        );
        item.append(versions);
      }
      if (
        change.before &&
        change.after &&
        ["tasks", "events", "thoughts", "archiveItems"].includes(
          change.collection,
        )
      ) {
        const label = make("label", "sync-review-choice"),
          keep = make("input");
        keep.type = "checkbox";
        keep.checked = both.get(change.key)?.checked ?? false;
        label.append(
          keep,
          make("span", "", "Сохранить локальную версию отдельной копией"),
        );
        both.set(change.key, keep);
        item.append(label);
      }
      checkbox.onchange = () => {
        const keep = both.get(change.key);
        if (keep) {
          keep.disabled = !checkbox.checked;
          if (!checkbox.checked) keep.checked = false;
        }
        if (
          !checkbox.checked &&
          change.collection === "projects" &&
          !change.before &&
          change.after
        ) {
          for (const related of value.changes.filter(
            (c) =>
              !c.before &&
              ["tasks", "events"].includes(c.collection) &&
              c.after?.context === change.after.name,
          )) {
            const choice = choices.get(related.key);
            if (choice) choice.checked = false;
            else choices.set(related.key, { checked: false });
          }
          status.textContent =
            "Новый проект отклонён вместе с его новыми задачами.";
        }
      };
      const columns = make("div", "sync-review-columns");
      for (const [title, row] of [
        ["На этом устройстве", change.before],
        [
          value.transport === "file" ? "Из файла" : "После принятия",
          change.after,
        ],
      ]) {
        const column = make("div"),
          text = make(
            "pre",
            "",
            row ? readable(row, change) : "Запись отсутствует",
          );
        text.dataset.userContent = "true";
        column.append(make("strong", "", title), text);
        columns.append(column);
      }
      item.append(columns);
      for (const conflict of value.transport === "file"
        ? []
        : change.conflicts) {
        const box = make("div", "lan-conflict");
        box.append(
          make(
            "strong",
            "",
            conflict.collection === "@settings"
              ? syncConflictTitle(conflict)
              : "Различается: " +
                  (fieldLabels[conflict.field] || conflict.field),
          ),
        );
        for (const [alternative, value] of [
          [false, conflict.kept],
          [true, conflict.alternative],
        ]) {
          const choice = make("div", "lan-conflict-choice"),
            preview = make("span", "", syncConflictValue(conflict, value));
          preview.dataset.userContent = "true";
          choice.append(
            preview,
            action("Использовать это значение", () =>
              window.dispatchEvent(
                new CustomEvent("life-os:lan-action", {
                  detail: {
                    operation: "resolve",
                    args: { id: conflict.id, alternative },
                  },
                }),
              ),
            ),
          );
          box.append(choice);
        }
        item.append(box);
      }
      list.append(item);
    }
    if (value.changes.length > pageSize) {
      const pages = make("div", "connection-actions sync-review-pages"),
        previous = action("Назад", () => open(value, page - 1, true), "button"),
        next = action("Далее", () => open(value, page + 1, true), "button");
      previous.disabled = page === 0;
      next.disabled = start + pageSize >= value.changes.length;
      pages.append(
        previous,
        make(
          "span",
          "aux-note",
          `${page + 1} / ${Math.ceil(value.changes.length / pageSize)}`,
        ),
        next,
      );
      list.append(pages);
    }
    updateApply();
    if (!preserve) ctx.openDialog("sync-review-dialog");
    else form.scrollTop = 0;
    ctx.fitDialog();
  }
  const listener = (event) => {
    const detail = event.detail;
    if (Object.hasOwn(detail, "review")) {
      review = detail.review;
      if (review && (!form.closest(".overlay").hidden || detail.openFileReview))
        open(review);
    }
    if (detail.reviewError) {
      status.textContent = detail.reviewError;
      apply.disabled = false;
    }
    if (detail.reviewApplied) {
      if (!form.closest(".overlay").hidden) ctx.closeDialog();
      review = null;
    }
  };
  window.addEventListener("life-os:lan-status", listener);
  return {
    open: () => review && open(review),
    dispose: () => window.removeEventListener("life-os:lan-status", listener),
  };
}
