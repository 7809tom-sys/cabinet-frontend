/**
 * DesignPreviewModal — A modal with three deterministic preview modes:
 * 1. Enhanced 2D Elevation — architectural-quality rendering with textures and shadows
 * 2. Isometric 3D View — deterministic perspective from actual cabinet data
 * 3. Materials Mood Board — collage of selected finishes
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { X, Image, Box, Palette, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { PlacedCabinet, RoomData, WallSide } from "@/lib/design";
import { cabinetWall, wallLength, roomCeiling } from "@/lib/design";

// ─── Types ────────────────────────────────────────────────────────────────────
interface DesignPreviewModalProps {
  open: boolean;
  onClose: () => void;
  placed: PlacedCabinet[];
  room: RoomData;
  activeWall: WallSide;
  doorStyleName?: string;
  doorStyleColor?: string; // hex color for the door style
  countertopColor?: string; // hex color for countertop
  countertopName?: string;
  backsplashColor?: string;
  backsplashName?: string;
  flooringColor?: string;
  flooringName?: string;
  hardwareName?: string;
  sinkName?: string;
  faucetName?: string;
  /** URL of the door style swatch image */
  doorStyleImage?: string;
  /** URL of the countertop swatch image */
  countertopImage?: string;
  /** URL of the backsplash swatch image */
  backsplashImage?: string;
  /** URL of the flooring swatch image */
  flooringImage?: string;
}

type PreviewTab = "elevation" | "isometric" | "moodboard";

// ─── Color Helpers ────────────────────────────────────────────────────────────
const CABINET_COLORS: Record<string, { base: string; shadow: string; highlight: string }> = {
  default: { base: "#1a2744", shadow: "#0f1a2e", highlight: "#2a3a5a" },
  white: { base: "#f5f5f0", shadow: "#d4d4cf", highlight: "#ffffff" },
  gray: { base: "#6b7280", shadow: "#4b5563", highlight: "#9ca3af" },
  navy: { base: "#1a2744", shadow: "#0f1a2e", highlight: "#2a3a5a" },
  espresso: { base: "#3d2b1f", shadow: "#2a1d15", highlight: "#5c4033" },
  natural: { base: "#c4a882", shadow: "#a08968", highlight: "#dbc4a0" },
};

function getCabinetColor(doorStyleColor?: string) {
  if (!doorStyleColor) return CABINET_COLORS.default;
  // Try to match a named color, otherwise use the hex directly
  const lower = doorStyleColor.toLowerCase();
  if (lower.includes("white") || lower.includes("snow")) return CABINET_COLORS.white;
  if (lower.includes("gray") || lower.includes("grey")) return CABINET_COLORS.gray;
  if (lower.includes("navy") || lower.includes("blue")) return CABINET_COLORS.navy;
  if (lower.includes("espresso") || lower.includes("dark") || lower.includes("java")) return CABINET_COLORS.espresso;
  if (lower.includes("natural") || lower.includes("oak") || lower.includes("maple")) return CABINET_COLORS.natural;
  // Use the hex directly
  return { base: doorStyleColor, shadow: doorStyleColor, highlight: doorStyleColor };
}

