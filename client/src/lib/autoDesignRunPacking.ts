// client/src/lib/autoDesignRunPacking.ts
// Pure run-packing planner. No React, no repo imports, deterministic.

export type OffsetRange = { lo: number; hi: number };

export type RunBlock = {
  id: string;
  start: number;
  end: number;
  ranges: OffsetRange[] | null;
  role: "refrigerator" | "range" | "sink" | "corner" | "tall" | "other";
  coversStart: boolean;
  coversEnd: boolean;
  /**
   * When set, an offset moves only that edge of the block; the other edge stays
   * put and the block grows/shrinks. Used for a blind corner block stretched to
   * the run end: its pull changes how far it reaches out of the corner.
   */
  movingEdge?: "start" | "end";
  /**
   * The corner filler this block wants on its open side (the edge facing the
   * run). For movingEdge "start" that is the start edge, for "end" the end
   * edge; if movingEdge is unset, whichever edge is not at runStart/runEnd.
   */
  fillerTargetIn?: number;
};

export type RunSpec = {
  runStart: number;
  runEnd: number;
  blocked: { start: number; end: number }[];
  blocks: RunBlock[];
  widths: number[];
  fillerMaxIn: number;
  panelIn: number;
  landingPairs: { a: string; b: string; minIn: number }[];
  step?: number;
  smallPieceIn?: number;
};

export type GapFill = {
  start: number;
  end: number;
  pieces: { start: number; width: number }[];
  filler: { start: number; width: number } | null;
  panels: { start: number; side: "start" | "end" }[];
  openIn: number;
  startNeighbor: string | null;
  endNeighbor: string | null;
  /** End panels the gap needed but could not hold (the gap was too short once they were reserved). */
  panelsDropped?: number;
};

export type RunPlan = {
  offsets: Record<string, number>;
  gaps: GapFill[];
  landing: { a: string; b: string; gapIn: number; minIn: number }[];
  score: number[];
  searched: number;
};

const EPS_E = 1; // 1/8 in tolerance for "touching"
const MIN_GAP_E = 1; // ignore gaps under 1/8 in (spec says 1/16; use 1/8 for integer safety)
const TINY_E = 1; // residual < 1/8 treated as 0

export function eighths(inches: number): number {
  return Math.round(inches * 8) / 8;
}

function toE(inches: number): number {
  return Math.round(inches * 8);
}

function fromE(e: number): number {
  return e / 8;
}

export function packGap(
  lengthIn: number,
  widths: readonly number[],
  fillerMaxIn: number,
): { pieces: number[]; fillerIn: number; openIn: number } {
  const L = toE(lengthIn);
  const fillerMaxE = toE(fillerMaxIn);
  if (L <= 0) return { pieces: [], fillerIn: 0, openIn: 0 };

  const ws = Array.from(new Set(widths.map(toE).filter((w) => w > 0))).sort(
    (a, b) => a - b,
  );
  if (ws.length === 0) {
    return { pieces: [], fillerIn: 0, openIn: fromE(L) };
  }

  const INF = Number.POSITIVE_INFINITY;
  const best: number[] = new Array(L + 1).fill(INF);
  const choice: number[] = new Array(L + 1).fill(-1);
  best[0] = 0;
  for (let t = 1; t <= L; t++) {
    for (const w of ws) {
      if (w > t) break;
      const prev = best[t - w];
      if (prev === INF) continue;
      const cand = prev + 1;
      if (cand < best[t]) {
        best[t] = cand;
        choice[t] = w;
      }
    }
  }

  // Choose best total T <= L.
  let chosenT = -1;
  let chosenResidual = -1;
  let chosenPieces = INF;
  for (let t = L; t >= 0; t--) {
    if (best[t] === INF) continue;
    const r = L - t;
    const rEff = r < TINY_E ? 0 : r;
    const ok = rEff === 0 || (fillerMaxE > 0 && rEff <= fillerMaxE);
    if (ok) {
      // Prefer larger T (smaller residual), then fewer pieces.
      if (
        chosenT === -1 ||
        t > chosenT ||
        (t === chosenT && best[t] < chosenPieces)
      ) {
        chosenT = t;
        chosenResidual = rEff;
        chosenPieces = best[t];
      }
    }
  }

  if (chosenT === -1) {
    // No total fits within fillerMax; pick largest reachable T <= L.
    for (let t = L; t >= 0; t--) {
      if (best[t] !== INF) {
        chosenT = t;
        chosenResidual = L - t;
        chosenPieces = best[t];
        break;
      }
    }
    if (chosenT === -1) {
      return { pieces: [], fillerIn: 0, openIn: fromE(L) };
    }
    // openIn = L - T, fillerIn = 0
    const pieces = reconstruct(choice, chosenT);
    return { pieces, fillerIn: 0, openIn: fromE(chosenResidual) };
  }

  const pieces = reconstruct(choice, chosenT);
  const fillerIn = chosenResidual > 0 ? fromE(chosenResidual) : 0;
  return { pieces, fillerIn, openIn: 0 };
}

