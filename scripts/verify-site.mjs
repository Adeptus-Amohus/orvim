import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";

const root = fileURLToPath(new URL("../site/", import.meta.url));
const source = await fs.readFile(path.join(root, "index.html"), "utf8");
const script = await fs.readFile(path.join(root, "app.js"), "utf8");
const initialDocument = new JSDOM(source).window.document;
const fallbackWindows = initialDocument.getElementById("windows-download").href;
const fallbackAndroid = initialDocument.getElementById("android-download").href;
const localFiles = new Set();
for (const filename of ["index.html", "privacy.html", "help.html"]) {
  const html = await fs.readFile(path.join(root, filename), "utf8");
  const { document } = new JSDOM(html).window;
  assert.equal(document.documentElement.lang, "ru");
  assert.equal(document.querySelectorAll("h1").length, 1);
  const ids = [...document.querySelectorAll("[id]")].map((el) => el.id);
  assert.equal(new Set(ids).size, ids.length, `${filename}: duplicate ID`);
  for (const element of document.querySelectorAll("[href], [src]")) {
    const value = element.getAttribute("href") ?? element.getAttribute("src");
    if (!value || /^(?:https?|mailto):/.test(value)) continue;
    if (value.startsWith("#")) {
      if (value.length > 1)
        assert.ok(
          document.getElementById(value.slice(1)),
          `Missing anchor ${value}`,
        );
      continue;
    }
    const file = value.split("#")[0].split("?")[0];
    if (file === "./") continue;
    await fs.access(path.join(root, file));
    localFiles.add(file);
  }
  for (const img of document.querySelectorAll("img"))
    assert.ok(img.hasAttribute("alt"), "Missing image alt");
  assert.ok(
    !html.includes("Adeptus-Amohus/life-os"),
    "Link to private app repository",
  );
  assert.ok(!html.includes("®"), "Unverified registered trademark claim");
}
const css = await fs.readFile(path.join(root, "styles.css"), "utf8");
for (const match of css.matchAll(/url\(['"]?([^)'"\s]+)['"]?\)/g)) {
  await fs.access(path.join(root, match[1]));
  localFiles.add(match[1]);
}
await fs.access(path.join(root, "assets/OFL-Nunito.txt"));
await fs.access(path.join(root, "LICENSE"));
await fs.access(path.join(root, "NOTICE"));

async function render(release, rejects = false) {
  const dom = new JSDOM(source, {
    url: "https://adeptus-amohus.github.io/orvim/",
    runScripts: "outside-only",
  });
  dom.window.fetch = async (url) => {
    assert.equal(url, "release.json", "Unexpected network request");
    if (rejects) throw new Error("Offline");
    return { ok: true, json: async () => release };
  };
  dom.window.eval(script);
  await new Promise((resolve) => setTimeout(resolve, 10));
  return dom;
}
const published = {
  version: "test",
  notes: "https://github.com/Adeptus-Amohus/orvim/releases/tag/test",
  windows:
    "https://github.com/Adeptus-Amohus/orvim/releases/download/test/Orvim-setup.exe",
  android:
    "https://github.com/Adeptus-Amohus/orvim/releases/download/test/Orvim.apk",
};
for (const [release, rejects] of [
  [{}, false],
  [{ ...published, windows: "https://example.com/fake.exe" }, false],
  [{}, true],
]) {
  const dom = await render(release, rejects);
  assert.ok(
    dom.window.document.getElementById("windows-download").href ===
      fallbackWindows,
  );
  assert.ok(
    dom.window.document
      .getElementById("release-status")
      .textContent.includes("Стабильный выпуск 0.4.47"),
  );
  dom.window.close();
}
assert.ok(
  fallbackWindows.endsWith("/v0.4.47/Orvim-0.4.47-Windows-x64-setup.exe"),
);
assert.ok(fallbackAndroid.endsWith("/v0.4.47/Orvim-0.4.47-Android-arm64.apk"));
const dom = await render(published);
const { document, KeyboardEvent } = dom.window;
assert.equal(
  document.getElementById("windows-download").href,
  published.windows,
);
assert.equal(
  document.getElementById("android-download").href,
  published.android,
);
assert.ok(
  document
    .getElementById("release-status")
    .textContent.includes("Стабильный выпуск"),
);
document.getElementById("tab-projects").click();
assert.ok(document.getElementById("panel-day").hidden);
assert.ok(!document.getElementById("panel-projects").hidden);
document
  .getElementById("tab-projects")
  .dispatchEvent(
    new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
  );
assert.equal(document.activeElement.id, "tab-mobile");
assert.ok(!document.getElementById("panel-mobile").hidden);
assert.equal(
  document.querySelectorAll('[role="tab"][aria-selected="true"]').length,
  1,
);
document
  .getElementById("tab-mobile")
  .dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true }));
assert.equal(document.activeElement.id, "tab-day");
assert.ok(!document.getElementById("panel-day").hidden);
dom.window.close();
JSON.parse(await fs.readFile(path.join(root, "release.json"), "utf8"));
console.log(
  `Site verified: ${localFiles.size} local resources, anchors, release success/failure/offline states, click and keyboard navigation.`,
);
