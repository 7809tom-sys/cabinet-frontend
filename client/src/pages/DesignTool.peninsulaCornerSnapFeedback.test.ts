import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer peninsula snap feedback setting", () => {
  it("defaults to unchecked feedback and persists an explicit user preference in browser storage", () => {
    expect(source).toContain('const PENINSULA_CORNER_SNAP_FEEDBACK_PREFERENCE = "cabinetdealz.designer.show-peninsula-corner-snap-feedback"');
    expect(source).toContain("const [showPeninsulaCornerSnapFeedback, setShowPeninsulaCornerSnapFeedback] = useState(() => {");
    expect(source).toContain("window.localStorage.getItem(PENINSULA_CORNER_SNAP_FEEDBACK_PREFERENCE) === \"true\"");
    expect(source).toContain("window.localStorage.setItem(");
    expect(source).toContain("showPeninsulaCornerSnapFeedback ? \"true\" : \"false\"");
  });

  it("surfaces the same toggle in desktop and mobile Designer settings and wires both plan views", () => {
    expect(source).toContain('data-testid="desktop-peninsula-snap-feedback-setting"');
    expect(source).toContain('data-testid="mobile-peninsula-snap-feedback-setting"');
    expect(source).toContain('id="mobile-peninsula-snap-feedback"');
    expect(source).toContain("onCheckedChange={setShowPeninsulaCornerSnapFeedback}");
    expect(source).toContain("showPeninsulaCornerSnapFeedback={showPeninsulaCornerSnapFeedback}");
  });
});
