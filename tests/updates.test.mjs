import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { installUpdateSettings } from "../src/features/workspace/update-ui.js";

const dom = new JSDOM("<main></main>");
globalThis.window = dom.window;
const document = dom.window.document;
const panel = document.querySelector("main");
const calls = [];
const publicUrl = "https://github.com/Adeptus-Amohus/orvim/releases/latest";
let response = {
  installed: "0.4.46",
  latest: "0.4.47",
  configured: false,
  updateAvailable: true,
  manualUrl: publicUrl,
  message: "Доступна версия 0.4.47.",
};
let failure;
function make(tag, className = "", text = "") {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}
const view = installUpdateSettings(
  {
    make,
    action(text, handler, className) {
      const button = make("button", className, text);
      button.addEventListener("click", handler);
      return button;
    },
    services: {
      localSync: true,
      flush: async () => {},
      openExternal: async (url) => calls.push(["open", url]),
      updates: async (operation, version) => {
        calls.push([operation, version]);
        if (operation === "status")
          return { installed: "0.4.46", configured: true };
        if (failure) throw new Error(failure);
        return response;
      },
    },
  },
  panel,
);
const check = panel.querySelector("button");
async function click(node) {
  node.click();
  await new Promise((resolve) => setTimeout(resolve, 0));
}
await click(check);
assert.match(panel.textContent, /Доступна версия 0.4.47/);
assert.equal(panel.querySelector("a").href, publicUrl);
assert.equal(
  panel.querySelectorAll("button").length,
  1,
  "Unsigned metadata cannot offer install/download",
);
await click(panel.querySelector("a"));
assert.deepEqual(calls.at(-1), ["open", publicUrl]);

response = {
  installed: "0.4.46",
  releases: [
    {
      version: "0.4.47",
      newer: true,
      notes: "Test",
      schema_min: 3,
      schema_max: 3,
      workspace_max: 31,
    },
  ],
};
await click(check);
assert.equal(
  panel.querySelector("a"),
  null,
  "The previous release link is cleared",
);
let buttons = [...panel.querySelectorAll(".update-release button")];
assert.ok(
  buttons.every((button) => button.disabled),
  "Format 31 must not enable installation into a format 32 database",
);
response.releases[0].workspace_max = 32;
await click(check);
buttons = [...panel.querySelectorAll(".update-release button")];
assert.equal(buttons[0].disabled, false);
assert.equal(buttons[1].disabled, true);
await click(buttons[0]);
assert.equal(buttons[1].disabled, false);
assert.deepEqual(calls.at(-1), ["download", "0.4.47"]);

failure = "Сервер обновлений временно недоступен.";
await click(check);
assert.match(panel.textContent, /Сервер обновлений временно недоступен/);
assert.equal(check.disabled, false, "A failed check can be retried");
view.dispose();
dom.window.close();
delete globalThis.window;
console.log("Update UI regression checks passed (mock native service).");

const folder = fs.mkdtempSync(path.join(os.tmpdir(), "orvim-update-fixture-"));
const version = "0.4.47";
const names = [
  `Orvim-${version}-Windows-x64-setup.exe`,
  `Orvim-${version}-Android-arm64.apk`,
];
try {
  const files = names.map((name) => {
    const bytes = Buffer.from(`Synthetic package: ${name}`);
    fs.writeFileSync(path.join(folder, name), bytes);
    return {
      name,
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  });
  fs.writeFileSync(
    path.join(folder, "build-info.json"),
    JSON.stringify({ version, files }),
  );
  fs.writeFileSync(
    path.join(folder, "Release-notes.md"),
    "Synthetic update fixture",
  );
  const prepare = () =>
    spawnSync(
      process.execPath,
      ["scripts/prepare-update-release.mjs", folder],
      { encoding: "utf8" },
    );
  const result = prepare();
  assert.equal(result.status, 0, result.stderr);
  const filename = path.join(folder, "orvim-updates.unsigned.json");
  const manifest = JSON.parse(fs.readFileSync(filename, "utf8"));
  assert.equal(
    manifest.releases[0].platforms["android-aarch64"].url,
    `https://github.com/Adeptus-Amohus/orvim/releases/download/v${version}/${names[1]}`,
  );
  assert.equal(
    manifest.releases[0].platforms["windows-x86_64"].sha256,
    files[0].sha256,
  );
  fs.unlinkSync(filename);
  fs.appendFileSync(path.join(folder, names[0]), "tampered");
  assert.notEqual(
    prepare().status,
    0,
    "A changed package must not produce a manifest",
  );
  assert.equal(fs.existsSync(filename), false);
  console.log(
    "Update manifest preparation passed with current asset names and tamper rejection.",
  );
} finally {
  for (const name of [
    ...names,
    "build-info.json",
    "Release-notes.md",
    "orvim-updates.unsigned.json",
  ]) {
    const filename = path.join(folder, name);
    if (fs.existsSync(filename)) fs.unlinkSync(filename);
  }
  fs.rmdirSync(folder);
}