function reconstruct(choice: number[], total: number): number[] {
  const out: number[] = [];
  let t = total;
  while (t > 0) {
    const w = choice[t];
    if (w <= 0) break;
    out.push(fromE(w));
    t -= w;
  }
  out.sort((a, b) => b - a);
  return out;
}

type Candidate = number; // offset in eighths

function candidatesFor(block: RunBlock, stepE: number): Candidate[] {
  const ranges = block.ranges;
  if (!ranges || ranges.length === 0) return [0];
  const set = new Set<number>();
  for (const r of ranges) {
    const loE = toE(r.lo);
    const hiE = toE(r.hi);
    if (hiE < loE) continue;
    set.add(loE);
    set.add(hiE);
    if (stepE > 0) {
      let v = Math.ceil(loE / stepE) * stepE;
      while (v <= hiE) {
        set.add(v);
        v += stepE;
      }
    }
  }
  if (set.size === 0) return [0];
  return Array.from(set).sort((a, b) => a - b);
}

type SortedBlock = {
  block: RunBlock;
  startE: number;
  endE: number;
  cands: Candidate[];
};

function sortBlocks(blocks: RunBlock[]): SortedBlock[] {
  return blocks
    .map((b) => ({
      block: b,
      startE: toE(b.start),
      endE: toE(b.end),
    }))
    .sort((a, b) => a.startE - b.startE || a.endE - b.endE)
    .map((s) => ({ ...s, cands: [] as Candidate[] }));
}

type Placed = { startE: number; endE: number };

/** Shifted start/end of a block: a movingEdge offset moves only that edge. */
function shiftedSpan(
  s: SortedBlock,
  off: number,
): { startE: number; endE: number } {
  const me = s.block.movingEdge;
  if (me === "start") return { startE: s.startE + off, endE: s.endE };
  if (me === "end") return { startE: s.startE, endE: s.endE + off };
  return { startE: s.startE + off, endE: s.endE + off };
}

function isValid(
  sorted: SortedBlock[],
  offsets: Candidate[],
  runStartE: number,
  runEndE: number,
  blockedE: { startE: number; endE: number }[],
): boolean {
  let prevEnd = -Infinity;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const off = offsets[i];
    const { startE, endE } = shiftedSpan(s, off);
    if (startE < runStartE - EPS_E) return false;
    if (endE > runEndE + EPS_E) return false;
    if (startE < prevEnd - EPS_E) return false;
    for (const b of blockedE) {
      if (startE < b.endE - EPS_E && endE > b.startE + EPS_E) return false;
    }
    prevEnd = endE;
  }
  return true;
}

