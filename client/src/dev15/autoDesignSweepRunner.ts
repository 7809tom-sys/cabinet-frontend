/**
 * Auto Design sweep runner.
 *
 * Picks a random sample of cabinet lines, builds each one on a synthetic
 * L-shape, U-shape and galley through the real `runAutoDesignLayout`, and
 * prints one row per design with the sweep-check codes (or "clean").
 *
 * Catalog fetching goes through `loadLinePools(styleId)` so a test can point
 * the same runner at fixtures. The live default talks to the public designer
 * tRPC endpoints (no auth), same queries DesignTool uses:
 * `doorStyles.list`, `design.placeableCabinets`, `design.surroundForFridge`.
 *
 * From the repo root:
 *   npx tsx client/src/dev15/autoDesignSweepRunner.ts
 *   npx tsx client/src/dev15/autoDesignSweepRunner.ts --seed 81120
 *
 * Env:
 *   CABINETDEALZ_API_BASE  API origin (default https://www.cabinetdealz.com)
 *   SWEEP_SEED             Repeat a run (overridden by --seed)
 *   SWEEP_SAMPLE_SIZE      How many lines to sample (default 8)
 */
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { mergeAutoDesignRefrigeratorCaps, runAutoDesignLayout } from "../lib/autoDesignLayout";
import { emptyAutoDesignIntake } from "../lib/autoDesignFifteenRules";
import { sweepFindings } from "../lib/autoDesignSweepChecks";
import type { AutoDesignInputs, AutoDesignLayoutType } from "../lib/autoDesignAutoBuild";
import {
  applianceAsDesignCabinet,
  appliancesForRoom,
  type DesignCabinet,
  type RoomData,
} from "../lib/design";

const DEFAULT_API_BASE = "https://www.cabinetdealz.com";
const LAYOUT_TYPES: AutoDesignLayoutType[] = ["l-shape", "u-shape", "galley"];
const DEFAULT_SAMPLE_SIZE = 8;

export type SweepStyle = {
  id: number;
  ourName: string;
};

export type LinePools = {
  styleId: number;
  baseCatalog: DesignCabinet[];
  wallCatalog: DesignCabinet[];
  fillers: DesignCabinet[];
  tallCatalog: DesignCabinet[];
  appliancePalette: DesignCabinet[];
  refrigeratorCaps: DesignCabinet[];
  refrigeratorEndPanels: DesignCabinet[];
  panelCatalog: DesignCabinet[];
};

export type CatalogApi = {
  baseUrl: string;
  listStyles(): Promise<SweepStyle[]>;
  placeableCabinets(styleId: number, placement: "base" | "wall" | "accessory" | "tall"): Promise<DesignCabinet[]>;
  surroundForFridge(styleId: number): Promise<{
    deepAbove?: DesignCabinet[];
    endPanels?: DesignCabinet[];
    smoothPanels?: DesignCabinet[];
  }>;
};

type TrpcResult<T> = {
  result?: { data?: { json?: T } };
  error?: { json?: { message?: string; data?: { httpStatus?: number } } };
};

function apiBaseUrl(): string {
  const raw = (process.env.CABINETDEALZ_API_BASE ?? "").trim().replace(/\/+$/, "");
  return raw || DEFAULT_API_BASE;
}

async function trpcQuery<T>(baseUrl: string, path: string, input?: unknown): Promise<T> {
  const url = new URL(`/api/trpc/${path}`, `${baseUrl}/`);
  if (input !== undefined) url.searchParams.set("input", JSON.stringify({ json: input }));
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const text = await response.text();
  let body: TrpcResult<T>;
  try {
    body = JSON.parse(text) as TrpcResult<T>;
  } catch {
    throw new Error(`${path} returned ${response.status} ${response.statusText} (not JSON)`);
  }
  if (body.error?.json) {
    const message = body.error.json.message ?? `${path} failed`;
    const status = body.error.json.data?.httpStatus ?? response.status;
    throw new Error(`${path}: ${message} (HTTP ${status})`);
  }
  if (!response.ok) throw new Error(`${path} returned HTTP ${response.status}`);
  if (body.result?.data && "json" in body.result.data) return body.result.data.json as T;
  throw new Error(`${path} returned an unexpected tRPC payload`);
}

function asCabinets(rows: unknown): DesignCabinet[] {
  return Array.isArray(rows) ? (rows as DesignCabinet[]) : [];
}

function styleName(row: { ourName?: string | null; aliasName?: string | null; id: number }): string {
  return (row.ourName ?? "").trim() || (row.aliasName ?? "").trim() || `Style ${row.id}`;
}

