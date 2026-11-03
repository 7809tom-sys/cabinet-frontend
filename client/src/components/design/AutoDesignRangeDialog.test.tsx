// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoDesignRangeDialog } from "./AutoDesignRangeDialog";
import { applianceAsDesignCabinet, APPLIANCES } from "@/lib/design";
import { autoDesignRangeChoices, defaultAutoDesignRange } from "@/lib/autoDesignTallCabinets";

afterEach(cleanup);

const choices = autoDesignRangeChoices(
  APPLIANCES.filter((appliance) => appliance.rooms.includes("kitchen")).map(applianceAsDesignCabinet),
);

function renderDialog(overrides: Partial<Parameters<typeof AutoDesignRangeDialog>[0]> = {}) {
  const onChoose = vi.fn();
  const onKeepDefault = vi.fn();
  render(
    <AutoDesignRangeDialog
      open
      choices={choices}
      selected={defaultAutoDesignRange(choices)}
      onKeepDefault={onKeepDefault}
      onChoose={onChoose}
      {...overrides}
    />,
  );
  return { onChoose, onKeepDefault };
}

describe("AutoDesignRangeDialog", () => {
  it("is a pop-up that lists the real range choices", () => {
    renderDialog();
    expect(screen.getByTestId("auto-design-range-dialog")).toBeTruthy();
    expect(screen.getByTestId("auto-design-range-grid")).toBeTruthy();
    expect(screen.getAllByText(/30" Black Gas Range/).length).toBeGreaterThan(0);
  });

  it("shows the width each range seats at", () => {
    renderDialog();
    expect(screen.getAllByText(/30″ wide · RANGE-30/).length).toBeGreaterThan(0);
  });

  it("chooses an alternate finish and passes its master code through", () => {
    const { onChoose } = renderDialog();
    const stainless = choices.find((choice) => /Stainless Gas/.test(choice.label))!;
    fireEvent.click(screen.getByTestId(`auto-design-range-option-${stainless.key}`));
    expect(onChoose).toHaveBeenCalledWith(stainless);
  });

  it("keeps the current range without changing the build", () => {
    const { onKeepDefault, onChoose } = renderDialog();
    fireEvent.click(screen.getByTestId("auto-design-range-keep"));
    expect(onKeepDefault).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it("says so when the palette has no range", () => {
    renderDialog({ choices: [], selected: null });
    expect(screen.getByTestId("auto-design-range-empty")).toBeTruthy();
  });
});
