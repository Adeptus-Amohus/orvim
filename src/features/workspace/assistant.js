import { proposedSnapshot, editableCollections, localDay } from "./changes.js";
import {
  lifeSettings,
  personalDay,
  lifeRecordDay,
} from "./life-tracking-model.js";
import {
  requestLifePeriod,
  lifeCollections,
  lifeContextSummary,
  statsDay,
  analyzeLifePeriod,
  validStatsRange,
} from "./life-statistics.js";

// This is a local suggestion only. Nothing is attached until the user chooses it.
export function suggestAssistantContext(
  data,
  selection,
  prompt,
  now = new Date(),
  periodOverride = undefined,
) {
  const normalize = (text) =>
    String(text || "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replaceAll("ё", "е")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  const query = " " + normalize(prompt) + " ";
  const existing = assistantContext(data, selection, now),
    suggestions = [];
  const period =
    periodOverride === undefined
      ? requestLifePeriod(prompt, now)
      : periodOverride;
  const lifeRequest =
    /(?:шаг|step|трениров|workout|статист|сводк|summary|statistics|как.*(?:день|недел)|калораж)/iu.test(
      prompt,
    ) &&
    !/^\s*(?:добав|созда|запланир|запиш|add|create|schedule)/iu.test(prompt);
  if (lifeRequest && !selection?.lifeData?.includes("*")) {
    const specific = [];
    if (/шаг|step/iu.test(prompt)) specific.push("stepLogs");
    if (/трениров|workout/iu.test(prompt)) specific.push("workouts");
    if (/калораж|калори|ккал|calori/iu.test(prompt)) specific.push("foodLogs");
    const kinds = specific.length ? specific : ["lifeData"];
    for (const kind of kinds) {
      const rows = lifeCollections.flatMap((key) =>
        kind !== "lifeData" && key !== kind
          ? []
          : (data[key] || []).filter((row) => {
              const day =
                key === "checkins" ? statsDay(new Date(row.at)) : row.date;
              return !period || (day >= period.from && day <= period.until);
            }),
      );
      if (!selection?.[kind]?.includes("*"))
        suggestions.push({ kind, ids: ["*"], rows, period });
    }
  }
  const databaseRequest =
    /(?:фильм|книг|аниме|каталог|коллекци|баз[аеуы] данных|movie|book|database|catalog)/iu.test(
      prompt,
    );
  const foodRequest =
    /(?:калори|ккал|питани|съел|съела|завтрак|обед|ужин|calori|meal|food)/iu.test(
      prompt,
    ) || /(?:^|[^\p{L}])ед[ауе](?:[^\p{L}]|$)/iu.test(prompt);
  for (const kind of ["archiveItems", "foodLogs"]) {
    const selected = new Set((existing[kind] || []).map((row) => row.id));
    const missing = (data[kind] || []).filter((row) => !selected.has(row.id));
    const named = (data[kind] || []).filter((row) => {
      const title = normalize(row.name || row.title);
      return title.length >= 4 && query.includes(" " + title + " ");
    });
    let rows = named.filter((row) => !selected.has(row.id));
    if (!named.length && kind === "archiveItems" && databaseRequest)
      rows = missing;
    if (
      !named.length &&
      kind === "foodLogs" &&
      foodRequest &&
      !suggestions.some((s) => s.kind === "lifeData" || s.kind === kind) &&
      !selection?.lifeData?.includes("*")
    ) {
      const day = new Date(now);
      if (/вчера|yesterday/iu.test(prompt)) day.setDate(day.getDate() - 1);
      const date = prompt.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0] || localDay(day);
      rows = missing.filter((row) =>
        period
          ? row.date >= period.from && row.date <= period.until
          : row.date === date,
      );
    }
    if (rows.length)
      suggestions.push({
        kind,
        ids: rows.map((row) => row._syncId ?? row.id),
        rows,
      });
  }
  return suggestions;
}

export function assistantContext(
  data,
  selection,
  now = new Date(),
  prompt = "",
  periodOverride = undefined,
) {
  const result = {
    version: data.version || 31,
    today: personalDay(now, data),
    localTime: now.toString(),
    lifePreferences: {
      personalDay: lifeSettings(data).personalDay,
      nutrition: lifeSettings(data).nutrition,
    },
  };
  for (const [kind, ids] of Object.entries(selection || {})) {
    if (
      kind === "projectTasks" ||
      ![...editableCollections, ...lifeCollections].includes(kind) ||
      !Array.isArray(data[kind]) ||
      !Array.isArray(ids)
    )
      continue;
    result[kind] = data[kind].filter(
      (item) =>
        ids.includes("*") ||
        ids.includes(item._syncId ?? item.id ?? item.at ?? item.date) ||
        ids.includes(item.id ?? item.at ?? item.date),
    );
  }
  const analysis = analyzeLifePeriod(
    prompt,
    new Date(personalDay(now, data) + "T12:00:00"),
  );
  const period =
    periodOverride === undefined ? analysis.period : periodOverride;
  if (period && !validStatsRange(period.from, period.until))
    throw Error("Некорректный период данных.");
  if (selection?.lifeData?.includes("*"))
    for (const key of lifeCollections) result[key] = data[key] || [];
  const fullLifeContext = Object.fromEntries(
    lifeCollections
      .filter((key) => Array.isArray(result[key]))
      .map((key) => [key, result[key]]),
  );
  for (const key of lifeCollections) {
    if (!result[key] || !period) continue;
    result[key] = result[key].filter((row) => {
      const day = lifeRecordDay(row, data, key);
      return key === "illnessLogs"
        ? day <= period.until &&
            (row.until || personalDay(now, data)) >= period.from
        : day >= period.from && day <= period.until;
    });
  }
  const grantedLife = Object.fromEntries(
    lifeCollections
      .filter(
        (key) => selection?.lifeData?.includes("*") || selection?.[key]?.length,
      )
      .map((key) => [key, result[key] || []]),
  );
  grantedLife.lifePreferences = result.lifePreferences;
  const summary = lifeContextSummary(grantedLife, period);
  if (summary) result.lifeSummary = summary;
  if (summary && periodOverride === undefined && analysis.comparisons) {
    summary.comparisons = analysis.comparisons.map((part) =>
      lifeContextSummary(
        {
          ...Object.fromEntries(
            Object.entries(fullLifeContext)
              .filter(([key]) => lifeCollections.includes(key))
              .map(([key, rows]) => [
                key,
                rows.filter((row) => {
                  const day = lifeRecordDay(row, data, key);
                  return key === "illnessLogs"
                    ? day <= part.until &&
                        (row.until || personalDay(now, data)) >= part.from
                    : day >= part.from && day <= part.until;
                }),
              ]),
          ),
          lifePreferences: result.lifePreferences,
        },
        part,
      ),
    );
  }
  if (summary && selection?.lifeData?.includes("*")) {
    summary.rawRecordCoverage = {};
    for (const key of lifeCollections) {
      const rows = result[key] || [];
      summary.rawRecordCoverage[key] = {
        total: rows.length,
        included: Math.min(200, rows.length),
      };
      if (rows.length > 200)
        result[key] = [...rows]
          .sort((a, b) =>
            key === "checkins" ? b.at - a.at : b.date.localeCompare(a.date),
          )
          .slice(0, 200);
    }
  }
  const projectIds = selection?.projectTasks || [];
  if (projectIds.length) {
    const projects = data.projects.filter(
      (p) =>
        projectIds.includes("*") ||
        projectIds.includes(p._syncId ?? p.id) ||
        projectIds.includes(p.id),
    );
    const names = new Set(projects.map((p) => p.name));
    for (const kind of ["projects", "tasks", "events"]) {
      const rows =
        kind === "projects"
          ? projects
          : data[kind].filter((row) => names.has(row.context));
      result[kind] = [
        ...new Map(
          [...(result[kind] || []), ...rows].map((row) => [row.id, row]),
        ).values(),
      ];
    }
  }
  if (selection?.archiveItems?.length) {
    const categories = [
      ...new Set(
        selection.archiveItems.includes("*")
          ? data.archiveCategories || []
          : (result.archiveItems || []).map((row) => row.category),
      ),
    ];
    result.databaseCollections = categories.map(
      (name) =>
        data.uiPreferences?.databaseCollections?.find(
          (config) => config.name === name,
        ) || {
          name,
          ratingMax: 5,
          statuses: ["planned", "active", "done"].map((id) => ({
            id,
            phase: id,
          })),
        },
    );
  }
  if (Object.hasOwn(result, "financeLogs"))
    result.financeAccounts = (data.uiPreferences?.financeAccounts || [])
      .filter(
        (account) =>
          selection?.financeLogs?.includes("*") ||
          result.financeLogs.some(
            (row) =>
              row.accountKey === account.key ||
              row.toAccountKey === account.key,
          ),
      )
      .map(({ key, name, currency, from }) => ({ key, name, currency, from }));
  return structuredClone(result);
}

