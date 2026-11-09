/**
 * Vite config used ONLY by the issue-353 before/after screenshot harnesses.
 *
 * It is `vite.config.ts` plus `issue353MainSnapshotPlugin()`, which serves real
 * `origin/main` geometry as virtual modules so the BEFORE column of those
 * screenshots runs main's own code instead of a copy vendored into this repo.
 *
 * Nothing else loads this file, so a normal `vite dev`, a Vercel build and
 * `vite build` never register that plugin:
 *
 *   pnpm issue353:shots         # dev server for the screenshot harness pages
 *   npx playwright test -c playwright.issue353.config.ts
 */
import baseConfig from "./vite.config";
import { issue353MainSnapshotPlugin, issue353RepoRoot } from "./plugins/issue353MainSnapshot";
import { defineConfig } from "vite";

export default defineConfig(async (env) => {
  const base = typeof baseConfig === "function" ? await baseConfig(env) : baseConfig;
  return {
    ...base,
    plugins: [...(base.plugins ?? []), issue353MainSnapshotPlugin({ cwd: issue353RepoRoot })],
  };
});
