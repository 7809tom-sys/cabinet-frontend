/**
 * WebGL context budget check for the 3D designers.
 *
 * Chrome lets one page hold 16 live WebGL contexts; the 17th silently evicts the
 * oldest, which is usually the 3D view the customer is looking at. This check
 * drives the real app in headless Chrome (and the same binary with Edge's user
 * agent) and fails on anything that would eat that budget or leave the customer
 * without a 3D view:
 *
 *   1. Plan <-> 3D, 30 times: the 3D view mounts and unmounts each time.
 *   2. Kitchen / bathroom / closet designers, 30 in-app navigations.
 *   3. GPU resets (Linux only: the browser's GPU process is killed, which is
 *      what a driver reset or a crash does). Chrome blocks WebGL for a whole
 *      site once a second reset hits while the site holds a live context, and
 *      only a reload the customer starts from the browser lifts that. Each run
 *      takes one reset with 3D on screen, then a second one either while the
 *      customer works in the 2D plan or while the tab is hidden, and requires
 *      the 3D view to come back with no notice. Headless Chrome never hides a
 *      page, so "hidden" is announced to the page with the visibilitychange
 *      event the browser fires; the reset and Chrome's response are real.
 *
 * At every step it records live contexts, contexts lost without the app asking
 * (Chrome evictions or GPU resets), renderer construction errors, Chrome's
 * "Too many active WebGL contexts" warning, and whether the 3D stage painted or
 * a "3D unavailable" notice showed instead.
 *
 *   npx vite --port 5199 --strictPort
 *   node scripts/verify-3d-context-budget.mjs
 *
 * VERIFY_BROWSER=chrome|edge limits the run; VERIFY_CYCLES changes 30.
 */