/** Markdown is constructed as DOM text; generated HTML is never interpreted. */
export function renderAssistantMarkdown(host, text, openExternal) {
  host.replaceChildren();
  const doc = host.ownerDocument,
    make = (tag, text) => {
      const n = doc.createElement(tag);
      if (text !== undefined) n.textContent = text;
      return n;
    };
  function inline(parent, text) {
    const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\))/g;
    for (const part of text.split(pattern)) {
      if (part.startsWith("**") && part.endsWith("**"))
        parent.append(make("strong", part.slice(2, -2)));
      else if (part.startsWith("`") && part.endsWith("`"))
        parent.append(make("code", part.slice(1, -1)));
      else if (/^\[.+\]\(https?:\/\//.test(part)) {
        const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part),
          link = make("a", match[1]);
        let url;
        try {
          url = new URL(match[2]);
        } catch {
          parent.append(doc.createTextNode(part));
          continue;
        }
        if (url.username || url.password) {
          parent.append(doc.createTextNode(part));
          continue;
        }
        link.href = url.href;
        link.rel = "noopener noreferrer";
        link.target = "_blank";
        if (openExternal)
          link.addEventListener("click", (event) => {
            event.preventDefault();
            void openExternal(url.href);
          });
        parent.append(link);
      } else parent.append(doc.createTextNode(part));
    }
  }
  let list = null,
    code = null;
  for (const line of String(text).split("\n")) {
    if (line.startsWith("```")) {
      if (code) {
        code = null;
      } else {
        const pre = make("pre");
        code = make("code");
        pre.append(code);
        host.append(pre);
      }
      list = null;
      continue;
    }
    if (code) {
      code.textContent += line + "\n";
      continue;
    }
    if (!line.trim()) {
      list = null;
      continue;
    }
    const bullet = /^\s*([-*]|\d+[.)])\s+/.exec(line);
    if (bullet) {
      const tag = /\d/.test(bullet[1]) ? "ol" : "ul";
      if (!list || list.tagName.toLowerCase() !== tag) {
        list = make(tag);
        host.append(list);
      }
      const item = make("li");
      inline(item, line.slice(bullet[0].length));
      list.append(item);
      continue;
    }
    list = null;
    const heading = /^(#{1,3})\s+/.exec(line),
      item = make(heading ? "h" + (heading[1].length + 2) : "p");
    inline(item, heading ? line.slice(heading[0].length) : line);
    host.append(item);
  }
}

