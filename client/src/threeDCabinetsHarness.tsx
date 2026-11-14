/**
 * Harness for "cabinets show in 2D but not in 3D". Renders the REAL
 * InteractiveRoom3D for a real Auto Design kitchen built from the fixture
 * catalog (or one hand-placed cabinet) and publishes what the 2D plan holds on
 * `window.__threeDCabinetsHarness` so a headless run can compare it with the
 * scene. Loaded only by dev/three-d-cabinets-shot.html.
 */
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import "@/index.css";
import { trpc as typedTrpc } from "@/lib/trpc";

// The router type does not resolve in the client-only tsc run; the harness only
// needs the provider, so it uses the client untyped.
const trpc = typedTrpc as unknown as { createClient: (options: unknown) => unknown; Provider: (props: { client: unknown; queryClient: QueryClient; children: React.ReactNode }) => React.ReactElement };
import catalogFixture from "@/lib/__fixtures__/autoDesignMatrixCatalog.json";
import { runAutoDesignLayout, mergeAutoDesignRefrigeratorCaps } from "@/lib/autoDesignLayout";
import { emptyAutoDesignIntake } from "@/lib/autoDesignFifteenRules";
import { APPLIANCES, applianceAsDesignCabinet, type DesignCabinet, type PlacedCabinet, type RoomData, type SinkFixture, type WallOpening } from "@/lib/design";
import { InteractiveRoom3D, type InteractiveRoomScene } from "@/components/design/InteractiveRoom3D";

type Pack = { base: DesignCabinet[]; wall: DesignCabinet[]; accessory?: DesignCabinet[]; surround?: { deepAbove?: DesignCabinet[]; endPanels?: DesignCabinet[] } };
const matrix = catalogFixture as unknown as Record<string, Pack>;

const STOCK: DesignCabinet[] = [
  { id: 9001, masterCode: "BF3", description: '3" Base Filler', category: "Filler", subCategory: "Filler", width: "3", height: "34.5", depth: "24", placement: "accessory" } as unknown as DesignCabinet,
  { id: 9002, masterCode: "WF3", description: '3" Wall Filler', category: "Filler", subCategory: "Filler", width: "3", height: "30", depth: "12", placement: "accessory" } as unknown as DesignCabinet,
];
// The real designer appliance list, so every appliance carries its catalog height.
const PALETTE = ["RANGE-30", "DW-24", "FRIDGE-36", "HOOD-30"].map((code) => APPLIANCES.find((item) => item.masterCode === code)!).filter(Boolean);

function scenario(index: number) {
  let seed = 7 + index * 7919;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const styleIds = Object.keys(matrix);
  const styleId = styleIds[index % styleIds.length]!;
  const pack = matrix[styleId]!;
  const room: RoomData = { width: [132, 144, 156, 168][Math.floor(rnd() * 4)]!, depth: [108, 120, 144][Math.floor(rnd() * 3)]!, ceilingHeight: 96 };
  const layoutType = (["l-shape", "u-shape", "l-shape"] as const)[Math.floor(rnd() * 3)]!;
  const win = rnd() < 0.6;
  const sinkC = Math.round(40 + rnd() * (room.depth - 80));
  const fr = Math.round(18 + rnd() * 8);
  const st = Math.round(fr + 50 + rnd() * 30);
  const openings: WallOpening[] = win ? [{ uid: "harness-window", kind: "window", label: "Window", side: "right", offset: sinkC - 18, width: 36, height: 36, sill: 42 } as WallOpening] : [];
  let uid = 0;
  const result = runAutoDesignLayout({
    input: {
      layoutType, originCorner: "left", runDirection: "right", wallCabinetHeightIn: [30, 36, 42][Math.floor(rnd() * 3)]!,
      refrigerator: { wallLabel: "Wall 1", centerOffsetIn: fr }, stove: { wallLabel: "Wall 1", centerOffsetIn: st },
      sink: { wallLabel: "Wall 2", centerOffsetIn: sinkC }, sinkBaseWidthIn: 36, sinkBaseKind: rnd() < 0.3 ? "farmhouse" : "regular", dishwasherSide: rnd() < 0.5 ? "right" : "left",
      sinkWindowCenter: win ? { wallLabel: "Wall 2", centerOffsetIn: sinkC } : null,
      kitchenUsage: { uses: [], skipped: true, acceptedSuggestionIds: [] },
      intake: { ...emptyAutoDesignIntake(), construction: "new", canMove: { electrical: true, plumbing: true, rangeHookup: true, sinkBase: true } },
    } as never,
    room, openings, baseCatalog: pack.base, wallCatalog: pack.wall, fillers: [...(pack.accessory ?? []), ...STOCK],
    appliancePalette: PALETTE.map(applianceAsDesignCabinet), refrigeratorCaps: mergeAutoDesignRefrigeratorCaps(pack.wall, pack.surround?.deepAbove ?? []),
    refrigeratorEndPanels: pack.surround?.endPanels ?? [], tallCatalog: [], styleId: Number(styleId), makeUid: () => `h-${++uid}`,
  } as never) as { ok: boolean; message?: string; placed?: PlacedCabinet[]; sinks?: SinkFixture[]; openings?: WallOpening[] };
  return { styleId, layoutType, room, result, openings: result.ok ? (result.openings?.length ? result.openings : openings) : openings };
}