// ─── Enhanced Elevation View ──────────────────────────────────────────────────
function EnhancedElevation({
  placed,
  room,
  activeWall,
  doorStyleColor,
  countertopColor = "#e8ddd3",
  flooringColor = "#c4a882",
  backsplashColor = "#f0ebe4",
}: {
  placed: PlacedCabinet[];
  room: RoomData;
  activeWall: WallSide;
  doorStyleColor?: string;
  countertopColor?: string;
  flooringColor?: string;
  backsplashColor?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors = getCabinetColor(doorStyleColor);
  const ceiling = roomCeiling(room);
  const wLen = wallLength(activeWall, room);

  // Filter cabinets on this wall
  const wallCabs = useMemo(
    () => placed.filter((c) => cabinetWall(c, room) === activeWall),
    [placed, room, activeWall],
  );

  const baseCabs = wallCabs.filter((c) => c.placement === "base" || c.placement === "appliance");
  const wallCabinets = wallCabs.filter((c) => c.placement === "wall");
  const tallCabs = wallCabs.filter((c) => c.placement === "tall");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Scale: 1 inch = 4px for a nice detailed rendering
    const scale = 4;
    const w = wLen * scale;
    const h = ceiling * scale;
    canvas.width = w;
    canvas.height = h;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // ─── Background (wall color) ───
    ctx.fillStyle = "#f8f6f3";
    ctx.fillRect(0, 0, w, h);

    // ─── Flooring ───
    const floorH = 4 * scale; // 4" toe kick area visual
    ctx.fillStyle = flooringColor;
    ctx.fillRect(0, h - floorH, w, floorH);
    // Floor shadow gradient
    const floorGrad = ctx.createLinearGradient(0, h - floorH, 0, h - floorH + 8);
    floorGrad.addColorStop(0, "rgba(0,0,0,0.08)");
    floorGrad.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, h - floorH, w, 8);

    // ─── Backsplash area ───
    const backsplashTop = (ceiling - 54) * scale; // 54" from floor = typical backsplash top
    const backsplashBottom = (ceiling - 36) * scale; // 36" = counter height
    if (baseCabs.length > 0 && wallCabinets.length > 0) {
      ctx.fillStyle = backsplashColor;
      ctx.fillRect(0, backsplashTop, w, backsplashBottom - backsplashTop);
    }

    // ─── Countertop band ───
    const counterY = (ceiling - 36) * scale;
    const counterH = 1.5 * scale; // 1.5" thick
    if (baseCabs.length > 0) {
      // Find extent of base cabinets
      const horizontal = activeWall === "top" || activeWall === "bottom";
      const sorted = [...baseCabs].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
      const firstX = (horizontal ? sorted[0].x : sorted[0].y) * scale;
      const lastCab = sorted[sorted.length - 1];
      const lastX = ((horizontal ? lastCab.x : lastCab.y) + (lastCab.width ?? 0)) * scale;

      // Countertop with overhang
      const overhang = 1.5 * scale;
      ctx.fillStyle = countertopColor;
      ctx.fillRect(firstX - overhang, counterY, lastX - firstX + overhang * 2, counterH);

      // Countertop shadow
      const ctShadow = ctx.createLinearGradient(0, counterY + counterH, 0, counterY + counterH + 6);
      ctShadow.addColorStop(0, "rgba(0,0,0,0.12)");
      ctShadow.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = ctShadow;
      ctx.fillRect(firstX - overhang, counterY + counterH, lastX - firstX + overhang * 2, 6);

      // Countertop edge highlight
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.fillRect(firstX - overhang, counterY, lastX - firstX + overhang * 2, 2);
    }

    // ─── Draw cabinets ───
    const drawCabinet = (x: number, y: number, w: number, h: number, isWallCab: boolean) => {
      // Cabinet body
      ctx.fillStyle = colors.base;
      ctx.fillRect(x, y, w, h);

      // Panel inset (door)
      const inset = 3 * scale;
      const doorW = w - inset * 2;
      const doorH = h - inset * 2;
      if (doorW > 0 && doorH > 0) {
        // Door panel with slight depth
        ctx.fillStyle = colors.highlight;
        ctx.fillRect(x + inset, y + inset, doorW, doorH);

        // Inner panel (raised panel look)
        const innerInset = 6 * scale;
        if (doorW > innerInset * 2 && doorH > innerInset * 2) {
          ctx.fillStyle = colors.base;
          ctx.fillRect(x + inset + innerInset / 2, y + inset + innerInset / 2, doorW - innerInset, doorH - innerInset);

          // Innermost panel
          ctx.fillStyle = colors.highlight;
          ctx.fillRect(x + inset + innerInset, y + inset + innerInset, doorW - innerInset * 2, doorH - innerInset * 2);
        }

        // Door frame shadow (top-left light, bottom-right shadow)
        ctx.strokeStyle = "rgba(255,255,255,0.15)";
        ctx.lineWidth = 1;
        ctx.strokeRect(x + inset + 0.5, y + inset + 0.5, doorW - 1, doorH - 1);

        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + inset + doorW, y + inset);
        ctx.lineTo(x + inset + doorW, y + inset + doorH);
        ctx.lineTo(x + inset, y + inset + doorH);
        ctx.stroke();
      }

      // Hardware knob/pull
      const knobX = w > 20 * scale ? x + w - 8 * scale : x + w / 2;
      const knobY = isWallCab ? y + h - 6 * scale : y + 6 * scale;
      ctx.fillStyle = "#b8860b";
      ctx.beginPath();
      ctx.arc(knobX, knobY, 2 * scale, 0, Math.PI * 2);
      ctx.fill();

      // Cabinet outline
      ctx.strokeStyle = "rgba(0,0,0,0.3)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);
    };

    // Sort and draw base cabinets
    const horizontal = activeWall === "top" || activeWall === "bottom";
    const sortedBase = [...baseCabs].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
    for (const cab of sortedBase) {
      const cx = (horizontal ? cab.x : cab.y) * scale;
      const cw = (cab.width ?? 24) * scale;
      const ch = (cab.height ?? 34.5) * scale;
      const cy = counterY + counterH; // below countertop
      drawCabinet(cx, cy, cw, ch, false);
    }

    // Sort and draw wall cabinets
    const sortedWall = [...wallCabinets].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
    for (const cab of sortedWall) {
      const cx = (horizontal ? cab.x : cab.y) * scale;
      const cw = (cab.width ?? 24) * scale;
      const ch = (cab.height ?? 30) * scale;
      // Wall cabinets: bottom at 54" from floor
      const cy = (ceiling - 54 - (cab.height ?? 30)) * scale + (ceiling - 54) * scale - ch;
      const wallCabY = (ceiling - 54) * scale - ch;
      drawCabinet(cx, wallCabY, cw, ch, true);
    }

    // Sort and draw tall cabinets
    const sortedTall = [...tallCabs].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
    for (const cab of sortedTall) {
      const cx = (horizontal ? cab.x : cab.y) * scale;
      const cw = (cab.width ?? 24) * scale;
      const ch = (cab.height ?? 84) * scale;
      const cy = h - floorH - ch;
      drawCabinet(cx, cy, cw, ch, false);
    }

    // ─── Ceiling line ───
    ctx.strokeStyle = "#d1d5db";
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(w, 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // ─── Floor line ───
    ctx.strokeStyle = "#9ca3af";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h - floorH);
    ctx.lineTo(w, h - floorH);
    ctx.stroke();

    // ─── Ambient shadow at bottom ───
    const ambientGrad = ctx.createLinearGradient(0, h - 20, 0, h);
    ambientGrad.addColorStop(0, "rgba(0,0,0,0)");
    ambientGrad.addColorStop(1, "rgba(0,0,0,0.05)");
    ctx.fillStyle = ambientGrad;
    ctx.fillRect(0, h - 20, w, 20);
  }, [wallCabs, baseCabs, wallCabinets, tallCabs, wLen, ceiling, colors, countertopColor, flooringColor, backsplashColor, activeWall]);

  return (
    <div className="w-full overflow-auto">
      <canvas
        ref={canvasRef}
        className="w-full h-auto max-h-[60vh] object-contain rounded-lg border border-border"
        style={{ imageRendering: "auto" }}
      />
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Enhanced elevation — {activeWall === "top" ? "Back" : activeWall === "bottom" ? "Front" : activeWall === "left" ? "Left" : "Right"} wall ({Math.round(wLen / 12)}' wide)
      </p>
    </div>
  );
}

