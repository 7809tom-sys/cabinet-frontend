# Designer inventory integration

There is no live vendor inventory feed. The Designer checks stock through an `InventoryProvider` and, when a cabinet is out of stock, suggests alternatives. The user chooses Swap. Nothing is swapped automatically, and prices are never edited.

Production uses `UnknownInventoryProvider`. Every SKU comes back as `unknown`. The Designer draws no badge and no suggestion panel for that status, so behavior matches a design with no inventory data.

## Where the code lives

- `client/src/lib/inventoryProvider.ts` — `InventoryProvider`, the unknown provider, the admin simulation stub, and the unwired vendor placeholder.
- `client/src/lib/inventoryAlternatives.ts` — which cabinets are flagged, which substitutes fit, and how a chosen swap is applied.
- `client/src/lib/useDesignerInventory.ts` — wires the provider into the Designer. It does not call the catalog for other door styles unless an admin simulation has an out-of-stock cabinet.
- `client/src/components/design/InventoryStockNotice.tsx` — the badge and the suggestion panel.
- The Designer page (`client/src/pages/DesignTool.tsx`) renders the badge on the selected cabinet and a design-level “Out of stock” control.

No backend change and no SQL are required for this seam. Catalog rows already loaded for the active door style are the suggestion source. Other door styles from the same vendor are loaded only for the admin simulation, through the existing `design.placeableCabinets` query.

## Stock result

```ts
getStockStatus(skus: string[]) => Array<{
  sku: string;
  status: "in_stock" | "low" | "out_of_stock" | "unknown";
  qtyAvailable?: number;
  vendor?: string;
  asOf?: string;
}>
```

A cabinet is flagged only when the resolved status is `out_of_stock`. `unknown`, `low`, and `in_stock` show nothing.

Stock is looked up from the most specific key that has a real status:

1. Vendor SKU, when the catalog row has one.
2. Catalog SKU, when it differs.
3. `styleId:masterCode` (one door style).
4. `masterCode` (every door style of that code).

A missing row stays `unknown`. It is not treated as zero.

## Alternatives

For an out-of-stock cabinet, in this order, using only the earlier tier when it has a match:

1. Same width, height, depth, and type in the same door style.
2. That same size and type in another door style from the same vendor.
3. Two smaller cabinets of that type whose widths add up to the opening.

Type follows the Designer: door base, drawer base, sink base, farm sink base, wall, glass wall, tall, filler, and corner type. Corner openings stay blind, easy-reach, or diagonal. Easy-reach includes the lazy-susan codes the Designer already treats as that corner. A corner, sink base, filler, or panel is never split into two cabinets. A filler is never added to make a combination fit, and a filler is never offered in place of a cabinet. The piece that touches a range is at least 15 inches wide. A combination beside a dishwasher fills the opening exactly.

Swap keeps the cabinet’s place. A one-for-one swap keeps an existing per-cabinet discount because that discount was already on the line; the swap does not add or change a price. A two-cabinet swap creates the new pieces with no discount. Catalog pricing then prices whatever SKU is on the plan.

## Run the simulation

The simulation is admin-only. A signed-in administrator opens the Designer with one of these. Anyone else, including a customer with the same URL, sees no stock badges.

| URL | Effect |
| --- | --- |
| `?inventorySim=1` | Fixture: `B36`, `W3012`, `SB36`, `BBC36`, `DB24` are out of stock in every door style. |
| `?inventorySim=B36,BBC36` | Those master codes are out of stock in every door style. |
| `?inventorySim=11:B36` | Only door style 11’s B36 is out. The same code in another style from this vendor can be suggested. |
| `?inventorySim=0` | Simulation off, even if localStorage is set. |

The same values work in localStorage under `cabinetdealz.inventorySim`. The URL wins when both are set.

```js
localStorage.setItem("cabinetdealz.inventorySim", "B36,BBC36");
```

Unlisted SKUs are treated as in stock only inside this simulation, so a substitute can be offered. That assumption is not used by the unknown provider or the vendor placeholder.

While the simulation is on, the toolbar shows “Out of stock (n)” when a marked SKU is in the design, or a quiet “Stock simulation” chip when none of the marked SKUs are placed. Open the chip or the badge on the selected cabinet for suggestions. Swap is explicit.

## Plug in a live feed later

1. Teach `VendorApiInventoryProvider.getStockStatus` to request the SKUs and map each row with `stockStatusFromVendorRecord`.
2. Leave quantity `null`, and leave `outOfStock` unset, when the feed has no row for a SKU. That stays `unknown`, and the Designer stays quiet.
3. Return that provider from `resolveDesignerInventoryProvider` only after the feed is live. Until then the placeholder reports `unknown` and `configured` is `false`.
4. Do not invent prices in the feed adapter. The Designer keeps using the catalog price for whatever cabinet the user swaps to.

`stockStatusFromVendorRecord` maps `0` or `outOfStock: true` to out of stock, `1`–`2` to low, and a larger on-hand quantity to in stock. Low stock is stored for a later feed and is not flagged in the Designer.

Suggested vendor payload fields, when a feed exists: SKU, quantity on hand, an explicit out-of-stock flag, vendor name, and an as-of timestamp. Style-specific availability should use a distinct vendor SKU or the `styleId:masterCode` key so one finish can be out while another finish of the same master code is still available.
