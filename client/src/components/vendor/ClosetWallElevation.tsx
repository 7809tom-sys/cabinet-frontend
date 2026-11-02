import {
  STUDIO_BASKET_FRAME_HEX, STUDIO_BASKET_LINER_PLACEHOLDER_HEX, STUDIO_ROOM_HEIGHT_DEFAULT_IN, studioBasketPlacementsForWall, studioBays, studioCornerShelvesForWall, studioFixedBottom, studioFixedTop, studioItemHeight,
  studioPanelHeight, studioTowerFootprint, studioWallLength, studioWidthForWall,
  type StudioDesign, type StudioWall,
} from "@/lib/vendorClosetStudio";

const SCALE = 6; // px per inch
const MARGIN = { left: 76, right: 56, top: 34, bottom: 78 };
const UPRIGHT_IN = 0.75;
const finishFill: Record<StudioDesign["finish"], string> = { "Glacier White": "#f1f0eb", "Slate Rift": "#6a6a67", "Spiced Mahogany": "#8a5a45" };
const wallTitles: Record<StudioWall, string> = { back: "Back wall", left: "Left wall", right: "Right wall", front: "Front wall" };
/** Inches, rounded for labels: 24 → 24″, 22.5 → 22.5″. */
const inches = (value: number) => `${Math.round(value * 100) / 100}″`;
const halo = { paintOrder: "stroke", stroke: "#fbfaf7", strokeWidth: 3, strokeLinejoin: "round" } as const;

/**
 * Front view of one room wall drawn from the design state: uprights, towers, every placed part at its height from the floor,
 * and dimension lines (tower widths, used vs wall length, upright height, room height). Illustrative planning view, not an installation drawing.
 */
