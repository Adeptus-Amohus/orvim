import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { Check, Plus } from "lucide";
import {
  dateFormat,
  numberFormat,
} from "../src/features/workspace/formatters.js";
import { createIconRefresher } from "../src/features/workspace/refresh-icons.ts";

for (const locale of ["ru", "en"]) {
  const date = new Date(2026, 10, 10, 12);
  const options = { day: "numeric", month: "long", year: "numeric" };
  assert.equal(
    dateFormat(locale, options).format(date),
    new Intl.DateTimeFormat(locale, options).format(date),
  );
  const money = { style: "currency", currency: "KZT" };
  assert.equal(
    numberFormat(locale, money).format(1234.5),
    new Intl.NumberFormat(locale, money).format(1234.5),
  );
}
assert.notEqual(
  dateFormat("ru", { month: "long" }).format(new Date(2026, 10, 10)),
  dateFormat("en", { month: "long" }).format(new Date(2026, 10, 10)),
);

const dom = new JSDOM(
  '<main><i data-lucide="check" class="custom" width="20" aria-label="Done"></i></main>',
);
globalThis.document = dom.window.document;
try {
  const refresh = createIconRefresher({ Check, Plus });
  const root = document.querySelector("main");
  refresh(root);
  const first = root.querySelector("svg");
  assert.equal(first.getAttribute("width"), "20");
  assert.equal(first.getAttribute("aria-label"), "Done");
  assert.ok(first.classList.contains("custom"));
  assert.equal(first.hasAttribute("aria-hidden"), false);
  for (let i = 0; i < 100; i++) refresh(root);
  assert.equal(
    root.querySelector("svg"),
    first,
    "unchanged icons must keep their DOM nodes",
  );
  first.dataset.lucide = "plus";
  refresh(root);
  assert.notEqual(
    root.querySelector("svg"),
    first,
    "a changed icon name must update geometry",
  );
  assert.equal(root.querySelector("svg").getAttribute("data-lucide"), "plus");
  root.insertAdjacentHTML(
    "beforeend",
    '<i data-lucide="check"></i><i data-lucide="unknown"></i>',
  );
  refresh(); // Feature modules can request a refresh without specifying a scope.
  assert.equal(root.querySelectorAll("svg").length, 2);
  assert.equal(
    root.querySelector('svg[data-lucide="check"]').getAttribute("aria-hidden"),
    "true",
  );
  assert.ok(root.querySelector('i[data-lucide="unknown"]'));
} finally {
  delete globalThis.document;
  dom.window.close();
}
console.log(
  "Formatting preserves locales/currencies; icons retain identity across 100 refreshes, update names and support unscoped calls.",
);
