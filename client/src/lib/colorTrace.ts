/**
 * Color trace: the debugging record behind `?colorTrace=1`.
 *
 * Tom debugs the color pipeline with this. For one cabinet it records every step
 * that could set a color, in the order they run, so the answer is "which layer
 * won and what overrode it" instead of a guess:
 *
 *   1. the style (id, code) and its ACCEPTED run — the render hex and image, and
 *      when that accepted appearance was fetched;
 *   2. the style's saved catalog color;
 *   3. the fallback candidates: swatch file, WalzCraft shade, name estimator;
 *   4. which layer won, and why (the shared resolver already states this);
 *   5. any LATER override that runs after the resolver — a saved design's
 *      `cabinetFinish`, a catalog finish override, `finishForCab`, and the
 *      per-surface material;
 *   6. the final hex applied to each surface: front, box, sides, skin.
 *
 * It is a pure recorder: building it changes nothing, and it never runs unless an
 * admin asks for it. Production data is not touched.
 */
import type { DoorColorDecision } from "@shared/doorColorResolve";

export type ColorTraceSurface = "front" | "box" | "sides" | "skin" | "toeKick";

export type ColorTraceStep = {
  /** Milliseconds since the trace began, so ordering is visible in the panel. */
  atMs: number;
  /** Stable key: style.accepted, style.saved, layer.won, override.savedDesign, ... */
  key: string;
  /** One line a person can read. */
  detail: string;
  /** The hex this step would apply, when it carries one. */
  hex?: string | null;
  /** Where the value came from, when the step knows. */
  source?: string | null;
};

export type ColorTraceCabinet = {
  cabinetUid: string;
  masterCode: string;
  styleId: number | null;
  styleCode: string | null;
  steps: ColorTraceStep[];
  /** The last surface hex applied per surface, after every override. */
  surfaces: Partial<Record<ColorTraceSurface, string | null>>;
  /** True when every recorded surface agrees. The whole point of the trace. */
  surfacesAgree: boolean;
};

export type ColorTrace = {
  startedAt: string;
  cabinets: ColorTraceCabinet[];
  /** Surfaces that disagreed, with their hex values. Empty is healthy. */
  mismatches: Array<{ cabinetUid: string; surfaces: Array<{ surface: ColorTraceSurface; hex: string | null }> }>;
};

