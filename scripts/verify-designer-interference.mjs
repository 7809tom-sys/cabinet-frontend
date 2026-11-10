/**
 * Three-designer interference check for the WebGL work.
 *
 * Opens the kitchen, bathroom and closet designers and switches between them
 * with in-app navigation (one document, so React has to release each designer's
 * WebGL context on unmount — a full page load would hide a leak), then opens all
 * three at once in separate tabs of one browser session. It measures:
 *
 *   - leaks: WebGL contexts that stay alive after their canvas left the page;
 *   - white pages: a designer that shows neither its 3D stage nor the clear 2D
 *     fallback notice;
 *   - loops: WebGL contexts, GPU buffers or textures created while nobody is
 *     touching the page (a scene rebuild or context recreation loop);
 *   - freezes: main-thread tasks longer than 1 s while idle.
 *
 * Runs in Chrome and in the same Chrome binary with Edge's user agent (Edge is
 * Chromium: same Blink and WebGL implementation; the UA does not change Edge's
 * own GPU blocklist or driver behaviour, which this cannot cover).
 *
 *   npx vite --port 5199 --strictPort
 *   node scripts/verify-designer-interference.mjs
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";

const ORIGIN = process.env.VERIFY_ORIGIN ?? "http://127.0.0.1:5199";
const OUT_DIR = "/opt/cursor/artifacts";
mkdirSync(OUT_DIR, { recursive: true });

const CHROME_PATH = "/usr/local/bin/google-chrome";
const EDGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";

const DESIGNERS = {
  kitchen: "/design",
  bathroom: "/design?room=bathroom",
  closet: "/closet?demo=mixed",
};

const results = [];
function record(browser, designer, check, pass, detail) {
  results.push({ browser, designer, check, pass, detail });
  console.log(`[${browser}][${designer}] ${pass ? "PASS" : "FAIL"} ${check}${detail ? ` — ${detail}` : ""}`);
}

/** Runs before any app code: tracks every WebGL context, GPU allocations and long tasks. */
const TRACKER = () => {
  const contexts = new Map();
  const stats = { created: 0, released: 0, buffers: 0, textures: 0, programs: 0 };
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(name, ...rest) {
    const context = original.call(this, name, ...rest);
    if (context && typeof name === "string" && /webgl/i.test(name) && !contexts.has(context)) {
      contexts.set(context, this);
      stats.created += 1;
      this.addEventListener("webglcontextlost", () => {
        if (contexts.delete(context)) stats.released += 1;
      }, { once: true });
    }
    return context;
  };
  for (const proto of [window.WebGLRenderingContext?.prototype, window.WebGL2RenderingContext?.prototype].filter(Boolean)) {
    for (const [method, key] of [["createBuffer", "buffers"], ["createTexture", "textures"], ["createProgram", "programs"]]) {
      const fn = proto[method];
      proto[method] = function counted(...args) { stats[key] += 1; return fn.apply(this, args); };
    }
  }
  const longTasks = [];
  try {
    new PerformanceObserver((list) => list.getEntries().forEach((entry) => longTasks.push({ at: entry.startTime, ms: entry.duration })))
      .observe({ type: "longtask", buffered: true });
  } catch { /* longtask unsupported */ }
  window.__glProbe = {
    snapshot: () => ({
      ...stats,
      live: contexts.size,
      // Alive but no longer on the page: nothing can ever release it except GC.
      orphaned: Array.from(contexts.values()).filter((canvas) => !canvas.isConnected).length,
      onPage: Array.from(contexts.values()).filter((canvas) => canvas.isConnected).length,
    }),
    longTasksSince: (since) => longTasks.filter((task) => task.at >= since),
    now: () => performance.now(),
  };
};

async function inspect(page) {
  return page.evaluate(() => {
    const bodyText = (document.body.innerText || "").replace(/\s+/g, " ").trim();
    const canvases = Array.from(document.querySelectorAll("canvas")).filter((canvas) => canvas.isConnected);
    return {
      rootChildren: document.getElementById("root")?.childElementCount ?? 0,
      textLength: bodyText.length,
      canvases: canvases.length,
      paintedCanvas: canvases.some((canvas) => canvas.width > 1 && canvas.height > 1 && canvas.getBoundingClientRect().width > 100),
      designerFallback: document.querySelectorAll('[data-testid="webgl-unavailable"]').length,
      closetFallback: document.querySelectorAll('[data-testid="vendor-closet-webgl-unavailable"]').length,
      errorBoundary: bodyText.includes("An unexpected error occurred"),
      gate: document.querySelectorAll('input[type="email"]').length,
      gl: window.__glProbe.snapshot(),
    };
  });
}

