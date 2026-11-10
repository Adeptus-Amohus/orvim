// Run against a production preview, before and after a performance change.
const { chromium } = require(process.env.PLAYWRIGHT_PATH || "playwright");
const fs = require("node:fs/promises");
const path = require("node:path");

const url = process.env.ORVIM_BENCH_URL || "http://127.0.0.1:5182";
const output = process.argv[2] || ".artifacts/performance/current.json";
const runs = Number(process.env.ORVIM_BENCH_RUNS || 3);

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  });
  const results = [];
  try {
    for (const scenario of ["desktop", "mobile", "history", "english"]) {
      for (let run = 0; run < runs; run++) {
        const context = await browser.newContext({
          viewport:
            scenario === "mobile"
              ? { width: 390, height: 844 }
              : { width: 1440, height: 900 },
          locale: scenario === "english" ? "en-US" : "ru-RU",
        });
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (e) => errors.push(e.message));
        if (scenario === "history") {
          // Populate a fresh, isolated browser database; never touch native data.
          await page.route("**/*", (route) =>
            route.request().resourceType() === "document"
              ? route.fulfill({
                  contentType: "text/html",
                  body: "<!doctype html><title>seed</title>",
                })
              : route.continue(),
          );
          await page.goto(url);
          await page.evaluate(async () => {
            const db = await new Promise((resolve, reject) => {
              const request = indexedDB.open("life-os-preview", 1);
              request.onupgradeneeded = () =>
                request.result.createObjectStore("documents");
              request.onsuccess = () => resolve(request.result);
              request.onerror = () => reject(request.error);
            });
            const today = new Date().toLocaleDateString("en-CA");
            const document = {
              revision: 1,
              covers: [],
              data: {
                version: 32,
                nextId: 2000,
                activePage: "home",
                languageMode: "ru",
                projects: Array.from({ length: 20 }, (_, i) => ({
                  id: i + 1,
                  name: `Project ${i}`,
                  tone: "sun",
                })),
                tasks: Array.from({ length: 1000 }, (_, i) => ({
                  id: i + 100,
                  title: `Task ${i}`,
                  context: `Project ${i % 20}`,
                  date: i < 50 ? today : "2025-01-01",
                  done: i >= 50,
                  createdDate: "2025-01-01",
                })),
              },
            };
            await new Promise((resolve, reject) => {
              const tx = db.transaction("documents", "readwrite");
              tx.objectStore("documents").put(document, "workspace");
              tx.oncomplete = resolve;
              tx.onerror = () => reject(tx.error);
            });
            db.close();
          });
          await page.unroute("**/*");
        }
        await page.addInitScript(() => {
          window.bench = { longTasks: [] };
          new PerformanceObserver((list) => {
            window.bench.longTasks.push(
              ...list
                .getEntries()
                .map((e) => ({ start: e.startTime, duration: e.duration })),
            );
          }).observe({ type: "longtask", buffered: true });
          const observer = new MutationObserver(() => {
            const workspace = document.getElementById("life-os-workspace");
            if (workspace && !workspace.hidden && !window.bench.ready) {
              window.bench.ready = performance.now();
              observer.disconnect();
            }
          });
          observer.observe(document, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["hidden"],
          });
        });
        const cdp = await context.newCDPSession(page);
        await cdp.send("Performance.enable");
        const profile = scenario === "history" && run === 0;
        if (profile) {
          await cdp.send("Profiler.enable");
          await cdp.send("Profiler.start");
        }
        await page.goto(url);
        await page.waitForFunction(() => window.bench.ready);
        await page.waitForTimeout(300);
        const before = await cdp.send("Performance.getMetrics");
        await page.waitForTimeout(800);
        const after = await cdp.send("Performance.getMetrics");
        const metric = (result, name) =>
          result.metrics.find((m) => m.name === name)?.value || 0;
        const measurements = await page.evaluate(() => ({
          ...window.bench,
          fcp: performance.getEntriesByName("first-contentful-paint")[0]
            ?.startTime,
          nodes: document.querySelectorAll("*").length,
          animations: document.getAnimations().length,
        }));
        const result = {
          scenario,
          run,
          ...measurements,
          errors,
          idleTaskMs:
            (metric(after, "TaskDuration") - metric(before, "TaskDuration")) *
            1000,
          idleScriptMs:
            (metric(after, "ScriptDuration") -
              metric(before, "ScriptDuration")) *
            1000,
          startupTaskMs: metric(before, "TaskDuration") * 1000,
        };
        if (profile) {
          const { profile: cpu } = await cdp.send("Profiler.stop");
          await fs.mkdir(path.dirname(output), { recursive: true });
          await fs.writeFile(
            output.replace(/\.json$/, ".cpuprofile"),
            JSON.stringify(cpu),
          );
          const weights = new Map();
          cpu.samples?.forEach((id, i) =>
            weights.set(id, (weights.get(id) || 0) + cpu.timeDeltas[i]),
          );
          result.hotspots = cpu.nodes
            .map((n) => ({
              name: n.callFrame.functionName,
              url: n.callFrame.url,
              ms: (weights.get(n.id) || 0) / 1000,
            }))
            .sort((a, b) => b.ms - a.ms)
            .slice(0, 18);
        }
        results.push(result);
        console.log(JSON.stringify(result));
        await context.close();
      }
    }
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify({ url, runs, results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
