import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import {
  assistantContext,
  renderAssistantMarkdown,
} from "../src/features/workspace/assistant.js";
import { proposedSnapshot } from "../src/features/workspace/changes.js";
import { createDictation } from "../src/features/workspace/dictation.js";
const data = {
  version: 30,
  nextId: 10,
  projects: [{ id: 1, name: "Поездка", description: "", tone: "pine" }],
  tasks: [
    {
      id: 2,
      title: "Билеты",
      context: "Поездка",
      date: "2026-10-08",
      done: false,
    },
  ],
  events: [],
  thoughts: [],
  archiveItems: [],
  archiveCategories: [],
  sleepLogs: [],
  foodLogs: [],
  waterLogs: [],
  workouts: [],
  trainingGoals: [],
  financeLogs: [],
  exercises: [],
};
let context = assistantContext(data, { projectTasks: [1] });
assert.equal(context.projects[0].name, "Поездка");
assert.equal(context.tasks[0].id, 2);
data.tasks[0].title = "Новая правка";
assert.equal(
  assistantContext(data, { projectTasks: [1] }).tasks[0].title,
  "Новая правка",
);
assert.equal(context.tasks[0].title, "Билеты");
assert.deepEqual(assistantContext(data, { tasks: [] }).tasks, []);
const plan = [
  {
    operation: "upsert",
    collection: "projects",
    id: null,
    data: JSON.stringify({ name: "Дом", description: "", tone: "pine" }),
  },
  {
    operation: "upsert",
    collection: "tasks",
    id: null,
    data: JSON.stringify({
      title: "Уборка",
      context: "Дом",
      date: "2026-10-08",
      done: false,
    }),
  },
];
const next = proposedSnapshot({ data, covers: [] }, plan);
assert.equal(next.data.projects.length, 2);
assert.equal(next.data.tasks[1].context, "Дом");
assert.equal(data.projects.length, 1);
for (const fields of [
  { done: "true" },
  { time: "25:90" },
  { date: "2026-02-30" },
  { duration: 0 },
  { title: true },
  { status: "invented" },
]) {
  assert.throws(() =>
    proposedSnapshot({ data, covers: [] }, [
      ...plan,
      {
        operation: "upsert",
        collection: "tasks",
        id: null,
        data: JSON.stringify(fields),
      },
    ]),
  );
  assert.equal(data.projects.length, 1);
}
assert.throws(() =>
  proposedSnapshot({ data, covers: [] }, [
    {
      operation: "upsert",
      collection: "tasks",
      id: null,
      data: '{"fakeField":1}',
    },
  ]),
);
assert.throws(() =>
  proposedSnapshot({ data, covers: [] }, [
    { operation: "upsert", collection: "tasks", id: 99, data: '{"title":"x"}' },
  ]),
);
assert.throws(() =>
  proposedSnapshot({ data, covers: [] }, [
    {
      operation: "upsert",
      collection: "tasks",
      id: null,
      data: '{"context":"Несуществующий"}',
    },
  ]),
);
assert.throws(() =>
  proposedSnapshot({ data, covers: [] }, [
    ...plan,
    {
      operation: "upsert",
      collection: "tasks",
      id: null,
      data: '{"__proto__":{}}',
    },
  ]),
);
assert.equal(data.projects.length, 1);
const dom = new JSDOM("<main></main>"),
  host = dom.window.document.querySelector("main");
renderAssistantMarkdown(
  host,
  "# Ответ\n\n**Важно**\n1. Первое\n2. Второе\n\n<script>alert(1)</script>\n```js\nx < 5\n```",
);
assert.equal(host.querySelectorAll("li").length, 2);
assert.equal(host.querySelectorAll("script").length, 0);
assert.equal(host.querySelector("strong").textContent, "Важно");
assert.match(host.textContent, /<script>/);
assert.match(host.querySelector("code").textContent, /x < 5/);
let text = "Запиши",
  state = { text: "", partial: "", listening: true },
  stopped = 0;
const dictation = createDictation({
  services: {
    platform: async (operation) => {
      if (operation === "speechStop") {
        stopped++;
        return state;
      }
      return state;
    },
  },
  language: () => "ru",
  allowCloud: () => false,
  getText: () => text,
  setText: (value) => {
    text = value;
  },
  onStatus: () => {},
});
await dictation.start();
state = { text: "восемь часов сна", partial: "", listening: false };
await new Promise((resolve) => setTimeout(resolve, 300));
assert.equal(dictation.active, true);
assert.equal(text, "Запиши восемь часов сна");
state = { text: "восемь часов сна и прогулку", partial: "", listening: true };
await new Promise((resolve) => setTimeout(resolve, 300));
assert.equal(text, "Запиши восемь часов сна и прогулку");
await dictation.stop();
assert.equal(dictation.active, false);
assert.equal(stopped, 1);
assert.equal(text, "Запиши восемь часов сна и прогулку");
dom.window.close();
console.log(
  "Assistant: 36 assertions passed (fresh saved context, project/tasks, atomic rejection, field types and statuses, safe Markdown, pauses, Stop, no duplicate text).",
);
