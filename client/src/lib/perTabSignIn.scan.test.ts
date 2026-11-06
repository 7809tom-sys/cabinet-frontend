import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Guards the per-tab sign-in fix so a later change cannot quietly hand the
 * session back to a store every tab of the origin can read.
 *
 * Tom reported that signing in on one tab changed every other tab: a new tab
 * opened under the 'firstclassfcd' affiliate account instead of his admin
 * session. The cause was supabase-js's default auth store — localStorage under
 * `sb-<project-ref>-auth-token` — which one origin shares between all of its
 * tabs. These assertions scan the real repository.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SELF = "perTabSignIn.scan.test.ts";

const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "test-artifacts", "coverage"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

function sourceFiles(root: string): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      found.push(...sourceFiles(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) continue;
    if (entry.name === SELF) continue;
    found.push(full);
  }
  return found;
}

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}

const clientFiles = sourceFiles(path.join(repoRoot, "client", "src"));
const read = (file: string) => readFileSync(file, "utf8");
const relative = (file: string) => path.relative(repoRoot, file);

const supabaseClientFile = path.join(repoRoot, "client", "src", "lib", "supabase.ts");
const supabaseClientSource = stripComments(read(supabaseClientFile));

describe("Supabase client is configured per tab", () => {
  it("finds the Supabase client, so this scan cannot pass vacuously", () => {
    expect(clientFiles.length).toBeGreaterThan(100);
    expect(read(supabaseClientFile)).toContain("createClient(");
  });

  it("stores the auth session in this tab's sessionStorage, not shared localStorage", () => {
    expect(supabaseClientSource).toContain("storage: createPerTabAuthStorage()");
    expect(supabaseClientSource).not.toMatch(/storage:\s*(window\.)?localStorage/);
  });

  it("passes an explicit, app-owned storageKey", () => {
    expect(supabaseClientSource).toMatch(/storageKey:\s*AUTH_STORAGE_KEY/);
  });

  it("closes the cross-tab BroadcastChannel supabase-js opens on the storage key", () => {
    expect(supabaseClientSource).toContain("detachCrossTabAuthBroadcast(supabase)");
  });

  it("drops the refresh token the old shared store left in localStorage", () => {
    expect(supabaseClientSource).toContain("removeLegacySharedAuthSession(");
  });
});

describe("No shipped code reads a shared sign-in identity", () => {
  const productionSources = clientFiles
    .filter((file) => !file.includes(".test.") && !file.includes(".spec."))
    .map((file) => ({ file: relative(file), source: stripComments(read(file)) }));

  it("no auth key is written to localStorage", () => {
    const offenders = productionSources
      .filter(({ source }) =>
        /localStorage\.(?:setItem|getItem)\s*\(/.test(source) &&
        /auth[-_]token|supabase|access_token|refresh_token/i.test(source),
      )
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("no component subscribes to another tab's storage events for auth", () => {
    const offenders = productionSources
      .filter(({ source }) =>
        /addEventListener\(\s*["']storage["']/.test(source) &&
        /auth|session|token/i.test(source),
      )
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("no component opens its own BroadcastChannel to relay a session", () => {
    const offenders = productionSources
      .filter(({ source }) => /new\s+BroadcastChannel\s*\(/.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("defines the shared test-account token key in exactly one place", () => {
    const offenders = productionSources
      .filter(({ source }) => source.includes("cd.testAccountToken"))
      .map(({ file }) => file.split(path.sep).join("/"));
    expect(offenders).toEqual(["client/src/lib/trpcAuthFetch.ts"]);
  });
});
