import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Tom asked (Nov 2 2026) that each distributor/affiliate site keep its own
 * sign-in session. supabase.auth.signOut() with no options defaults to
 * scope 'global', which revokes every refresh token the user has and signs
 * them out of the main site, affiliate /store/:slug stores, admin, and the
 * contractor portal at once. Every call must pin scope: 'local'.
 *
 * This scans the real repository, so a new bare signOut() anywhere fails here.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SELF = "signOutScope.scan.test.ts";

const SCAN_ROOTS = ["client/src", "shared", "scripts", "e2e", "server"];
const SKIP_DIRS = new Set(["node_modules", "dist", "build", ".git", "test-artifacts", "coverage"]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

type SignOutCall = { file: string; line: number; args: string };

function sourceFiles(root: string): string[] {
  let entries: ReturnType<typeof readdirSync>;
  try {
    entries = readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const found: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".") continue;
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

/** Argument text between the parentheses of a call that starts at `open`. */
function callArguments(source: string, open: number): string {
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return source.slice(open + 1);
}

function lineOf(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

/**
 * Blank out comments while keeping every newline, so a note that mentions
 * `signOut()` is not mistaken for a call and reported line numbers stay true.
 */
function stripComments(source: string): string {
  let out = "";
  let index = 0;
  let quote: string | null = null;
  while (index < source.length) {
    const char = source[index];
    const next = source[index + 1];
    if (quote) {
      out += char;
      if (char === "\\") {
        out += next ?? "";
        index += 2;
        continue;
      }
      if (char === quote) quote = null;
      index += 1;
      continue;
    }
    if (char === "/" && (next === "/" || next === "*")) {
      const block = next === "*";
      const end = block ? "*/" : "\n";
      let cursor = index + 2;
      while (cursor < source.length && source.slice(cursor, cursor + end.length) !== end) {
        cursor += 1;
      }
      const stop = block ? Math.min(cursor + end.length, source.length) : cursor;
      out += source.slice(index, stop).replace(/[^\n]/g, " ");
      index = stop;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") quote = char;
    out += char;
    index += 1;
  }
  return out;
}

function findSignOutCalls(file: string, source: string): SignOutCall[] {
  const calls: SignOutCall[] = [];
  const pattern = /\bsignOut\s*\(/g;
  for (const match of source.matchAll(pattern)) {
    const start = match.index ?? 0;
    const open = start + match[0].length - 1;
    calls.push({ file, line: lineOf(source, start), args: callArguments(source, open) });
  }
  return calls;
}

const allFiles = SCAN_ROOTS.flatMap((root) => sourceFiles(path.join(repoRoot, root)));
const calls = allFiles.flatMap((file) => {
  const raw = readFileSync(file, "utf8");
  if (!raw.includes("signOut")) return [];
  return findSignOutCalls(path.relative(repoRoot, file), stripComments(raw));
});

const LOCAL_SCOPE = /scope\s*:\s*["'`]local["'`]/;
const NON_LOCAL_SCOPE = /scope\s*:\s*["'`](?:global|others)["'`]/;

function describeCall(call: SignOutCall): string {
  return `${call.file}:${call.line} signOut(${call.args.trim()})`;
}

describe("Supabase sign-out scope", () => {
  it("finds the sign-out call sites, so this scan cannot pass vacuously", () => {
    expect(allFiles.length).toBeGreaterThan(100);
    expect(calls.length).toBeGreaterThanOrEqual(2);
  });

  it("never calls signOut() with no arguments, which defaults to scope 'global'", () => {
    const bare = calls.filter((call) => call.args.trim() === "");
    expect(bare.map(describeCall)).toEqual([]);
  });

  it("passes scope 'local' to every signOut call in the repository", () => {
    const wrong = calls.filter((call) => !LOCAL_SCOPE.test(call.args));
    expect(wrong.map(describeCall)).toEqual([]);
  });

  it("never asks Supabase to revoke a global or other-device scope", () => {
    const global = calls.filter((call) => NON_LOCAL_SCOPE.test(call.args));
    expect(global.map(describeCall)).toEqual([]);
  });

  it("covers the logout hook and the sign-in page's stuck-session sign-out", () => {
    const files = new Set(calls.map((call) => call.file));
    expect(files).toContain(path.join("client", "src", "_core", "hooks", "useAuth.ts"));
    expect(files).toContain(path.join("client", "src", "pages", "SignIn.tsx"));
  });
});

describe("Sign-out stays this-browser-only", () => {
  const productionSources = allFiles
    .filter((file) => !file.includes(".test.") && !file.includes(".spec."))
    .map((file) => ({ file: path.relative(repoRoot, file), source: readFileSync(file, "utf8") }));

  it("does not wipe localStorage anywhere in shipped code", () => {
    const offenders = productionSources
      .filter(({ source }) => /localStorage\.clear\s*\(/.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("does not write a cookie document-wide while signing out", () => {
    const offenders = productionSources
      .filter(({ source }) => /document\.cookie\s*=/.test(source) && /signOut/.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });

  it("does not call the Supabase admin sign-out API from the client", () => {
    const offenders = productionSources
      .filter(({ source }) => /admin\.signOut|signOut\s*\(\s*[^)]*jwt/.test(source))
      .map(({ file }) => file);
    expect(offenders).toEqual([]);
  });
});
