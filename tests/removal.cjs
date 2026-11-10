const sourceIncludes = (source, text) =>
  source
    .replace(/\s/g, "")
    .replace(/;}/g, "}")
    .replace(/0\.(\d)/g, ".$1")
    .includes(
      text
        .replace(/\s/g, "")
        .replace(/;}/g, "}")
        .replace(/0\.(\d)/g, ".$1"),
    );
const fs = require("node:fs"),
  assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const source = require("./fixture.cjs")();
const html = source.replace(
  "    })();",
  "      window.__qa={snapshotData,positionTaskMenu,renderLifeInsights,makeBackup,validateBackup};\n    })();",
);
const windows = [];
let assertions = 0;
const check = (value, message) => {
  assert.ok(value, message);
  assertions++;
};
function runtime(state) {
  const errors = [],
    vc = new VirtualConsole();
  vc.on("jsdomError", (error) => {
    if (!error.message.includes("Could not parse CSS stylesheet"))
      errors.push(error.message);
  });
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      const now = Date.UTC(2026, 9, 1, 12);
      window.Date = class extends Date {
        constructor(...args) {
          super(...(args.length ? args : [now]));
        }
        static now() {
          return now;
        }
      };
      Object.defineProperty(window.navigator, "language", { value: "ru-RU" });
      window.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      });
      window.lucide = { createIcons() {} };
      Object.assign(window, {
        TextEncoder,
        Blob,
        Response,
        CompressionStream,
        DecompressionStream,
      });
      window.openai = {
        widgetState: state ? { privateContent: state } : {},
        setWidgetState: async () => {},
      };
      window.HTMLCanvasElement.prototype.getContext = () =>
        new Proxy(
          {},
          {
            get(target, name) {
              if (name.startsWith("create"))
                return () => ({ addColorStop() {} });
              return () => {};
            },
          },
        );
    },
  });
  windows.push(dom.window);
  const $ = (selector) => dom.window.document.querySelector(selector),
    all = (selector) => [...dom.window.document.querySelectorAll(selector)],
    click = (target) => {
      const node = typeof target === "string" ? $(target) : target;
      assert.ok(node, "Missing " + target);
      node.click();
    },
    set = (selector, value, type = "input") => {
      const node = $(selector);
      if (node.type === "checkbox") node.checked = value;
      else node.value = String(value);
      node.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
    };
  return {
    window: dom.window,
    $,
    all,
    click,
    set,
    errors,
    qa: dom.window.__qa,
    submit(selector) {
      click(selector + ' button[type="submit"]');
    },
    pointer(node, type) {
      const event = new dom.window.Event(type, {
        bubbles: true,
        cancelable: true,
      });
      Object.defineProperties(event, {
        clientX: { value: 200 },
        clientY: { value: 180 },
        button: { value: 0 },
        pointerId: { value: 1 },
        pointerType: { value: "mouse" },
      });
      node.dispatchEvent(event);
      return event;
    },
  };
}
(async () => {
  try {
    for (const text of [
      "supportBeforeCheckin",
      "support-enabled",
      "win-dialog",
      "win-continue",
      "winIndex",
      "victory-",
      "gift-",
      "Можно двигаться в своём темпе.",
      "Небольшой шаг тоже имеет значение.",
      "Поддержка перед отметкой",
      "Немного поддержки",
    ])
      check(!sourceIncludes(source, text), "Removed entirely: " + text);
    for (const enabled of [true, false]) {
      const r = runtime({
        version: 28,
        activePage: "home",
        supportBeforeCheckin: enabled,
        winIndex: 4,
      });
      r.click("#state-open");
      check(
        !r.$("#state-dialog").hidden,
        "Home opens score form regardless of old support preference",
      );
      check(!r.$("#win-dialog"), "Support dialog absent from DOM");
      r.click("#state-dialog [data-close]");
      r.click('[data-open="settings-dialog"]');
      check(
        !r.$("#support-enabled") &&
          !r.$("#settings-dialog").textContent.includes("Поддержка"),
        "No support setting remains",
      );
      for (const palette of ["sun", "pine", "scarlet", "winter"])
        for (const appearance of ["light", "dark"]) {
          r.click('button[data-theme="' + palette + '"]');
          r.click('button[data-appearance="' + appearance + '"]');
          check(
            !r.$("#win-dialog") && !r.$("#support-enabled"),
            "Theme and appearance cannot recreate support",
          );
        }
      r.click("#settings-dialog [data-close]");
      r.click('[data-page="life"]');
      r.click("#life-checkin-open");
      check(!r.$("#state-dialog").hidden, "Life opens score form directly");
      r.click('input[name="energy"][value="5"]');
      r.submit("#state-form");
      check(
        r.qa.snapshotData().checkins.length === 1 &&
          r.qa.snapshotData().checkins[0].energy === 5,
        "Direct check-in saves scores",
      );
      r.click('[data-page="home"]');
      r.click("#state-open");
      check(
        r.$("#state-dialog").hidden && !r.$("#life-mood-view").hidden,
        "Within four hours opens statistics",
      );
      const snapshot = r.qa.snapshotData();
      check(
        !("supportBeforeCheckin" in snapshot) && !("winIndex" in snapshot),
        "Removed state omitted from snapshot and backup",
      );
      const backup = JSON.parse(JSON.stringify(r.qa.makeBackup()));
      check(
        r.qa.validateBackup(backup).data.version === 32,
        "New backup needs no removed support preference",
      );
      backup.data.version = 28;
      backup.data.supportBeforeCheckin = true;
      backup.data.winIndex = 3;
      check(
        r.qa.validateBackup(backup).data.version === 28,
        "Old backup remains compatible",
      );
      check(
        r.errors.length === 0,
        "No runtime errors after old-state restore, themes and check-in",
      );
    }
    check(
      sourceIncludes(
        source,
        ".field{display:grid;gap:7px;font-size:12px;margin-bottom:15px;min-width:0}",
      ),
      "Form labels cannot force a grid beyond available width",
    );
    check(
      sourceIncludes(
        source,
        ".field-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:11px}",
      ),
      "Date and time columns may shrink",
    );
    check(
      sourceIncludes(
        source,
        "@media(max-width:420px){#life-os-workspace .field-row{grid-template-columns:1fr}}",
      ),
      "Narrow date/time forms stack instead of squeezing native controls",
    );
    check(
      sourceIncludes(
        source,
        ".project-hero h2,#life-os-workspace .project-description{overflow-wrap:anywhere}",
      ),
      "Long project names and descriptions wrap",
    );
    check(
      sourceIncludes(
        source,
        ".water-strip{display:flex;align-items:center;gap:12px;min-width:0;flex-wrap:wrap}",
      ),
      "Water controls wrap when they cannot fit",
    );
    const report = {
      passed: true,
      assertions,
      checked: [
        "support dialog and phrases removed from source",
        "old preferences ignored",
        "Home and Life open scores directly",
        "four-hour gate preserved",
        "all theme and appearance combinations",
        "backup migration",
        "responsive CSS safeguards",
      ],
      scope:
        "DOM/event logic and CSS source audit only; no rendered browser viewport, zoom or physical phone coverage",
    };
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    windows.forEach((window) => window.close());
  }
})();