// ─── Isometric 3D View ────────────────────────────────────────────────────────
function IsometricView({
  placed,
  room,
  doorStyleColor,
  countertopColor = "#e8ddd3",
  flooringColor = "#c4a882",
}: {
  placed: PlacedCabinet[];
  room: RoomData;
  doorStyleColor?: string;
  countertopColor?: string;
  flooringColor?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const colors = getCabinetColor(doorStyleColor);
  const ceiling = roomCeiling(room);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Isometric projection parameters
    const scale = 2.5;
    const isoAngle = Math.PI / 6; // 30 degrees
    const cosA = Math.cos(isoAngle);
    const sinA = Math.sin(isoAngle);

    // Canvas size
    const canvasW = 800;
    const canvasH = 600;
    canvas.width = canvasW;
    canvas.height = canvasH;

    // Clear
    ctx.fillStyle = "#fafafa";
    ctx.fillRect(0, 0, canvasW, canvasH);

    // Origin offset (center-bottom of canvas)
    const originX = canvasW * 0.5;
    const originY = canvasH * 0.85;

    // Convert 3D point to 2D isometric
    const toIso = (x: number, y: number, z: number) => ({
      x: originX + (x - y) * cosA * scale,
      y: originY - (x + y) * sinA * scale - z * scale,
    });

    // Draw filled isometric box face
    const drawFace = (
      points: { x: number; y: number }[],
      fillColor: string,
      strokeColor: string = "rgba(0,0,0,0.2)",
    ) => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    // Draw an isometric box
    const drawBox = (
      x: number, y: number, z: number,
      w: number, d: number, h: number,
      topColor: string, leftColor: string, rightColor: string,
    ) => {
      // 8 corners
      const ftl = toIso(x, y, z + h);
      const ftr = toIso(x + w, y, z + h);
      const fbr = toIso(x + w, y, z);
      const fbl = toIso(x, y, z);
      const btl = toIso(x, y + d, z + h);
      const btr = toIso(x + w, y + d, z + h);
      const bbr = toIso(x + w, y + d, z);

      // Top face
      drawFace([ftl, ftr, btr, btl], topColor);
      // Left face
      drawFace([ftl, btl, toIso(x, y + d, z), fbl], leftColor);
      // Right face
      drawFace([ftr, fbr, bbr, btr], rightColor);
    };

    // ─── Floor ───
    const floorPts = [
      toIso(0, 0, 0),
      toIso(room.width, 0, 0),
      toIso(room.width, room.depth, 0),
      toIso(0, room.depth, 0),
    ];
    drawFace(floorPts, flooringColor, "rgba(0,0,0,0.1)");

    // ─── Back wall (partial, faded) ───
    const wallH = ceiling * 0.6; // Don't draw full height, just enough for context
    const backWallPts = [
      toIso(0, room.depth, 0),
      toIso(room.width, room.depth, 0),
      toIso(room.width, room.depth, wallH),
      toIso(0, room.depth, wallH),
    ];
    drawFace(backWallPts, "#f0ede8", "rgba(0,0,0,0.05)");

    // ─── Left wall (partial, faded) ───
    const leftWallPts = [
      toIso(0, 0, 0),
      toIso(0, room.depth, 0),
      toIso(0, room.depth, wallH),
      toIso(0, 0, wallH),
    ];
    drawFace(leftWallPts, "#e8e5e0", "rgba(0,0,0,0.05)");

    // ─── Draw cabinets ───
    // Sort by depth (back to front) for proper occlusion
    const sortedCabs = [...placed].sort((a, b) => {
      // Draw back wall cabs first, then sides, then front
      const wallA = cabinetWall(a, room);
      const wallB = cabinetWall(b, room);
      const order: Record<string, number> = { top: 0, left: 1, right: 2, bottom: 3 };
      return (order[wallA] ?? 0) - (order[wallB] ?? 0);
    });

    for (const cab of sortedCabs) {
      const wall = cabinetWall(cab, room);
      const cw = cab.width ?? 24;
      const ch = cab.height ?? 34.5;
      const cd = 24; // standard depth

      let bx = 0, by = 0, bz = 0;
      let boxW = cw, boxD = cd, boxH = ch;

      if (wall === "top") {
        // Back wall: x along wall, y = room.depth - depth, z from floor
        bx = cab.x;
        by = room.depth - cd;
        bz = cab.placement === "wall" ? 54 : cab.placement === "tall" ? 0 : 0;
      } else if (wall === "bottom") {
        bx = cab.x;
        by = 0;
        bz = cab.placement === "wall" ? 54 : 0;
      } else if (wall === "left") {
        bx = 0;
        by = cab.y;
        boxW = cd;
        boxD = cw;
        bz = cab.placement === "wall" ? 54 : 0;
      } else {
        bx = room.width - cd;
        by = cab.y;
        boxW = cd;
        boxD = cw;
        bz = cab.placement === "wall" ? 54 : 0;
      }

      // Darken left face, lighten top
      const topC = colors.highlight;
      const leftC = colors.shadow;
      const rightC = colors.base;

      drawBox(bx, by, bz, boxW, boxD, boxH, topC, leftC, rightC);
    }

    // ─── Countertop on base cabinets ───
    const baseCabs = placed.filter((c) => c.placement === "base" || c.placement === "appliance");
    if (baseCabs.length > 0) {
      // Group by wall and draw countertop slab
      for (const wall of ["top", "bottom", "left", "right"] as WallSide[]) {
        const wCabs = baseCabs.filter((c) => cabinetWall(c, room) === wall);
        if (wCabs.length === 0) continue;

        const horizontal = wall === "top" || wall === "bottom";
        const sorted = [...wCabs].sort((a, b) => horizontal ? a.x - b.x : a.y - b.y);
        const first = sorted[0];
        const last = sorted[sorted.length - 1];

        let cx: number, cy: number, cw: number, cd: number;
        if (wall === "top") {
          cx = first.x - 1.5;
          cy = room.depth - 25.5;
          cw = (last.x + (last.width ?? 24)) - first.x + 3;
          cd = 25.5;
        } else if (wall === "bottom") {
          cx = first.x - 1.5;
          cy = 0;
          cw = (last.x + (last.width ?? 24)) - first.x + 3;
          cd = 25.5;
        } else if (wall === "left") {
          cx = 0;
          cy = first.y - 1.5;
          cw = 25.5;
          cd = (last.y + (last.width ?? 24)) - first.y + 3;
        } else {
          cx = room.width - 25.5;
          cy = first.y - 1.5;
          cw = 25.5;
          cd = (last.y + (last.width ?? 24)) - first.y + 3;
        }

        drawBox(cx, cy, 34.5, cw, cd, 1.5, countertopColor, "#c4b8a8", "#d4c8b8");
      }
    }
  }, [placed, room, colors, countertopColor, flooringColor, ceiling]);

  return (
    <div className="w-full overflow-auto">
      <canvas
        ref={canvasRef}
        className="w-full h-auto max-h-[60vh] object-contain rounded-lg border border-border"
        style={{ imageRendering: "auto" }}
      />
      <p className="text-xs text-muted-foreground mt-2 text-center">
        Isometric view — {Math.round(room.width / 12)}' × {Math.round(room.depth / 12)}' room
      </p>
    </div>
  );
}

