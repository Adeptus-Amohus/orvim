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
const fs = require("node:fs");
const assert = require("node:assert/strict");
const { JSDOM, VirtualConsole } = require("jsdom");
const html = require("./fixture.cjs")();
const windows = [];
let assertions = 0;
const check = (value, message) => {
  assert.ok(value, message);
  assertions++;
};
function runtime(state, initialNow) {
  let now = initialNow,
    id = 0;
  const timers = new Map(),
    errors = [],
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
      Object.defineProperty(window.navigator, "language", { value: "ru-RU" });
      window.Date = class extends Date {
        constructor(...args) {
          super(...(args.length ? args : [now]));
        }
        static now() {
          return now;
        }
      };
      window.setTimeout = (fn, delay = 0) => {
        const key = ++id;
        timers.set(key, { fn, at: now + Number(delay) });
        return key;
      };
      window.clearTimeout = (key) => timers.delete(key);
      window.setInterval = () => 0;
      window.clearInterval = () => {};
      window.matchMedia = () => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
      });
      window.TextEncoder = TextEncoder;
      window.lucide = { createIcons() {} };
      window.openai = {
        widgetState: state ? { privateContent: state } : {},
        setWidgetState: async () => {},
      };
      window.HTMLCanvasElement.prototype.getContext = () =>
        new Proxy(
          {},
          {
            get(target, name) {
              if (
                name === "createLinearGradient" ||
                name === "createRadialGradient"
              )
                return () => ({ addColorStop() {} });
              return () => {};
            },
          },
        );
    },
  });
  windows.push(dom.window);
  const $ = (selector) => dom.window.document.querySelector(selector),
    all = (selector) => [...dom.window.document.querySelectorAll(selector)];
  return {
    window: dom.window,
    $,
    all,
    errors,
    click(selector) {
      $(selector).click();
    },
    advance(target) {
      let steps = 0;
      while (true) {
        const next = [...timers]
          .filter(([, timer]) => timer.at <= target)
          .sort((a, b) => a[1].at - b[1].at)[0];
        if (!next) break;
        if (++steps > 1000) throw Error("Timer loop");
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = target;
    },
    indicators() {
      return all(".counterweight").map((node) => node.dataset.checkinState);
    },
  };
}
function expect(r, state, label) {
  check(r.indicators().length === 2, label + " has Home and Life indicators");
  check(
    r.indicators().every((value) => value === state),
    label + " updates both indicators",
  );
}
try {
  const at = new Date(2026, 9, 1, 8).getTime(),
    interval = 4 * 60 * 60 * 1000;
  const empty = runtime(null, at);
  expect(empty, "due", "First visit");
  check(
    sourceIncludes(
      html,
      ".counterweight span{background:currentColor;transition:background-color .3s ease}",
    ),
    "Unrecorded bars share inherited theme color",
  );
  check(
    !sourceIncludes(html, '.state[data-has-entry="true"] .counterweight span'),
    "Old saved-data rule cannot override expired color",
  );
  for (const palette of ["sun", "pine", "scarlet", "winter"]) {
    empty.click('[data-theme="' + palette + '"]');
    expect(empty, "due", "Empty state " + palette);
    check(
      empty.$("#life-os-workspace").dataset.palette === palette,
      "Theme changed " + palette,
    );
  }
  const fresh = runtime(
    {
      version: 25,
      activePage: "life",
      checkins: [{ at, mood: 4, energy: 5, stress: 1 }],
    },
    at + interval - 1000,
  );
  expect(fresh, "recorded", "Restored recent record");
  for (const palette of ["sun", "pine", "scarlet", "winter"]) {
    fresh.click('[data-theme="' + palette + '"]');
    expect(fresh, "recorded", "Fresh state " + palette);
    check(
      fresh
        .all(".counterweight span")
        .every((bar) => bar.style.background === ""),
      "No inline color override " + palette,
    );
  }
  for (const [index, token] of [
    [1, "mood"],
    [2, "energy"],
    [3, "stress"],
  ])
    check(
      sourceIncludes(
        html,
        '.counterweight[data-checkin-state="recorded"] span:nth-child(' +
          index +
          "){background:var(--lo-" +
          token +
          "-color)}",
      ),
      "Recorded color " + token + " is independent of palette",
    );
  fresh.advance(at + interval - 1);
  expect(fresh, "recorded", "One millisecond before expiry");
  fresh.advance(at + interval);
  expect(fresh, "due", "Exact period expiry without navigation");
  check(
    fresh.$("#life-core-caption").textContent === "Отметиться",
    "Life call to action refreshes at expiry",
  );
  check(
    fresh
      .$("#state-card")
      .getAttribute("aria-label")
      .includes("пора отметиться"),
    "Expired Home accessible label reflects new check-in",
  );
  fresh.click("#life-checkin-open");
  expect(fresh, "due", "Opening score form directly");
  check(
    !fresh.$("#state-dialog").hidden && !fresh.$("#win-dialog"),
    "No support window before check-in",
  );
  fresh.click('input[name="mood"][value="5"]');
  expect(fresh, "due", "Choosing without saving");
  fresh.click('#state-form button[type="submit"]');
  expect(fresh, "recorded", "Saving check-in");
  fresh.click('[data-page="home"]');
  expect(fresh, "recorded", "Returning Home");
  fresh.advance(at + 10 * 60 * 60 * 1000);
  expect(fresh, "due", "New check-in starts another period period");
  const expired = runtime(
    {
      version: 26,
      activePage: "home",
      checkins: [{ at, mood: 4, energy: 4, stress: 2 }],
    },
    at + interval + 1,
  );
  expect(expired, "due", "Restored old record");
  expired.click('[data-page="life"]');
  expect(expired, "due", "Life after old record");
  for (const r of [empty, fresh, expired])
    check(r.errors.length === 0, "No runtime errors");
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)];
  scripts.forEach((match) => new Function(match[1]));
  check(true, "JavaScript syntax valid");
  const report = {
    passed: true,
    assertions,
    checked: [
      "same state on Home and Life",
      "theme-colored due bars",
      "fixed three-color saved bars",
      "exact period timeout",
      "save boundary",
      "older-state restore",
    ],
    scope: "DOM and timer checks; browser pixel layout not measured",
  };
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.stack);
  process.exitCode = 1;
} finally {
  windows.forEach((window) => window.close());
}
