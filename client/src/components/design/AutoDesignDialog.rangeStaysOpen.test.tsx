// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { applianceAsDesignCabinet, APPLIANCES } from "@/lib/design";
import { autoDesignRangeChoices } from "@/lib/autoDesignTallCabinets";
import { AutoDesignDialog } from "./AutoDesignDialog";
import { AutoDesignRangeDialog } from "./AutoDesignRangeDialog";

afterEach(cleanup);

const choices = autoDesignRangeChoices(
  APPLIANCES.filter((appliance) => appliance.rooms.includes("kitchen")).map(applianceAsDesignCabinet),
);

// Mirrors the DesignTool wiring: the range pop-up is a sibling dialog of the Auto-Design dialog.
function Harness() {
  const [open, setOpen] = useState(true);
  const [rangeOpen, setRangeOpen] = useState(false);
  const [pick, setPick] = useState<(typeof choices)[number] | null>(null);
  return (
    <>
      <AutoDesignDialog
        open={open}
        onOpenChange={setOpen}
        onBuild={() => ({ ok: true })}
        onOpenRangePicker={() => setRangeOpen(true)}
        selectedRangeLabel={pick ? `${pick.label} (${pick.widthIn}″)` : null}
        childPickerOpen={rangeOpen}
      />
      <AutoDesignRangeDialog
        open={rangeOpen}
        choices={choices}
        selected={pick}
        onKeepDefault={() => setRangeOpen(false)}
        onChoose={(choice) => { setPick(choice); setRangeOpen(false); }}
      />
    </>
  );
}

describe("Auto-Design dialog with the range pop-up", () => {
  it("stays open while the range pop-up is open and after a range is picked", async () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId("auto-design-open-range-picker"));
    expect(await screen.findByTestId("auto-design-range-dialog")).toBeTruthy();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.getByTestId("auto-design-auto-build-dialog")).toBeTruthy();

    const card = screen.getAllByTestId(/^auto-design-range-option-/)[0]!;
    fireEvent.pointerDown(card);
    fireEvent.click(card);
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByTestId("auto-design-range-dialog")).toBeNull();
    expect(screen.getByTestId("auto-design-auto-build-dialog")).toBeTruthy();
    expect(screen.getByTestId("auto-design-range-selection").textContent).toMatch(/wide|″/);
  });
});
