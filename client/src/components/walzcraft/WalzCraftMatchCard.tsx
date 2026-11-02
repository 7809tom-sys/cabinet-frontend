import { useState } from "react";
import { WalzProfileSvg } from "@/components/walzcraft/WalzProfileSvg";
import { ColorSwatchPicker } from "@/components/walzcraft/ColorSwatchPicker";
import { colorPatternFor, woodGrainBadge } from "@shared/walzcraftColorPatterns";
import { TintedSlab, resolveSlabTint } from "@/components/walzcraft/TintedSlab";
import { WALZCRAFT_PROFILE_TEMPLATES } from "@shared/walzcraftDoorTemplates";
import {
  WALZCRAFT_DISTRIBUTOR_DOORS,
  colorLabel,
  doorDisplayName,
  doorForStyle,
  featureConfidence,
  readApprovals,
  rowText,
  writeApproval,
  type ApprovalState,
  type DistributorDoorMatch,
} from "@shared/walzcraftDistributorMatches";

// Layout mirrors the /workspace/walz/*_vs_WalzCraft_p*.png matching sheets:
// distributor door photo + name, then the top WalzCraft side profiles with
// confidence, then color, then feature details. Brand colors only.

function useApproval(id: string) {
  const [state, setState] = useState<ApprovalState | undefined>(() => readApprovals()[id]);
  const set = (next: ApprovalState) => {
    const value = state === next ? null : next;
    writeApproval(id, value);
    setState(value ?? undefined);
  };
  return [state, set] as const;
}