/** In-app navigation, the way the site's own links move between pages. */
async function navigateInApp(page, path) {
  await page.evaluate((target) => {
    window.history.pushState(null, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

/** Gets a designer to its 3D stage the way a visitor does. */
async function enterDesigner(page, name) {
  await page.waitForTimeout(2500);
  if (name === "closet") {
    await page.waitForTimeout(2000);
    return inspect(page);
  }
  if (await page.locator('input[type="email"]').count()) {
    await page.fill('input[type="email"]', "designer-check@example.com").catch(() => {});
    await page.keyboard.press("Enter").catch(() => {});
    await page.waitForTimeout(3000);
  }
  // The catalog backend is not reachable here, so the only room a visitor can
  // start is the empty starter room; the 3D stage needs a room to exist.
  const starter = page.locator('button:has-text("Bathroom starter")').first();
  if (await starter.count()) {
    await starter.click().catch(() => {});
    await page.waitForTimeout(3000);
  }
  const before = await inspect(page);
  if (!before.paintedCanvas && !before.designerFallback) {
    const threeD = page.locator('button:has-text("3D"), [role="tab"]:has-text("3D")').first();
    if (await threeD.count()) {
      await threeD.click().catch(() => {});
      await page.waitForTimeout(4500);
    }
  }
  return inspect(page);
}

function usableFrom(info) {
  const fallback = info.designerFallback + info.closetFallback > 0;
  const stage = info.paintedCanvas;
  const whitePage = info.rootChildren === 0 || info.textLength < 60;
  return { fallback, stage, whitePage, usable: !whitePage && !info.errorBoundary && (stage || fallback) };
}

/**
 * Waits for the first scene build to finish: GPU allocations stop for 2 s. A
 * build loop never gets there, so not settling within 20 s is itself a failure.
 */
async function settle(page) {
  return page.evaluate(async () => {
    const started = performance.now();
    let last = window.__glProbe.snapshot();
    let quietSince = performance.now();
    while (performance.now() - started < 20_000) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      const next = window.__glProbe.snapshot();
      if (next.buffers !== last.buffers || next.textures !== last.textures || next.created !== last.created) quietSince = performance.now();
      last = next;
      if (performance.now() - quietSince >= 2000) return { settled: true, ms: Math.round(performance.now() - started) };
    }
    return { settled: false, ms: Math.round(performance.now() - started) };
  });
}

/** Idle window: nothing may be created on the GPU, and the main thread must not lock up. */
async function idleWindow(page, ms) {
  return page.evaluate(async (duration) => {
    const start = window.__glProbe.now();
    const before = window.__glProbe.snapshot();
    await new Promise((resolve) => setTimeout(resolve, duration));
    const after = window.__glProbe.snapshot();
    const tasks = window.__glProbe.longTasksSince(start);
    return {
      contextsCreated: after.created - before.created,
      buffersCreated: after.buffers - before.buffers,
      texturesCreated: after.textures - before.textures,
      programsCreated: after.programs - before.programs,
      longestTaskMs: Math.round(tasks.reduce((max, task) => Math.max(max, task.ms), 0)),
    };
  }, ms);
}

async function run(browserLabel, launchOptions) {
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(TRACKER);
    const page = await context.newPage();
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(String(error.message).slice(0, 200)));
    page.on("dialog", (dialog) => dialog.dismiss().catch(() => {}));

    const ua = await page.evaluate(() => navigator.userAgent);
    record(browserLabel, "all", "browser identifies as expected", browserLabel === "edge" ? ua.includes("Edg/") : !ua.includes("Edg/"), ua);

    // ── One document, switching between all three with in-app navigation ─────
    await page.goto(`${ORIGIN}/`, { waitUntil: "load" });
    await page.waitForTimeout(2500);
    const order = ["kitchen", "closet", "bathroom", "closet", "kitchen", "bathroom", "closet", "kitchen", "closet", "bathroom"];
    const visits = [];
    for (const [index, name] of order.entries()) {
      const entered = await page.evaluate(() => window.__glProbe.snapshot());
      await navigateInApp(page, DESIGNERS[name]);
      await enterDesigner(page, name);
      const settled = await settle(page);
      const info = await inspect(page);
      const view = usableFrom(info);
      const idle = await idleWindow(page, 3000);
      record(browserLabel, name, `visit ${index + 1}: scene finishes building and stops (no endless rebuild)`, settled.settled, `settled after ${settled.ms} ms; GPU buffers created on entry=${info.gl.buffers - entered.buffers}, shader programs=${info.gl.programs - entered.programs}`);
      const after = await page.evaluate(() => window.__glProbe.snapshot());
      visits.push({ visit: index + 1, designer: name, ...view, gl: after, idle });
      if (!visits.some((entry) => entry.designer === name && entry.visit < index + 1)) {
        await page.screenshot({ path: `${OUT_DIR}/interference-${browserLabel}-${name}.png` });
      }
      record(browserLabel, name, `visit ${index + 1}: no white page (3D stage or clear 2D fallback)`, view.usable,
        `stage=${view.stage} fallback=${view.fallback} rootChildren=${info.rootChildren} text=${info.textLength}`);
      record(browserLabel, name, `visit ${index + 1}: earlier designers' contexts released (no orphaned live context)`, after.orphaned === 0,
        `live=${after.live} onPage=${after.onPage} orphaned=${after.orphaned} created=${after.created} released=${after.released}`);
      record(browserLabel, name, `visit ${index + 1}: at most one live context (the visible designer's)`, after.live <= 1, `live=${after.live}`);
      record(browserLabel, name, `visit ${index + 1}: no rebuild or context loop while idle 3 s`,
        idle.contextsCreated === 0 && idle.buffersCreated === 0 && idle.texturesCreated === 0 && idle.programsCreated === 0,
        `contexts=${idle.contextsCreated} buffers=${idle.buffersCreated} textures=${idle.texturesCreated} programs=${idle.programsCreated}`);
      record(browserLabel, name, `visit ${index + 1}: no freeze while idle (no main-thread task over 1 s)`, idle.longestTaskMs < 1000,
        `longest task ${idle.longestTaskMs} ms`);
    }
    // Leaving the designers entirely must leave nothing behind.
    await navigateInApp(page, "/");
    await page.waitForTimeout(2500);
    const home = await page.evaluate(() => window.__glProbe.snapshot());
    record(browserLabel, "all", "after leaving every designer, zero live WebGL contexts", home.live === 0,
      `live=${home.live} created=${home.created} released=${home.released}`);
    record(browserLabel, "all", "every context created during the switching was released", home.created === home.released,
      `created=${home.created} released=${home.released}`);
    record(browserLabel, "all", "no uncaught page errors during switching", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | ") || "none");
    writeFileSync(`${OUT_DIR}/designer-interference-${browserLabel}-visits.json`, JSON.stringify(visits, null, 2));
    await context.close();

    // ── All three open at once in one browser session ────────────────────────
    const shared = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await shared.addInitScript(TRACKER);
    const tabs = {};
    const sharedErrors = [];
    for (const name of ["kitchen", "closet", "bathroom"]) {
      const tab = await shared.newPage();
      tab.on("pageerror", (error) => sharedErrors.push(`${name}: ${String(error.message).slice(0, 160)}`));
      await tab.goto(`${ORIGIN}${DESIGNERS[name]}`, { waitUntil: "load" });
      tabs[name] = tab;
      await enterDesigner(tab, name);
    }
    for (const [name, tab] of Object.entries(tabs)) {
      await tab.bringToFront();
      await settle(tab);
      const info = await inspect(tab);
      const view = usableFrom(info);
      const idle = await idleWindow(tab, 2500);
      record(browserLabel, name, "open alongside the other two designers: still usable", view.usable, `stage=${view.stage} fallback=${view.fallback}`);
      record(browserLabel, name, "open alongside the other two: one live context, no idle churn",
        info.gl.live <= 1 && idle.contextsCreated === 0 && idle.buffersCreated === 0 && idle.texturesCreated === 0,
        `live=${info.gl.live} idleContexts=${idle.contextsCreated} idleBuffers=${idle.buffersCreated} idleTextures=${idle.texturesCreated}`);
    }
    await tabs.closet.bringToFront();
    await tabs.closet.screenshot({ path: `${OUT_DIR}/interference-${browserLabel}-three-tabs-closet.png` });
    record(browserLabel, "all", "no uncaught page errors with all three open", sharedErrors.length === 0, sharedErrors.slice(0, 3).join(" | ") || "none");
    await shared.close();
  } finally {
    await browser.close().catch(() => {});
  }
}

const only = process.env.VERIFY_BROWSER;
if (!only || only === "chrome") await run("chrome", { channel: "chrome", headless: true });
if (!only || only === "edge") await run("edge", { headless: true, executablePath: CHROME_PATH, args: [`--user-agent=${EDGE_UA}`] });

const failures = results.filter((entry) => !entry.pass);
writeFileSync(`${OUT_DIR}/designer-interference.json`, JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2));
console.log(`\n${results.length - failures.length}/${results.length} checks passed.`);
if (failures.length) {
  console.log("Failures:");
  failures.forEach((entry) => console.log(` - [${entry.browser}][${entry.designer}] ${entry.check} (${entry.detail})`));
  process.exitCode = 1;
}
