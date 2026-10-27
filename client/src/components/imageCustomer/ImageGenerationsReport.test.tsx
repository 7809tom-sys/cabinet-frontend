// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageGenerationsReport } from "./ImageGenerationsReport";
import type { ImageGenerationSummary } from "./imageGenerationTypes";

afterEach(() => cleanup());

const summary: ImageGenerationSummary = {
  schemaReady: true,
  from: "2026-10-01T00:00:00.000Z",
  to: "2026-10-27T00:00:00.000Z",
  internalCount: 3,
  unlinkedCount: 1,
  customers: [
    { customerId: 7, customerKind: "user", name: "Ada Homeowner", email: "ada@example.com", succeeded: 2, failed: 1 },
  ],
  unlinked: [
    { id: 44, imageType: "room_scene", model: "gemini-3.1-flash-image", status: "blocked", createdAt: "2026-10-02T00:00:00.000Z", requestedByUserId: 1 },
  ],
};

describe("ImageGenerationsReport", () => {
  it("shows per-customer counts, the internal count, and unlinked generations", () => {
    const onFromChange = vi.fn();
    render(
      <ImageGenerationsReport
        summary={summary}
        from="2026-10-01"
        to="2026-10-27"
        onFromChange={onFromChange}
        onToChange={vi.fn()}
      />,
    );
    expect(screen.getByText("Internal images: 3")).toBeTruthy();
    expect(screen.getByText("Ada Homeowner")).toBeTruthy();
    expect(screen.getByText("Missing a customer: 1")).toBeTruthy();
    expect(screen.getByText(/#44 room_scene/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2026-09-01" } });
    expect(onFromChange).toHaveBeenCalledWith("2026-09-01");
  });

  it("explains when the ledger table is not installed", () => {
    render(
      <ImageGenerationsReport
        summary={{ ...summary, schemaReady: false, customers: [], unlinked: [], unlinkedCount: 0, internalCount: 0 }}
        from="2026-10-01"
        to="2026-10-27"
        onFromChange={vi.fn()}
        onToChange={vi.fn()}
      />,
    );
    expect(screen.getByText(/Apply SQL 0228/)).toBeTruthy();
  });
});
