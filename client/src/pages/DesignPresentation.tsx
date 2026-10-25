import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Printer, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { PlanCanvas } from "@/components/design/PlanCanvas";
import { ElevationView } from "@/components/design/ElevationView";
import { trpc } from "@/lib/trpc";
// import { useLanguage } from "@/contexts/LanguageContext";
import {
  type PlacedCabinet, type RoomData, type WallSide, type WallOpening,
  type FinishColors, DEFAULT_FINISH_COLORS, cabinetWall,
  type PlanAnnotation,
} from "@/lib/design";
import type { HardwareStyleId } from "@/lib/hardware";
import {
  designerDraftActiveKey,
  designerDraftStorageKey,
  normalizeStoreScope,
  resolveStoreScope,
  type StoreScope,
} from "@/lib/affiliateContext";

/**
 * Design Presentation — print-optimized page.
 *
 * Reads the current design from localStorage (same draft the Design Tool uses)
 * and renders a branded, multi-page layout suitable for "Print → Save as PDF".
 *
 * Sections:
 * 1. Branded header with logo, site name, date, customer info
 * 2. Floor plan (PlanCanvas in read-only mode)
 * 3. Elevation views for all 4 walls (only walls with cabinets)
 * 4. Bill of Materials table with pricing
 */

// The Design Tool records only the active draft identity for this exact store.
function getDraftKey(scope: StoreScope): string {
  const activeKey = designerDraftActiveKey(scope);
  const activeDraft = localStorage.getItem(activeKey);
  const expectedPrefix = `cabinet-dealz:designer-draft:v2:${normalizeStoreScope(scope)}:`;
  return activeDraft?.startsWith(expectedPrefix)
    ? activeDraft
    : designerDraftStorageKey(scope, "guest");
}

interface DraftSnapshot {
  v: number;
  originScope: StoreScope;
  savedAt: number;
  room: RoomData;
  placed: PlacedCabinet[];
  openings: WallOpening[];
  island?: { x: number; y: number; width: number; depth: number } | null;
  styleId: number | null;
  tier: "Wholesale" | "Contractor" | "Homeowner";
  crown: boolean;
  toeKick: boolean;
  batten: boolean;
  lightRail: boolean;
  countertopMaterialId?: string | null;
  edgeProfileId?: string | null;
  backsplashMaterialId?: string | null;
  flooringMaterialId?: string | null;
  hardwareStyleId?: HardwareStyleId | null;
  annotations?: PlanAnnotation[];
  roomType?: string;
}

// Wall labels for display
const WALL_LABELS: Record<WallSide, string> = {
  top: "Back Wall",
  bottom: "Front Wall",
  left: "Left Wall",
  right: "Right Wall",
};

