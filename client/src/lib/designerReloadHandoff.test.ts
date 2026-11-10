import { afterEach, describe, expect, it, vi } from "vitest";
import { handOffDesignerContact, takeDesignerContactHandoff } from "./designerReloadHandoff";
import { pageReloadEnv } from "./staleChunkReload";

function memory() {
  const stored: Record<string, string> = {};
  return { getItem: (key: string) => stored[key] ?? null, setItem: (key: string, value: string) => { stored[key] = value; }, removeItem: (key: string) => { delete stored[key]; } } as unknown as Storage;
}

afterEach(() => vi.restoreAllMocks());

describe("designer contact handoff across the customer's reload", () => {
  it("hands the contact to the next load exactly once", () => {
    vi.spyOn(pageReloadEnv, "storage").mockReturnValue(memory());
    handOffDesignerContact({ email: "guest@example.com", name: "Guest" });
    expect(takeDesignerContactHandoff()).toEqual({ email: "guest@example.com", name: "Guest", phone: undefined });
    expect(takeDesignerContactHandoff()).toBeNull();
  });

  it("ignores a stale handoff and works without storage", () => {
    let now = 5_000_000;
    vi.spyOn(pageReloadEnv, "storage").mockReturnValue(memory());
    vi.spyOn(pageReloadEnv, "now").mockImplementation(() => now);
    handOffDesignerContact({ email: "guest@example.com" });
    now += 61_000;
    expect(takeDesignerContactHandoff()).toBeNull();
    vi.spyOn(pageReloadEnv, "storage").mockReturnValue(null);
    expect(() => handOffDesignerContact({ email: "guest@example.com" })).not.toThrow();
    expect(takeDesignerContactHandoff()).toBeNull();
  });
});