/** True only for an admin who asked for it. Nothing else ever turns the trace on. */
export function colorTraceEnabled(input: {
  search?: string | null;
  isAdmin: boolean;
}): boolean {
  if (!input.isAdmin) return false;
  const query = (input.search ?? "").trim();
  if (!query) return false;
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  const value = (params.get("colorTrace") ?? "").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

/** A recorder bound to one point in time, so every step carries an offset. */
export function createColorTraceRecorder(now: () => number = () => Date.now()) {
  const startedAtMs = now();
  const cabinets = new Map<string, ColorTraceCabinet>();

  const cabinet = (input: {
    cabinetUid: string;
    masterCode?: string | null;
    styleId?: number | null;
    styleCode?: string | null;
  }): ColorTraceCabinet => {
    const existing = cabinets.get(input.cabinetUid);
    if (existing) return existing;
    const created: ColorTraceCabinet = {
      cabinetUid: input.cabinetUid,
      masterCode: (input.masterCode ?? "").trim(),
      styleId: input.styleId ?? null,
      styleCode: (input.styleCode ?? "").trim() || null,
      steps: [],
      surfaces: {},
      surfacesAgree: true,
    };
    cabinets.set(input.cabinetUid, created);
    return created;
  };

  return {
    /** Record one step. Returns the cabinet record so callers can chain. */
    step(
      identity: { cabinetUid: string; masterCode?: string | null; styleId?: number | null; styleCode?: string | null },
      step: Omit<ColorTraceStep, "atMs"> & { atMs?: number },
    ): ColorTraceCabinet {
      const record = cabinet(identity);
      record.steps.push({ atMs: step.atMs ?? now() - startedAtMs, ...step });
      return record;
    },

    /**
     * Record the shared resolver's answer as the "which layer won" step. The
     * resolver already names the winning layer and the reason it kept it, so this
     * does not re-derive precedence.
     */
    recordResolver(
      identity: { cabinetUid: string; masterCode?: string | null; styleId?: number | null; styleCode?: string | null },
      decision: DoorColorDecision,
      acceptedFetchedAt?: string | null,
    ): ColorTraceCabinet {
      const record = cabinet(identity);
      const push = (step: Omit<ColorTraceStep, "atMs">) => record.steps.push({ atMs: now() - startedAtMs, ...step });
      push({
        key: "style.accepted",
        detail: decision.layers.renderHex
          ? `Accepted run color ${decision.layers.renderHex}${acceptedFetchedAt ? ` (fetched ${acceptedFetchedAt})` : ""}`
          : "No accepted door-rendering run for this style",
        hex: decision.layers.renderHex,
        source: decision.layers.renderHex ? "accepted-render" : null,
      });
      push({
        key: "style.saved",
        detail: decision.layers.catalogColor
          ? `Saved catalog color ${decision.layers.catalogColor.hex}`
          : "No saved catalog color on this style",
        hex: decision.layers.catalogColor?.hex ?? null,
        source: "catalog-color",
      });
      push({
        key: "candidates.fallback",
        detail: [
          decision.layers.swatch ? `swatch ${decision.layers.swatch.hex}` : null,
          decision.layers.walzcraft ? `walz ${decision.layers.walzcraft.hex}` : null,
          decision.layers.estimator ? `estimate ${decision.layers.estimator.hex}` : null,
          decision.layers.pre209 ? `pre-209 ${decision.layers.pre209.hex}` : null,
        ].filter(Boolean).join(" · ") || "no fallback candidates",
        source: "fallback",
      });
      push({
        key: "layer.won",
        detail: `${decision.candidateSource} won with ${decision.candidateHex} → applied ${decision.appliedHex} (${decision.review.keptBecause})`,
        hex: decision.appliedHex,
        source: decision.appliedSource,
      });
      if (decision.review.needsColorReview) {
        push({
          key: "layer.review",
          detail: `Estimator disagreed (${decision.review.estimatorHex ?? "none"}, ΔE ${decision.review.deltaE ?? "n/a"}); kept ${decision.review.keptBecause}`,
          hex: decision.review.chosenHex,
          source: decision.review.estimatorSource,
        });
      }
      return record;
    },

    /** Record an override that runs AFTER the resolver, and what it set. */
    override(
      identity: { cabinetUid: string; masterCode?: string | null; styleId?: number | null; styleCode?: string | null },
      input: { key: string; detail: string; hex?: string | null; source?: string | null },
    ): ColorTraceCabinet {
      return this.step(identity, { ...input, source: input.source ?? input.key });
    },

    /** Record the final hex actually applied to one surface. */
    surface(
      identity: { cabinetUid: string; masterCode?: string | null; styleId?: number | null; styleCode?: string | null },
      surface: ColorTraceSurface,
      hex: string | null,
      detail?: string,
    ): ColorTraceCabinet {
      const record = cabinet(identity);
      record.surfaces[surface] = hex;
      record.steps.push({
        atMs: now() - startedAtMs,
        key: `surface.${surface}`,
        detail: detail ?? `${surface} renders ${hex ?? "no color"}`,
        hex,
        source: `surface:${surface}`,
      });
      return record;
    },

    /** Freeze the trace, flagging any cabinet whose surfaces disagreed. */
    finish(): ColorTrace {
      const list: ColorTraceCabinet[] = [];
      const mismatches: ColorTrace["mismatches"] = [];
      for (const record of Array.from(cabinets.values())) {
        const entries = Object.entries(record.surfaces) as Array<[ColorTraceSurface, string | null]>;
        const distinct = new Set(entries.map(([, hex]) => (hex ?? "").toLowerCase()).filter(Boolean));
        // A surface that was never recorded is not a disagreement.
        record.surfacesAgree = distinct.size <= 1;
        if (!record.surfacesAgree) {
          mismatches.push({
            cabinetUid: record.cabinetUid,
            surfaces: entries.map(([surface, hex]) => ({ surface, hex })),
          });
        }
        list.push(record);
      }
      return { startedAt: new Date(startedAtMs).toISOString(), cabinets: list, mismatches };
    },
  };
}

/** One plain block of text per cabinet, for the console. */
export function colorTraceToText(trace: ColorTrace): string {
  const lines: string[] = [`[colorTrace] started ${trace.startedAt} · ${trace.cabinets.length} cabinet(s)`];
  for (const cabinet of trace.cabinets) {
    lines.push(`- ${cabinet.cabinetUid} ${cabinet.masterCode} style=${cabinet.styleId ?? "?"} ${cabinet.styleCode ?? ""}`.trim());
    for (const step of cabinet.steps) {
      lines.push(`    +${String(step.atMs).padStart(5)}ms ${step.key}: ${step.detail}`);
    }
    const surfaces = Object.entries(cabinet.surfaces)
      .map(([surface, hex]) => `${surface}=${hex ?? "none"}`)
      .join(" ");
    lines.push(`    surfaces: ${surfaces || "(none recorded)"}${cabinet.surfacesAgree ? "" : "  ← MISMATCH"}`);
  }
  if (trace.mismatches.length) lines.push(`[colorTrace] ${trace.mismatches.length} cabinet(s) show more than one surface color`);
  return lines.join("\n");
}
