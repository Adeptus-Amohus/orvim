import assistantFields from "./actions-schema.json" with { type: "json" };
import { goalState } from "./training-model.js";
import { stampLifeRecord } from "./life-tracking-model.js";
export const editableCollections = [
  "tasks",
  "events",
  "projects",
  "thoughts",
  "archiveItems",
  "sleepLogs",
  "foodLogs",
  "waterLogs",
  "workouts",
  "trainingGoals",
  "financeLogs",
  "exercises",
  "stepLogs",
];
const forbidden = new Set(["__proto__", "prototype", "constructor"]);
export function safeObject(value) {
  if (!value || typeof value !== "object") return true;
  return Object.entries(value).every(
    ([key, child]) => !forbidden.has(key) && safeObject(child),
  );
}
export function proposedSnapshot(
  snapshot,
  changes,
  resolvedCovers = new Map(),
) {
  if (!Array.isArray(changes) || changes.length > 100)
    throw Error("Слишком много изменений за один запрос.");
  const result = structuredClone(snapshot),
    data = result.data;
  for (const [changeIndex, change] of changes.entries()) {
    if (
      !change ||
      typeof change !== "object" ||
      Array.isArray(change) ||
      Object.keys(change).some(
        (key) => !["operation", "collection", "id", "data"].includes(key),
      )
    )
      throw Error("Некорректная структура команды ИИ.");
    if (
      !editableCollections.includes(change.collection) ||
      !["upsert", "delete"].includes(change.operation)
    )
      throw Error("ИИ предложил неподдерживаемое действие.");
    const rows = data[change.collection];
    if (!Array.isArray(rows)) throw Error("Не найдена коллекция.");
    const idField = ["sleepLogs", "stepLogs"].includes(change.collection)
      ? "date"
      : "id";
    let record = change.operation === "upsert" ? JSON.parse(change.data) : null;
    if (
      record &&
      Object.keys(record).some(
        (key) => !assistantFields[change.collection]?.includes(key),
      )
    )
      throw Error(
        "ИИ предложил несуществующее или недоступное поле: " +
          Object.keys(record)
            .filter((key) => !assistantFields[change.collection]?.includes(key))
            .join(", "),
      );
    for (const [field, value] of Object.entries(record || {})) {
      const rule = assistantFields._collectionConstraints?.[
        change.collection
      ]?.[field] ||
        assistantFields._constraints[field] || { type: "string" };
      const valid =
        value === null
          ? rule.nullable
          : rule.type === "boolean"
            ? typeof value === "boolean"
            : rule.type === "number"
              ? typeof value === "number" &&
                Number.isFinite(value) &&
                value >= rule.min &&
                value <= rule.max &&
                (!rule.enum || rule.enum.includes(value))
              : rule.type === "time"
                ? typeof value === "string" &&
                  ((rule.empty && value === "") ||
                    /^([01]\d|2[0-3]):[0-5]\d$/.test(value))
                : rule.type === "date"
                  ? typeof value === "string" &&
                    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
                    !isNaN(Date.parse(value)) &&
                    new Date(value).toISOString().slice(0, 10) === value
                  : typeof value === "string" &&
                    value.length <= (rule.maxLength || 100000) &&
                    (!rule.enum || rule.enum.includes(value));
      if (!valid) throw Error("Недопустимое значение поля ИИ: " + field);
    }
    if (
      record &&
      Object.keys(record).some((key) =>
        ["source", "id", "workoutId"].includes(key),
      )
    )
      throw Error("ИИ не может менять идентификаторы и связи импорта.");
    if (
      record &&
      (!safeObject(record) ||
        Array.isArray(record) ||
        typeof record !== "object")
    )
      throw Error("Некорректные данные изменения.");
    const id = idField === "date" ? change.id || record?.date : change.id;
    const index = rows.findIndex((row) => row[idField] === id);
    if (change.operation === "delete") {
      if (index < 0) throw Error("Запись для удаления не найдена.");
      if (
        change.collection === "projects" &&
        rows[index].system === "unassigned"
      )
        throw Error("Системный раздел задач нельзя удалить.");
      const removed = rows.splice(index, 1)[0];
      if (change.collection === "archiveItems")
        result.covers = result.covers.filter(([key]) => key !== removed.id);
      if (change.collection === "projects") {
        for (const item of [...data.tasks, ...data.events])
          if (item.context === removed.name) item.context = personalProject;
      }
      if (change.collection === "workouts")
        data.events = data.events.filter(
          (item) => item.workoutId !== removed.id,
        );
      continue;
    }
    if (
      change.id !== null &&
      change.id !== undefined &&
      idField === "id" &&
      index < 0
    )
      throw Error("Запись для изменения не найдена.");
    const old = rows[index];
    if (change.collection === "projects" && old?.system === "unassigned")
      throw Error("Системный раздел задач нельзя изменить.");
    const coverRequest =
      change.collection === "archiveItems" &&
      (Object.hasOwn(record, "coverUrl") ||
        Object.hasOwn(record, "coverQuery"));
    const removeCover =
      coverRequest &&
      Object.hasOwn(record, "coverUrl") &&
      !record.coverUrl &&
      !record.coverQuery;
    if (change.collection === "archiveItems") {
      delete record.coverUrl;
      delete record.coverQuery;
    }
    const nutritionChanged =
      change.collection === "foodLogs" &&
      ["calories", "protein", "fat", "carbs"].some((key) =>
        Object.hasOwn(record, key),
      );
    record = { ...old, ...record };
    if (["foodLogs", "waterLogs"].includes(change.collection)) {
      if (old && record.date !== old.date) delete record.occurredAt;
      stampLifeRecord(record, data, change.collection);
    }
    if (nutritionChanged) {
      // Assistant amounts describe the consumed portion. Keep subsequent edits
      // consistent instead of reopening stale values from an old per-100g label.
      record.nutritionBasis = "portion";
      record.nutritionSource = "estimate";
      record.nutritionBase = Object.fromEntries(
        ["calories", "protein", "fat", "carbs"].map((key) => [
          key,
          record[key],
        ]),
      );
    }
    if (change.collection === "tasks") {
      record.createdDate ||= localDay(new Date());
      record.date ||= "";
    }
    if (
      ["tasks", "events"].includes(change.collection) &&
      record.context === "Личное"
    )
      record.context = personalProject;
    if (change.collection === "archiveItems" && record.status !== undefined) {
      const config = data.uiPreferences?.databaseCollections?.find(
        (c) => c.name === record.category,
      );
      const supported = config?.statuses?.map((s) => s.id) || [
        "planned",
        "active",
        "done",
      ];
      if (!supported.includes(record.status))
        throw Error("ИИ предложил несуществующий статус коллекции.");
    }
    if (idField === "date" && old && record.date !== old.date)
      throw Error("Для смены даты создайте новую запись и удалите прежнюю.");
    if (idField === "id") record.id = old?.id || data.nextId++;
    if (change.collection === "projects" && old && old.name !== record.name) {
      for (const item of [...data.tasks, ...data.events])
        if (item.context === old.name) item.context = record.name;
    }
    if (change.collection === "thoughts") record.context = "Личное";
    if (["sleepLogs", "stepLogs"].includes(change.collection))
      record.manualOverride = true;
    if (change.collection === "trainingGoals") {
      record.history ||= [];
      if (JSON.parse(change.data).current !== undefined)
        record.history.push({ at: Date.now(), value: record.current });
    }
    if (
      change.collection === "archiveItems" &&
      !data.archiveCategories.includes(record.category)
    )
      data.archiveCategories.push(record.category);
    if (index < 0) rows.push(record);
    else rows[index] = record;
    if (change.collection === "archiveItems" && coverRequest) {
      const image = resolvedCovers.get(changeIndex)?.image;
      if (removeCover || image)
        result.covers = result.covers.filter(([key]) => key !== record.id);
      if (image) result.covers.push([record.id, image]);
    }
    if (change.collection === "workouts") {
      const event = data.events.find((item) => item.workoutId === record.id);
      if (event)
        Object.assign(event, {
          title: record.name,
          date: record.date,
          start: record.time,
          end: endTime(record.time, record.duration),
          done: record.done,
        });
      else
        data.events.push({
          id: data.nextId++,
          workoutId: record.id,
          title: record.name,
          date: record.date,
          start: record.time,
          end: endTime(record.time, record.duration),
          done: record.done,
          context: "Личное",
          tone: "pine",
        });
    }
  }
  const names = new Set();
  for (const goal of data.trainingGoals)
    goal.current = goalState(goal, data.workouts, data).current;
  for (const project of data.projects) {
    if (!project.name?.trim() || names.has(project.name))
      throw Error("Название проекта пустое или уже используется.");
    names.add(project.name);
  }
  const knownContexts = new Set([
    "Личное",
    ...snapshot.data.projects.map((p) => p.name),
    ...snapshot.data.tasks.map((t) => t.context),
    ...snapshot.data.events.map((t) => t.context),
    ...names,
  ]);
  for (const change of changes.filter(
    (c) =>
      c.operation === "upsert" && ["tasks", "events"].includes(c.collection),
  )) {
    const patch = JSON.parse(change.data);
    if (patch.context && !knownContexts.has(patch.context))
      throw Error(
        "Проект или область «" +
          patch.context +
          "» не существует. Сначала создайте проект.",
      );
  }
  return result;
}
function endTime(start, duration) {
  const [h, m] = String(start).split(":").map(Number),
    end = h * 60 + m + Number(duration);
  if (!Number.isFinite(end) || end > 1439)
    throw Error("Тренировка выходит за пределы дня.");
  return (
    String(Math.floor(end / 60)).padStart(2, "0") +
    ":" +
    String(end % 60).padStart(2, "0")
  );
}
export function ratingParts(value) {
  return Array.from({ length: 5 }, (_, index) =>
    Math.max(0, Math.min(1, (Number(value) || 0) - index)),
  );
}
export function financeCategoryName(name) {
  const clean = String(name || "").trim();
  const known = {
    питание: "Еда",
    еда: "Еда",
    транспорт: "Транспорт",
    дом: "Дом",
    здоровье: "Здоровье",
    покупки: "Покупки",
    подарки: "Подарки",
    другое: "Другое",
  };
  const key = clean.toLocaleLowerCase("ru");
  return Object.hasOwn(known, key) ? known[key] : clean || "Другое";
}
export function financialSummary(rows, month, currency) {
  const items = rows.filter(
    (row) =>
      !row.legacyFinance &&
      inFinancePeriod(month, row.date) &&
      row.currency === currency,
  );
  const income = items
    .filter((row) => row.type === "income")
    .reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
  const expenses = items
    .filter((row) => row.type === "expense")
    .reduce((sum, row) => sum + Math.round(row.amount * 100), 0);
  const categories = new Map();
  for (const row of items.filter((row) => row.type === "expense")) {
    const category = financeCategoryName(row.category);
    categories.set(
      category,
      (categories.get(category) || 0) + Math.round(row.amount * 100),
    );
  }
  return {
    items,
    income: income / 100,
    expenses: expenses / 100,
    balance: (income - expenses) / 100,
    categories: [...categories].sort((a, b) => b[1] - a[1]),
  };
}
export function importRows(payload, kind, provider, source) {
  if (!payload || typeof payload !== "object")
    throw Error("Сервис должен вернуть JSON со списком записей.");
  const rows = Array.isArray(payload)
    ? payload
    : payload.items ||
      payload.results ||
      (Array.isArray(payload.data) ? payload.data : payload.data?.[kind]) ||
      payload[kind];
  if (!Array.isArray(rows) || rows.length > 10000)
    throw Error("Сервис должен вернуть список до 10 000 записей.");
  const result = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== "object" || !safeObject(raw))
      throw Error("Некорректная запись источника.");
    const properties = raw.properties || {},
      get = (type) =>
        Object.values(properties).find((value) => value?.type === type),
      rich = (value) =>
        value?.map((t) => t.plain_text || t.text?.content || "").join(""),
      title = String(
        raw.title ||
          raw.name ||
          raw.summary ||
          rich(get("title")?.title) ||
          "Без названия",
      ),
      description = String(
        raw.description ||
          raw.body ||
          raw.review ||
          rich(get("rich_text")?.rich_text) ||
          "",
      ),
      date =
        raw.date ||
        get("date")?.date?.start ||
        raw.start?.dateTime ||
        raw.start?.date,
      sourceId = raw.id ?? raw.uid ?? raw.url;
    if (
      !["string", "number"].includes(typeof sourceId) ||
      (typeof sourceId === "number" && !Number.isFinite(sourceId)) ||
      !String(sourceId).trim()
    ) {
      result.push({ skip: true, title, reason: "Нет стабильного ID записи" });
      continue;
    }
    const metadata = {
      provider,
      connection: source,
      id: String(sourceId),
      etag: raw.etag || null,
      ...(raw.eventId ? { eventId: raw.eventId } : {}),
    };
    if (raw.status === "cancelled" || raw.in_trash || raw.archived) {
      result.push({ kind, remove: true, source: metadata, title });
      continue;
    }
    let target = kind,
      record;
    const dated = String(date || localDay()).slice(0, 10),
      status =
        (typeof raw.status === "string" ? raw.status : raw.status?.name) ||
        get("status")?.status?.name ||
        get("select")?.select?.name,
      done =
        raw.done === true ||
        get("checkbox")?.checkbox === true ||
        /^(done|complete|completed|готово|выполнено|завершено)$/i.test(
          status || "",
        );
    if (kind === "projects")
      record = { name: title, description, tone: raw.tone || "pine" };
    if (kind === "tasks")
      record = {
        title,
        description,
        date: dated,
        context: raw.context || "Личное",
        done,
      };
    if (kind === "thoughts")
      record = {
        title,
        body: description || title,
        date: dated,
        context: "Личное",
      };
    if (kind === "archiveItems")
      record = {
        name: title,
        review: description,
        category: raw.category || "Импорт",
        date: dated,
        rating: raw.rating ?? null,
      };
    const timedTask =
      kind === "tasks" && (raw.time || String(date).includes("T"));
    if (kind === "events" || timedTask) {
      const start =
          raw.start?.dateTime ||
          (typeof raw.start === "string"
            ? raw.date + "T" + raw.start
            : raw.time
              ? dated + "T" + raw.time
              : date),
        end =
          raw.end?.dateTime ||
          (typeof raw.end === "string"
            ? raw.date + "T" + raw.end
            : get("date")?.date?.end);
      if (!start || !String(start).includes("T")) {
        target = "tasks";
        record = {
          title,
          description,
          date: dated,
          context: raw.context || "Личное",
          done,
        };
        if (raw.end?.date) record.calendarEndDate = raw.end.date;
      } else {
        const from = new Date(start),
          until = end
            ? new Date(end)
            : new Date(from.valueOf() + (Number(raw.duration) || 30) * 60000);
        if (
          !Number.isFinite(from.valueOf()) ||
          !Number.isFinite(until.valueOf()) ||
          until <= from
        ) {
          result.push({ skip: true, title, reason: "Некорректная дата" });
          continue;
        }
        target = "events";
        if (localDay(from) !== localDay(until)) {
          let cursor = new Date(from);
          let count = 0;
          while (cursor < until) {
            if (++count > 366)
              throw Error("Событие длиннее года: сократите период импорта.");
            const day = localDay(cursor),
              next = new Date(cursor);
            next.setDate(next.getDate() + 1);
            next.setHours(0, 0, 0, 0);
            const partEnd = until < next ? localTime(until) : "23:59";
            if (localTime(cursor) < partEnd)
              result.push({
                kind: "events",
                title,
                record: {
                  title,
                  description,
                  date: day,
                  start: localTime(cursor),
                  end: partEnd,
                  context: raw.context || "Личное",
                  tone: raw.tone || "winter",
                  done,
                  source: {
                    ...metadata,
                    id: metadata.id + "#" + day,
                    remoteId: metadata.id,
                    multiDay: true,
                  },
                },
              });
            cursor = next;
          }
          continue;
        }
        record = {
          title,
          description,
          date: localDay(from),
          start: localTime(from),
          end: localTime(until),
          context: raw.context || "Личное",
          tone: raw.tone || "winter",
          done,
        };
      }
    }
    if (!record) throw Error("Неизвестная категория импорта.");
    record.source = metadata;
    result.push({ kind: target, record, title });
  }
  return result;
}
export function mergeImport(snapshot, rows) {
  const next = structuredClone(snapshot),
    counts = { added: 0, updated: 0, conflicts: 0, removed: 0 };
  for (const entry of rows) {
    if (entry.skip) continue;
    const source = entry.source || entry.record.source;
    const locate = (item) =>
      item.source?.provider === source.provider &&
      (source.provider === "notion" ||
        item.source?.connection === source.connection) &&
      (item.source?.id === source.id ||
        (entry.remove && item.source?.remoteId === source.id));
    if (entry.remove) {
      for (const name of ["events", "tasks"].includes(entry.kind)
        ? ["events", "tasks"]
        : [entry.kind]) {
        const list = next.data[name] || [];
        for (let index = list.length - 1; index >= 0; index--) {
          const previous = list[index];
          if (!locate(previous)) continue;
          if (
            previous.source.signature &&
            signature(previous) !== previous.source.signature
          ) {
            counts.conflicts++;
            continue;
          }
          list.splice(index, 1);
          counts.removed++;
        }
      }
      continue;
    }
    const list = next.data[entry.kind],
      record = structuredClone(entry.record),
      previous = list.find(locate);
    if (
      previous &&
      previous.source.signature &&
      signature(previous) !== previous.source.signature
    ) {
      counts.conflicts++;
      continue;
    }
    record.id = previous?.id || next.data.nextId++;
    record.source.signature = signature(record);
    if (previous) {
      Object.assign(previous, record);
      counts.updated++;
    } else {
      list.push(record);
      counts.added++;
    }
    if (
      entry.kind === "archiveItems" &&
      !next.data.archiveCategories.includes(record.category)
    )
      next.data.archiveCategories.push(record.category);
  }
  return { snapshot: next, counts };
}
export function signature(record) {
  const { id, source, ...fields } = record;
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)),
    ),
  );
}
export function localDay(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export function localTime(date) {
  return (
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}
/** A creation date and the calendar selection do not imply an appointment. */
export function dueToday(data, now = new Date()) {
  const today = localDay(now),
    timed = (value) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value || "");
  return [
    ...(data.tasks || []).map((item) => ({ kind: "task", item })),
    ...(data.events || []).map((item) => ({ kind: "event", item })),
  ]
    .filter(({ item }) => item.date === today && timed(item.start || item.time))
    .sort(
      (a, b) =>
        Number(Boolean(a.item.done)) - Number(Boolean(b.item.done)) ||
        (a.item.start || a.item.time).localeCompare(
          b.item.start || b.item.time,
        ),
    );
}

export const personalProject = "Задачи без проекта и даты";
export function taskDay(item) {
  return (
    item.date ||
    (!item.context || ["Личное", personalProject].includes(item.context)
      ? item.createdDate
      : "")
  );
}
export function homeItems(data, day) {
  return [
    ...(data.tasks || [])
      .filter((item) => taskDay(item) === day)
      .map((item) => ({ kind: "task", item })),
    ...(data.events || [])
      .filter((item) => item.date === day)
      .map((item) => ({ kind: "event", item })),
  ].sort(
    (a, b) =>
      Number(Boolean(a.item.done)) - Number(Boolean(b.item.done)) ||
      (a.item.start || a.item.time || "99:99").localeCompare(
        b.item.start || b.item.time || "99:99",
      ) ||
      (a.item.order || a.item.id) - (b.item.order || b.item.id),
  );
}
import { inFinancePeriod } from "./finance-period.js";
