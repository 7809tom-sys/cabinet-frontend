-- TiDB SQL editor version. Numbered 0246. Run after 0245.
-- Paste each numbered block on its own. One statement per block.
-- Every table is cabinet_dealz.<table>. No reserved-word aliases.
-- Block 1 and block 3 are read-only. Block 2 inserts one door_styles row and
-- changes nothing else: no SKUs, no prices, no swatch or paint-match rows.
--
-- What this adds: door style "Casselberry" (Warm Ivory, painted raised panel)
-- for U.S. Cabinet Depot. It is a separate row from 330026 "Casselberry Antique
-- White" (CW, #EDE0C8) and 330027 "Casselberry Saddle" (CS), which are already
-- USCD rows. 330026 and 330027 are not touched.
--
-- distributorId 210002 = U.S. Cabinet Depot. Source: the public endpoint
-- /api/trpc/distributors.list returns { id: 210002, code: "USCD", initials:
-- "USCD", name: "Madison" } ("Madison" is the neutral public series name), and
-- cabinet-backend seed_uscd_bridge.ts declares USCD_DISTRIBUTOR_ID = 210002.
--
-- Field values come from a ChatGPT read of a door photo (medium confidence).
-- Anything that read did not state stays NULL. The color is the read's hex as
-- given, not snapped to any brand palette or paint chip.
--
-- After the insert, the Designer paints this door #EEEADF (the style's own
-- saved catalog color) until Tom accepts a door render. Accepting a render writes
-- renderHex / approvedReferenceImageUrl / approvedVersionId (0245) onto this row,
-- and that render then becomes the door's color.

-- 1. Read-only: every USCD Casselberry row that already exists.
--    Expect exactly two rows: 330026 CW Casselberry Antique White and
--    330027 CS Casselberry Saddle. If any row with styleCode 'Casselberry', a
--    third row named "Casselberry", or any USCD row with color #EEEADF is listed,
--    it is already added: do NOT run block 2. (The admin create flow also rejects
--    a second row with the same distributorId + styleCode.)
SELECT
  uscd_style.id AS styleId,
  uscd_style.styleCode,
  uscd_style.ourName,
  uscd_style.aliasName,
  uscd_style.distributorName,
  uscd_style.doorStyle,
  uscd_style.finish,
  uscd_style.color,
  uscd_style.isActive
FROM cabinet_dealz.door_styles AS uscd_style
WHERE uscd_style.distributorId = 210002
  AND (
    uscd_style.styleCode = 'Casselberry'
    OR uscd_style.ourName LIKE '%Casselberry%'
    OR uscd_style.doorStyle = 'Casselberry'
    OR UPPER(uscd_style.color) = '#EEEADF'
  )
ORDER BY uscd_style.id;

-- 2. Insert the one new row.
--    styleCode is 'Casselberry', the full word, as Tom gave it from the source
--    data. It is 11 characters; the column is varchar(32) NOT NULL (cabinet-backend
--    drizzle/0001_equal_stick.sql and drizzle/schema.ts), so it fits unchanged.
--    It does not collide with CW or CS (330026 / 330027).
--
--    distributorName is NOT NULL. USCD's own name for this door is unknown, so
--    it is 'Casselberry', the same default the admin Create dialog uses
--    (distributorName falls back to ourName). It is admin-only, never public.
--    isActive = 1 matches every other USCD row. isFeatured = 0: the door has no
--    photo, thumbnail, or room scene yet. The accepted-render columns from 0245
--    (approvedReferenceImageUrl, approvedVersionId, approvedAt) are left out, so
--    they take their NULL default and this block runs whether or not 0245 is applied.
INSERT INTO cabinet_dealz.door_styles (
  distributorId,
  styleCode,
  ourName,
  aliasName,
  distributorName,
  doorStyle,
  woodSpecies,
  finish,
  color,
  renderHex,
  finishCategory,
  finishSheen,
  grainLightHex,
  grainDarkHex,
  railWidth,
  stileWidth,
  centerRailWidth,
  insideEdgeProfile,
  profileDescription,
  sourceSpecification,
  doorSampleImageUrl,
  drawerSampleImageUrl,
  thumbnailImageUrl,
  roomSceneImageUrl,
  isFeatured,
  isActive
) VALUES (
  210002,
  'Casselberry',
  'Casselberry',
  NULL,
  'Casselberry',
  'Raised Panel',
  NULL,
  'Painted',
  '#EEEADF',
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  'bevel',
  'Casselberry door with a raised center panel, beveled edges, and a painted warm ivory finish.',
  'Door photo read (ChatGPT, medium confidence). Not yet confirmed against a U.S. Cabinet Depot specification book. Sheen, wood species, and rail/stile widths unknown.',
  NULL,
  NULL,
  NULL,
  NULL,
  0,
  1
);

-- 3. Read-only check: the new row exists once, under USCD, with the read's values.
--    Expect exactly one row: styleCode Casselberry, ourName Casselberry,
--    doorStyle Raised Panel, finish Painted, color #EEEADF, insideEdgeProfile bevel,
--    isActive 1, isFeatured 0, and NULL for woodSpecies, finishSheen, renderHex,
--    grain hexes, and rail/stile widths.
SELECT
  new_style.id AS styleId,
  new_style.distributorId,
  new_style.styleCode,
  new_style.ourName,
  new_style.distributorName,
  new_style.doorStyle,
  new_style.finish,
  new_style.color,
  new_style.renderHex,
  new_style.woodSpecies,
  new_style.finishSheen,
  new_style.grainLightHex,
  new_style.grainDarkHex,
  new_style.railWidth,
  new_style.stileWidth,
  new_style.insideEdgeProfile,
  new_style.profileDescription,
  new_style.isActive,
  new_style.isFeatured
FROM cabinet_dealz.door_styles AS new_style
WHERE new_style.distributorId = 210002
  AND new_style.styleCode = 'Casselberry'
  AND new_style.ourName = 'Casselberry'
ORDER BY new_style.id;
