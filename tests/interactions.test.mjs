import assert from "node:assert/strict";
import fs from "node:fs";
import { JSDOM } from "jsdom";
import {
  createScreenHistory,
  isTextEntry,
  isBackSwipe,
  installButtonHints,
  revealInDialog,
} from "../src/features/workspace/interactions.js";
let checks = 0;
const check = (condition, message) => {
  assert.ok(condition, message);
  checks++;
};
const history = createScreenHistory();
const home = { page: "home" },
  life = { page: "life" },
  sleep = { page: "life", detail: true, tab: "sleep" };
history.reset(home);
history.visit(life);
history.visit(sleep);
history.visit(sleep);
check(history.back().page === "life", "Back from sleep returns to Life");
check(history.back().page === "home", "Second back follows actual navigation");
check(!history.back(), "Home has no previous screen");
history.replace(life);
check(!history.back(), "Fallback does not create a back loop");
check(
  isBackSwipe({ x: 12, y: 150, at: 0 }, { x: 120, y: 155, at: 300 }),
  "Intentional edge swipe",
);
for (const end of [
  { x: 70, y: 150, at: 300 },
  { x: 120, y: 210, at: 300 },
  { x: 120, y: 155, at: 1100 },
])
  check(
    !isBackSwipe({ x: 12, y: 150, at: 0 }, end),
    "Short, vertical and slow gestures ignored",
  );
check(
  !isBackSwipe({ x: 90, y: 150, at: 0 }, { x: 200, y: 155, at: 300 }),
  "Non-edge horizontal list swipe ignored",
);
const dom = new JSDOM(
  '<div id="root"><button id="icon" aria-label="Поиск">⌕</button><button id="named" aria-label="Сохранить">Сохранить</button><textarea></textarea><input type="checkbox"><div class="overlay"><div class="dialog"><p id="error"></p></div></div></div>',
  { pretendToBeVisual: true },
);
globalThis.window = dom.window;
globalThis.getComputedStyle = window.getComputedStyle.bind(window);
window.matchMedia = (query) => ({ matches: query === "(hover: hover)" });
const root = window.document.querySelector("#root"),
  icon = root.querySelector("#icon");
check(
  isTextEntry(root.querySelector("textarea")),
  "Text input blocks screen navigation",
);
check(
  !isTextEntry(root.querySelector("input")),
  "Checkbox is not a text entry",
);
const hints = installButtonHints({
  root,
  make: (tag, cls) => {
    const node = window.document.createElement(tag);
    node.className = cls;
    return node;
  },
  listen: (target, type, fn, options) =>
    target.addEventListener(type, fn, options),
});
icon.focus();
check(
  !root.querySelector('[role="tooltip"]').hidden,
  "Keyboard focus shows hint",
);
check(
  icon.getAttribute("aria-describedby") === "workspace-button-hint",
  "Hint accessible to assistive technology",
);
root.querySelector("#named").focus();
check(
  root.querySelector('[role="tooltip"]').hidden,
  "Clear visible labels do not get duplicate hints",
);
icon.dispatchEvent(new window.MouseEvent("mouseover", { bubbles: true }));
check(!root.querySelector('[role="tooltip"]').hidden, "Mouse hover shows hint");
hints.hide();
check(
  !icon.hasAttribute("aria-describedby"),
  "Temporary description is removed",
);
const error = root.querySelector("#error");
let revealed = 0;
error.scrollIntoView = () => revealed++;
root.querySelector(".dialog").getBoundingClientRect = () => ({
  top: 0,
  bottom: 500,
});
error.getBoundingClientRect = () => ({ top: 100, bottom: 150 });
revealInDialog(error);
check(revealed === 0, "Visible errors do not move the form");
error.getBoundingClientRect = () => ({ top: 450, bottom: 480 });
revealInDialog(error);
check(revealed === 1, "Obscured errors are revealed inside the dialog");
const android = fs.readFileSync(
  "src-tauri/gen/android/app/src/main/java/local/lifeos/client/MainActivity.kt",
  "utf8",
);
check(
  android.indexOf("isVisible(WindowInsetsCompat.Type.ime())") <
    android.indexOf("window.dispatchEvent(new Event('life-os:back'"),
  "Android checks the keyboard before dispatching screen back",
);
dom.window.close();
console.log(
  `Interactions: ${checks} assertions passed (DOM and model checks; no physical device).`,
);
