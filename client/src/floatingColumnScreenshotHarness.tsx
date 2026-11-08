/**
 * Screenshot harness for the right-edge floating buttons on the 3D canvas.
 *
 * It renders the REAL `InteractiveRoom3D` stage around a REAL WebGL room, so the
 * capture shows the buttons the owner actually sees rather than a mock of them.
 * Only two things are stubbed: the tRPC transport (no backend in a screenshot
 * run) and the page's quick-add callbacks (which only open Designer panels).
 *
 * Query params:
 *   ?immersive=1  start in fullscreen / Focus 3D mode
 *   ?legacy=1     draw the PREVIOUS arrangement (toggle pinned top-right, the
 *                 quick adds in a second rail, zoom/share in a third, PAN pad
 *                 floating above the bottom) so the same page yields the before
 *                 and after half of the comparison.
 *
 * Loaded only by `dev/floating-column-shot.html` during the screenshot run
 * (`e2e/floating-column-screenshot.spec.ts`). Not part of the app bundle: nothing
 * imports it and no route points at it.
 */
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Boxes,
  Maximize2,
  Minimize2,
  Minus,
  PanelTop,
  Plus,
  RefreshCw,
  Share2,
  Sparkles,
  Sun,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import "@/index.css";
import { trpc } from "@/lib/trpc";
import { DEFAULT_ROOM, type PlacedCabinet, type RoomData } from "@/lib/design";
import {
  InteractiveRoom3D,
  THREE_D_EMBEDDED_TOOLBAR_CLASS,
  type InteractiveRoomScene,
} from "@/components/design/InteractiveRoom3D";
import { CanvasActionRail } from "@/components/design/CanvasActionRail";

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 144, depth: 120, ceilingHeight: 96 };

const SCENE: InteractiveRoomScene = {
  roomShape: { id: "shot-room", name: "Screenshot room", defaultDimensions: ROOM, geometryTemplate: null },
  layout: { id: "shot-layout", name: "Single wall" },
  suggestions: [],
  materials: {
    cabinet: {
      publicName: "Shaker White",
      name: "Shaker White",
      color: "#e8e2d6",
      finish: "Painted",
      doorStyle: "Shaker",
      doorPanelType: "Recessed Panel",
    },
    defaults: { floor: "#d9c9a8", countertop: "#3d4245", backsplash: "#f2f0ea", wall: "#f7f5f0" },
  },
};

function cabinet(uid: string, x: number, width: number, height: number, placement: "base" | "wall"): PlacedCabinet {
  return {
    uid,
    cabinetId: 1,
    masterCode: `${placement === "base" ? "B" : "W"}${width}${height}`,
    description: `${width}" ${placement === "base" ? "Base" : "Wall"} Cabinet`,
    category: placement === "base" ? "Base" : "Wall",
    subCategory: placement === "base" ? "Base Cabinet" : "Wall Cabinet",
    placement,
    x,
    y: 0,
    width,
    depth: placement === "base" ? 24 : 12,
    height,
    rotation: 0,
    numberOfDoors: width > 18 ? 2 : 1,
    numberOfDrawers: placement === "base" ? 1 : 0,
    wallId: "top",
    wallOffset: x,
  } as PlacedCabinet;
}

/** One ordinary run, so the room behind the buttons is a real kitchen. */
const PLACED: PlacedCabinet[] = [
  cabinet("b1", 0, 36, 34.5, "base"),
  cabinet("b2", 36, 24, 34.5, "base"),
  cabinet("b3", 60, 30, 34.5, "base"),
  cabinet("w1", 0, 30, 30, "wall"),
  cabinet("w2", 30, 30, 30, "wall"),
  cabinet("w3", 60, 30, 30, "wall"),
];

const trpcClient = trpc.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

/**
 * The arrangement the owner reported: the fullscreen toggle alone at the top
 * right, the quick adds in a second rail, the zoom/share rail under it, and the
 * PAN pad floating above the corner. Only used for the "before" capture.
 */
