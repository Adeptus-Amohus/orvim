import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
import { JSDOM } from "jsdom";
import { mountWorkspace } from "../src/features/workspace/runtime.js";
const source = ts
  .transpileModule(fs.readFileSync("src/features/workspace/lan.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  })
  .outputText.replace(
    "./sync-review.js",
    new URL("../src/features/workspace/sync-review.js", import.meta.url).href,
  );
const { startLanSync } = await import(
  "data:text/javascript;base64," + Buffer.from(source).toString("base64")
);
const dom = new JSDOM(
  '<div id="life-os-workspace">' +
    fs.readFileSync("src/features/workspace/markup.html", "utf8") +
    "</div>",
  { pretendToBeVisual: true, url: "http://localhost" },
);
const w = dom.window;
w.HTMLMediaElement.prototype.pause = () => {};
w.matchMedia = () => ({
  matches: false,
  addEventListener() {},
  removeEventListener() {},
});
Object.defineProperty(w.navigator, "language", { value: "kk-KZ" });
globalThis.getComputedStyle = w.getComputedStyle.bind(w);
for (const key of [
  "window",
  "document",
  "Node",
  "NodeFilter",
  "MutationObserver",
  "HTMLElement",
  "HTMLInputElement",
  "FileReader",
  "Audio",
  "CustomEvent",
  "Event",
  "navigator",
])
  Object.defineProperty(globalThis, key, {
    value: key === "window" ? w : w[key],
    configurable: true,
  });
const collections = [
  "tasks",
  "events",
  "checkins",
  "projects",
  "sleepLogs",
  "foodLogs",
  "workouts",
  "recoveryLogs",
  "waterLogs",
  "trainingGoals",
  "archiveItems",
  "savedMeals",
  "taskTemplates",
  "thoughts",
  "financeLogs",
  "exercises",
];
const now = new Date();
const day = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
let current = {
  data: {
    ...Object.fromEntries(collections.map((c) => [c, []])),
    version: 30,
    nextId: 20,
    waterTarget: 2000,
    foodTarget: 0,
    archiveCategories: ["Книги"],
    languageMode: "system",
    selectedDate: day,
    selectedLifeDay: day,
    selectedArchiveCategory: "Книги",
    tasks: [
      {
        id: 1,
        title: "Не переводить мой текст",
        context: "Личное",
        date: day,
        time: "08:00",
        done: false,
      },
    ],
    palette: "sun",
    activePage: "home",
  },
  covers: [],
};
let storedKey = false,
  failSave = false,
  holdExchange = false,
  releaseExchange,
  remoteTitle = "С телефона",
  exchanges = 0,
  acks = 0,
  mode = "off";
const wait = async () => {
  await new Promise((r) => setTimeout(r, 15));
};
const services = {
  persist: (snapshot) => {
    current = structuredClone(snapshot);
  },
  flush: async () => {},
  refreshIcons: () => {},
  openFile: async () => null,
  saveFile: async () => true,
  saveAttachment: async () => true,
  openExternal: async () => {},
  localSync: true,
  mobile: false,
  credential: async (operation) => {
    if (operation === "set") storedKey = !failSave;
    if (operation === "delete") storedKey = false;
    return { configured: storedKey };
  },
  request: async () => ({ models: ["gpt-example", "tts-example"] }),
  lan: async (operation, args, doc) => {
    if (operation === "review")
      return { document: lastRemote, receipt: args.receipt };
    if (operation === "host") mode = "host";
    if (operation === "stop") mode = "off";
    if (operation === "ack") {
      acks++;
      return { saved: true };
    }
    if (operation === "exchange") {
      exchanges++;
      if (holdExchange) await new Promise((r) => (releaseExchange = r));
      const response = {
        document: {
          ...structuredClone(doc),
          data: {
            ...structuredClone(doc.data),
            tasks: [
              ...structuredClone(doc.data.tasks),
              {
                id: 90,
                title: remoteTitle,
                context: "Личное",
                date: day,
                done: false,
              },
            ],
          },
        },
        receipt: "receipt-" + exchanges,
        conflicts: [],
        syncedAt: Date.now(),
      };
      lastRemote = response.document;
      return response;
    }
    return {
      mode,
      connected: mode !== "off",
      addresses: ["192.168.1.2"],
      port: 42673,
      code: "12345678",
      expires: Date.now() + 300000,
      conflicts: 0,
      peers: [],
    };
  },
};
const root = w.document.querySelector("#life-os-workspace"),
  runtime = mountWorkspace(root, { ...current, revision: 0 }, services);
const $ = (s) => root.querySelector(s),
  click = (s) => $(s).click(),
  set = (s, v) => {
    $(s).value = v;
    $(s).dispatchEvent(new w.Event("change", { bubbles: true }));
  };
let checks = 0;
const check = (c, label) => {
  assert.ok(c, label);
  checks++;
};
let dispose;
let lastRemote;
try {
  await wait();
  check(
    root.lang === "ru",
    "Unsupported system language falls back to Russian",
  );
  check(
    $("#page-title").textContent === "Главная",
    "Russian fallback home title: " + $("#page-title").textContent,
  );
  check(
    $(".task-title").textContent === "Не переводить мой текст",
    "User titles are preserved",
  );
  click('[data-open="settings-dialog"]');
  for (const [language, title] of [
    ["en", "Home"],
    ["ru", "Главная"],
    ["ru", "Главная"],
    ["ru", "Главная"],
  ]) {
    set("#language-select", language);
    await wait();
    check(
      $("#page-title").textContent === title,
      "Switch between supported languages",
    );
  }
  check(
    $("#language-select").value === "ru",
    "Russian selection remains persisted",
  );
  click('[data-settings-tab="connections"]');
  click('[data-settings-connection="ai"]');
  $("#ai-key").value = "test-key-not-real";
  click("#ai-key-save");
  await wait();
  check(storedKey, "Synthetic API key persisted");
  check(
    $("#ai-key").value === "",
    "Password field cleared after successful storage",
  );
  check(
    $("#ai-key-status").textContent.includes("сохранён"),
    "Visible local storage confirmation in Russian",
  );
  click("#ai-key-test");
  await wait();
  check(
    $("#ai-model-choice option[value='gpt-example']"),
    "Connection check loads a selectable model",
  );
  check(
    !$("#ai-model-choice option[value='tts-example']"),
    "Non-text model excluded",
  );
  set("#ai-model-choice", "gpt-example");
  check(
    runtime.snapshot().data.connectionSettings.aiModel === "gpt-example",
    "Selected model saved locally",
  );
  failSave = true;
  $("#ai-key").value = "another-test-key";
  click("#ai-key-save");
  await wait();
  check(
    $("#ai-key").value === "another-test-key",
    "Failed storage preserves input",
  );
  check(
    $("#ai-key-status").dataset.error === "true",
    "Failed verification gives visible error",
  );
  click("#connections-dialog .close");
  click('[data-open="settings-dialog"]');
  click('[data-settings-tab="data"]');
  check(
    $("#lan-settings") && !$(".lan-off").hidden,
    "Pairing is available inside Data settings",
  );
  $("#lan-code").value = "1a2b3456789";
  $("#lan-code").dispatchEvent(new w.Event("input", { bubbles: true }));
  check(
    $("#lan-code").value === "12345678",
    "Pairing code only accepts eight digits",
  );
  dispose = startLanSync(runtime, services, services);
  await wait();
  click("#lan-host-start");
  await new Promise((r) => setTimeout(r, 100));
  check(
    mode === "host" && $(".lan-off").hidden && !$(".lan-host").hidden,
    "PC host controls replace pairing form",
  );
  check(
    !runtime.snapshot().data.tasks.some((t) => t.title === remoteTitle),
    "Incoming data waits for review before mutation",
  );
  check(acks === 0, "Unreviewed document is not acknowledged");
  w.dispatchEvent(
    new w.CustomEvent("life-os:lan-action", {
      detail: { operation: "review", args: { rejected: [] } },
    }),
  );
  await wait();
  check(
    runtime.snapshot().data.tasks.some((t) => t.title === remoteTitle),
    "Accepted document is persisted",
  );
  check(acks === 1, "Received document acknowledged after persistence");
  check(
    runtime.snapshot().data.languageMode === "ru",
    "Incoming records preserve local language",
  );
  $("#lan-address").focus();
  check(!runtime.canSync(), "Focused inputs defer remote updates");
  $("#lan-host-start").focus();
  click("#settings-dialog .close");
  click("#task-add");
  check(!runtime.canSync(), "Open editor defers sync");
  click("#capture-dialog [data-close]");
  holdExchange = true;
  remoteTitle = "Incoming while editing";
  w.dispatchEvent(
    new w.CustomEvent("life-os:lan-action", {
      detail: { operation: "exchange" },
    }),
  );
  await wait();
  click("#task-add");
  releaseExchange();
  await wait();
  check(
    !runtime.snapshot().data.tasks.some((t) => t.title === remoteTitle),
    "In-flight response cannot replace an active editor",
  );
  check(acks === 1, "Deferred response is not acknowledged");
  click("#capture-dialog [data-close]");
  holdExchange = false;
  w.dispatchEvent(
    new w.CustomEvent("life-os:lan-action", { detail: { operation: "stop" } }),
  );
  await wait();
  check(mode === "off", "Disconnect works");
  check(
    runtime.snapshot().data.tasks.some((t) => t.title === "С телефона"),
    "Disconnect keeps merged local data",
  );
  console.log(
    `LAN controller, API key UX and Kazakh: ${checks} assertions passed (mock native calls).`,
  );
} finally {
  dispose?.();
  runtime.dispose();
  dom.window.close();
}