const manualB24: PlacedCabinet = {
  uid: "manual-b24", cabinetId: 1, masterCode: "B24", description: '24" Base Cabinet', category: "Base", subCategory: "Base Cabinet",
  placement: "base", x: 30, y: 0, width: 24, depth: 24, height: 34.5, rotation: 0, numberOfDoors: 2, numberOfDrawers: 1, wallId: "top", wallOffset: 30,
} as PlacedCabinet;

const params = new URLSearchParams(window.location.search);
const which = params.get("scenario") ?? "0";
let room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };
let placed: PlacedCabinet[] = [];
let sinks: SinkFixture[] = [];
let openings: WallOpening[] = [];
let label = which;
if (which === "manual") {
  placed = [manualB24];
} else {
  const built = scenario(Number(which));
  room = built.room;
  label = `${which} ${built.styleId} ${built.layoutType} ${room.width}x${room.depth}`;
  if (built.result.ok) {
    placed = built.result.placed ?? [];
    sinks = built.result.sinks ?? [];
    openings = built.openings;
  } else {
    label += ` NOT-OK ${built.result.message ?? ""}`;
  }
}
if (params.get("bad") === "1") {
  placed = [...placed, { ...manualB24, uid: "harness-bad", masterCode: "B30", x: Number.NaN, width: Number.NaN } as PlacedCabinet];
}
if (params.get("bad") === "2") {
  // A record whose master code went missing: the kind of single bad row that used
  // to throw inside the cabinet loop.
  placed = [...placed, { ...manualB24, uid: "harness-no-code", x: 80, wallOffset: 80, masterCode: undefined } as unknown as PlacedCabinet];
}
(window as unknown as Record<string, unknown>).__threeDCabinetsHarness = { label, planCount: placed.length, planUids: placed.map((item) => item.uid) };

const SCENE: InteractiveRoomScene = {
  roomShape: { id: "harness-room", name: "Harness room", defaultDimensions: room, geometryTemplate: null },
  layout: { id: "harness-layout", name: "Auto Design" },
  suggestions: [],
  materials: {
    cabinet: { publicName: "Shaker White", name: "Shaker White", color: "#f2f0ea", finish: "Painted", doorStyle: "Shaker", doorPanelType: "Recessed Panel" },
    defaults: { floor: "#d9c9a8", countertop: "#e9e7e2", backsplash: "#f2f0ea", wall: "#f7f5f0" },
  },
};

const trpcClient = trpc.createClient({ links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })] });
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <div className="relative flex h-[100dvh] w-screen flex-col overflow-hidden bg-background">
        <InteractiveRoom3D embedded hybridPlanUnderlay={params.get("hybrid") === "1"} cutawayRoomWalls scene={SCENE} placed={placed} sinks={sinks} openings={openings} roomOverride={room} toeKick crown className="h-full min-h-0" />
      </div>
    </QueryClientProvider>
  </trpc.Provider>,
);