export default function DesignPresentation() {
  const [location] = useLocation();
  const scope = useMemo(() => resolveStoreScope({
    pathname: typeof window !== "undefined" ? window.location.pathname : location.split("?")[0],
    search: typeof window !== "undefined" ? window.location.search : location.split("?")[1] ?? "",
    hostname: typeof window !== "undefined" ? window.location.hostname : "",
  }), [location]);
  const savedDesignId = useMemo(() => {
    const value = new URLSearchParams(location.split("?")[1] ?? "").get("designId");
    const designId = Number(value);
    return Number.isInteger(designId) && designId > 0 ? designId : null;
  }, [location]);
  const documentAccess = trpc.design.documentAccess.useQuery(
    { designId: savedDesignId ?? 1 },
    { enabled: savedDesignId !== null, retry: false },
  );
  // A missing, unpaid, changed, or inaccessible plan identity defaults to the
  // protected visual proposal. The server remains the authority for full access.
  const hasFullDocumentAccess = documentAccess.data?.level === "full";
  const [draft, setDraft] = useState<DraftSnapshot | null>(null);

  // Load branding
  const brandingQuery = trpc.emailSettings.getPublicBranding.useQuery();
  const branding = brandingQuery.data;

  // Load draft from localStorage
  useEffect(() => {
    const key = getDraftKey(scope);
    const raw = localStorage.getItem(key);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DraftSnapshot;
        if (parsed.v === 2 && parsed.originScope === scope) setDraft(parsed);
      } catch {
        // ignore parse errors
      }
    }
  }, [scope]);

  // Determine which walls have cabinets
  const wallsWithCabinets = useMemo<WallSide[]>(() => {
    if (!draft) return [];
    const walls = new Set<WallSide>();
    for (const cab of draft.placed) {
      if (cab.placement === "wall" || cab.placement === "base" || cab.placement === "tall") {
        const w = cabinetWall(cab, draft.room);
        walls.add(w);
      }
    }
    // Always show all 4 walls in a fixed order, but only those with cabinets
    return (["bottom", "top", "left", "right"] as WallSide[]).filter((w) => walls.has(w));
  }, [draft]);

  // BOM grouping
  const bomLines = useMemo(() => {
    if (!draft) return [];
    const map = new Map<string, { code: string; description: string; qty: number; placement: string }>();
    for (const p of draft.placed) {
      const code = p.glassDoor ? `${p.masterCode}GD` : p.masterCode;
      const key = `${code}|${p.placement}`;
      const existing = map.get(key);
      if (existing) {
        existing.qty++;
      } else {
        map.set(key, {
          code,
          description: p.description || code,
          qty: 1,
          placement: p.placement,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
  }, [draft]);

  // Date formatting
  const dateStr = useMemo(() => {
    if (!draft) return "";
    return new Date(draft.savedAt).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }, [draft]);

  if (!draft) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">No design found. Please create a design first.</p>
          <Button variant="outline" asChild>
            <Link href="/design">
              <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to 3D Designer
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  const siteName = branding?.siteName || "Cabinet Dealz";
  const logoUrl = branding?.logoUrl || "";
  const primaryColor = branding?.primaryColor || "#1a2b4a";

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Print stylesheet */}
      <style>{`
        @media print {
          @page { size: letter portrait; margin: 0.4in; }
          .no-print { display: none !important; }
          .print-page-break { page-break-before: always; }
          .print-avoid-break { page-break-inside: avoid; }
          html, body { background: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .presentation-section { margin-bottom: 0 !important; }
        }
        @media screen {
          .presentation-container { max-width: 8.5in; margin: 0 auto; padding: 1rem; }
        }
      `}</style>

      {/* Screen-only controls */}
      <div className="no-print sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/design">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Back to Design
          </Link>
        </Button>
        <p className="hidden text-sm text-muted-foreground sm:block">
          {hasFullDocumentAccess
            ? "Detailed plan documentation is authorized for this saved plan."
            : "Visual proposal only — detailed measurements and pricing unlock after purchase."}
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print / Save PDF
        </Button>
      </div>

      {/* Presentation content */}
      <div className="presentation-container">
        {!hasFullDocumentAccess && (
          <div className="mb-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 print:border-amber-300">
            <p className="font-semibold">Customer proposal</p>
            <p className="mt-1 text-xs leading-relaxed">This printout intentionally excludes exact measurements, cabinet codes, itemized pricing, and supplier-ready details. Detailed documents unlock only after a paid cabinet order is linked to this saved plan.</p>
          </div>
        )}
        {/* ─── Page 1: Header + Floor Plan ─── */}
        <div className="presentation-section mb-8">
          {/* Branded header */}
          <div className="flex items-center justify-between border-b-2 pb-4 mb-6" style={{ borderColor: primaryColor }}>
            <div className="flex items-center gap-3">
              {logoUrl && (
                <img src={logoUrl} alt={siteName} className="h-12 w-auto object-contain" />
              )}
              <div>
                <h1 className="text-2xl font-bold" style={{ color: primaryColor }}>{siteName}</h1>
                <p className="text-sm text-muted-foreground">{hasFullDocumentAccess ? "Kitchen Design Documentation" : "Kitchen Design Proposal"}</p>
              </div>
            </div>
            <div className="text-right text-sm text-muted-foreground">
              <p>{dateStr}</p>
              <p className="font-medium">{draft.roomType || "Kitchen"}{hasFullDocumentAccess ? ` — ${draft.room.width}" × ${draft.room.depth}"` : ""}</p>
            </div>
          </div>

          {/* Design summary */}
          <div className={`grid ${hasFullDocumentAccess ? "grid-cols-3" : "grid-cols-2"} gap-4 mb-6 text-sm`}>
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Cabinets</p>
              <p className="text-lg font-semibold">{draft.placed.length}</p>
            </div>
            {hasFullDocumentAccess && <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Room Size</p>
              <p className="text-lg font-semibold">{Math.round(draft.room.width / 12)}' × {Math.round(draft.room.depth / 12)}'</p>
            </div>}
            {hasFullDocumentAccess && <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Tier</p>
              <p className="text-lg font-semibold">{draft.tier}</p>
            </div>}
            {!hasFullDocumentAccess && <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Plan status</p>
              <p className="text-lg font-semibold">Visual proposal</p>
            </div>}
          </div>

          {/* Floor Plan */}
          <div className="print-avoid-break">
            <h2 className="text-lg font-semibold mb-3" style={{ color: primaryColor }}>Floor Plan</h2>
            <div className="border rounded-lg p-4 bg-gray-50/50 overflow-hidden" style={{ maxHeight: "500px" }}>
              <PlanCanvas
                room={draft.room}
                cabinets={draft.placed}
                selectedUid={null}
                onSelect={() => {}}
                onMove={() => {}}
                showWallLayer={true}
                autoDimensions={hasFullDocumentAccess}
                island={draft.island}
                openings={draft.openings}
                countertopMaterialId={draft.countertopMaterialId}
                annotations={draft.annotations}
                cabinetsLocked={true}
                layoutLocked={true}
              />
            </div>
          </div>
        </div>

        {/* ─── Page 2+: Elevation Views ─── */}
        {wallsWithCabinets.map((wall, i) => (
          <div key={wall} className={`presentation-section mb-8 print-avoid-break ${i > 0 ? "print-page-break" : ""}`}>
            <h2 className="text-lg font-semibold mb-3" style={{ color: primaryColor }}>
              {WALL_LABELS[wall]} Elevation
            </h2>
            <div className="border rounded-lg p-4 bg-gray-50/50 overflow-hidden">
              <ElevationView
                room={draft.room}
                cabinets={draft.placed}
                selectedUid={null}
                onSelect={() => {}}
                wall={wall}
                openings={draft.openings}
                crown={draft.crown}
                toeKick={draft.toeKick}
                batten={draft.batten}
                lightRail={draft.lightRail}
                countertopMaterialId={draft.countertopMaterialId}
                backsplashMaterialId={draft.backsplashMaterialId}
                hardwareStyleId={draft.hardwareStyleId}
                hideSwitcher={true}
                showProductCodes={hasFullDocumentAccess}
              />
            </div>
          </div>
        ))}

        {/* ─── BOM Table (authorized detailed documents only) ─── */}
        {hasFullDocumentAccess && <div className="presentation-section mb-8 print-page-break">
          <h2 className="text-lg font-semibold mb-3" style={{ color: primaryColor }}>Bill of Materials</h2>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b-2" style={{ borderColor: primaryColor }}>
                <th className="text-left py-2 px-2 font-semibold">Code</th>
                <th className="text-left py-2 px-2 font-semibold">Description</th>
                <th className="text-left py-2 px-2 font-semibold">Placement</th>
                <th className="text-right py-2 px-2 font-semibold">Qty</th>
              </tr>
            </thead>
            <tbody>
              {bomLines.map((line, i) => (
                <tr key={i} className="border-b border-gray-200">
                  <td className="py-1.5 px-2 font-mono text-xs">{line.code}</td>
                  <td className="py-1.5 px-2">{line.description}</td>
                  <td className="py-1.5 px-2 capitalize">{line.placement}</td>
                  <td className="py-1.5 px-2 text-right font-semibold">{line.qty}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2" style={{ borderColor: primaryColor }}>
                <td colSpan={3} className="py-2 px-2 font-semibold">Total Items</td>
                <td className="py-2 px-2 text-right font-bold">{draft.placed.length}</td>
              </tr>
            </tfoot>
          </table>

          {/* Trim summary */}
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            {draft.crown && <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-600" /> Crown Molding</div>}
            {draft.toeKick && <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-600" /> Toe Kick</div>}
            {draft.batten && <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-600" /> Batten Molding</div>}
            {draft.lightRail && <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-600" /> Light Rail</div>}
            {draft.countertopMaterialId && <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-stone-500" /> Countertop Selected</div>}
            {draft.edgeProfileId && <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-stone-500" /> Edge Profile: {draft.edgeProfileId}</div>}
          </div>
        </div>}

        {/* Footer */}
        <div className="border-t pt-4 text-center text-xs text-muted-foreground">
          <p>Generated by {siteName} • {dateStr}</p>
          <p className="mt-1">{hasFullDocumentAccess ? "Detailed documentation for the linked paid plan." : "This is a visual proposal. Final pricing and availability are subject to confirmation."}</p>
        </div>
      </div>
    </div>
  );
}
