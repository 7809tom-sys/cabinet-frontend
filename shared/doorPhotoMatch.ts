export interface DoorCandidate {
  id: number;
  styleCode: string;
  ourName: string | null;
  doorStyle: string | null;
  color: string | null;
  finish: string | null;
  woodSpecies: string | null;
  doorSampleImageUrl: string | null;
  thumbnailImageUrl: string | null;
  roomSceneImageUrl: string | null;
}

export interface DoorVisionMatch {
  styleId?: number | string | null;
  confidence?: number | string | null;
  reasoning?: string | null;
}

export interface DoorVisionResult {
  matches?: DoorVisionMatch[] | null;
}

export interface RankedDoorMatch extends DoorCandidate {
  confidence: number;
  reasoning: string;
}

function normalizeId(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && value.trim()) {
    const n = Number(value.trim());
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function normalizeConfidence(value: number | string | null | undefined): number {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(raw as number)) return 0.5;
  const n = Number(raw);
  if (n > 1) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

function normalizeReasoning(value: string | null | undefined, candidate: DoorCandidate): string {
  const text = (value ?? "").trim();
  if (text) return text.slice(0, 280);
  const parts = [candidate.doorStyle, candidate.color, candidate.finish].filter(Boolean);
  return parts.length > 0
    ? `Closest match based on visible profile and finish cues (${parts.join(", ")}).`
    : "Closest match based on the visible door profile and finish cues.";
}

export function rankDoorMatches(
  candidates: DoorCandidate[],
  vision: DoorVisionResult | null | undefined,
): RankedDoorMatch[] {
  const byId = new Map<number, DoorCandidate>();
  candidates.forEach((candidate) => byId.set(candidate.id, candidate));

  const ranked: RankedDoorMatch[] = [];
  const seen = new Set<number>();

  for (const row of vision?.matches ?? []) {
    const id = normalizeId(row?.styleId);
    if (id == null || seen.has(id)) continue;
    const candidate = byId.get(id);
    if (!candidate) continue;
    seen.add(id);
    ranked.push({
      ...candidate,
      confidence: normalizeConfidence(row?.confidence),
      reasoning: normalizeReasoning(row?.reasoning, candidate),
    });
    if (ranked.length >= 3) break;
  }

  return ranked.sort((a, b) => b.confidence - a.confidence || a.ourName?.localeCompare(b.ourName ?? "") || a.id - b.id);
}
