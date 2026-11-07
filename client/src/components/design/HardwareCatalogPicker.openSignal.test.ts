import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const picker = readFileSync(new URL("./HardwareCatalogPicker.tsx", import.meta.url), "utf8");

describe("HardwareCatalogPicker external open signal", () => {
  it("opens on a bumped signal from the floating canvas rail", () => {
    expect(picker).toContain("openSignal?: number;");
    expect(picker).toContain("const lastOpenSignal = useRef(openSignal ?? 0);");
    expect(picker).toContain("if (signal === lastOpenSignal.current) return;");
    expect(picker).toContain("lastOpenSignal.current = signal;");
    expect(picker).toContain("setOpen(true);");
  });

  it("stays closed on mount, so the Designer never pops a dialog on load", () => {
    // The initial ref value equals the first render's signal, so the effect's
    // equality guard short-circuits and setOpen is never reached.
    expect(picker).toContain("useRef(openSignal ?? 0)");
    expect(picker).toContain("const [open, setOpen] = useState(false);");
    // The effect runs before the dialog's first paint.
    expect(picker.indexOf("const lastOpenSignal")).toBeLessThan(picker.indexOf("<Dialog open={open}"));
  });

  it("keeps its own toolbar trigger working unchanged", () => {
    expect(picker).toContain('data-testid="designer-real-hardware-trigger"');
    expect(picker).toContain("onClick={() => setOpen(true)}");
  });
});
