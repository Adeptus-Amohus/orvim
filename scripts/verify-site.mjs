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

async function render(
  release,
  rejects = false,
  locale = "ru-RU",
  query = "",
  mobile = false,
) {
  const dom = new JSDOM(source, {
    url: `https://adeptus-amohus.github.io/orvim/${query}`,
    runScripts: "outside-only",
  });
  Object.defineProperty(dom.window.navigator, "language", {
    value: locale,
    configurable: true,
  });
  Object.defineProperty(dom.window.navigator, "languages", {
    value: [locale],
    configurable: true,
  });
  dom.window.matchMedia = (query) => ({
    matches: mobile && query.includes("max-width"),
    addEventListener() {},
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
      .textContent.includes("Стабильный выпуск 0.4.50"),
  );
  dom.window.close();
}
assert.ok(
  fallbackWindows.endsWith("/v0.4.50/Orvim-0.4.50-Windows-x64-setup.exe"),
);
assert.ok(fallbackAndroid.endsWith("/v0.4.50/Orvim-0.4.50-Android-arm64.apk"));
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
const image = document.getElementById("tour-image");
assert.match(image.src, /home-desktop\.webp$/);
const next = document.getElementById("tour-next");
next.click();
assert.match(image.src, /life-desktop\.webp$/);
next.dispatchEvent(
  new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
);
assert.match(image.src, /home-desktop\.webp$/);
document.getElementById("tour-prev").click();
assert.match(image.src, /database-desktop\.webp$/);
assert.equal(
  document.getElementById("tour-status").textContent,
  "База данных · 5 / 5",
);
document.querySelector('input[value="mobile"]').click();
assert.match(image.src, /database-mobile\.webp$/);
assert.match(
  document.getElementById("tour-enlarge").href,
  /database-mobile-full\.webp$/,
);
assert.match(image.srcset, /database-mobile-full\.webp 1080w$/);

// Verify manual language toggle (RU -> EN)
const langToggle = document.getElementById("lang-toggle");
assert.equal(langToggle.textContent.trim(), "EN");
langToggle.click();
assert.equal(document.documentElement.lang, "en");
assert.equal(langToggle.textContent.trim(), "RU");
assert.match(image.src, /database-mobile-en\.webp$/);
assert.equal(
  document.getElementById("tour-status").textContent,
  "Database · 5 / 5",
);
assert.ok(
  document
    .getElementById("release-status")
    .textContent.includes("Stable release"),
);
dom.window.close();

// Verify automatic English detection on first visit
const enDom = await render(published, false, "en-US", "", true);
assert.equal(enDom.window.document.documentElement.lang, "en");
assert.ok(
  enDom.window.document
    .getElementById("release-status")
    .textContent.includes("Stable release test"),
);
const enDocument = enDom.window.document;
const screens = ["home", "life", "thoughts", "projects", "database"];
for (const screen of screens) {
  assert.ok(
    enDocument
      .getElementById("tour-image")
      .src.endsWith(`/${screen}-mobile-en.webp`),
  );
  enDocument.getElementById("tour-next").click();
  for (const device of ["desktop", "mobile"]) {
    for (const suffix of ["", "-en"]) {
      for (const size of ["", "-full"]) {
        await fs.access(
          path.join(
            root,
            `assets/tour/${screen}-${device}${suffix}${size}.webp`,
          ),
        );
      }
    }
  }
}
assert.ok(
  enDocument.getElementById("tour-image").src.endsWith("/home-mobile-en.webp"),
);
enDom.window.close();

const linkedDom = await render(published, false, "ru-RU", "?lang=en");
const linkedPage = linkedDom.window.document;
assert.equal(linkedPage.documentElement.lang, "en");
const issueLink = linkedPage.querySelector(
  '[data-i18n-html="feedback_github_btn"]',
);
assert.equal(
  new URL(issueLink.href).searchParams.get("template"),
  "bug-en.yml",
);
linkedPage.getElementById("lang-toggle").click();
assert.equal(linkedPage.documentElement.lang, "ru");
assert.equal(
  new URL(linkedDom.window.location.href).searchParams.get("lang"),
  "ru",
);
assert.equal(new URL(issueLink.href).searchParams.get("template"), "bug.yml");
linkedDom.window.close();

JSON.parse(await fs.readFile(path.join(root, "release.json"), "utf8"));
console.log(
  `Site verified: ${localFiles.size} local resources, anchors, release success/failure/offline states, click, keyboard, and i18n navigation.`,
);