function kitchenAppliancePalette(): DesignCabinet[] {
  return appliancesForRoom("kitchen").map(applianceAsDesignCabinet);
}

export function createLiveCatalogApi(baseUrl = apiBaseUrl()): CatalogApi {
  return {
    baseUrl,
    async listStyles() {
      const rows = await trpcQuery<Array<{ id: number; ourName?: string | null; aliasName?: string | null; isActive?: boolean | null; isPreview?: boolean | null }>>(
        baseUrl,
        "doorStyles.list",
      );
      return rows
        .filter((row) => row.isActive !== false && row.isPreview !== true)
        .map((row) => ({ id: row.id, ourName: styleName(row) }));
    },
    async placeableCabinets(styleId, placement) {
      const rows = await trpcQuery<unknown>(baseUrl, "design.placeableCabinets", { placement, styleId });
      return asCabinets(rows);
    },
    async surroundForFridge(styleId) {
      const rows = await trpcQuery<{
        deepAbove?: DesignCabinet[];
        endPanels?: DesignCabinet[];
        smoothPanels?: DesignCabinet[];
      }>(baseUrl, "design.surroundForFridge", { styleId });
      return rows ?? {};
    },
  };
}

let catalogApi: CatalogApi = createLiveCatalogApi();

/** Point `loadLinePools` (and style listing) at fixtures or another host. */
export function setCatalogApi(api: CatalogApi): void {
  catalogApi = api;
}

/**
 * Load the Auto Design pools for one door-style line. The live implementation
 * uses the same public `placeableCabinets` / `surroundForFridge` queries as the
 * designer. Swap the catalog through `setCatalogApi` to run against fixtures.
 */
export async function loadLinePools(styleId: number): Promise<LinePools> {
  const [baseCatalog, wallCatalog, fillers, tallCatalog, surround] = await Promise.all([
    catalogApi.placeableCabinets(styleId, "base"),
    catalogApi.placeableCabinets(styleId, "wall"),
    catalogApi.placeableCabinets(styleId, "accessory"),
    catalogApi.placeableCabinets(styleId, "tall"),
    catalogApi.surroundForFridge(styleId),
  ]);
  const endPanels = surround.endPanels ?? [];
  const smoothPanels = surround.smoothPanels ?? [];
  return {
    styleId,
    baseCatalog,
    wallCatalog,
    fillers,
    tallCatalog,
    appliancePalette: kitchenAppliancePalette(),
    refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(wallCatalog, surround.deepAbove ?? []),
    refrigeratorEndPanels: endPanels,
    panelCatalog: [...fillers, ...endPanels, ...smoothPanels],
  };
}

export function loadStyles(): Promise<SweepStyle[]> {
  return catalogApi.listStyles();
}