import { chromium } from "@playwright/test";
import { execSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const ORIGIN = process.env.VERIFY_ORIGIN ?? "http://127.0.0.1:5199";
const OUT_DIR = process.env.VERIFY_OUT ?? "/opt/cursor/artifacts";
const CYCLES = Number(process.env.VERIFY_CYCLES ?? 30);
const LABEL = process.env.VERIFY_LABEL ?? "branch";
const EDGE_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36 Edg/141.0.0.0";
/** The app may hold the visible view plus a small reuse pool; anything near 16 is a leak. */
const LIVE_BUDGET = 4;

mkdirSync(OUT_DIR, { recursive: true });

const TRACKER = () => {
  const live = new Map();
  const stats = { created: 0, releasedByApp: 0, lostUnasked: 0, nullContexts: 0 };
  const asked = new WeakSet();
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function getContext(name, ...rest) {
    const context = original.call(this, name, ...rest);
    if (typeof name === "string" && /webgl/i.test(name)) {
      if (!context) stats.nullContexts += 1;
      else if (!live.has(context)) {
        live.set(context, this);
        stats.created += 1;
        const extension = context.getExtension("WEBGL_lose_context");
        if (extension) {
          const lose = extension.loseContext.bind(extension);
          extension.loseContext = () => { asked.add(context); lose(); };
        }
        this.addEventListener("webglcontextlost", () => {
          if (!live.delete(context)) return;
          if (asked.has(context)) stats.releasedByApp += 1;
          else stats.lostUnasked += 1;
        });
        // Chrome brings back a context lost to a GPU reset; it holds a slot again.
        this.addEventListener("webglcontextrestored", () => {
          asked.delete(context);
          live.set(context, this);
        });
      }
    }
    return context;
  };
  window.__ctx = () => ({
    ...stats,
    live: live.size,
    orphaned: Array.from(live.values()).filter((canvas) => !canvas.isConnected).length,
  });
};

const results = [];
function record(browser, scenario, check, pass, detail) {
  results.push({ browser, scenario, check, pass, detail });
  console.log(`[${browser}][${scenario}] ${pass ? "PASS" : "FAIL"} ${check}${detail ? ` — ${detail}` : ""}`);
}

async function stage(page) {
  return page.evaluate(() => {
    const canvases = Array.from(document.querySelectorAll("canvas")).filter((canvas) => canvas.isConnected && canvas.getBoundingClientRect().width > 100);
    const notice = document.querySelector('[data-testid="webgl-unavailable"], [data-testid="vendor-closet-webgl-unavailable"]');
    const starting = document.querySelector('[data-testid="webgl-starting"], [data-testid="webgl-context-lost"], [data-testid="vendor-closet-webgl-starting"]');
    const text = (document.body.innerText || "").replace(/\s+/g, " ");
    return {
      painted: !starting && canvases.some((canvas) => canvas.width > 1 && canvas.height > 1),
      notice: notice ? (notice.textContent || "").trim().slice(0, 160) : null,
      blank: (document.getElementById("root")?.childElementCount ?? 0) === 0 || text.trim().length < 60,
      ctx: window.__ctx(),
    };
  });
}

/** Waits until the stage paints or a notice shows; a notice must survive the app's own silent retries. */
async function waitForStage(page, timeoutMs = 20000) {
  const started = Date.now();
  let last = await stage(page);
  while (Date.now() - started < timeoutMs) {
    if (last.painted && !last.notice) return last;
    await page.waitForTimeout(400);
    last = await stage(page);
  }
  return last;
}

const VIEW_BUTTONS = { "3D": ["3D View", "3D"], Plan: ["Floor Plan", "Plan"] };

async function clickExact(page, view) {
  for (const name of VIEW_BUTTONS[view]) {
    const button = page.getByRole("button", { name, exact: true }).first();
    if (await button.count()) {
      await button.click({ timeout: 5000 }).catch(() => {});
      return true;
    }
  }
  return false;
}

async function navigateInApp(page, path) {
  await page.evaluate((target) => {
    window.history.pushState(null, "", target);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, path);
}

/** A cold dev server can take many seconds to serve the designer; wait for its gate or its view switch. */
async function waitForDesigner(page) {
  const ready = ['input[type="email"]', ...VIEW_BUTTONS["3D"].map((name) => `button:text-is("${name}")`)].join(", ");
  await page.locator(ready).first().waitFor({ state: "visible", timeout: 60_000 }).catch(() => {});
}

async function openDesigner3D(page, closet) {
  await page.waitForTimeout(1500);
  if (closet) return waitForStage(page);
  await waitForDesigner(page);
  if (await page.locator('input[type="email"]').count()) {
    await page.fill('input[type="email"]', "designer-check@example.com").catch(() => {});
    await page.keyboard.press("Enter").catch(() => {});
    await page.waitForTimeout(2500);
  }
  const starter = page.locator('button:has-text("Bathroom starter")').first();
  if (await starter.count()) {
    await starter.click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  const now = await stage(page);
  if (!now.painted) await clickExact(page, "3D");
  const shown = await waitForStage(page);
  if (shown.painted || shown.notice) return shown;
  // A cold dev-server load can swallow the first click.
  await clickExact(page, "3D");
  return waitForStage(page);
}

async function run(browserLabel, launchOptions) {
  const browser = await chromium.launch(launchOptions);
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(TRACKER);
    const page = await context.newPage();
    const errors = [];
    const tooMany = [];
    const rendererErrors = [];
    page.on("pageerror", (error) => errors.push(String(error.message).slice(0, 200)));
    page.on("console", (message) => {
      const text = message.text();
      if (/Too many active WebGL contexts/i.test(text)) tooMany.push(text);
      if (/WebGLRenderer|WebGL could not start|Error creating WebGL context/i.test(text) && message.type() !== "log") rendererErrors.push(text.slice(0, 200));
    });

    // ── 1. Plan <-> 3D, mounting and unmounting the 3D view each time ─────────
    await page.goto(`${ORIGIN}/design`, { waitUntil: "load" });
    let view = await openDesigner3D(page, false);
    record(browserLabel, "plan-3d", "3D view paints on first open", view.painted && !view.notice, `notice=${view.notice ?? "none"}`);
    let peakLive = view.ctx.live;
    let failures = [];
    for (let cycle = 1; cycle <= CYCLES; cycle += 1) {
      await clickExact(page, "Plan");
      await page.waitForTimeout(600);
      const planned = await stage(page);
      peakLive = Math.max(peakLive, planned.ctx.live);
      await clickExact(page, "3D");
      view = await waitForStage(page);
      peakLive = Math.max(peakLive, view.ctx.live);
      if (!view.painted || view.notice || view.blank) failures.push({ cycle, notice: view.notice, painted: view.painted, blank: view.blank });
    }
    const afterToggles = await stage(page);
    record(browserLabel, "plan-3d", `3D renders on every one of ${CYCLES} Plan->3D mounts`, failures.length === 0, failures.length ? JSON.stringify(failures.slice(0, 3)) : "all painted");
    record(browserLabel, "plan-3d", `live WebGL contexts stay within ${LIVE_BUDGET}`, peakLive <= LIVE_BUDGET, `peak live=${peakLive}`);
    record(browserLabel, "plan-3d", "no context lost without the app asking (no eviction, no reset)", afterToggles.ctx.lostUnasked === 0, `lostUnasked=${afterToggles.ctx.lostUnasked} created=${afterToggles.ctx.created} released=${afterToggles.ctx.releasedByApp}`);
    await page.screenshot({ path: `${OUT_DIR}/context-budget-${LABEL}-${browserLabel}-plan-3d.png` });

    // ── 2. Navigating between the three designers in one document ────────────
    const designers = [["kitchen", "/design", false], ["closet", "/closet?demo=mixed", true], ["bathroom", "/design?room=bathroom", false]];
    failures = [];
    let navPeak = 0;
    for (let step = 1; step <= CYCLES; step += 1) {
      const [name, path, closet] = designers[(step - 1) % designers.length];
      await navigateInApp(page, path);
      const shown = await openDesigner3D(page, closet);
      navPeak = Math.max(navPeak, shown.ctx.live);
      if (!shown.painted || shown.notice || shown.blank) failures.push({ step, name, notice: shown.notice, painted: shown.painted, blank: shown.blank });
      if (step <= 3) await page.screenshot({ path: `${OUT_DIR}/context-budget-${LABEL}-${browserLabel}-${name}.png` });
    }
    const afterNav = await stage(page);
    record(browserLabel, "navigation", `every designer renders across ${CYCLES} in-app navigations`, failures.length === 0, failures.length ? JSON.stringify(failures.slice(0, 3)) : "all painted");
    record(browserLabel, "navigation", `live WebGL contexts stay within ${LIVE_BUDGET}`, navPeak <= LIVE_BUDGET, `peak live=${navPeak}`);
    record(browserLabel, "navigation", "no context lost without the app asking", afterNav.ctx.lostUnasked === 0, `lostUnasked=${afterNav.ctx.lostUnasked} created=${afterNav.ctx.created} released=${afterNav.ctx.releasedByApp}`);
    record(browserLabel, "navigation", "no orphaned live context (alive after its canvas left the page)", afterNav.ctx.orphaned <= LIVE_BUDGET - 1, `orphaned=${afterNav.ctx.orphaned} (reuse pool may hold parked canvases)`);

    // ── Whole run ────────────────────────────────────────────────────────────
    record(browserLabel, "all", "Chrome never warned 'Too many active WebGL contexts'", tooMany.length === 0, `${tooMany.length} warnings`);
    record(browserLabel, "all", "no WebGL renderer construction errors", rendererErrors.length === 0, rendererErrors.slice(0, 2).join(" | ") || "none");
    record(browserLabel, "all", "no uncaught page errors", errors.length === 0, errors.slice(0, 2).join(" | ") || "none");
    record(browserLabel, "all", "browser refused no context (getContext never returned null)", afterNav.ctx.nullContexts === 0, `null contexts=${afterNav.ctx.nullContexts}`);
    await context.close();
  } finally {
    await browser.close().catch(() => {});
  }
}

/** Kills this browser's GPU process; Chrome restarts it, as after a driver reset. */
function resetGpu(mark) {
  const root = execSync(`pgrep -f -- "${mark}" | head -1`).toString().trim();
  const dir = execSync(`tr '\\0' '\\n' < /proc/${root}/cmdline | grep -- --user-data-dir`).toString().trim();
  const gpu = execSync(`pgrep -f -- "type=gpu-process.*${dir}" || true`).toString().trim().split("\n")[0];
  if (!gpu) return false;
  execSync(`kill -9 ${gpu}`);
  return true;
}

async function gpuResetRun(browserLabel, launchOptions, secondResetWhile) {
  const mark = `--verify-mark-${process.pid}-${browserLabel}-${secondResetWhile}`;
  const browser = await chromium.launch({ ...launchOptions, args: [...(launchOptions.args ?? []), mark] });
  const scenario = `gpu-reset-${secondResetWhile}`;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await context.addInitScript(TRACKER);
    const page = await context.newPage();
    const blockedMessages = [];
    page.on("console", (message) => { if (/was blocked/i.test(message.text())) blockedMessages.push(message.text()); });
    await page.goto(`${ORIGIN}/design`, { waitUntil: "load" });
    let view = await openDesigner3D(page, false);
    if (!view.painted) return record(browserLabel, scenario, "3D view paints before any reset", false, `notice=${view.notice ?? "none"}`);
    if (!resetGpu(mark)) return record(browserLabel, scenario, "GPU process found to reset", false, "no GPU process (not Linux headless Chrome?)");
    await page.waitForTimeout(1500);
    view = await waitForStage(page);
    record(browserLabel, scenario, "3D comes back by itself after a GPU reset with 3D on screen", view.painted && !view.notice, `notice=${view.notice ?? "none"}`);

    let liveAtReset;
    if (secondResetWhile === "plan") {
      await clickExact(page, "Plan");
      // Long enough for the 3D view's renderer to leave the reuse pool.
      await page.waitForTimeout(17_000);
      liveAtReset = (await stage(page)).ctx.live;
      resetGpu(mark);
      await page.waitForTimeout(1500);
      await clickExact(page, "3D");
    } else {
      await page.evaluate(() => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await page.waitForTimeout(1000);
      liveAtReset = (await stage(page)).ctx.live;
      resetGpu(mark);
      await page.waitForTimeout(3000);
      await page.evaluate(() => {
        delete document.visibilityState;
        delete document.hidden;
        document.dispatchEvent(new Event("visibilitychange"));
      });
    }
    record(browserLabel, scenario, "the site held no live WebGL context when the second reset hit", liveAtReset === 0, `live contexts at reset=${liveAtReset}`);
    view = await waitForStage(page, 25_000);
    record(browserLabel, scenario, `3D renders after a second GPU reset while ${secondResetWhile === "plan" ? "the customer is in the 2D plan" : "the tab is hidden"}`, view.painted && !view.notice, `notice=${view.notice ?? "none"}`);
    record(browserLabel, scenario, "Chrome never blocked WebGL for the site", blockedMessages.length === 0, `${blockedMessages.length} "blocked" messages`);
    await page.screenshot({ path: `${OUT_DIR}/context-budget-${LABEL}-${browserLabel}-${scenario}.png` });
    await context.close();
  } finally {
    await browser.close().catch(() => {});
  }
}

const only = process.env.VERIFY_BROWSER;
const scenarios = (process.env.VERIFY_SCENARIOS ?? "budget,gpu-reset").split(",");
const browsers = [["chrome", { channel: "chrome", headless: true }], ["edge", { channel: "chrome", headless: true, args: [`--user-agent=${EDGE_UA}`] }]];
for (const [label, options] of browsers) {
  if (only && only !== label) continue;
  if (scenarios.includes("budget")) await run(label, options);
  if (scenarios.includes("gpu-reset")) {
    await gpuResetRun(label, options, "plan");
    await gpuResetRun(label, options, "hidden");
  }
}

const failed = results.filter((entry) => !entry.pass);
writeFileSync(`${OUT_DIR}/context-budget-${LABEL}.json`, JSON.stringify({ ranAt: new Date().toISOString(), cycles: CYCLES, results }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length) process.exitCode = 1;