function buildGaps(
  spec: RunSpec,
  sorted: SortedBlock[],
  offsets: Candidate[],
): GapFill[] {
  const runStartE = toE(spec.runStart);
  const runEndE = toE(spec.runEnd);
  const panelE = toE(spec.panelIn);
  const fillerMaxE = toE(spec.fillerMaxIn);
  const widths = spec.widths;

  type Obstacle = {
    startE: number;
    endE: number;
    blockId: string | null;
    coversStart: boolean;
    coversEnd: boolean;
  };

  const obstacles: Obstacle[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const off = offsets[i];
    const { startE, endE } = shiftedSpan(s, off);
    obstacles.push({
      startE,
      endE,
      blockId: s.block.id,
      coversStart: s.block.coversStart,
      coversEnd: s.block.coversEnd,
    });
  }
  for (const b of spec.blocked) {
    obstacles.push({
      startE: toE(b.start),
      endE: toE(b.end),
      blockId: null,
      coversStart: true,
      coversEnd: true,
    });
  }
  obstacles.sort((a, b) => a.startE - b.startE || a.endE - b.endE);

  const gaps: GapFill[] = [];
  let cursor = runStartE;
  let prevObstacle: Obstacle | null = null;

  const flushGap = (gapStartE: number, gapEndE: number) => {
    const lenE = gapEndE - gapStartE;
    if (lenE < MIN_GAP_E) return;
    const startNeighbor = prevObstacle ? prevObstacle.blockId : null;
    const endNeighbor = null; // filled below when we know next obstacle
    void endNeighbor;
    // placeholder; real construction below
    void startNeighbor;
    void lenE;
  };
  void flushGap;

  const makeGap = (
    gapStartE: number,
    gapEndE: number,
    startObs: Obstacle | null,
    endObs: Obstacle | null,
  ): GapFill => {
    const lenE = gapEndE - gapStartE;
    const startNeighbor = startObs ? startObs.blockId : null;
    const endNeighbor = endObs ? endObs.blockId : null;

    // Panel reservation.
    let reserveStartE = 0;
    let reserveEndE = 0;
    if (panelE > 0) {
      if (startObs && startObs.blockId !== null && !startObs.coversEnd) {
        reserveStartE = panelE;
      }
      if (endObs && endObs.blockId !== null && !endObs.coversStart) {
        reserveEndE = panelE;
      }
    }

    const minWidthE = widths.length
      ? Math.min(...widths.map(toE).filter((w) => w > 0))
      : Infinity;

    const tryFill = (
      rsE: number,
      reE: number,
    ): { pieces: number[]; fillerIn: number; openIn: number } => {
      const innerE = lenE - rsE - reE;
      if (innerE <= 0) {
        return { pieces: [], fillerIn: 0, openIn: fromE(Math.max(0, innerE)) };
      }
      return packGap(fromE(innerE), widths, spec.fillerMaxIn);
    };

    let fill = tryFill(reserveStartE, reserveEndE);
    let panelsDropped = 0;
    // If reserved panels leave less than smallest width and no pieces, drop panels.
    if (
      (reserveStartE > 0 || reserveEndE > 0) &&
      fill.pieces.length === 0 &&
      lenE - reserveStartE - reserveEndE < minWidthE
    ) {
      panelsDropped = (reserveStartE > 0 ? 1 : 0) + (reserveEndE > 0 ? 1 : 0);
      reserveStartE = 0;
      reserveEndE = 0;
      fill = tryFill(0, 0);
    }

    const panels: { start: number; side: "start" | "end" }[] = [];
    if (reserveStartE > 0) {
      panels.push({ start: fromE(gapStartE), side: "start" });
    }
    if (reserveEndE > 0) {
      panels.push({ start: fromE(gapEndE - reserveEndE), side: "end" });
    }

    // Placement of pieces + filler.
    const innerStartE = gapStartE + reserveStartE;
    const innerEndE = gapEndE - reserveEndE;
    const innerLenE = innerEndE - innerStartE;

    const piecesOut: { start: number; width: number }[] = [];
    let filler: { start: number; width: number } | null = null;

    const fillerE = toE(fill.fillerIn);
    const piecesE = fill.pieces.map(toE);
    const piecesTotalE = piecesE.reduce((a, b) => a + b, 0);

    // Decide filler edge.
    const startQualifies =
      startObs === null ||
      (startObs.blockId !== null &&
        (startObs.blockId !== null &&
          (sorted.find((s) => s.block.id === startObs.blockId)?.block.role ===
            "corner" ||
            sorted.find((s) => s.block.id === startObs.blockId)?.block.role ===
              "tall")));
    const endQualifies =
      endObs === null ||
      (endObs.blockId !== null &&
        (sorted.find((s) => s.block.id === endObs.blockId)?.block.role ===
          "corner" ||
          sorted.find((s) => s.block.id === endObs.blockId)?.block.role ===
            "tall"));

    // A block with a corner-filler target wins the filler on its open edge.
    const startTargetE =
      startObs && startObs.blockId !== null
        ? toE(
            sorted.find((s) => s.block.id === startObs.blockId)?.block
              .fillerTargetIn ?? 0,
          )
        : 0;
    const endTargetE =
      endObs && endObs.blockId !== null
        ? toE(
            sorted.find((s) => s.block.id === endObs.blockId)?.block
              .fillerTargetIn ?? 0,
          )
        : 0;

    let fillerAtStart = false;
    if (fillerE > 0) {
      if (endTargetE > 0) fillerAtStart = false;
      else if (startTargetE > 0) fillerAtStart = true;
      else if (endQualifies) fillerAtStart = false;
      else if (startQualifies) fillerAtStart = true;
      else fillerAtStart = false;
    }

    let cursorE = innerStartE;
    if (fillerE > 0 && fillerAtStart) {
      filler = { start: fromE(cursorE), width: fromE(fillerE) };
      cursorE += fillerE;
    }
    for (const w of piecesE) {
      piecesOut.push({ start: fromE(cursorE), width: fromE(w) });
      cursorE += w;
    }
    if (fillerE > 0 && !fillerAtStart) {
      filler = { start: fromE(cursorE), width: fromE(fillerE) };
      cursorE += fillerE;
    }
    void piecesTotalE;
    void innerLenE;

    return {
      start: fromE(gapStartE),
      end: fromE(gapEndE),
      pieces: piecesOut,
      filler,
      panels,
      openIn: fill.openIn,
      startNeighbor,
      endNeighbor,
      panelsDropped,
    };
  };

  for (const obs of obstacles) {
    if (obs.startE > cursor) {
      gaps.push(makeGap(cursor, obs.startE, prevObstacle, obs));
    }
    cursor = Math.max(cursor, obs.endE);
    prevObstacle = obs;
  }
  if (runEndE > cursor) {
    gaps.push(makeGap(cursor, runEndE, prevObstacle, null));
  }

  return gaps;
}