function Photo({ src, label, alt }: { src: string | null; label: string; alt: string }) {
  return (
    <figure className="w-28 shrink-0 text-center">
      {src ? (
        <img src={src} alt={alt} className="h-36 w-28 rounded border border-[#244338]/20 bg-white object-contain" />
      ) : (
        <div className="flex h-36 w-28 items-center justify-center rounded border border-dashed border-[#244338]/30 bg-[#fffdf9] p-2 text-xs text-[#244338]/70">
          No brochure photo found
        </div>
      )}
      <figcaption className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-[#244338]/70">{label}</figcaption>
    </figure>
  );
}

export function WalzCraftMatchCard({ door, currentPhoto, catalogHex, catalogColorName, styleGrainDirection }: { door: DistributorDoorMatch; currentPhoto?: string | null; catalogHex?: string | null; catalogColorName?: string | null; styleGrainDirection?: string | null }) {
  const isSlab = /slab/i.test(door.group);
  const colorRec = colorPatternFor(door);
  const grainBadge = woodGrainBadge(colorRec, styleGrainDirection);
  const [approval, setApproval] = useApproval(door.id);
  return (
    <div data-testid={`walz-match-${door.id}`} className="w-full rounded-lg border-2 border-[#d7a46c] bg-[#fffdf9] p-3 text-[#244338]">
      <div className="flex flex-wrap items-start gap-3">
        <Photo src={door.photo} label="Distributor brochure" alt={`${door.distributor} ${doorDisplayName(door)} brochure door`} />
        {currentPhoto !== undefined && <Photo src={currentPhoto} label="Current site photo" alt="Current site photo" />}
        {isSlab && colorRec.colorType !== "woodGrain" && <TintedSlab tint={resolveSlabTint({ catalogHex, catalogColorName, walzColorName: door.walzcraftColor })} />}
        <div className="min-w-[14rem] flex-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#244338]/70">WalzCraft match · {door.distributor}</div>
          <div className="text-lg font-bold">{doorDisplayName(door)}</div>
          {grainBadge && <span data-testid="wood-grain-badge" className="mr-1 inline-block rounded-full border border-[#d7a46c] bg-[#d7a46c]/20 px-2 py-0.5 text-xs font-semibold">{grainBadge}</span>}
          <p data-testid="walz-row-text" className="mt-1 text-sm">{rowText(door)}</p>
          <p className="mt-1 text-xs text-[#244338]/70">{door.group} · {door.geometry} · source sheet {door.sheet}</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {door.matches.map((m) => {
          const tpl = m.templateId ? WALZCRAFT_PROFILE_TEMPLATES.find((t) => t.id === m.templateId) : null;
          return (
            <div key={m.rank} className={`rounded border p-2 ${m.rank === 1 ? "border-[#d7a46c]" : "border-[#244338]/20"} bg-white`}>
              <div className="flex h-24 items-center justify-center overflow-hidden grayscale">
                {tpl ? <WalzProfileSvg template={tpl} /> : m.drawing ? (
                  <img src={m.drawing} alt={`${m.profileCode} side profile`} className="max-h-24 object-contain" />
                ) : (
                  <span className="text-xs text-[#244338]/60">No profile drawing in source ({m.profileCode ?? "none"})</span>
                )}
              </div>
              <div className="mt-1 text-sm font-semibold">{m.walzcraft}</div>
              <div className="text-xs">{m.confidencePct}% profile match{m.profileCode ? ` · ${m.profileCode}` : ""}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-sm font-semibold">{colorLabel(door)}</p>
      <ul className="mt-1 grid gap-1 text-xs sm:grid-cols-3">
        {featureConfidence(door).map((f) => (
          <li key={f.feature} className="rounded bg-[#244338]/5 px-2 py-1">
            <span className="font-semibold">{f.feature}:</span> {f.pct != null ? `${f.pct}%` : f.note}
          </li>
        ))}
      </ul>
      <ColorSwatchPicker door={door} styleGrainDirection={styleGrainDirection} />
      {door.unknowns.length > 0 && <p className="mt-1 text-xs text-[#244338]/70">Unknowns (CSV): {door.unknowns.join("; ")}</p>}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button type="button" data-testid={`walz-approve-${door.id}`} onClick={() => setApproval("approved")}
          className={`rounded px-3 py-1 text-sm font-semibold ${approval === "approved" ? "bg-[#244338] text-[#fffdf9]" : "border-2 border-[#244338] text-[#244338]"}`}>
          {approval === "approved" ? "Approved" : "Approve"}
        </button>
        <button type="button" data-testid={`walz-reject-${door.id}`} onClick={() => setApproval("rejected")}
          className={`rounded px-3 py-1 text-sm font-semibold ${approval === "rejected" ? "bg-[#d7a46c] text-[#244338]" : "border-2 border-[#d7a46c] text-[#244338]"}`}>
          {approval === "rejected" ? "Rejected" : "Reject"}
        </button>
        <span className="text-xs italic text-[#244338]/70">Saved in this browser only — not saved to catalog yet.</span>
      </div>
    </div>
  );
}

/** Block shown inside an existing featured style row when a CSV door matches it by name. */
export function WalzCraftMatchForStyle({ style, currentPhoto }: { style: Parameters<typeof doorForStyle>[0] & { renderHex?: string | null; color?: string | null; grainDirection?: string | null }; currentPhoto: string | null }) {
  const door = doorForStyle(style);
  if (!door) return null;
  return <WalzCraftMatchCard door={door} currentPhoto={currentPhoto} catalogHex={style.renderHex ?? null} catalogColorName={style.color ?? null} styleGrainDirection={style.grainDirection ?? null} />;
}

/** WalzCraft-only rows: CSV doors that match no existing style in the list. */
export function WalzCraftOnlyMatches({ styles }: { styles: Array<Parameters<typeof doorForStyle>[0]> }) {
  const matched = new Set(styles.map((s) => doorForStyle(s)?.id).filter(Boolean));
  const rest = WALZCRAFT_DISTRIBUTOR_DOORS.filter((d) => !matched.has(d.id));
  return (
    <section data-testid="walzcraft-only-matches" className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        WalzCraft door matches without a featured style ({rest.length})
      </h3>
      <p className="text-xs text-muted-foreground">From the Faircrest, Kitchen Crest, DL Cabinetry and AltaEuro vs WalzCraft matching sheets. Approvals are kept in this browser only — not saved to catalog yet.</p>
      <ul className="space-y-2">{rest.map((d) => <li key={d.id}><WalzCraftMatchCard door={d} /></li>)}</ul>
    </section>
  );
}
