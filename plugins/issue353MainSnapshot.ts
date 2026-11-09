/**
 * Dev-only Vite plugin for the issue-353 before/after screenshots.
 *
 * The BEFORE column of those screenshots must run REAL `origin/main` code.
 * A vendored copy committed to this repository would be tens of thousands of
 * duplicate lines that silently drifts from main, so these virtual modules run
 * `git show origin/main:<path>` when the dev server resolves them. Nothing is
 * written to the working tree, and the before column is always literally main.
 *
 * This module is deliberately NOT imported by `vite.config.ts`. Only
 * `vite.issue353-shots.config.ts`, which the screenshot scripts and
 * `playwright.issue353.config.ts` load, registers it, so a normal `vite dev`,
 * a Vercel build and `vite build` never see these ids.
 *
 * The exported VIRTUAL module ids are mirrored by
 * `client/dev/issue353-virtual-main.d.ts` for the harnesses' type-check.
 */
import { execFileSync } from "node:child_process";
import path from "node:path";
import { transformSync } from "esbuild";
import type { Plugin } from "vite";

/** Virtual id prefix every harness imports. */
export const ISSUE353_MAIN_PREFIX = "virtual:issue353-main/";

/** The only modules this plugin will serve, mapped to their repository paths. */
export const ISSUE353_MAIN_MODULES: Record<string, string> = {
  design: "client/src/lib/design.ts",
  freestandingRun: "client/src/lib/freestandingRun.ts",
  verticalFiller: "client/src/lib/verticalFiller.ts",
  exposedSidePanels: "client/src/lib/exposedSidePanels.ts",
};

const RESOLVED_PREFIX = "\0" + ISSUE353_MAIN_PREFIX;

/**
 * Serve `origin/main`'s source for the allow-listed geometry modules as virtual
 * ESM modules. The ref is a parameter so a caller can pin a different baseline
 * (the default is the repository's `origin/main`).
 */
export function issue353MainSnapshotPlugin(options: { ref?: string; cwd?: string } = {}): Plugin {
  const ref = options.ref ?? "origin/main";
  const cwd = options.cwd ?? process.cwd();
  return {
    name: "issue353-main-snapshot",
    apply: "serve",
    enforce: "pre",
    resolveId(id) {
      if (!id.startsWith(ISSUE353_MAIN_PREFIX)) return null;
      const name = id.slice(ISSUE353_MAIN_PREFIX.length).replace(/\.ts$/, "");
      if (!ISSUE353_MAIN_MODULES[name]) return null;
      // Keep the `.ts` suffix: Vite picks the esbuild loader from the extension,
      // and main's source uses TypeScript type imports.
      return `${RESOLVED_PREFIX}${name}.ts`;
    },
    load(id) {
      if (!id.startsWith(RESOLVED_PREFIX)) return null;
      const name = id.slice(RESOLVED_PREFIX.length).replace(/\.ts$/, "");
      const repoPath = ISSUE353_MAIN_MODULES[name];
      if (!repoPath) return null;
      let source: string;
      try {
        source = execFileSync("git", ["show", `${ref}:${repoPath}`], {
          cwd,
          maxBuffer: 32 * 1024 * 1024,
          encoding: "utf8",
        });
      } catch (error) {
        throw new Error(`issue353 main snapshot: git show ${ref}:${repoPath} failed (${(error as Error).message})`);
      }
      // Pin the geometry modules to main so the snapshot resolves its own chain
      // (design -> freestandingRun, verticalFiller -> design), then send every
      // other sibling import through the normal `@/lib` alias. Those siblings
      // are branch helpers that main also has at the same path, so they resolve
      // identically and never change the geometry under test.
      const pinned = source
        .replace(/from "@\/lib\/freestandingRun"/g, `from "${ISSUE353_MAIN_PREFIX}freestandingRun.ts"`)
        .replace(/from "\.\/freestandingRun"/g, `from "${ISSUE353_MAIN_PREFIX}freestandingRun.ts"`)
        .replace(/from "\.\/design"/g, `from "${ISSUE353_MAIN_PREFIX}design.ts"`)
        .replace(/from "@\/lib\/design"/g, `from "${ISSUE353_MAIN_PREFIX}design.ts"`);
      const normalised = pinned
        .replace(/from "\.\/([A-Za-z0-9_]+)"/g, 'from "@/lib/$1"')
        .replace(/import\("\.\/([A-Za-z0-9_]+)"\)/g, 'import("@/lib/$1")');
      // A virtual id carries no real file, so Vite cannot pick a loader from its
      // extension. Transpile main's TypeScript here with the same esbuild the
      // app builds with, and hand the pipeline plain ESM.
      return transformSync(`// ${ref}:${repoPath}\n${normalised}`, {
        loader: "ts",
        format: "esm",
        target: "es2022",
        sourcefile: repoPath,
      }).code;
    },
  };
}

/** Absolute repository root, so `git show` runs in the right checkout. */
export const issue353RepoRoot = path.resolve(import.meta.dirname, "..");