function computeLanding(
  spec: RunSpec,
  sorted: SortedBlock[],
  offsets: Candidate[],
): { a: string; b: string; gapIn: number; minIn: number }[] {
  const pos = new Map<string, { startE: number; endE: number }>();
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const off = offsets[i];
    pos.set(s.block.id, shiftedSpan(s, off));
  }
  const out: { a: string; b: string; gapIn: number; minIn: number }[] = [];
  for (const pair of spec.landingPairs) {
    const pa = pos.get(pair.a);
    const pb = pos.get(pair.b);
    if (!pa || !pb) continue;
    let gapE: number;
    if (pa.endE <= pb.startE) gapE = pb.startE - pa.endE;
    else if (pb.endE <= pa.startE) gapE = pa.startE - pb.endE;
    else gapE = 0;
    out.push({
      a: pair.a,
      b: pair.b,
      gapIn: fromE(Math.max(0, gapE)),
      minIn: pair.minIn,
    });
  }
  return out;
}

function scorePlan(
  spec: RunSpec,
  sorted: SortedBlock[],
  offsets: Candidate[],
  gaps: GapFill[],
  landing: { a: string; b: string; gapIn: number; minIn: number }[],
): number[] {
  const smallE = toE(spec.smallPieceIn ?? 15);
  let landingShortE = 0;
  for (const l of landing) {
    const shortE = toE(l.minIn) - toE(l.gapIn);
    if (shortE > 0) landingShortE += shortE;
  }
  let openGaps = 0;
  let totalOpenE = 0;
  let fillers = 0;
  let smallPieces = 0;
  let totalPieces = 0;
  let droppedPanels = 0;
  for (const g of gaps) {
    droppedPanels += g.panelsDropped ?? 0;
    if (g.openIn > 0) openGaps++;
    totalOpenE += toE(g.openIn);
    if (g.filler) fillers += toE(g.filler.width) < 6 ? 2 : 1; // a sliver under 3/4" counts double
    for (const p of g.pieces) {
      totalPieces++;
      if (toE(p.width) < smallE) smallPieces++;
    }
  }
  let absOffE = 0;
  for (let i = 0; i < sorted.length; i++) {
    absOffE += Math.abs(offsets[i]);
  }
  // Corner-filler target deviation: a missing corner filler costs the whole target.
  let cornerTargetDevE = 0;
  for (const s of sorted) {
    const target = s.block.fillerTargetIn;
    if (target === undefined) continue;
    const targetE = toE(eighths(target));
    const me = s.block.movingEdge;
    const openEdge: "start" | "end" =
      me === "start"
        ? "start"
        : me === "end"
          ? "end"
          : Math.abs(s.startE - toE(spec.runStart)) <= EPS_E
            ? "end"
            : "start";
    let wE = 0;
    for (const g of gaps) {
      const touches =
        openEdge === "start"
          ? g.endNeighbor === s.block.id
          : g.startNeighbor === s.block.id;
      if (!touches) continue;
      if (g.filler) wE = toE(g.filler.width);
      break;
    }
    cornerTargetDevE += Math.abs(wE - targetE);
  }
  // Bare floor is never acceptable, so openings outrank a landing that cannot reach 15" anyway.
  return [
    openGaps,
    fromE(totalOpenE),
    fromE(landingShortE),
    droppedPanels,
    fromE(cornerTargetDevE),
    fillers,
    smallPieces,
    totalPieces,
    fromE(absOffE),
  ];
}

