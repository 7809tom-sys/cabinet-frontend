import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./DesignTool.tsx", import.meta.url), "utf8");

describe("Designer price panel quick actions", () => {
  it("replaces the vertical cart-action stack with compact accessible action buttons", () => {
    expect(source).toContain('data-testid="price-panel-quick-actions"');
    expect(source).toContain('className="mt-3 grid grid-cols-4 gap-1.5"');
    expect(source).toContain('aria-label="Cart actions"');
    expect(source).toContain('aria-label="Surfaces and fixtures"');
    expect(source).toContain('aria-label="Professional designer"');
  });

  it("keeps countertop, sink, faucet, and edge controls inside focused popups rather than a persistent price-panel stack", () => {
    expect(source).toContain('aria-label="Countertop material and edge profile"');
    expect(source).toContain('aria-label="Sink and faucet options"');
    expect(source).toContain('const [sinkOptionsOpen, setSinkOptionsOpen] = useState(false);');
    expect(source).toContain('<Dialog open={sinkOptionsOpen} onOpenChange={setSinkOptionsOpen}>');
  });
});
