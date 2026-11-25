// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CrmStageBoard } from "./CrmStageBoard";

afterEach(cleanup);

const deals = [{ id: 1, stage: "new" as const }];
const props = { deals, lang: "en" as const, onMove: vi.fn(), onQuickAdd: vi.fn(), renderCard: (d: { id: number }) => <span>deal {d.id}</span> };

describe("CrmStageBoard stage label overrides", () => {
  it("keeps the standard New header by default", () => {
    render(<CrmStageBoard {...props} />);
    expect(screen.getByRole("heading", { name: "New" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Distributor" })).toBeNull();
  });

  it("relabels only the overridden column and leaves the rest alone", () => {
    render(<CrmStageBoard {...props} stageLabels={{ new: "Distributor" }} />);
    expect(screen.getByRole("heading", { name: "Distributor" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "New" })).toBeNull();
    expect(screen.getByRole("heading", { name: "New Sale" })).toBeTruthy();
    expect(screen.getByLabelText("Quick add Distributor")).toBeTruthy();
    expect(screen.getByText("deal 1")).toBeTruthy();
  });
});