function lexLess(a: number[], b: number[]): boolean {
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] < b[i]) return true;
    if (a[i] > b[i]) return false;
  }
  return a.length < b.length;
}

export function planRun(spec: RunSpec): RunPlan {
  const stepE = Math.max(1, toE(spec.step ?? 0.125));
  const runStartE = toE(spec.runStart);
  const runEndE = toE(spec.runEnd);
  const blockedE = spec.blocked.map((b) => ({
    startE: toE(b.start),
    endE: toE(b.end),
  }));

  const sorted = sortBlocks(spec.blocks);
  for (const s of sorted) {
    s.cands = candidatesFor(s.block, stepE);
  }

  const zeroOffsets: Candidate[] = sorted.map(() => 0);

  const evaluate = (
    offsets: Candidate[],
  ): { score: number[]; gaps: GapFill[]; landing: ReturnType<typeof computeLanding> } => {
    const gaps = buildGaps(spec, sorted, offsets);
    const landing = computeLanding(spec, sorted, offsets);
    const score = scorePlan(spec, sorted, offsets, gaps, landing);
    return { score, gaps, landing };
  };

  // Count combinations.
  let product = 1;
  for (const s of sorted) {
    product *= s.cands.length;
    if (product > 300000) break;
  }

  let bestOffsets: Candidate[] | null = null;
  let bestScore: number[] | null = null;
  let bestGaps: GapFill[] | null = null;
  let bestLanding: ReturnType<typeof computeLanding> | null = null;
  let searched = 0;

  const consider = (offsets: Candidate[]) => {
    if (!isValid(sorted, offsets, runStartE, runEndE, blockedE)) return;
    searched++;
    const { score, gaps, landing } = evaluate(offsets);
    if (bestScore === null || lexLess(score, bestScore)) {
      bestScore = score;
      bestOffsets = offsets.slice();
      bestGaps = gaps;
      bestLanding = landing;
    }
  };

  if (product <= 300000) {
    // Full enumeration via odometer.
    const n = sorted.length;
    if (n === 0) {
      consider([]);
    } else {
      const idx: number[] = new Array(n).fill(0);
      const offsets: Candidate[] = new Array(n).fill(0);
      // Iterate.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        for (let i = 0; i < n; i++) offsets[i] = sorted[i].cands[idx[i]];
        consider(offsets);
        // Increment.
        let k = n - 1;
        while (k >= 0) {
          idx[k]++;
          if (idx[k] < sorted[k].cands.length) break;
          idx[k] = 0;
          k--;
        }
        if (k < 0) break;
      }
    }
  } else {
    // Coordinate descent.
    const n = sorted.length;
    // Seed candidates.
    const seeds: Candidate[][] = [];
    if (isValid(sorted, zeroOffsets, runStartE, runEndE, blockedE)) {
      seeds.push(zeroOffsets.slice());
    }
    for (let i = 0; i < n; i++) {
      const cands = sorted[i].cands;
      let closest = cands[0];
      let bestDist = Math.abs(closest);
      for (const c of cands) {
        const d = Math.abs(c);
        if (d < bestDist) {
          bestDist = d;
          closest = c;
        }
      }
      const seed: Candidate[] = zeroOffsets.slice();
      seed[i] = closest;
      seeds.push(seed);
    }
    // Pick best valid seed.
    let current: Candidate[] | null = null;
    let currentScore: number[] | null = null;
    for (const seed of seeds) {
      if (!isValid(sorted, seed, runStartE, runEndE, blockedE)) continue;
      searched++;
      const { score } = evaluate(seed);
      if (currentScore === null || lexLess(score, currentScore)) {
        currentScore = score;
        current = seed.slice();
      }
    }
    if (current !== null && currentScore !== null) {
      for (let round = 0; round < 8; round++) {
        let improved = false;
        for (let i = 0; i < n; i++) {
          let localBest = current[i];
          let localScore: number[] = currentScore;
          for (const c of sorted[i].cands) {
            if (c === current[i]) continue;
            const trial = current.slice();
            trial[i] = c;
            if (!isValid(sorted, trial, runStartE, runEndE, blockedE)) continue;
            searched++;
            const { score } = evaluate(trial);
            if (lexLess(score, localScore)) {
              localScore = score;
              localBest = c;
            }
          }
          if (localBest !== current[i]) {
            current[i] = localBest;
            currentScore = localScore;
            improved = true;
          }
        }
        if (!improved) break;
      }
      // Record best.
      const { score, gaps, landing } = evaluate(current);
      bestScore = score;
      bestOffsets = current.slice();
      bestGaps = gaps;
      bestLanding = landing;
    }
  }

  if (bestOffsets === null || bestScore === null || bestGaps === null || bestLanding === null) {
    // No valid combination: return zeros, gaps with zero shifts, score [Infinity].
    const gaps = buildGaps(spec, sorted, zeroOffsets);
    const landing = computeLanding(spec, sorted, zeroOffsets);
    const offsets: Record<string, number> = {};
    for (const s of sorted) offsets[s.block.id] = 0;
    return {
      offsets,
      gaps,
      landing,
      score: [Number.POSITIVE_INFINITY],
      searched,
    };
  }

  const offsets: Record<string, number> = {};
  for (let i = 0; i < sorted.length; i++) {
    offsets[sorted[i].block.id] = fromE(bestOffsets[i]);
  }

  return {
    offsets,
    gaps: bestGaps,
    landing: bestLanding,
    score: bestScore,
    searched,
  };
}
