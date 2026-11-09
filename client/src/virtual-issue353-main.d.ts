/**
 * Ambient declarations for the dev-only `virtual:issue353-main/*` modules that
 * vite.config.ts serves from `git show origin/main:<path>`.
 *
 * They exist so the issue-353 screenshot harnesses type-check. The Vite plugin
 * is `apply: "serve"`, so `vite build` never resolves these ids and the app
 * bundle never contains them.
 */
declare module "virtual:issue353-main/design.ts" {
  export * from "@/lib/design";
}

declare module "virtual:issue353-main/exposedSidePanels.ts" {
  export * from "@/lib/exposedSidePanels";
}

declare module "virtual:issue353-main/verticalFiller.ts" {
  export * from "@/lib/verticalFiller";
}
