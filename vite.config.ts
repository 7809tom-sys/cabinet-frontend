import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
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

const plugins = [react(), tailwindcss(), jsxLocPlugin(), buildVersionFile()];

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