export function ClosetWallElevation({ design, wall }: { design: StudioDesign; wall: StudioWall }) {
  const bays = studioBays(design, wall);
  const lengthIn = studioWallLength(design, wall);
  const roomIn = design.roomHeightIn ?? STUDIO_ROOM_HEIGHT_DEFAULT_IN;
  const panelIn = studioPanelHeight(design);
  const bottomIn = studioFixedBottom(design);
  const topIn = studioFixedTop(design);
  const footprint = studioTowerFootprint(design, wall);
  const startIn = wall === "back" || wall === "front" ? footprint.xMin : footprint.zMin;
  const usedIn = studioWidthForWall(design, wall);
  const width = lengthIn * SCALE + MARGIN.left + MARGIN.right;
  const height = roomIn * SCALE + MARGIN.top + MARGIN.bottom;
  const x = (inch: number) => MARGIN.left + inch * SCALE;
  const y = (inchFromFloor: number) => MARGIN.top + (roomIn - inchFromFloor) * SCALE;
  const fill = finishFill[design.finish];
  let cursorIn = startIn;
  const columns = bays.map((bay) => {
    const left = cursorIn + UPRIGHT_IN;
    cursorIn = left + bay.widthIn;
    return { bay, left, right: left + bay.widthIn };
  });
  const placements = studioBasketPlacementsForWall(design, wall);
  const corners = studioCornerShelvesForWall(design, wall);
  const dimY = y(0) + 18;
  const totalY = y(0) + 44;

  return <svg role="img" aria-label={`${wallTitles[wall]} elevation: ${bays.length} tower${bays.length === 1 ? "" : "s"}, ${inches(usedIn)} of ${inches(lengthIn)} used, ${inches(roomIn)} room height`}
    viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet" data-testid="closet-wall-elevation" data-wall={wall}>
    <rect x="0" y="0" width={width} height={height} fill="#f4f1ea" />
    <text x={MARGIN.left} y="18" fontSize="12" fontWeight="700" fill="#4b4338">{wallTitles[wall]} · front view</text>
    {/* Room height line and wall */}
    <rect x={x(0)} y={y(roomIn)} width={lengthIn * SCALE} height={roomIn * SCALE} fill="#fbfaf7" stroke="#cfc6b8" />
    <line x1={x(0)} x2={x(lengthIn)} y1={y(roomIn)} y2={y(roomIn)} stroke="#9a8f80" strokeDasharray="6 4" />
    <text x={x(lengthIn) + 6} y={y(roomIn) + 4} fontSize="10" fill="#6d6458">ceiling</text>
    <line x1={x(0) - 46} x2={x(0) - 46} y1={y(0)} y2={y(roomIn)} stroke="#6d6458" />
    <line x1={x(0) - 50} x2={x(0) - 42} y1={y(0)} y2={y(0)} stroke="#6d6458" /><line x1={x(0) - 50} x2={x(0) - 42} y1={y(roomIn)} y2={y(roomIn)} stroke="#6d6458" />
    <text transform={`translate(${x(0) - 52} ${(y(0) + y(roomIn)) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#4b4338">{inches(roomIn)} room height</text>
    <line x1={x(0)} x2={x(lengthIn)} y1={y(0)} y2={y(0)} stroke="#4b4338" strokeWidth="2" />
    {!bays.length && <text x={x(lengthIn / 2)} y={y(roomIn / 2)} textAnchor="middle" fontSize="13" fill="#7a7062">No towers on this wall</text>}
    {bays.length > 0 && <>
      {/* Upright height */}
      <line x1={x(startIn) - 22} x2={x(startIn) - 22} y1={y(0)} y2={y(panelIn)} stroke="#6d6458" />
      <line x1={x(startIn) - 26} x2={x(startIn) - 18} y1={y(0)} y2={y(0)} stroke="#6d6458" /><line x1={x(startIn) - 26} x2={x(startIn) - 18} y1={y(panelIn)} y2={y(panelIn)} stroke="#6d6458" />
      <text transform={`translate(${x(startIn) - 28} ${(y(0) + y(panelIn)) / 2}) rotate(-90)`} textAnchor="middle" fontSize="11" fill="#4b4338">{inches(panelIn)} upright</text>
      {/* Uprights */}
      {[startIn, ...columns.map((column) => column.right)].map((at, index) => <rect key={`upright-${index}`} x={x(at)} y={y(panelIn)} width={UPRIGHT_IN * SCALE} height={panelIn * SCALE} fill={fill} stroke="#8e8576" strokeWidth="0.8" />)}
      {columns.map(({ bay, left, right }, index) => <g key={bay.id} data-testid={`elevation-tower-${index + 1}`}>
        <rect x={x(left)} y={y(panelIn)} width={bay.widthIn * SCALE} height={panelIn * SCALE} fill="#fffdf9" fillOpacity="0.55" stroke="#d6cdbf" strokeWidth="0.6" />
        <rect x={x(left)} y={y(bottomIn + UPRIGHT_IN)} width={bay.widthIn * SCALE} height={UPRIGHT_IN * SCALE} fill={fill} stroke="#8e8576" strokeWidth="0.8" />
        <rect x={x(left)} y={y(topIn + UPRIGHT_IN)} width={bay.widthIn * SCALE} height={UPRIGHT_IN * SCALE} fill={fill} stroke="#8e8576" strokeWidth="0.8" />
        {bay.items.map((item) => {
          const itemHeight = studioItemHeight(item.kind);
          const label = <text x={x(left + bay.widthIn / 2)} y={y(item.bottomIn + itemHeight) - 3} textAnchor="middle" fontSize="10" fontWeight="600" fill="#3d362d" style={halo}>{inches(item.bottomIn)}</text>;
          if (item.kind === "rod") return <g key={item.id} data-item={item.kind}>
            <line x1={x(left) + 3} x2={x(left + bay.widthIn) - 3} y1={y(item.bottomIn)} y2={y(item.bottomIn)} stroke="#8c8f94" strokeWidth="3" strokeLinecap="round" />
            <circle cx={x(left) + 4} cy={y(item.bottomIn)} r="2.5" fill="#6f7378" /><circle cx={x(left + bay.widthIn) - 4} cy={y(item.bottomIn)} r="2.5" fill="#6f7378" />{label}
          </g>;
          if (item.kind === "shelf") return <g key={item.id} data-item={item.kind}><rect x={x(left)} y={y(item.bottomIn + itemHeight)} width={bay.widthIn * SCALE} height={Math.max(2.5, itemHeight * SCALE)} fill={fill} stroke="#8e8576" strokeWidth="0.8" />{label}</g>;
          if (item.kind === "drawer") return <g key={item.id} data-item={item.kind}><rect x={x(left) + 1} y={y(item.bottomIn + itemHeight)} width={bay.widthIn * SCALE - 2} height={itemHeight * SCALE} fill={fill} stroke="#6f6659" strokeWidth="1" /><line x1={x(left + bay.widthIn / 2) - 10} x2={x(left + bay.widthIn / 2) + 10} y1={y(item.bottomIn + itemHeight) + 5} y2={y(item.bottomIn + itemHeight) + 5} stroke="#6f6659" strokeWidth="2" strokeLinecap="round" />{label}</g>;
          return <g key={item.id} data-item={item.kind}><rect x={x(left) + 1} y={y(item.bottomIn + itemHeight)} width={bay.widthIn * SCALE - 2} height={itemHeight * SCALE} fill="#e9dcc7" fillOpacity="0.7" stroke="#8e8576" strokeDasharray="4 3" strokeWidth="1" /><line x1={x(left) + 1} x2={x(left + bay.widthIn) - 1} y1={y(item.bottomIn)} y2={y(item.bottomIn + itemHeight)} stroke="#8e8576" strokeWidth="1.2" />{label}</g>;
        })}
        {placements.filter((placement) => placement.bayId === bay.id).map((placement) => <g key={placement.id} data-item="basket"><rect x={x(left) + 2} y={y(placement.bottomIn + placement.nominalHeightIn)} width={bay.widthIn * SCALE - 4} height={placement.nominalHeightIn * SCALE} fill={STUDIO_BASKET_LINER_PLACEHOLDER_HEX} fillOpacity="1" stroke={STUDIO_BASKET_FRAME_HEX} strokeWidth="1.6" /><text x={x(left + bay.widthIn / 2)} y={y(placement.bottomIn + placement.nominalHeightIn) - 3} textAnchor="middle" fontSize="10" fontWeight="600" fill="#3d362d" style={halo}>{inches(placement.bottomIn)}</text></g>)}
        {/* Tower width dimension */}
        <line x1={x(left)} x2={x(left + bay.widthIn)} y1={dimY} y2={dimY} stroke="#6d6458" />
        <line x1={x(left)} x2={x(left)} y1={dimY - 4} y2={dimY + 4} stroke="#6d6458" /><line x1={x(left + bay.widthIn)} x2={x(left + bay.widthIn)} y1={dimY - 4} y2={dimY + 4} stroke="#6d6458" />
        <text x={x(left + bay.widthIn / 2)} y={dimY + 15} textAnchor="middle" fontSize="11" fill="#3d362d">{inches(bay.widthIn)}{bay.stockWidthIn ? ` (cut from ${inches(bay.stockWidthIn)})` : ""}</text>
      </g>)}
      {corners.map((shelf) => {
        const atStart = wall === "back" || wall === "front" ? shelf.cornerId.endsWith("left") : shelf.cornerId.startsWith("back");
        const from = atStart ? 0 : lengthIn - shelf.nominalFootprintIn;
        return <g key={shelf.id} data-item="corner-shelf"><rect x={x(from)} y={y(shelf.elevationIn + 0.75)} width={shelf.nominalFootprintIn * SCALE} height={Math.max(2.5, 0.75 * SCALE)} fill={fill} fillOpacity="0.7" stroke="#8e8576" strokeDasharray="5 3" />
          <text x={x(from + shelf.nominalFootprintIn / 2)} y={y(shelf.elevationIn + 0.75) - 3} textAnchor="middle" fontSize="10" fontWeight="600" fill="#3d362d" style={halo}>corner {inches(shelf.elevationIn)}</text></g>;
      })}
      {/* Total used vs wall length */}
      <line x1={x(0)} x2={x(lengthIn)} y1={totalY} y2={totalY} stroke="#4b4338" />
      <line x1={x(0)} x2={x(0)} y1={totalY - 5} y2={totalY + 5} stroke="#4b4338" /><line x1={x(lengthIn)} x2={x(lengthIn)} y1={totalY - 5} y2={totalY + 5} stroke="#4b4338" />
      <text x={x(lengthIn / 2)} y={totalY + 16} textAnchor="middle" fontSize="11" fontWeight="700" fill="#3d362d">{inches(usedIn)} of towers · {inches(lengthIn)} wall</text>
    </>}
  </svg>;
}