export function installAssistant(ctx, ui) {
  const { $, make, listen, services, action } = ctx;
  let disposed = false,
    pending = null,
    busy = false,
    requesting = false,
    requestStartedAt = 0,
    waitingTimer = null;
  let draftTimer = null,
    activeRequest = null,
    manualPeriod = null;
  const labels = {
    lifeData: "Данные Жизни",
    projectTasks: "Проекты и их задачи",
    tasks: "Задачи",
    thoughts: "Мысли",
    events: "Расписание",
    checkins: "Самочувствие",
    sleepLogs: "Сон",
    foodLogs: "Питание",
    waterLogs: "Вода",
    workouts: "Тренировки",
    trainingGoals: "Цели тренировок",
    stepLogs: "Шаги",
    weightLogs: "Вес тела",
    illnessLogs: "Болезнь и восстановление",
    financeLogs: "Финансы",
    archiveItems: "База данных",
    exercises: "Упражнения",
    projects: "Проекты",
  };
  Object.assign(ctx.translations, {
    "Данные Жизни": "Life data",
    "Все данные Жизни": "All Life data",
    "Шаги, тренировки и подходы, питание и калории, вода, сон и самочувствие. Для запроса за день или неделю передаётся только этот период.":
      "Steps, workouts and sets, nutrition and calories, water, sleep and wellbeing. Day or week requests share only that period.",
    "Настроить ИИ": "AI settings",
    "Добавить контекст": "Add context",
    Контекст: "Context",
    Необязательно: "Optional",
    "Чем помочь?": "How can I help?",
    "Пишите как в обычном разговоре.": "Write as in a normal conversation.",
    "Если нужны данные Orvim — добавьте контекст.":
      "Add context if you need Orvim data.",
    "Спланировать день": "Plan my day",
    "Сообщение ИИ": "Message AI",
    "Напишите сообщение…": "Write a message…",
    "Отправить сообщение": "Send message",
    Диктовка: "Dictation",
    "Настройки диктовки": "Dictation settings",
    "Переписка с ИИ": "AI conversation",
    "ИИ ещё готовит ответ…": "AI is still preparing a reply…",
    "Разрешить облачное распознавание, если локальное недоступно. Аудио может передаваться службе устройства.":
      "Allow cloud recognition if local recognition is unavailable. Audio may be sent to the device's speech service.",
    "Enter — отправить · Shift + Enter — новая строка":
      "Enter to send · Shift + Enter for a new line",
    "К чату": "Back to chat",
    "Данные для ИИ": "Data for AI",
    "Выберите, что ИИ сможет прочитать. Проект добавляется вместе с его задачами. Остальные данные останутся на устройстве.":
      "Choose what AI can read. Projects include their tasks. Other data stays on your device.",
    "Какие данные добавить": "Which data to add",
    "Найти проект": "Find a project",
    "Найти задачу": "Find a task",
    "Найти мысль": "Find a thought",
    "Найти событие": "Find an event",
    "Сохранённые наборы": "Saved selections",
    "Чтобы не выбирать записи заново. Их содержимое обновляется перед каждым запросом.":
      "Reuse a selection. Its contents refresh before every request.",
    "Выбрать набор": "Choose a selection",
    "Название, например «Работа»": "Name, for example Work",
    "Что увидит ИИ": "What AI will see",
    "Убрать всё": "Remove all",
    "Проекты и их задачи": "Projects and their tasks",
    "Выбрать весь раздел": "Select the entire section",
    "Включая записи, которые появятся позже": "Including future records",
    "Копировать сообщение": "Copy message",
    "ИИ помощник": "AI assistant",
    "Готовит ответ…": "Preparing a reply…",
    Повторить: "Retry",
    "Только ваше сообщение и предыдущая переписка. Записи Orvim не выбраны.":
      "Only your message and the previous conversation. No Orvim records selected.",
    "Здесь пока нет записей. Можно выбрать другой раздел.":
      "No records here yet. Choose another section.",
    "Ничего не найдено. Попробуйте другой запрос.":
      "Nothing found. Try a different search.",
  });
  const fieldNames = {
    description: "Описание",
    body: "Текст",
    context: "Проект",
    date: "Дата",
    time: "Время",
    start: "Начало",
    end: "Конец",
    note: "Заметка",
    hours: "Часы сна",
    quality: "Качество сна",
    mood: "Настроение",
    energy: "Энергия",
    stress: "Стресс",
    calories: "Калории",
    protein: "Белки",
    fat: "Жиры",
    carbs: "Углеводы",
    ml: "Вода, мл",
    amount: "Сумма",
    currency: "Валюта",
    category: "Категория",
    rating: "Оценка",
    review: "Отзыв",
    duration: "Минуты",
    current: "Прогресс",
    target: "Цель",
    status: "Этап",
    name: "Название",
    title: "Название",
    done: "Выполнено",
    tone: "Цвет",
    focus: "Направление",
    unit: "Единица",
    baseline: "Начальное значение",
    coverUrl: "Обложка по ссылке",
    coverQuery: "Поиск обложки",
    kind: "Тип записи",
  };
  const prefs = () => ctx.extraState.uiPreferences;
  // Keep the user's explicit selection across openings and app restarts.
  let sessionSelection = structuredClone(prefs().aiSelection || {});
  const selection = () => sessionSelection;
  const history = () => (prefs().aiHistory ||= []);
  let historyStart = history().length;
  const recordsSignature = (snapshot) =>
    JSON.stringify([
      editableCollections.map((key) => snapshot.data[key]),
      snapshot.covers,
      snapshot.data.archiveCategories,
    ]);
  const form = ui.dialog("ai-dialog", "ИИ помощник");
  form.classList.add("ai-dialog");
  form.classList.add("assistant-shell");
  form.insertAdjacentHTML(
    "beforeend",
    `<div class="ai-toolbar"><span id="ai-current-model"></span><button type="button" id="ai-settings" class="text-button">Настроить ИИ</button></div>
  <div id="ai-chat-view" class="ai-chat-view">
    <div class="ai-context-bar"><button type="button" id="ai-context-open" class="ai-context-button"><span>Данные для ИИ</span><span id="ai-context-count"></span></button><span id="ai-context-summary">Без записей Orvim</span></div>
    <div class="ai-chat-scroll" id="ai-chat-scroll"><div id="ai-empty" class="ai-empty"><div class="ai-empty-symbol"></div><h3>Чем помочь?</h3><p>Пишите как в обычном разговоре.<br>Если нужны данные Orvim — добавьте контекст.</p><div class="ai-suggestions"><button type="button" data-ai-prompt="Помоги создать проект. Сначала уточни, что я хочу сделать.">Создать проект</button><button type="button" data-ai-prompt="Помоги спланировать день. Сначала уточни мои планы.">Спланировать день</button><button type="button" data-ai-prompt="Хочу записать мысль. Сначала спроси, какую.">Записать мысль</button></div></div><div id="ai-messages" class="ai-messages" role="log" aria-label="Переписка с ИИ" aria-live="polite" aria-relevant="additions text"></div><div id="ai-changes" class="ai-changes" hidden></div></div>
    <div class="ai-compose"><label class="ai-compose-label" for="ai-prompt">Сообщение ИИ</label><textarea id="ai-prompt" rows="2" maxlength="10000" required placeholder="Напишите сообщение…"></textarea><div class="ai-compose-actions"><button type="submit" id="ai-send" class="button button-primary" aria-label="Отправить сообщение"><span>Отправить</span></button></div></div>
    <small class="ai-compose-hint">Enter — отправить · Shift + Enter — новая строка</small>
  </div>
  <section id="ai-context-panel" class="ai-context-view" aria-labelledby="ai-context-title" hidden><div class="ai-context-heading"><button type="button" id="ai-context-back" class="text-button">К чату</button><h3 id="ai-context-title">Данные для ИИ</h3></div><div class="ai-context-body"><p class="ai-context-help">Выберите, что ИИ сможет прочитать. Проект добавляется вместе с его задачами. Остальные данные останутся на устройстве.</p><div id="ai-context-selected" class="ai-context-selected"></div><div class="ai-context-sources"><button type="button" data-ai-source="projectTasks">Проекты</button><button type="button" data-ai-source="tasks">Задачи</button><button type="button" data-ai-source="thoughts">Мысли</button><button type="button" data-ai-source="events">Расписание</button><button type="button" data-ai-source="other">Ещё</button></div><label id="ai-context-other" class="ai-context-other" hidden>Какие данные добавить<select id="ai-context-kind" aria-label="Источник контекста"></select></label><input id="ai-context-search" type="search" placeholder="Найти проект" aria-label="Найти запись"><div id="ai-context-items"></div><details class="ai-context-presets"><summary>Сохранённые наборы</summary><p class="ai-context-help">Чтобы не выбирать записи заново. Их содержимое обновляется перед каждым запросом.</p><select id="ai-context-preset" aria-label="Сохранённый контекст"><option value="">Выбрать набор</option></select><div class="ai-preset-save"><input id="ai-context-name" maxlength="80" placeholder="Название, например «Работа»" aria-label="Название набора контекста"><button type="button" id="ai-context-save" class="button">Сохранить</button></div><p id="ai-context-notice" role="status" hidden></p></details><details class="ai-context-preview-panel"><summary>Что увидит ИИ</summary><div id="ai-context-preview"></div></details></div><div class="ai-context-footer"><button type="button" id="ai-context-clear" class="text-button">Убрать всё</button><button type="button" id="ai-context-done" class="button button-primary">Готово</button></div></section>
  <p id="ai-status" class="connection-status" role="status" hidden></p>`,
  );
  const status = (message, error = false) => {
    ui.setStatus($("#ai-status"), message, error);
    $("#ai-status").hidden = !message;
  };
  const contextNotice = (message, error = false) => {
    ui.setStatus($("#ai-context-notice"), message, error);
    $("#ai-context-notice").hidden = !message;
  };
  const databaseSource = make("button", "", "База данных");
  databaseSource.type = "button";
  databaseSource.dataset.aiSource = "archiveItems";
  $(".ai-context-sources [data-ai-source='other']").before(databaseSource);
  const lifeSource = make("button", "", "Жизнь");
  lifeSource.type = "button";
  lifeSource.dataset.aiSource = "lifeData";
  databaseSource.before(lifeSource);
  const primarySources = [
    "projectTasks",
    "tasks",
    "thoughts",
    "events",
    "archiveItems",
    "lifeData",
  ];
  for (const [id, icon] of [
    ["ai-context-open", "paperclip"],
    ["ai-send", "arrow-up"],
    ["ai-context-back", "chevron-left"],
  ])
    $("#" + id).prepend(ui.icon(icon));
  $(".ai-empty-symbol").append(ui.icon("sparkles"));
  const clear = action(
    "",
    () => {
      if (busy) return;
      if (
        history().length &&
        !window.confirm(
          "Очистить переписку на устройстве? Доступ к записям будет сброшен. Данные у провайдера ИИ и в старых резервных копиях не удаляются. Записи Orvim останутся.",
        )
      )
        return;
      prefs().aiHistory = [];
      historyStart = 0;
      sessionSelection = {};
      prefs().aiDraft = "";
      $("#ai-prompt").value = "";
      updateContext();
      $("#ai-messages").replaceChildren();
      showChanges([]);
      status("");
      updateEmpty();
      ctx.persistState();
    },
    "text-button ai-clear-chat",
  );
  clear.id = "ai-clear-chat";
  clear.setAttribute("aria-label", "Очистить переписку на устройстве");
  clear.title = "Очистить переписку на устройстве";
  clear.append(ui.icon("trash-2"));
  const shareHistoryLabel = make("label", "ai-history-consent"),
    shareHistory = make("input"),
    shareNotice = make("small", "aux-note"),
    outgoing = make("details", "ai-context-preview-panel"),
    outgoingText = make("pre");
  shareHistory.type = "checkbox";
  shareHistory.id = "ai-share-history";
  shareHistoryLabel.append(
    shareHistory,
    document.createTextNode("Передавать также прошлую переписку"),
  );
  $(".ai-context-body").prepend(shareHistoryLabel);
  shareNotice.textContent =
    "Выбор запоминается. При отправке сообщения ИИ получает выбранные данные и текущий разговор. Убрать доступ можно здесь в любой момент.";
  outgoing.append(make("summary", "", "Подробности запроса"), outgoingText);
  outgoingText.style.cssText =
    "white-space:pre-wrap;overflow-wrap:anywhere;max-height:180px;overflow:auto;font-size:12px";
  $(".ai-context-body").append(shareNotice, outgoing);
  $("#ai-chat-scroll").append($("#ai-status"));
  function refreshOutgoing() {
    if (!outgoing.open) return;
    try {
      outgoingText.textContent = JSON.stringify(
        {
          message: $("#ai-prompt").value,
          context: assistantContext(
            ctx.snapshotData(),
            selection(),
            new Date(),
            $("#ai-prompt").value,
            selectedPeriod(),
          ),
          history: history()
            .slice(shareHistory.checked ? 0 : historyStart)
            .filter(
              (row) =>
                !row.error &&
                row.delivery !== "pending" &&
                ["user", "assistant"].includes(row.role),
            )
            .map(({ role, content }) => ({ role, content })),
        },
        null,
        2,
      );
    } catch {
      outgoingText.textContent = "Уточните период данных.";
    }
  }
  outgoing.addEventListener("toggle", refreshOutgoing);
  shareHistory.addEventListener("change", refreshOutgoing);
  $("#ai-prompt").addEventListener("input", refreshOutgoing);
  form
    .querySelector(".dialog-head")
    .insertBefore(clear, form.querySelector(".close"));
  function setBusy(value) {
    busy = value;
    const send = $("#ai-send");
    const cancellable = value && activeRequest;
    send.disabled = value && !cancellable;
    send.type = cancellable ? "button" : "submit";
    send.setAttribute(
      "aria-label",
      cancellable
        ? ctx.translate("Остановить ответ", "Stop response")
        : ctx.translate("Отправить сообщение", "Send message"),
    );
    send.replaceChildren(
      ui.icon(cancellable ? "square" : "arrow-up"),
      make(
        "span",
        "",
        cancellable
          ? ctx.translate("Остановить", "Stop")
          : ctx.translate("Отправить", "Send"),
      ),
    );
    services.refreshIcons(send);
    clear.disabled = value;
  }
  function scrollChat() {
    const host = $("#ai-chat-scroll");
    host.scrollTop = host.scrollHeight;
  }
  function updateEmpty() {
    $("#ai-empty").hidden = Boolean($("#ai-messages").childElementCount);
  }
  function resizeComposer() {
    const input = $("#ai-prompt");
    input.style.height = "auto";
    input.style.height = Math.min(120, Math.max(48, input.scrollHeight)) + "px";
  }
  function saveDraft() {
    clearTimeout(draftTimer);
    if (draftTimer !== null) {
      draftTimer = null;
      ctx.persistState();
    }
  }
  function queueDraft() {
    clearTimeout(draftTimer);
    draftTimer = setTimeout(saveDraft, 400);
  }
  const periodRow = make("div", "ai-period-row"),
    periodFrom = make("input"),
    periodUntil = make("input"),
    periodHint = make("small", "aux-note");
  periodFrom.type = periodUntil.type = "date";
  periodFrom.id = "ai-period-from";
  periodUntil.id = "ai-period-until";
  periodFrom.setAttribute("aria-label", "Данные ИИ: с даты");
  periodUntil.setAttribute("aria-label", "Данные ИИ: по дату");
  periodFrom.min = periodUntil.min = "1900-01-01";
  periodFrom.max = periodUntil.max = "2200-12-31";
  const autoPeriod = action(
    "Из запроса",
    () => {
      manualPeriod = null;
      renderPeriod();
    },
    "text-button",
  );
  periodRow.append(
    make("span", "", "Период данных"),
    periodFrom,
    make("span", "", "—"),
    periodUntil,
    autoPeriod,
    periodHint,
  );
  $(".ai-context-body").prepend(periodRow);
  function selectedPeriod() {
    const prompt = $("#ai-prompt").value.trim();
    return manualPeriod?.prompt === prompt ? manualPeriod.range : undefined;
  }
  function renderPeriod() {
    const analysis = analyzeLifePeriod($("#ai-prompt").value),
      override = selectedPeriod(),
      period = override === undefined ? analysis.period : override;
    periodRow.hidden =
      !period && !analysis.issue && !selection().lifeData?.includes("*");
    periodFrom.value = period?.from || "";
    periodUntil.value = period?.until || "";
    const hint =
      override !== undefined
        ? "Выбран вручную"
        : analysis.issue ||
          (period
            ? analysis.comparisons
              ? "Сравнение периодов из запроса"
              : "Из запроса"
            : "Все выбранные записи · можно ограничить даты");
    periodHint.textContent = ctx.translate(
      hint,
      ctx.translations[hint] || hint,
    );
    periodHint.dataset.error = String(
      override === undefined && Boolean(analysis.issue),
    );
    autoPeriod.hidden = override === undefined;
  }
  for (const input of [periodFrom, periodUntil])
    listen(input, "change", () => {
      manualPeriod = {
        prompt: $("#ai-prompt").value.trim(),
        range: { from: periodFrom.value, until: periodUntil.value },
      };
      periodHint.textContent = validStatsRange(
        periodFrom.value,
        periodUntil.value,
      )
        ? "Выбран вручную"
        : "Укажите начало и конец периода";
      autoPeriod.hidden = false;
    });
  function openContext() {
    form.classList.add("ai-selecting-context");
    $("#ai-chat-view").hidden = true;
    $("#ai-context-panel").hidden = false;
    status("");
    contextNotice("");
    renderPresets();
    renderPicker();
    $("#ai-context-back").focus();
  }
  function closeContext() {
    form.classList.remove("ai-selecting-context");
    $("#ai-context-panel").hidden = true;
    $("#ai-chat-view").hidden = false;
    status("");
    $("#ai-context-open").focus();
    resizeComposer();
    scrollChat();
  }
  listen($("#ai-context-open"), "click", openContext);
  listen($("#ai-context-back"), "click", closeContext);
  listen($("#ai-context-done"), "click", closeContext);
  for (const button of form.querySelectorAll("[data-ai-source]"))
    listen(button, "click", () => {
      const source = button.dataset.aiSource;
      $("#ai-context-kind").value = source === "other" ? "checkins" : source;
      $("#ai-context-search").value = "";
      renderPicker();
    });
  for (const button of form.querySelectorAll("[data-ai-prompt]"))
    listen(button, "click", () => {
      $("#ai-prompt").value = button.dataset.aiPrompt;
      prefs().aiDraft = $("#ai-prompt").value;
      resizeComposer();
      $("#ai-prompt").focus();
      ctx.persistState();
    });
  for (const [kind, label] of Object.entries(labels)) {
    const option = make("option", "", label);
    option.value = kind;
    $("#ai-context-kind").append(option);
  }
  const settings = () => ctx.extraState.connectionSettings;
  function metadata() {
    const provider =
      { openai: "OpenAI", deepseek: "DeepSeek", gemini: "Gemini" }[
        settings().aiProvider
      ] || "OpenAI";
    $("#ai-current-model").textContent =
      provider + " · " + (settings().aiModel || "Не подключён");
  }
  function updateContext() {
    if (
      JSON.stringify(prefs().aiSelection || {}) !== JSON.stringify(selection())
    ) {
      prefs().aiSelection = structuredClone(selection());
      ctx.persistState();
    }
    const context = assistantContext(
        ctx.snapshotData(),
        selection(),
        new Date(),
        $("#ai-prompt").value,
        selectedPeriod(),
      ),
      count = [...editableCollections, "checkins"].reduce(
        (sum, key) => sum + (context[key]?.length || 0),
        0,
      ),
      chosen = [];
    const data = ctx.snapshotData();
    for (const [kind, ids] of Object.entries(selection())) {
      if (!labels[kind] || !Array.isArray(ids)) continue;
      const rows = data[kind === "projectTasks" ? "projects" : kind] || [];
      for (const id of ids) {
        const row = rows.find((item) =>
          [item._syncId, item.id, item.at, item.date].includes(id),
        );
        if (id !== "*" && !row) continue;
        chosen.push({
          kind,
          id,
          title:
            id === "*"
              ? labels[kind] + ": все"
              : (row.name ||
                  row.title ||
                  row.date ||
                  new Date(row.at).toLocaleString()) +
                (kind === "projectTasks" ? " + задачи" : ""),
        });
      }
    }
    $("#ai-context-count").textContent = count ? "· " + count : "";
    $("#ai-context-open span").textContent = "Данные для ИИ";
    $("#ai-context-summary").textContent = chosen.length
      ? chosen
          .slice(0, 2)
          .map((item) => item.title)
          .join(" · ") + (chosen.length > 2 ? " · +" + (chosen.length - 2) : "")
      : "Без записей Orvim";
    $("#ai-context-done").textContent = count ? "Готово · " + count : "К чату";
    const chips = $("#ai-context-selected");
    chips.replaceChildren();
    for (const item of chosen.slice(0, 30)) {
      const chip = action(
        item.title,
        () => {
          selection()[item.kind] = selection()[item.kind].filter(
            (id) => id !== item.id,
          );
          renderPicker();
        },
        "ai-context-chip",
      );
      chip.setAttribute("aria-label", "Убрать из контекста: " + item.title);
      chip.append(make("span", "", "×"));
      chips.append(chip);
    }
    if (chosen.length > 30)
      chips.append(make("small", "", "Ещё выбрано: " + (chosen.length - 30)));
    const preview = $("#ai-context-preview");
    preview.replaceChildren();
    if (!count)
      preview.append(
        make(
          "p",
          "ai-context-help",
          "Только ваше сообщение и предыдущая переписка. Записи Orvim не выбраны.",
        ),
      );
    for (const [kind, rows] of Object.entries(context)) {
      if (!labels[kind] || !Array.isArray(rows) || !rows.length) continue;
      preview.append(make("h4", "", labels[kind] + " · " + rows.length));
      for (const row of rows.slice(0, 30)) {
        const item = make("div", "ai-preview-record");
        item.dataset.userContent = "true";
        item.append(
          make(
            "strong",
            "",
            row.name ||
              row.title ||
              row.date ||
              new Date(row.at).toLocaleString(),
          ),
        );
        for (const [key, label] of Object.entries(fieldNames))
          if (
            !["name", "title", "done"].includes(key) &&
            row[key] !== undefined &&
            row[key] !== null &&
            row[key] !== ""
          )
            item.append(make("small", "", label + ": " + String(row[key])));
        if (row.done !== undefined)
          item.append(
            make("small", "", row.done ? "Выполнено" : "Не выполнено"),
          );
        preview.append(item);
      }
      if (rows.length > 30)
        preview.append(
          make(
            "small",
            "",
            "И ещё " + (rows.length - 30) + " записей этого раздела.",
          ),
        );
    }
    renderPeriod();
    refreshOutgoing();
  }
  function renderPicker() {
    const kind = $("#ai-context-kind").value,
      key = kind === "projectTasks" ? "projects" : kind;
    const data = ctx.snapshotData(),
      items = data[key] || [],
      ids = selection()[kind] || [],
      query = $("#ai-context-search").value.trim().toLocaleLowerCase();
    const host = $("#ai-context-items");
    host.replaceChildren();
    const other = !primarySources.includes(kind);
    $("#ai-context-search").hidden = kind === "lifeData";
    $("#ai-context-other").hidden = !other;
    for (const button of form.querySelectorAll("[data-ai-source]"))
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.aiSource === (other ? "other" : kind)),
      );
    $("#ai-context-search").placeholder =
      {
        projectTasks: "Найти проект",
        tasks: "Найти задачу",
        thoughts: "Найти мысль",
        events: "Найти событие",
        archiveItems: "Найти книгу, фильм или другую запись",
      }[kind] || "Найти запись";
    const add = (id, label, subtitle = "") => {
      const row = make("label", "ai-context-option"),
        checkbox = make("input");
      checkbox.type = "checkbox";
      checkbox.value = String(id);
      checkbox.checked = ids.includes(id) || (id !== "*" && ids.includes("*"));
      listen(checkbox, "change", () => {
        let chosen = selection()[kind] || [];
        if (id !== "*" && chosen.includes("*"))
          chosen = items.map(
            (item) => item._syncId ?? item.id ?? item.at ?? item.date,
          );
        chosen = chosen.filter((value) => value !== id);
        if (id === "*") chosen = checkbox.checked ? ["*"] : [];
        else if (checkbox.checked) chosen.push(id);
        selection()[kind] = chosen;
        for (const input of host.querySelectorAll("input"))
          input.checked =
            chosen.includes("*") ||
            chosen.some((value) => String(value) === input.value);
        updateContext();
      });
      const text = make("span", "ai-context-option-text");
      const title = make("strong", "", label);
      if (id !== "*") title.dataset.userContent = "true";
      text.append(title);
      if (subtitle) text.append(make("small", "", subtitle));
      if (id === "*") row.classList.add("ai-context-all");
      row.append(checkbox, text);
      host.append(row);
    };
    if (kind === "lifeData") {
      add(
        "*",
        "Все данные Жизни",
        "Шаги, тренировки и подходы, питание и калории, вода, сон и самочувствие. Для запроса за день или неделю передаётся только этот период.",
      );
      updateContext();
      return;
    }
    if (items.length)
      add("*", "Выбрать весь раздел", "Включая записи, которые появятся позже");
    const found = items.filter((item) =>
      JSON.stringify([item.name, item.title, item.body, item.date])
        .toLocaleLowerCase()
        .includes(query),
    );
    for (const item of found.slice(0, 150)) {
      const subtitle =
        kind === "projectTasks"
          ? `${data.tasks.filter((task) => task.context === item.name).length} задач · ${data.events.filter((event) => event.context === item.name).length} событий`
          : [
              item.category || item.context,
              item.date,
              item.time || item.start,
              kind === "archiveItems" && item.rating != null
                ? "★ " + item.rating
                : "",
            ]
              .filter(Boolean)
              .join(" · ");
      add(
        item._syncId ?? item.id ?? item.at ?? item.date,
        item.name ||
          item.title ||
          item.date ||
          new Date(item.at).toLocaleString(),
        subtitle,
      );
    }
    if (!found.length)
      host.append(
        make(
          "p",
          "ai-context-help",
          query
            ? "Ничего не найдено. Попробуйте другой запрос."
            : "Здесь пока нет записей. Можно выбрать другой раздел.",
        ),
      );
    if (found.length > 150)
      host.append(
        make(
          "small",
          "",
          "Показаны первые 150. Уточните поиск или выберите весь источник.",
        ),
      );
    updateContext();
  }
  function renderPresets() {
    const select = $("#ai-context-preset");
    select.replaceChildren(make("option", "", "Выбрать набор"));
    select.firstChild.value = "";
    for (const preset of prefs().aiContextPresets || []) {
      const option = make("option", "", preset.name);
      option.value = preset.id;
      select.append(option);
    }
  }
  listen($("#ai-context-kind"), "change", renderPicker);
  listen($("#ai-context-search"), "input", renderPicker);
  listen($("#ai-context-clear"), "click", () => {
    sessionSelection = {};
    renderPicker();
  });
  listen($("#ai-context-save"), "click", async () => {
    const name = $("#ai-context-name").value.trim();
    if (!name) {
      contextNotice("Введите название набора.", true);
      return;
    }
    const presets = (prefs().aiContextPresets ||= []);
    const existing = presets.find((p) => p.name === name);
    if (existing) existing.selection = structuredClone(selection());
    else if (presets.length < 30)
      presets.push({
        id: crypto.randomUUID(),
        name,
        selection: structuredClone(selection()),
      });
    else {
      contextNotice("Можно сохранить до 30 наборов.", true);
      return;
    }
    ctx.persistState();
    renderPresets();
    try {
      await services.flush();
      contextNotice("Набор «" + name + "» сохранён.");
    } catch (error) {
      contextNotice("Набор не записан: " + String(error), true);
    }
  });
  listen($("#ai-context-preset"), "change", () => {
    const preset = (prefs().aiContextPresets || []).find(
      (p) => p.id === $("#ai-context-preset").value,
    );
    if (preset) {
      sessionSelection = structuredClone(preset.selection);
      renderPicker();
    }
  });
  function chatMessage(role, text, remember = true, saved = null) {
    const record = saved || {
      id: crypto.randomUUID(),
      role,
      content: String(text).slice(0, 100000),
      at: new Date().toISOString(),
    };
    const item = make("article", "ai-message");
    item.dataset.role = role;
    item.dataset.userContent = "true";
    if (record.id) item.dataset.messageId = record.id;
    const header = make("div", "ai-message-header");
    header.append(make("strong", "", role === "user" ? "Вы" : "ИИ помощник"));
    const copy = action(
      "",
      () => {
        void navigator.clipboard
          .writeText(text)
          .then(() => status("Текст скопирован."))
          .catch(() => status("Не удалось скопировать текст.", true));
      },
      "text-button ai-message-copy",
    );
    copy.append(ui.icon("copy"));
    copy.title = "Копировать сообщение";
    copy.setAttribute("aria-label", "Копировать сообщение");
    header.append(copy);
    const body = make("div", "ai-markdown");
    if (role === "user") body.textContent = text;
    else renderAssistantMarkdown(body, text, services.openExternal);
    item.append(header, body);
    $("#ai-messages").append(item);
    if (record.error) messageFailure(item, record);
    updateEmpty();
    scrollChat();
    if (remember) {
      history().push(record);
      if (history().length > 40) {
        const removed = history().length - 40;
        history().splice(0, removed);
        historyStart = Math.max(0, historyStart - removed);
      }
      ctx.persistState();
    }
    services.refreshIcons(item);
    return record;
  }
  function messageFailure(item, record) {
    item.querySelector(".ai-message-error")?.remove();
    const error = make("div", "ai-message-error");
    error.setAttribute("role", "alert");
    error.append(
      make("span", "", record.error),
      action(
        "Повторить",
        () => {
          if (busy) return;
          $("#ai-prompt").value = record.content;
          prefs().aiDraft = record.content;
          resizeComposer();
          form.requestSubmit();
        },
        "text-button",
      ),
    );
    item.append(error);
  }
  function showWaiting() {
    $("#ai-waiting")?.remove();
    if (!requesting) return;
    const row = make("article", "ai-message ai-waiting");
    row.id = "ai-waiting";
    row.setAttribute("role", "status");
    row.append(
      make("strong", "", "ИИ помощник"),
      make(
        "span",
        "ai-waiting-label",
        Date.now() - requestStartedAt >= 20000
          ? "ИИ ещё готовит ответ…"
          : "Готовит ответ…",
      ),
    );
    $("#ai-messages").append(row);
    updateEmpty();
    scrollChat();
  }
  function openAssistant(opener) {
    if (!busy) {
      shareHistory.checked = false;
    }
    metadata();
    renderPresets();
    renderPicker();
    $("#ai-messages").replaceChildren();
    for (const row of history()) chatMessage(row.role, row.content, false, row);
    showWaiting();
    updateEmpty();
    $("#ai-prompt").value = prefs().aiDraft || "";
    renderPeriod();
    $("#ai-context-panel").hidden = true;
    $("#ai-chat-view").hidden = false;
    form.classList.remove("ai-selecting-context");
    ctx.openDialog("ai-dialog", opener);
    resizeComposer();
    scrollChat();
    // Leave the keyboard closed on touch devices until the user taps the input.
    $("#ai-context-open").focus();
  }
  const open = action(
    "",
    (event) => openAssistant(event.currentTarget),
    "button ai-open",
  );
  open.append(ui.icon("sparkles"));
  open.setAttribute("aria-label", "ИИ помощник");
  open.dataset.tooltip = "ИИ помощник";
  $(".header-actions").prepend(open);
  listen(form.querySelector(".close"), "click", () => {
    saveDraft();
    ctx.closeDialog();
  });
  listen($("#ai-settings"), "click", (event) => {
    saveDraft();
    ctx.closeDialog();
    ui.openConnections(event.currentTarget, "ai");
  });
  listen($("#ai-prompt"), "input", () => {
    prefs().aiDraft = $("#ai-prompt").value;
    resizeComposer();
    renderPeriod();
    queueDraft();
  });
  listen($("#ai-prompt"), "blur", saveDraft);
  listen(window, "pagehide", saveDraft);
  listen(window, "life-os:pause", saveDraft);
  listen(document, "visibilitychange", () => {
    if (document.hidden) saveDraft();
  });
  listen($("#ai-prompt"), "keydown", (event) => {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.isComposing ||
      !window.matchMedia("(pointer: fine)").matches
    )
      return;
    event.preventDefault();
    if (!busy) form.requestSubmit();
  });
  let proposalRun = 0;
  async function showChanges(
    changes,
    cachedCovers = new Map(),
    approvedCoverRequests = new Set(),
  ) {
    const run = ++proposalRun;
    pending = null;
    const panel = $("#ai-changes");
    panel.replaceChildren();
    panel.hidden = !changes.length;
    if (!changes.length) return;
    const before = structuredClone(ctx.documentSnapshot()),
      coverData = new Map(cachedCovers);
    let preview = proposedSnapshot(before, changes, coverData);
    ctx.validateBackup({
      format: "life-os-backup",
      schemaVersion: 1,
      ...preview,
    });
    let requested = 0;
    for (const [index, change] of changes.entries()) {
      if (
        change.collection !== "archiveItems" ||
        change.operation !== "upsert" ||
        coverData.has(index) ||
        !approvedCoverRequests.has(index)
      )
        continue;
      const values = JSON.parse(change.data);
      if (!values.coverUrl && !values.coverQuery) continue;
      requested++;
      if (requested > 10) {
        coverData.set(index, {
          error: "За один запрос можно подобрать до 10 обложек.",
        });
        continue;
      }
      panel.replaceChildren(
        make(
          "p",
          "aux-note",
          "Подбираю обложку · " + (values.name || values.coverQuery || ""),
        ),
      );
      try {
        const old = before.data.archiveItems.find(
            (item) => item.id === change.id,
          ),
          kind =
            values.kind ||
            old?.kind ||
            (/книг|book/i.test(values.category || old?.category || "")
              ? "book"
              : "film"),
          result = await services.request({
            operation: "cover",
            provider: "json",
            source: values.coverUrl || "",
            query: values.coverQuery || values.name || old?.name,
            kind,
          });
        if (run !== proposalRun || disposed) return;
        let image = result.image;
        if (
          typeof image !== "string" ||
          image.length > 8 * 1024 * 1024 ||
          !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)
        )
          throw Error("Сервис не вернул подходящую обложку.");
        if (image.startsWith("data:image/webp")) {
          const bitmap = await createImageBitmap(
            await (await fetch(image)).blob(),
          );
          try {
            if (bitmap.width * bitmap.height > 20000000)
              throw Error("Изображение обложки слишком большое.");
            const canvas = document.createElement("canvas"),
              ratio = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
            canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
            canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
            canvas
              .getContext("2d")
              .drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            image = canvas.toDataURL("image/jpeg", 0.9);
          } finally {
            bitmap.close();
          }
        }
        coverData.set(index, { ...result, image });
      } catch (error) {
        coverData.set(index, { error: String(error.message || error) });
      }
    }
    if (run !== proposalRun || disposed) return;
    preview = proposedSnapshot(before, changes, coverData);
    ctx.validateBackup({
      format: "life-os-backup",
      schemaVersion: 1,
      ...preview,
    });
    panel.replaceChildren();
    pending = {
      changes,
      before,
      preview,
      coverData,
      fingerprint: recordsSignature(before),
    };
    panel.append(
      make("p", "ai-proposal-status", "Предложение ИИ · ещё не сохранено"),
    );
    if (changes.some((change) => change.collection === "foodLogs"))
      panel.append(
        make(
          "p",
          "aux-note",
          "Калории и БЖУ могут быть оценкой. Проверьте порцию и данные с упаковки.",
        ),
      );
    for (const [index, change] of changes.entries()) {
      const values = change.data ? JSON.parse(change.data) : {},
        row = make("div", "ai-change");
      row.dataset.userContent = "true";
      row.append(
        make(
          "strong",
          "",
          (change.operation === "delete" ? "Удалить" : "Сохранить") +
            " · " +
            (labels[change.collection] || change.collection) +
            " · " +
            (values.name || values.title || change.id || "Новая запись"),
        ),
      );
      if (change.collection === "foodLogs" && change.operation === "upsert") {
        const previous = before.data.foodLogs.find(
          (item) => item.id === change.id,
        );
        const food = { ...previous, ...values };
        row.append(
          make(
            "div",
            "ai-food-amount",
            `${food.date || "Дата не указана"} · ${food.calories ?? "—"} ккал · Б ${food.protein ?? "—"} / Ж ${food.fat ?? "—"} / У ${food.carbs ?? "—"} г`,
          ),
        );
        const macroCalories =
          4 * Number(food.protein || 0) +
          9 * Number(food.fat || 0) +
          4 * Number(food.carbs || 0);
        if (
          macroCalories > 0 &&
          Number.isFinite(Number(food.calories)) &&
          Math.abs(macroCalories - Number(food.calories)) >
            Math.max(50, Number(food.calories) * 0.25)
        )
          row.append(
            make(
              "small",
              "ai-cover-warning",
              `БЖУ дают примерно ${Math.round(macroCalories)} ккал. Значение заметно отличается — проверьте данные; округление и состав тоже влияют.`,
            ),
          );
      }
      const cover = coverData.get(index);
      if (!cover && (values.coverUrl || values.coverQuery)) {
        row.append(
          make(
            "small",
            "aux-note",
            "Будет отправлен запрос: " + (values.coverUrl || values.coverQuery),
          ),
        );
        const findCover = action(
          "Загрузить обложку из каталога",
          async () => {
            if (busy) return;
            setBusy(true);
            try {
              await showChanges(changes, coverData, new Set([index]));
            } catch (error) {
              status(String(error.message || error), true);
            } finally {
              setBusy(false);
            }
          },
          "text-button",
        );
        findCover.dataset.approveCover = String(index);
        row.append(findCover);
      }
      if (cover?.image) {
        const previewImage = make("img", "ai-cover-preview");
        previewImage.src = cover.image;
        previewImage.alt = cover.title || values.name || "Обложка";
        row.append(
          previewImage,
          make(
            "small",
            "aux-note",
            "Обложка: " +
              (cover.title || values.name || "") +
              " · " +
              (cover.catalog || "HTTPS"),
          ),
        );
      } else if (cover?.error)
        row.append(
          make(
            "small",
            "ai-cover-warning",
            "Обложка не добавлена: " + cover.error,
          ),
        );
      if (change.collection !== "foodLogs")
        row.append(
          make(
            "small",
            "",
            Object.entries(values)
              .map(
                ([key, value]) =>
                  (fieldNames[key] || key) +
                  ": " +
                  (typeof value === "boolean"
                    ? value
                      ? "Да"
                      : "Нет"
                    : String(value)),
              )
              .join(" · "),
          ),
        );
      panel.append(row);
    }
    const apply = action(
      "Применить изменения",
      async () => {
        if (!pending || busy) return;
        if (recordsSignature(ctx.documentSnapshot()) !== pending.fingerprint) {
          await showChanges(pending.changes, pending.coverData);
          status(
            "Данные изменились. Проверьте обновлённый список и подтвердите ещё раз.",
            true,
          );
          return;
        }
        setBusy(true);
        apply.disabled = true;
        const plan = pending;
        try {
          await services.flush();
          if (services.validateActions)
            await services.validateActions(plan.changes);
          if (services.backups) await services.backups("create");
          const fresh = proposedSnapshot(
            ctx.documentSnapshot(),
            plan.changes,
            plan.coverData,
          );
          ctx.validateBackup({
            format: "life-os-backup",
            schemaVersion: 1,
            ...fresh,
          });
          ctx.applyDocument(fresh);
          ctx.persistState();
          await services.flush();
          let stored = null;
          let verificationFailed = false;
          if (services.readDocument) {
            try {
              stored = await services.readDocument();
            } catch {
              verificationFailed = true;
            }
          }
          pending = null;
          panel.replaceChildren();
          const beforeFood = plan.before.data.foodLogs || [];
          const expectedFood = (plan.preview.data.foodLogs || []).filter(
            (item) => {
              const old = beforeFood.find((row) => row.id === item.id);
              return !old || JSON.stringify(old) !== JSON.stringify(item);
            },
          );
          if (plan.changes.some((change) => change.collection === "foodLogs")) {
            const removed = beforeFood.filter(
              (item) =>
                !(plan.preview.data.foodLogs || []).some(
                  (row) => row.id === item.id,
                ),
            );
            const savedRows = Array.isArray(stored?.data?.foodLogs)
              ? stored.data.foodLogs
              : null;
            const rows =
              savedRows || ctx.documentSnapshot().data.foodLogs || [];
            const confirmed = expectedFood
              .map((item) => rows.find((row) => row.id === item.id))
              .filter(Boolean);
            const keys = [
              "id",
              "date",
              "name",
              "calories",
              "protein",
              "fat",
              "carbs",
            ];
            const verified =
              savedRows &&
              confirmed.length === expectedFood.length &&
              confirmed.every((row, index) =>
                keys.every((key) => row[key] === expectedFood[index][key]),
              ) &&
              removed.every((item) => !rows.some((row) => row.id === item.id));
            panel.append(
              make(
                "strong",
                "ai-proposal-status",
                verified
                  ? "Сохранено · проверено в базе"
                  : "Изменения отправлены на сохранение",
              ),
            );
            for (const item of confirmed)
              panel.append(
                make(
                  "p",
                  "ai-food-amount",
                  `${item.date} · ${item.name} · ${item.calories} ккал · Б ${item.protein} / Ж ${item.fat} / У ${item.carbs} г`,
                ),
              );
            for (const item of removed)
              panel.append(
                make(
                  "p",
                  "ai-food-amount",
                  `Удалено · ${item.date} · ${item.name} · ${item.calories} ккал`,
                ),
              );
            panel.append(
              make(
                "small",
                "aux-note",
                "Значения ИИ могут быть приблизительными; точность зависит от порции и данных продукта.",
              ),
            );
            if (verificationFailed || (stored && !verified))
              panel.append(
                make(
                  "p",
                  "ai-cover-warning",
                  "Не удалось подтвердить состав записи повторным чтением. Проверьте её в питании.",
                ),
              );
          }
          status(
            verificationFailed
              ? "Сохранено, но повторно прочитать данные не удалось."
              : "Изменения сохранены.",
          );
          const after = recordsSignature(ctx.documentSnapshot());
          panel.append(
            action(
              "Отменить изменения ИИ",
              async () => {
                try {
                  if (after !== recordsSignature(ctx.documentSnapshot())) {
                    status(
                      "После этого были другие изменения. Отмена остановлена, чтобы их не потерять.",
                      true,
                    );
                    return;
                  }
                  if (services.backups) await services.backups("create");
                  const current = ctx.documentSnapshot();
                  for (const key of editableCollections)
                    current.data[key] = structuredClone(plan.before.data[key]);
                  current.covers = structuredClone(plan.before.covers);
                  current.data.archiveCategories = structuredClone(
                    plan.before.data.archiveCategories,
                  );
                  ctx.applyDocument(current);
                  ctx.persistState();
                  await services.flush();
                  panel.hidden = true;
                  status("Изменения ИИ отменены.");
                } catch (error) {
                  status(String(error), true);
                }
              },
              "text-button",
            ),
          );
          const created = plan.changes.find(
            (c) =>
              c.collection === "projects" &&
              c.id === null &&
              c.operation === "upsert",
          );
          if (created) {
            const name = JSON.parse(created.data).name,
              project = ctx.projects.find((p) => p.name === name);
            if (project) {
              ctx.closeDialog();
              ctx.openMaterialOwner("project", project);
            }
          }
        } catch (error) {
          status(String(error), true);
        } finally {
          setBusy(false);
          apply.disabled = false;
        }
      },
      "button button-primary",
    );
    panel.append(
      apply,
      action(
        "Отклонить",
        () => {
          pending = null;
          panel.hidden = true;
        },
        "text-button",
      ),
    );
  }
  listen(form, "submit", async (event) => {
    event.preventDefault();
    const prompt = $("#ai-prompt").value.trim();
    if (!prompt || busy) return;
    saveDraft();
    const analysis = analyzeLifePeriod(prompt),
      override = selectedPeriod();
    if (
      (override === undefined && analysis.issue) ||
      (override && !validStatsRange(override.from, override.until))
    ) {
      renderPeriod();
      status("Уточните даты периода перед отправкой.", true);
      periodFrom.focus();
      return;
    }
    const run = { id: crypto.randomUUID(), cancelled: false, sent: null };
    activeRequest = run;
    setBusy(true);
    let sent = null;
    try {
      ui.requireService();
      if (!settings().aiModel)
        throw Error(
          "Откройте «Настроить ИИ», сохраните ключ, проверьте соединение и выберите модель.",
        );
      const context = assistantContext(
        ctx.snapshotData(),
        selection(),
        new Date(),
        prompt,
        override,
      );
      updateContext();
      const previous = history()
        .slice(shareHistory.checked ? 0 : historyStart)
        .filter(
          (row) =>
            !row.error &&
            row.delivery !== "pending" &&
            ["user", "assistant"].includes(row.role) &&
            typeof row.content === "string",
        )
        .slice(-40)
        .map(({ role, content }) => ({ role, content }));
      const failed = history().at(-1);
      if (
        failed?.role === "user" &&
        failed.error &&
        failed.content === prompt
      ) {
        sent = failed;
        delete sent.error;
        form
          .querySelector(`[data-message-id="${sent.id}"] .ai-message-error`)
          ?.remove();
      } else sent = chatMessage("user", prompt);
      sent.delivery = "pending";
      run.sent = sent;
      $("#ai-prompt").value = "";
      prefs().aiDraft = "";
      resizeComposer();
      ctx.persistState();
      requesting = true;
      requestStartedAt = Date.now();
      showWaiting();
      waitingTimer = setTimeout(() => {
        if (!disposed && requesting) {
          const label = $("#ai-waiting .ai-waiting-label");
          if (label) label.textContent = "ИИ ещё готовит ответ…";
        }
      }, 20000);
      status("");
      const response = await services.request({
        operation: "assistant",
        provider: settings().aiProvider,
        model: settings().aiModel,
        prompt,
        context,
        history: previous,
        requestId: run.id,
      });
      if (disposed || run.cancelled || activeRequest !== run) return;
      const answer =
        typeof response.text === "string"
          ? JSON.parse(
              response.text
                .replace(/^```(?:json)?\s*/i, "")
                .replace(/\s*```$/, ""),
            )
          : response;
      if (typeof answer.message !== "string" || !Array.isArray(answer.changes))
        throw Error("Некорректный формат ответа ИИ. Изменения не применены.");
      delete sent.delivery;
      requesting = false;
      showWaiting();
      chatMessage("assistant", answer.message);
      await showChanges(answer.changes);
      if (!answer.changes.length) {
        const notice = make(
          "p",
          "ai-proposal-status",
          "Данные не изменены: ИИ не предложил записей для сохранения.",
        );
        $("#ai-changes").replaceChildren(notice);
        $("#ai-changes").hidden = false;
      }
      if (disposed || run.cancelled || activeRequest !== run) return;
      ctx.persistState();
      status("");
      scrollChat();
    } catch (error) {
      if (run.cancelled || disposed || activeRequest !== run) return;
      const message = String(error);
      if (sent) {
        showChanges([]);
        sent.error = message;
        delete sent.delivery;
        const item = [...$("#ai-messages").children].find(
          (node) => node.dataset.messageId === sent.id,
        );
        if (item) messageFailure(item, sent);
        status("");
      } else status(message, true);
      if (!$("#ai-prompt").value.trim()) {
        $("#ai-prompt").value = prompt;
        prefs().aiDraft = prompt;
        resizeComposer();
      }
      ctx.persistState();
    } finally {
      if (activeRequest === run) {
        activeRequest = null;
        clearTimeout(waitingTimer);
        waitingTimer = null;
        setBusy(false);
        requesting = false;
        showWaiting();
        scrollChat();
      }
    }
  });
  function cancelAnswer() {
    const run = activeRequest;
    if (!run) return;
    run.cancelled = true;
    activeRequest = null;
    proposalRun++;
    pending = null;
    $("#ai-changes").replaceChildren();
    $("#ai-changes").hidden = true;
    clearTimeout(waitingTimer);
    waitingTimer = null;
    requesting = false;
    setBusy(false);
    showWaiting();
    if (run.sent) {
      delete run.sent.delivery;
      run.sent.error = "Ответ остановлен. Можно повторить сообщение.";
      const item = [...$("#ai-messages").children].find(
        (node) => node.dataset.messageId === run.sent.id,
      );
      if (item) messageFailure(item, run.sent);
      if (!$("#ai-prompt").value.trim()) {
        $("#ai-prompt").value = run.sent.content;
        prefs().aiDraft = run.sent.content;
        resizeComposer();
        renderPeriod();
      }
    }
    void services.cancelRequest?.(run.id).catch(() => {});
    ctx.persistState();
  }
  listen($("#ai-send"), "click", (event) => {
    if (busy) {
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelAnswer();
    }
  });
  const overlay = form.parentElement;
  listen(form, "keydown", (event) => {
    if (event.isComposing) return;
    if (event.key === "Escape" && !$("#ai-context-panel").hidden) {
      event.preventDefault();
      event.stopPropagation();
      closeContext();
    }
  });
  ctx.registerBackLayer(
    () => !overlay.hidden && !$("#ai-context-panel").hidden,
    closeContext,
  );
  const closeObserver = new MutationObserver(() => {
    if (overlay.hidden) {
      saveDraft();
      proposalRun++;
    }
  });
  closeObserver.observe(overlay, {
    attributes: true,
    attributeFilter: ["hidden"],
  });
  // A request interrupted by a previous app shutdown must be retryable.
  for (const row of history())
    if (row.delivery === "pending") {
      delete row.delivery;
      row.error = "Ответ не получен. Повторите сообщение.";
    }
  services.refreshIcons(form);
  return {
    dispose() {
      saveDraft();
      cancelAnswer();
      disposed = true;
      clearTimeout(waitingTimer);
      closeObserver.disconnect();
    },
    open: openAssistant,
  };
}
