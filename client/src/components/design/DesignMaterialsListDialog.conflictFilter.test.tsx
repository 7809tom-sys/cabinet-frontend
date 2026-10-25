// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DesignMaterialsListDialog } from "./DesignMaterialsListDialog";
import type { MaterialsListRow } from "@/lib/designMaterialsList";

afterEach(cleanup);

const row = (overrides: Partial<MaterialsListRow>): MaterialsListRow => ({
  label: "A",
  section: "cabinet",
  code: "B24",
  description: "24 inch base cabinet",
  category: "Cabinet",
  supplier: "Preston",
  styleColor: "Aero Blanc",
  dimensions: '24" W × 34½" H × 24" D',
  qty: 1,
  unitPrice: 100,
  lineTotal: 100,
  priceStatus: "priced",
  notes: "",
  sourceUids: ["cabinet-a"],
  ...overrides,
});

describe("DesignMaterialsListDialog conflict filter", () => {
  it("shows only rows backed by an exact affected placement and restores every row on demand", () => {
    render(
      <DesignMaterialsListDialog
        open
        onOpenChange={vi.fn()}
        rows={[
          row({ code: "B24", description: "Unaffected base cabinet", sourceUids: ["cabinet-a"] }),
          row({ label: "B", code: "BBC36", description: "Affected blind corner cabinet", sourceUids: ["cabinet-b"] }),
          row({ label: "C", code: "CTR-QTZ", description: "Countertop quote", section: "other", sourceUids: undefined }),
        ]}
        roomLabel="Kitchen"
        styleName="Aero Blanc"
        conflictUids={new Set(["cabinet-b"])}
      />,
    );

    expect(screen.getByText("Unaffected base cabinet")).toBeTruthy();
    expect(screen.getByText("Affected blind corner cabinet")).toBeTruthy();
    expect(screen.getByText("Countertop quote")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /conflicts only/i }));

    expect(screen.queryByText("Unaffected base cabinet")).toBeNull();
    expect(screen.getByText("Affected blind corner cabinet")).toBeTruthy();
    expect(screen.queryByText("Countertop quote")).toBeNull();
    expect(screen.getByRole("button", { name: /show all items/i }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/conflict view · 1 of 3 rows shown/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /show all items/i }));
    expect(screen.getByText("Unaffected base cabinet")).toBeTruthy();
    expect(screen.getByText("Affected blind corner cabinet")).toBeTruthy();
    expect(screen.getByText("Countertop quote")).toBeTruthy();
  });

  it("keeps the filter disabled when there is no exact affected placement", () => {
    render(
      <DesignMaterialsListDialog
        open
        onOpenChange={vi.fn()}
        rows={[row({ description: "Unaffected base cabinet" })]}
        roomLabel="Kitchen"
        styleName="Aero Blanc"
        conflictUids={new Set()}
      />,
    );

    expect((screen.getByRole("button", { name: /conflicts only/i }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("opens directly in exact conflicts-only mode when launched from the Materials conflict badge", () => {
    render(
      <DesignMaterialsListDialog
        open
        initialConflictsOnly
        onOpenChange={vi.fn()}
        rows={[
          row({ code: "B24", description: "Unaffected base cabinet", sourceUids: ["cabinet-a"] }),
          row({ label: "B", code: "BBC36", description: "Affected blind corner cabinet", sourceUids: ["cabinet-b"] }),
        ]}
        roomLabel="Kitchen"
        styleName="Aero Blanc"
        conflictUids={new Set(["cabinet-b"])}
      />,
    );

    expect(screen.queryByText("Unaffected base cabinet")).toBeNull();
    expect(screen.getByText("Affected blind corner cabinet")).toBeTruthy();
    expect(screen.getByRole("button", { name: /show all items/i }).getAttribute("aria-pressed")).toBe("true");
  });

  it("resets to every row on the next normal Materials launch after a conflict shortcut", () => {
    const props = {
      onOpenChange: vi.fn(),
      rows: [
        row({ code: "B24", description: "Unaffected base cabinet", sourceUids: ["cabinet-a"] }),
        row({ label: "B", code: "BBC36", description: "Affected blind corner cabinet", sourceUids: ["cabinet-b"] }),
      ],
      roomLabel: "Kitchen",
      styleName: "Aero Blanc",
      conflictUids: new Set(["cabinet-b"]),
    };
    const { rerender } = render(<DesignMaterialsListDialog open initialConflictsOnly {...props} />);

    expect(screen.queryByText("Unaffected base cabinet")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /show all items/i }));
    expect(screen.getByText("Unaffected base cabinet")).toBeTruthy();

    rerender(<DesignMaterialsListDialog open={false} initialConflictsOnly {...props} />);
    rerender(<DesignMaterialsListDialog open initialConflictsOnly={false} {...props} />);

    expect(screen.getByText("Unaffected base cabinet")).toBeTruthy();
    expect(screen.getByRole("button", { name: /conflicts only/i }).getAttribute("aria-pressed")).toBe("false");
  });
});
