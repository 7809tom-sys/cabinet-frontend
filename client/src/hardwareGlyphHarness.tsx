import { useMemo } from "react";
import { HardwareGlyph } from "@/components/design/HardwareElevationGlyph";
import { hardwareDrawSpec, hardwareDrawnSizeIn } from "@/lib/hardwareElevation";
import type { CatalogHardwareSelection } from "@/lib/hardware";

// A straight-on proof sheet for the elevation hardware glyphs. Each row is one
// real catalog item drawn at its true catalog size on a 30-inch cabinet scale,
// so the shapes and relative lengths can be reviewed without the Designer.
const SCALE_PX_PER_IN = 26;

const SAMPLES: CatalogHardwareSelection[] = [
  { vendorProductId: 1, sku: "A-96", collection: "Aiden", productType: "Pull", configurationKey: "a1", configurationLabel: '4-13/16" Overall Length Cabinet pull, 96 mm Center to Center', finish: "Satin Nickel", imageUrl: null },
  { vendorProductId: 2, sku: "A-128", collection: "Aiden", productType: "Pull", configurationKey: "a2", configurationLabel: '6-1/8" Overall Length Cabinet pull, 128 mm Center to Center', finish: "Satin Nickel", imageUrl: null },
  { vendorProductId: 3, sku: "B-160", collection: "Alvar", productType: "Pull", configurationKey: "a3", configurationLabel: '7" Overall Length Cabinet Pull. Holes are 160 mm center-to-center.', finish: "Satin Bronze", imageUrl: null },
  { vendorProductId: 4, sku: "SCROLL", collection: "Brenton", productType: "Pull", configurationKey: "a4", configurationLabel: '4-5/16" Overall Length Scroll Cabinet Pull. Holes are 96 mm center-to-center.', finish: "Matte Black", imageUrl: null },
  { vendorProductId: 5, sku: "TEE", collection: "Zane", productType: "T-knob", configurationKey: "a5", configurationLabel: '2" Overall Length Cabinet "T" Knob.', finish: "Polished Chrome", imageUrl: null },
  { vendorProductId: 6, sku: "TAB", collection: "Edgefield", productType: "Tab pull", configurationKey: "a6", configurationLabel: '4" Overall Length Tab Pull. Holes are 76 mm center-to-center.', finish: "Gun Metal", imageUrl: null },
  { vendorProductId: 7, sku: "CUP", collection: "LYON", productType: "Cup pull", configurationKey: "a7", configurationLabel: '4-15/16" Overall Length Shaker Cabinet Cup Pull. Holes are 3" center-to-center.', finish: "Oil Rubbed Bronze", imageUrl: null },
  { vendorProductId: 8, sku: "KNOB", collection: "Aiden", productType: "Knob", configurationKey: "a8", configurationLabel: '1-5/8" Diameter Zinc Die Cast Cabinet Knob.', finish: "Satin Nickel", imageUrl: null },
  { vendorProductId: 9, sku: "SQKNOB", collection: "Dominique", productType: "Knob", configurationKey: "a9", configurationLabel: '1-1/8" Overall Length Square Cabinet Knob.', finish: "Brushed Gold", imageUrl: null },
];

const ACCENTS: Record<string, string> = {
  "Satin Nickel": "#e6e9ec",
  "Satin Bronze": "#d7a85c",
  "Matte Black": "#1d2024",
  "Polished Chrome": "#f4f6f7",
  "Gun Metal": "#6a727b",
  "Oil Rubbed Bronze": "#5e4030",
  "Brushed Gold": "#e2bc62",
};

function Swatch({ item }: { item: CatalogHardwareSelection }) {
  const spec = hardwareDrawSpec(item);
  const accent = ACCENTS[item.finish] ?? "#d8dce0";
  const size = spec ? hardwareDrawnSizeIn(spec) : null;
  const boxW = (size?.widthIn ?? 3) * SCALE_PX_PER_IN;
  const boxH = (size?.heightIn ?? 0.6) * SCALE_PX_PER_IN;
  return (
    <div style={{ border: "1px solid #d5dae1", borderRadius: 8, background: "#fff", overflow: "hidden" }}>
      <div style={{ padding: "6px 10px", background: "#f3f6fa", fontSize: 11, fontWeight: 700, color: "#1a2744" }}>
        {spec?.family} · {item.sku}
      </div>
      <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: "#667", width: 54 }}>drawer</span>
          <div style={{ width: boxW, height: boxH }}>
            {spec && <HardwareGlyph spec={spec} widthIn={size!.widthIn} heightIn={size!.heightIn} accent={accent} vertical={false} />}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 10, color: "#667", width: 54 }}>door</span>
          <div style={{ width: spec?.knob || spec?.family === "edge-pull" || spec?.family === "cup-pull" ? boxW : boxH, height: spec?.knob || spec?.family === "edge-pull" || spec?.family === "cup-pull" ? boxH : boxW }}>
            {spec && (
              <HardwareGlyph
                spec={spec}
                widthIn={spec.knob || spec.family === "edge-pull" || spec.family === "cup-pull" ? size!.widthIn : size!.heightIn}
                heightIn={spec.knob || spec.family === "edge-pull" || spec.family === "cup-pull" ? size!.heightIn : size!.widthIn}
                accent={accent}
                vertical
              />
            )}
          </div>
        </div>
      </div>
      <div style={{ padding: "6px 10px", borderTop: "1px solid #eef1f5", fontSize: 10, color: "#556" }}>
        catalog {spec?.lengthIn ?? "unread"}″ · drawn {size ? `${size.widthIn.toFixed(2)}″ × ${size.heightIn.toFixed(2)}″` : "—"} · {spec?.measured ? "measured" : "fallback"}
      </div>
    </div>
  );
}

export default function HardwareGlyphHarness() {
  const items = useMemo(() => SAMPLES, []);
  return (
    <div style={{ minHeight: "100vh", background: "#eef2f7", padding: 28, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, color: "#1a2744", margin: "0 0 4px" }}>Elevation hardware glyphs — straight-on catalog shapes</h1>
      <p style={{ fontSize: 12, color: "#556", margin: "0 0 20px" }}>
        Drawn at {SCALE_PX_PER_IN}px per inch from the catalog configuration label. No product photos are used.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 16 }}>
        {items.map((item) => <Swatch key={item.sku} item={item} />)}
      </div>
    </div>
  );
}
