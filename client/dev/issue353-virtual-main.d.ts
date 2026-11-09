/**
 * Ambient declarations for the dev-only `virtual:issue353-main/*` modules served
 * by `plugins/issue353MainSnapshot.ts`.
 *
 * They sit here, beside the harness pages, because they exist only for the
 * issue-353 screenshot harnesses' type-check — not for the app. The plugin is
 * registered only by `vite.issue353-shots.config.ts`, so `vite build`, a normal
 * `vite dev` and Vercel never resolve these ids.
 *
 * `tsconfig.json` includes `client/src/**\/*`, so this file is picked up through
 * the harnesses' own directory and stays out of the app bundle.
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
