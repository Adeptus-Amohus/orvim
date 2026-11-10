const assert = require("node:assert/strict");
const fs = require("fs"),
  ts = require("typescript");
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  try {
    const p = await browser.newPage();
    await p.route("**/src/features/workspace/runtime.js*", async (route) => {
      const r = await route.fetch();
      let body = await r.text();
      body = body.replace(
        "const workspaceContext = {",
        "window.__auditTranslate = translateLabel; const workspaceContext = {",
      );
      await route.fulfill({ response: r, body });
    });
    await p.goto("http://127.0.0.1:5180/tests/browser-harness.html?mobile=1");
    await p.waitForFunction(() => !!window.__auditTranslate);
    const candidates = new Map();
    for (const file of fs
      .readdirSync("src/features/workspace")
      .filter(
        (f) =>
          f.endsWith(".js") &&
          !f.includes("translation") &&
          !f.includes("english"),
      )) {
      const src = fs.readFileSync("src/features/workspace/" + file, "utf8"),
        ast = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
      function scan(n) {
        if (ts.isStringLiteral(n) && /[А-Яа-яЁё]/.test(n.text)) {
          let parent = n.parent;
          const directText =
            ts.isBinaryExpression(parent) &&
            /\.(textContent|innerText|placeholder|title)$/.test(
              parent.left.getText(ast),
            );
          const call =
            ts.isCallExpression(parent) &&
            /^(make|action|setStatus|notify|Error|t|button|label|field|confirm|toast)$/.test(
              parent.expression.getText(ast).split(".").pop(),
            );
          const err =
            ts.isNewExpression(parent) &&
            parent.expression.getText(ast) === "Error";
          if (
            (directText || call || err) &&
            !n.text.includes("<") &&
            !n.text.startsWith("data-")
          )
            candidates.set(n.text, file);
        }
        ts.forEachChild(n, scan);
      }
      scan(ast);
    }
    const missing = await p.evaluate(
      (rows) =>
        rows
          .map(([text, file]) => ({
            text,
            file,
            translation: window.__auditTranslate(text.trim()),
          }))
          .filter((r) => !r.translation),
      [...candidates],
    );
    fs.writeFileSync(
      ".artifacts/english-audit-static.json",
      JSON.stringify(missing, null, 2),
    );
    assert.ok(candidates.size >= 700);
    assert.deepEqual(
      missing,
      [],
      "Untranslated labels: " + JSON.stringify(missing),
    );
    console.log(candidates.size + " interface literals have English coverage");
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