function LegacyFloatingButtons({ immersive, onToggle }: { immersive: boolean; onToggle: () => void }) {
  const square = "flex h-11 w-11 items-center justify-center rounded-md border border-slate-300 bg-white text-[#1a2744] shadow-sm";
  return (
    <>
      <button type="button" onClick={onToggle} aria-label="Fullscreen view" className={`${square} absolute right-3 top-3 z-40`}>
        {immersive ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <div data-testid="legacy-quick-rail" className="absolute right-2 top-[6.75rem] z-30 flex flex-col items-center gap-2">
        <span className={`${square} h-11 w-11 flex-col rounded-xl border-[#d9cdb4] text-[8px] font-semibold`}>
          <Boxes className="h-5 w-5" />Cabinet
        </span>
        <span className={`${square} h-11 w-11 flex-col rounded-xl border-[#d9cdb4] text-[8px] font-semibold`}>
          <Wrench className="h-5 w-5" />Hardware
        </span>
      </div>
      <div data-testid="legacy-nav-rail" className="absolute right-3 top-40 z-20 flex flex-col items-center gap-1">
        <span className={square}><Plus className="h-5 w-5" /></span>
        <span className={square}><Minus className="h-5 w-5" /></span>
        <span className={square}><RefreshCw className="h-5 w-5" /></span>
        <span className={square}><Share2 className="h-5 w-5" /></span>
        <span className={square}><Sun className="h-5 w-5" /></span>
        <span className={`${square} border-[#d4a75a] text-[#765416]`}><Sparkles className="h-5 w-5" /></span>
        <div className="mt-2 grid grid-cols-3 gap-0.5 rounded-md border border-slate-300 bg-white/95 p-0.5">
          <span />
          <span className="flex h-8 w-8 items-center justify-center"><ArrowUp className="h-4 w-4" /></span>
          <span />
          <span className="flex h-8 w-8 items-center justify-center"><ArrowLeft className="h-4 w-4" /></span>
          <span className="flex items-center justify-center text-[9px] font-bold text-slate-500">PAN</span>
          <span className="flex h-8 w-8 items-center justify-center"><ArrowRight className="h-4 w-4" /></span>
          <span />
          <span className="flex h-8 w-8 items-center justify-center"><ArrowDown className="h-4 w-4" /></span>
          <span />
        </div>
      </div>
    </>
  );
}

function Harness() {
  const params = new URLSearchParams(window.location.search);
  const legacy = params.get("legacy") === "1";
  const [immersive, setImmersive] = useState(params.get("immersive") === "1");
  const toggle = () => setImmersive((current) => !current);

  const quickActions = (
    <CanvasActionRail
      inline
      testIdPrefix="three-d-floating"
      actions={["cabinet", "hardware"]}
      onAddCabinet={() => {}}
      onAddHardware={() => {}}
    />
  );
  const autoDesignAction = (
    <CanvasActionRail
      inline
      testIdPrefix="three-d-floating"
      actions={["autoDesign"]}
      onAddCabinet={() => {}}
      onAddHardware={() => {}}
      onAutoDesign={() => {}}
    />
  );

  return (
    <div className="relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-background">
      <InteractiveRoom3D
        embedded
        immersive={immersive}
        onToggleImmersive={legacy ? undefined : toggle}
        scene={SCENE}
        placed={PLACED}
        roomOverride={ROOM}
        className="h-full min-h-0"
        floatingQuickActions={legacy ? undefined : quickActions}
        floatingAutoDesignAction={legacy ? undefined : autoDesignAction}
      />
      {/* The colour-preview / flooring / wall-height row that is NOT part of the
          right edge. Shown so the capture proves the column did not take it over. */}
      <div className={`${THREE_D_EMBEDDED_TOOLBAR_CLASS} pointer-events-none flex`} aria-hidden="true">
        <span className="rounded-md bg-[#1a2744] px-2.5 py-1.5 text-xs font-semibold text-white">
          <Plus className="mr-1 inline h-3.5 w-3.5" />Add cabinet
        </span>
        <span className="rounded-md border px-2.5 py-1.5 text-xs font-semibold text-[#1a2744]">
          <PanelTop className="mr-1 inline h-3.5 w-3.5" />Wall heights
        </span>
      </div>
      {legacy ? <LegacyFloatingButtons immersive={immersive} onToggle={toggle} /> : null}

    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <Harness />
    </QueryClientProvider>
  </trpc.Provider>,
);
