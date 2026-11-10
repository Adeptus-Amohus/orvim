import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { setCompletionIcon } from "../src/features/workspace/completion-icon.js";

const dom = new JSDOM(
  '<button aria-pressed="true">✓<i data-lucide="check"></i></button>',
);
const button = dom.window.document.querySelector("button");
setCompletionIcon(button, true);
assert.equal(button.childNodes.length, 1, "No duplicate text or icon");
assert.equal(button.textContent, "");
assert.equal(
  button.firstElementChild.namespaceURI,
  "http://www.w3.org/2000/svg",
);
assert.equal(button.querySelectorAll("path").length, 1);
const first = button.firstElementChild;
setCompletionIcon(button, true);
assert.equal(
  button.firstElementChild,
  first,
  "Refreshing preserves a single mark",
);
for (let i = 0; i < 100; i++) {
  setCompletionIcon(button, false);
  assert.equal(button.childNodes.length, 0);
  assert.equal(button.getAttribute("aria-pressed"), "false");
  setCompletionIcon(button, true);
  assert.equal(button.childNodes.length, 1);
}
assert.equal(button.querySelector("svg").getAttribute("aria-hidden"), "true");
dom.window.close();
console.log(
  "Completion icon: one vector mark, no duplicate text, 100 repeated toggles passed.",
);
