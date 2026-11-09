import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execFileSync } from "node:child_process";
import { transformSync } from "esbuild";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";

// Writes /version.json into the build output so open tabs can tell a newer frontend
// has been deployed (see client/src/lib/versionWatcher.ts). The commit SHA of the
// host is the same for every region/instance of one deployment.
function buildVersionFile(): Plugin {
  const version =
    process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ||
    process.env.GIT_COMMIT_SHA?.slice(0, 12) ||
    String(Date.now());
  return {
    name: "build-version-file",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ version, timestamp: Date.now() }),
      });
    },
  };
}

const plugins = [react(), tailwindcss(), jsxLocPlugin(), buildVersionFile(), mainSnapshotPlugin()];

/**
 * Virtual modules that serve REAL `origin/main` source to the issue-353
 * before/after screenshot harness.
 *
 * The BEFORE column must run main's own code. A vendored copy committed to this
 * repository would be 17k lines of duplicate source that silently drifts from
 * main, so instead these virtual modules run `git show origin/main:<path>` when
 * the dev server resolves them. Nothing is written to the working tree, and the
 * before column is always literally main.
 *
 * Serve-only, allow-listed to the three geometry modules the harness needs, and
 * never reachable from the app: `apply: "serve"` means `vite build` cannot even
 * resolve these ids.
 */
const MAIN_SNAPSHOT_MODULES: Record<string, string> = {
  design: "client/src/lib/design.ts",
  freestandingRun: "client/src/lib/freestandingRun.ts",
  verticalFiller: "client/src/lib/verticalFiller.ts",
  exposedSidePanels: "client/src/lib/exposedSidePanels.ts",
};

const MAIN_SNAPSHOT_PREFIX = "virtual:issue353-main/";
const MAIN_SNAPSHOT_RESOLVED = "\0" + MAIN_SNAPSHOT_PREFIX;

function mainSnapshotPlugin(): Plugin {
  return {
    name: "issue353-main-snapshot",
    apply: "serve",
    enforce: "pre",
    resolveId(id) {
      if (!id.startsWith(MAIN_SNAPSHOT_PREFIX)) return null;
      if (!MAIN_SNAPSHOT_MODULES[id.slice(MAIN_SNAPSHOT_PREFIX.length).replace(/\.ts$/, "")]) return null;
      // Keep the `.ts` suffix on the resolved id: Vite picks the esbuild loader
      // from the extension, and main's source uses TypeScript type imports.
      return `${MAIN_SNAPSHOT_RESOLVED}${id.slice(MAIN_SNAPSHOT_PREFIX.length).replace(/\.ts$/, "")}.ts`;
    },
    load(id) {
      if (!id.startsWith(MAIN_SNAPSHOT_RESOLVED)) return null;
      const name = id.slice(MAIN_SNAPSHOT_RESOLVED.length).replace(/\.ts$/, "");
      const repoPath = MAIN_SNAPSHOT_MODULES[name];
      if (!repoPath) return null;
      let source: string;
      try {
        source = execFileSync("git", ["show", `origin/main:${repoPath}`], {
          cwd: import.meta.dirname,
          maxBuffer: 32 * 1024 * 1024,
          encoding: "utf8",
        });
      } catch (error) {
        throw new Error(`issue353 main snapshot: git show origin/main:${repoPath} failed (${(error as Error).message})`);
      }
      // Only sibling module imports are rewritten, so the snapshot resolves its
      // own chain (design -> freestandingRun, verticalFiller -> design) back
      // into these virtual modules. Every other import keeps its normal alias.
      const rewritten = source
        .replace(/from "@\/lib\/freestandingRun"/g, `from "${MAIN_SNAPSHOT_PREFIX}freestandingRun.ts"`)
        .replace(/from "\.\/freestandingRun"/g, `from "${MAIN_SNAPSHOT_PREFIX}freestandingRun.ts"`)
        .replace(/from "\.\/design"/g, `from "${MAIN_SNAPSHOT_PREFIX}design.ts"`)
        .replace(/from "@\/lib\/design"/g, `from "${MAIN_SNAPSHOT_PREFIX}design.ts"`);
      // A virtual module has no directory, so main's remaining `./sibling`
      // imports cannot resolve. The geometry modules above are already pinned
      // to main; every other sibling (autoEndPanels, cartTotals, ...) is a
      // branch helper that main also has at the same path, so it resolves
      // through the normal alias.
      const normalised = rewritten
        .replace(/from "\.\/([A-Za-z0-9_]+)"/g, 'from "@/lib/$1"')
        .replace(/import\("\.\/([A-Za-z0-9_]+)"\)/g, 'import("@/lib/$1")');
      // A virtual id carries no real file, so Vite cannot pick a loader from its
      // extension. Transpile main's TypeScript here with the same esbuild the
      // app builds with, and hand the pipeline plain ESM.
      const code = transformSync(`// origin/main:${repoPath}\n${normalised}`, {
        loader: "ts",
        format: "esm",
        target: "es2022",
        sourcefile: repoPath,
      }).code;
      return code;
    },
  };
}

export default defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Only libraries that do not import React. Putting React-based
        // packages (recharts, streamdown, jspdf wrappers) in a manual chunk
        // makes Rollup hoist React into that chunk and preload it on every
        // page. three / maplibre are pulled in only by the designer and maps.
        manualChunks(id) {
          const norm = id.replace(/\\/g, "/");
          if (!norm.includes("/node_modules/")) return;
          if (/\/node_modules\/(three|three-gpu-pathtracer|@react-three)\//.test(norm)) return "vendor-three";
          if (/\/node_modules\/maplibre-gl\//.test(norm)) return "vendor-map";
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: [
      "localhost",
      "127.0.0.1",
    ],
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
