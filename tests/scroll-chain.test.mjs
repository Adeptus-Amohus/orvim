import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { installScrollChaining } from "../src/features/workspace/scroll-chain.js";
const dom = new JSDOM(
  '<div id="root"><div id="parent" style="overflow-y:auto"><div id="inner" style="overflow-y:auto"><button>✓</button></div></div></div>',
  { pretendToBeVisual: true },
);
const { document, WheelEvent } = dom.window;
const root = document.querySelector("#root"),
  parent = document.querySelector("#parent"),
  inner = document.querySelector("#inner"),
  target = inner.querySelector("button");
const size = (node, height, viewport) =>
  Object.defineProperties(node, {
    scrollHeight: { configurable: true, value: height },
    clientHeight: { configurable: true, value: viewport },
  });
size(inner, 1000, 200);
size(parent, 2000, 400);
size(document.documentElement, 4000, 600);
Object.defineProperty(document, "scrollingElement", {
  value: document.documentElement,
});
installScrollChaining(root, (node, type, handler, options) =>
  node.addEventListener(type, handler, options),
);
const wheel = (deltaY, options = {}) => {
  const event = new WheelEvent("wheel", {
    bubbles: true,
    cancelable: true,
    deltaY,
    ...options,
  });
  target.dispatchEvent(event);
  return event;
};
inner.scrollTop = 400;
parent.scrollTop = 500;
assert.equal(
  wheel(80).defaultPrevented,
  false,
  "Native scrolling within the list",
);
assert.equal(parent.scrollTop, 500);
inner.scrollTop = 799;
assert.equal(
  wheel(80).defaultPrevented,
  true,
  "One-pixel bottom remainder chains",
);
assert.equal(parent.scrollTop, 580);
inner.scrollTop = 1;
assert.equal(
  wheel(-80).defaultPrevented,
  true,
  "One-pixel top remainder chains",
);
assert.equal(parent.scrollTop, 500);
inner.scrollTop = 800;
assert.equal(wheel(80, { ctrlKey: true }).defaultPrevented, false);
assert.equal(wheel(80, { deltaX: 200 }).defaultPrevented, false);
assert.equal(
  parent.scrollTop,
  500,
  "Zoom and horizontal gestures are preserved",
);
parent.scrollTop = 1600;
document.documentElement.scrollTop = 1000;
assert.equal(wheel(3, { deltaMode: 1 }).defaultPrevented, true);
assert.equal(
  document.documentElement.scrollTop,
  1048,
  "Line-mode wheel continues to page",
);
parent.style.overscrollBehaviorY = "contain";
assert.equal(
  wheel(80).defaultPrevented,
  false,
  "Modal boundary does not leak to background",
);
assert.equal(document.documentElement.scrollTop, 1048);
parent.scrollTop = 300;
assert.equal(
  wheel(80).defaultPrevented,
  true,
  "Inner list still chains to its dialog",
);
assert.equal(parent.scrollTop, 380);
dom.window.close();
console.log("Scroll chaining: 15 assertions passed.");