/** Mulberry32 — same generator the Auto Design matrix tests use. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSample<T>(items: readonly T[], count: number, rand: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, Math.max(0, Math.min(count, copy.length)));
}

export function syntheticRoom(_layoutType: AutoDesignLayoutType): RoomData {
  // A standard 12 ft x 10 ft box is enough for L, U and galley runs. The
  // layout type decides which walls get cabinets, not the room polygon.
  return { width: 144, depth: 120, ceilingHeight: 96 };
}

export function sweepInput(layoutType: AutoDesignLayoutType): AutoDesignInputs {
  const galley = layoutType === "galley";
  const lShape = layoutType === "l-shape";
  return {
    layoutType,
    originCorner: "left",
    runDirection: "right",
    wallCabinetHeightIn: 30,
    // L: sink on the side leg, range and fridge on the long run.
    // U: one appliance per run. Galley: fridge + range on Wall 1, sink on Wall 3.
    sink: { wallLabel: lShape ? "Wall 2" : "Wall 3", centerOffsetIn: lShape ? 66 : 72 },
    sinkBaseWidthIn: 36,
    sinkBaseKind: "regular",
    stove: { wallLabel: galley || lShape ? "Wall 1" : "Wall 2", centerOffsetIn: galley || lShape ? 108 : 60 },
    dishwasher: null,
    dishwasherSide: "right",
    refrigerator: { wallLabel: "Wall 1", centerOffsetIn: 18 },
    refrigeratorWidthIn: 36,
    refrigeratorPanels: "both",
    refrigeratorEnclosure: "cabinet-above",
    kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
    intake: { ...emptyAutoDesignIntake(), construction: "new", preferences: ["dishwasher"] },
  };
}

function parseArgs(argv: string[]): { seed: number; sampleSize: number } {
  let seed: number | null = null;
  let sampleSize = Number.parseInt(process.env.SWEEP_SAMPLE_SIZE ?? "", 10);
  if (!Number.isFinite(sampleSize) || sampleSize <= 0) sampleSize = DEFAULT_SAMPLE_SIZE;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]!;
    if (arg === "--seed" || arg.startsWith("--seed=")) {
      const raw = arg.includes("=") ? arg.slice("--seed=".length) : argv[++i];
      const value = Number.parseInt(raw ?? "", 10);
      if (!Number.isFinite(value)) throw new Error(`Invalid --seed value: ${raw ?? "(missing)"}`);
      seed = value;
    } else if (arg === "--sample" || arg.startsWith("--sample=")) {
      const raw = arg.includes("=") ? arg.slice("--sample=".length) : argv[++i];
      const value = Number.parseInt(raw ?? "", 10);
      if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid --sample value: ${raw ?? "(missing)"}`);
      sampleSize = value;
    }
  }
  if (seed == null) {
    const env = Number.parseInt(process.env.SWEEP_SEED ?? "", 10);
    seed = Number.isFinite(env) ? env : (Date.now() ^ process.hrtime()[1]) >>> 0;
  }
  return { seed, sampleSize };
}

function formatCodes(codes: string[]): string {
  if (codes.length === 0) return "clean";
  const counts = new Map<string, number>();
  for (const code of codes) counts.set(code, (counts.get(code) ?? 0) + 1);
  return Array.from(counts.entries()).map(([code, count]) => (count > 1 ? `${code}(${count})` : code)).join(",");
}

export async function runSweep(options: { seed: number; sampleSize: number; log?: (line: string) => void } = parseArgs(process.argv.slice(2))): Promise<{
  seed: number;
  rows: string[];
  clean: number;
  findings: number;
  errors: number;
}> {
  const log = options.log ?? console.log;
  const baseUrl = catalogApi.baseUrl;
  log(`Auto Design sweep  api=${baseUrl}  seed=${options.seed}  sample=${options.sampleSize}`);

  const styles = await loadStyles();
  if (styles.length === 0) throw new Error("doorStyles.list returned no active styles.");
  const sample = randomSample(styles, options.sampleSize, mulberry32(options.seed));
  log(`Sampled ${sample.length} of ${styles.length} lines: ${sample.map((style) => `${style.ourName} (${style.id})`).join("; ")}`);

  let clean = 0;
  let findings = 0;
  let errors = 0;
  const rows: string[] = [];

  for (const style of sample) {
    let pools: LinePools;
    try {
      pools = await loadLinePools(style.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const layoutType of LAYOUT_TYPES) {
        const row = `${style.ourName} ${layoutType} -> ERROR ${message}`;
        rows.push(row);
        log(row);
        errors += 1;
      }
      continue;
    }

    for (const layoutType of LAYOUT_TYPES) {
      const room = syntheticRoom(layoutType);
      let uid = 0;
      try {
        const plan = runAutoDesignLayout({
          input: sweepInput(layoutType),
          room,
          openings: [],
          baseCatalog: pools.baseCatalog,
          wallCatalog: pools.wallCatalog,
          fillers: pools.fillers,
          appliancePalette: pools.appliancePalette,
          refrigeratorCaps: pools.refrigeratorCaps,
          refrigeratorEndPanels: pools.refrigeratorEndPanels,
          tallCatalog: pools.tallCatalog,
          panelCatalog: pools.panelCatalog,
          styleId: style.id,
          makeUid: () => `sweep-${style.id}-${layoutType}-${++uid}`,
        });
        if (!plan.ok) {
          const row = `${style.ourName} ${layoutType} -> ERROR ${plan.message}`;
          rows.push(row);
          log(row);
          errors += 1;
          continue;
        }
        const codes = sweepFindings(plan.placed, room).map((finding) => finding.code);
        const row = `${style.ourName} ${layoutType} -> ${formatCodes(codes)}`;
        rows.push(row);
        log(row);
        if (codes.length) findings += 1;
        else clean += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const row = `${style.ourName} ${layoutType} -> ERROR ${message}`;
        rows.push(row);
        log(row);
        errors += 1;
      }
    }
  }

  const total = clean + findings + errors;
  const summary = `Summary: ${total} designs, ${clean} clean, ${findings} with findings, ${errors} errors (seed ${options.seed})`;
  log(summary);
  return { seed: options.seed, rows, clean, findings, errors };
}

function isDirectRun(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(resolve(entry)).href;
  } catch {
    return entry.replaceAll("\\", "/").endsWith("/client/src/dev15/autoDesignSweepRunner.ts");
  }
}

if (isDirectRun()) {
  runSweep().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
