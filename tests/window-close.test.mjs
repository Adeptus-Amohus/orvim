import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = ts.transpileModule(
  fs.readFileSync(
    new URL("../src/app/window-close.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  },
).outputText;
const { createWindowCloser } = await import(
  `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`
);
for (const hidden of [true, false]) {
  test(
    hidden
      ? "close saves before hiding"
      : "disabled tray / explicit Exit saves then destroys",
    async () => {
      const calls = [];
      const close = createWindowCloser({
        persist: () => calls.push("persist"),
        flush: async () => {
          calls.push("flush");
        },
        hideToTray: async () => {
          calls.push("tray");
          return hidden;
        },
        destroy: async () => {
          calls.push("destroy");
        },
        onError: () => assert.fail("unexpected failure"),
      });
      await close();
      assert.deepEqual(
        calls,
        hidden
          ? ["persist", "flush", "tray"]
          : ["persist", "flush", "tray", "destroy"],
      );
    },
  );
}
test("failed save keeps window open and allows retry", async () => {
  let fail = true,
    hidden = 0,
    errors = 0;
  const close = createWindowCloser({
    persist: () => {},
    flush: async () => {
      if (fail) throw Error("disk full");
    },
    hideToTray: async () => {
      hidden++;
      return true;
    },
    destroy: async () => assert.fail("must not destroy"),
    onError: () => errors++,
  });
  await close();
  assert.equal(hidden, 0);
  assert.equal(errors, 1);
  fail = false;
  await close();
  assert.equal(hidden, 1);
});
test("repeated close requests share the pending save", async () => {
  let release,
    writes = 0,
    hides = 0;
  const close = createWindowCloser({
    persist: () => writes++,
    flush: () =>
      new Promise((resolve) => {
        release = resolve;
      }),
    hideToTray: async () => {
      hides++;
      return true;
    },
    destroy: async () => assert.fail("must not destroy"),
    onError: () => assert.fail("unexpected failure"),
  });
  const first = close(),
    second = close();
  assert.equal(first, second);
  assert.equal(writes, 1);
  assert.equal(hides, 0);
  release();
  await first;
  assert.equal(hides, 1);
});
test("tray error does not silently destroy the window", async () => {
  let errors = 0;
  await createWindowCloser({
    persist: () => {},
    flush: async () => {},
    hideToTray: async () => {
      throw Error("native error");
    },
    destroy: async () => assert.fail("must stay open"),
    onError: () => errors++,
  })();
  assert.equal(errors, 1);
});
