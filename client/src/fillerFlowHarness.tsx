import { createRoot } from "react-dom/client";
import "@/index.css";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PlanCanvas } from "@/components/design/PlanCanvas";
import { DEFAULT_ROOM, wallPlacementAt, type PlacedCabinet, type RoomData } from "@/lib/design";

const ROOM: RoomData = { ...DEFAULT_ROOM, width: 120, depth: 96, ceilingHeight: 96 };

function cabinet(row: Partial<PlacedCabinet> & Pick<PlacedCabinet, "uid" | "masterCode" | "width">): PlacedCabinet {
  const along = Number(row.wallOffset) || 0;
  const spot = wallPlacementAt(along, row.width, row.depth ?? 24, "top", ROOM);
  return {
    cabinetId: 1,
    description: `${row.width}" cabinet`,
    category: "Base",
    subCategory: "Standard Base",
    placement: "base",
    depth: 24,
    height: 34.5,
    numberOfDoors: 1,
    numberOfDrawers: 0,
    ...spot,
    ...row,
  } as PlacedCabinet;
}

const PLACED: PlacedCabinet[] = [
  cabinet({ uid: "l", masterCode: "B24", wallOffset: 6, width: 24 }),
  cabinet({ uid: "range", cabinetId: 0, masterCode: "RANGE-30", description: '30" Range', category: "Appliance", subCategory: "Appliance", placement: "appliance", wallOffset: 30, width: 30, depth: 25, height: 36 }),
  cabinet({
    uid: "filler", cabinetId: 102, masterCode: "BF3", description: '3" Base Filler',
    category: "Filler", subCategory: "Filler", wallOffset: 60, width: 3, depth: 24, height: 34.5,
    numberOfDoors: 0, fillerPieceGroupId: "g1", fillerBillingRole: "primary",
    fillerTotalWidth: 3, fillerPlacementMode: "right", fillerForCabinetUid: "range",
  }),
  cabinet({ uid: "r", masterCode: "B27", wallOffset: 63, width: 27 }),
];

declare global {
  interface Window {
    __fillerFlow?: { selected: string[]; deleted: string[]; menu: string[]; ready: boolean };
  }
}

const log = { selected: [] as string[], deleted: [] as string[], menu: [] as string[], ready: false };
window.__fillerFlow = log;

function App() {
  return (
    <LanguageProvider>
      <PlanCanvas
        room={ROOM}
        cabinets={PLACED}
        selectedUid={null}
        onSelect={(uid) => { if (uid) log.selected.push(uid); }}
        onMove={() => undefined}
        onDelete={(uid) => { log.deleted.push(uid); }}
        showWallLayer
        activeWall="top"
        conflictUids={new Set<string>()}
        missingPriceUids={new Set<string>()}
      />
    </LanguageProvider>
  );
}

createRoot(document.getElementById("plan")!).render(<App />);
setTimeout(() => { log.ready = true; }, 500);