// ─── Materials Mood Board ─────────────────────────────────────────────────────
function MaterialsMoodBoard({
  doorStyleName,
  doorStyleImage,
  countertopName,
  countertopImage,
  countertopColor,
  backsplashName,
  backsplashImage,
  backsplashColor,
  flooringName,
  flooringImage,
  flooringColor,
  hardwareName,
  sinkName,
  faucetName,
  doorStyleColor,
}: {
  doorStyleName?: string;
  doorStyleImage?: string;
  countertopName?: string;
  countertopImage?: string;
  countertopColor?: string;
  backsplashName?: string;
  backsplashImage?: string;
  backsplashColor?: string;
  flooringName?: string;
  flooringImage?: string;
  flooringColor?: string;
  hardwareName?: string;
  sinkName?: string;
  faucetName?: string;
  doorStyleColor?: string;
}) {
  const materials = [
    { label: "Door Style", name: doorStyleName, image: doorStyleImage, color: doorStyleColor || "#1a2744" },
    { label: "Countertop", name: countertopName, image: countertopImage, color: countertopColor || "#e8ddd3" },
    { label: "Backsplash", name: backsplashName, image: backsplashImage, color: backsplashColor || "#f0ebe4" },
    { label: "Flooring", name: flooringName, image: flooringImage, color: flooringColor || "#c4a882" },
    { label: "Hardware", name: hardwareName, image: undefined, color: "#b8860b" },
    { label: "Sink", name: sinkName, image: undefined, color: "#c0c0c0" },
    { label: "Faucet", name: faucetName, image: undefined, color: "#a0a0a0" },
  ].filter((m) => m.name); // Only show materials that are selected

  if (materials.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
        No materials selected yet. Choose a door style, countertop, and other finishes in the Design Tool.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {materials.map((mat) => (
          <div key={mat.label} className="rounded-xl border border-border overflow-hidden shadow-sm">
            {/* Swatch */}
            <div className="aspect-square relative">
              {mat.image ? (
                <img
                  src={mat.image}
                  alt={mat.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div
                  className="w-full h-full"
                  style={{ backgroundColor: mat.color }}
                />
              )}
            </div>
            {/* Label */}
            <div className="p-2.5 bg-white">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{mat.label}</p>
              <p className="text-xs font-medium text-foreground truncate mt-0.5">{mat.name}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-4 text-center">
        Materials palette — your selected finishes at a glance
      </p>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export function DesignPreviewModal({
  open,
  onClose,
  placed,
  room,
  activeWall,
  doorStyleName,
  doorStyleColor,
  countertopColor,
  countertopName,
  backsplashColor,
  backsplashName,
  flooringColor,
  flooringName,
  hardwareName,
  sinkName,
  faucetName,
  doorStyleImage,
  countertopImage,
  backsplashImage,
  flooringImage,
}: DesignPreviewModalProps) {
  const [tab, setTab] = useState<PreviewTab>("elevation");

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-[95vw] max-w-4xl max-h-[90vh] bg-background rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="text-base font-semibold">Design Preview</h2>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={(v) => setTab(v as PreviewTab)} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mx-4 mt-3 shrink-0">
            <TabsTrigger value="elevation" className="gap-1.5 text-xs">
              <Image className="h-3.5 w-3.5" /> Elevation
            </TabsTrigger>
            <TabsTrigger value="isometric" className="gap-1.5 text-xs">
              <Box className="h-3.5 w-3.5" /> 3D View
            </TabsTrigger>
            <TabsTrigger value="moodboard" className="gap-1.5 text-xs">
              <Palette className="h-3.5 w-3.5" /> Materials
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto p-4 min-h-0">
            <TabsContent value="elevation" className="mt-0">
              <EnhancedElevation
                placed={placed}
                room={room}
                activeWall={activeWall}
                doorStyleColor={doorStyleColor}
                countertopColor={countertopColor}
                flooringColor={flooringColor}
                backsplashColor={backsplashColor}
              />
            </TabsContent>

            <TabsContent value="isometric" className="mt-0">
              <IsometricView
                placed={placed}
                room={room}
                doorStyleColor={doorStyleColor}
                countertopColor={countertopColor}
                flooringColor={flooringColor}
              />
            </TabsContent>

            <TabsContent value="moodboard" className="mt-0">
              <MaterialsMoodBoard
                doorStyleName={doorStyleName}
                doorStyleImage={doorStyleImage}
                countertopName={countertopName}
                countertopImage={countertopImage}
                countertopColor={countertopColor}
                backsplashName={backsplashName}
                backsplashImage={backsplashImage}
                backsplashColor={backsplashColor}
                flooringName={flooringName}
                flooringImage={flooringImage}
                flooringColor={flooringColor}
                hardwareName={hardwareName}
                sinkName={sinkName}
                faucetName={faucetName}
                doorStyleColor={doorStyleColor}
              />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
