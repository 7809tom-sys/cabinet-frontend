// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadWallBuilderPdf, downloadWallBuilderPng } from "@/lib/wallBuilderExport";
import { WallBuilder, type WallBuilderDraft } from "./WallBuilder";

vi.mock("@/lib/wallBuilderExport", () => ({
  downloadWallBuilderPng: vi.fn(() => Promise.resolve()),
  downloadWallBuilderPdf: vi.fn(() => Promise.resolve()),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

function openBuilder() {
  fireEvent.click(screen.getByRole("button", { name: /build walls continuously/i }));
}

function setLength(value: string) {
  const input = screen.getByLabelText("Wall length");
  fireEvent.change(input, { target: { value } });
}

function addWall() {
  fireEvent.click(screen.getByTestId("add-continuous-wall"));
}

type PreviewPoint = { x: number; y: number };

function previewWallPoints(): PreviewPoint[] {
  const preview = screen.getByLabelText("Live clockwise continuous wall preview");
  const stroke = preview.querySelector('path[stroke="#1a2744"]');
  const d = stroke?.getAttribute("d") ?? "";
  const points: PreviewPoint[] = [];
  const pattern = /[ML]\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null = pattern.exec(d);
  while (match) {
    points.push({ x: Number(match[1]), y: Number(match[2]) });
    match = pattern.exec(d);
  }
  return points;
}

function arrowLine(): { start: PreviewPoint; end: PreviewPoint } {
  const arrow = screen.getByTestId("wall-builder-clockwise-arrow");
  return {
    start: { x: Number(arrow.getAttribute("x1")), y: Number(arrow.getAttribute("y1")) },
    end: { x: Number(arrow.getAttribute("x2")), y: Number(arrow.getAttribute("y2")) },
  };
}

function liesOnOpenSegment(point: PreviewPoint, start: PreviewPoint, end: PreviewPoint): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return false;
  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  if (t <= 0.02 || t >= 0.98) return false;
  const projectedX = start.x + t * dx;
  const projectedY = start.y + t * dy;
  return Math.hypot(point.x - projectedX, point.y - projectedY) <= 0.2;
}

function expectArrowOffTheOpenWall() {
  const points = previewWallPoints();
  expect(points.length).toBeGreaterThan(1);
  const last = points[points.length - 1];
  const previous = points[points.length - 2];
  const arrow = arrowLine();
  expect(arrow.start.x).toBeCloseTo(last.x, 2);
  expect(arrow.start.y).toBeCloseTo(last.y, 2);
  const arrowLength = Math.hypot(arrow.end.x - arrow.start.x, arrow.end.y - arrow.start.y);
  const wallLength = Math.hypot(last.x - previous.x, last.y - previous.y);
  expect(arrowLength).toBeGreaterThan(1);
  expect(arrowLength).toBeLessThan(wallLength);
  const midpoint = {
    x: (arrow.start.x + arrow.end.x) / 2,
    y: (arrow.start.y + arrow.end.y) / 2,
  };
  for (let index = 0; index < points.length - 1; index += 1) {
    expect(liesOnOpenSegment(arrow.end, points[index], points[index + 1])).toBe(false);
    expect(liesOnOpenSegment(midpoint, points[index], points[index + 1])).toBe(false);
  }
  expect(screen.getByTestId("wall-builder-next-wall-label").textContent).toBe("NEXT WALL");
}

describe("Continuous Wall Builder", () => {
  it("explains the clockwise sequence and marks the exact next-wall endpoint", () => {
    render(<WallBuilder wallHeightIn={96} onApply={() => undefined} />);
    openBuilder();

    expect(screen.getByTestId("wall-builder-clockwise-guide").textContent).toMatch(/Clockwise wall sequence/i);
    expect(screen.getByText(/Clockwise start: Wall 1 begins at the gold point/i)).toBeTruthy();
    setLength("101");
    addWall();

    expect(screen.getByLabelText("Live clockwise continuous wall preview")).toBeTruthy();
    expectArrowOffTheOpenWall();
    const rightTurn = arrowLine();
    expect(rightTurn.end.x).toBeCloseTo(rightTurn.start.x, 2);
    expect(rightTurn.end.y).toBeGreaterThan(rightTurn.start.y);
    expect(screen.getByText(/Clockwise sequence: this wall begins at the gold arrow/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Straight" }));
    expectArrowOffTheOpenWall();
    const straight = arrowLine();
    expect(straight.end.x).toBeGreaterThan(straight.start.x);
    expect(straight.end.y).toBeCloseTo(straight.start.y, 2);
  });

  it("drops the direction arrow after a measured room closes and keeps it off the open wall", () => {
    render(<WallBuilder wallHeightIn={96} onApply={() => undefined} />);
    openBuilder();

    setLength("145");
    addWall();
    fireEvent.click(screen.getByRole("button", { name: /90° right/i }));
    addWall();
    fireEvent.click(screen.getByRole("button", { name: /90° right/i }));
    addWall();

    expect(screen.queryByText("Room closed")).toBeNull();
    expectArrowOffTheOpenWall();
    const openArrow = arrowLine();
    const openPoints = previewWallPoints();
    const openEnd = openPoints[openPoints.length - 1];
    expect(openArrow.start.x).toBeCloseTo(openEnd.x, 2);
    expect(openArrow.start.y).toBeCloseTo(openEnd.y, 2);

    fireEvent.click(screen.getByRole("button", { name: /90° right/i }));
    addWall();

    expect(screen.getByText("Room closed")).toBeTruthy();
    expect(screen.queryByTestId("wall-builder-clockwise-arrow")).toBeNull();
    expect(screen.queryByTestId("wall-builder-next-wall-label")).toBeNull();
    expect(screen.queryByText("NEXT WALL")).toBeNull();
  });

  it("adds measured walls continuously with an exact 45-degree choice", () => {
    render(<WallBuilder wallHeightIn={96} onApply={() => undefined} />);
    openBuilder();
    setLength("101");
    addWall();
    setLength("78");
    fireEvent.click(screen.getByRole("button", { name: /45° right/i }));
    addWall();

    expect(screen.getAllByText(/Wall 1/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Wall 2/).length).toBeGreaterThan(0);
    expect(screen.getByText(/45° right · down-right/i)).toBeTruthy();
    expect(screen.getByLabelText("Live clockwise continuous wall preview")).toBeTruthy();
    expect(screen.getByTestId("wall-builder-perimeter").textContent).toContain("179");
    expect(screen.getByTestId("wall-builder-area").textContent).toBe("—");
    expect(screen.getByText("Close the walls to calculate")).toBeTruthy();
  });

  it("rotates only the drawing view in exact 90-degree steps", () => {
    render(<WallBuilder wallHeightIn={96} onApply={() => undefined} />);
    openBuilder();
    setLength("101");
    addWall();
    setLength("78");
    fireEvent.click(screen.getByRole("button", { name: /45° right/i }));
    addWall();

    const preview = screen.getByTestId("wall-builder-preview");
    expect(preview.getAttribute("data-view-rotation")).toBe("0");
    fireEvent.click(screen.getByTestId("rotate-wall-builder-view"));
    expect(preview.getAttribute("data-view-rotation")).toBe("90");
    expect(screen.getAllByText(/101/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/78/).length).toBeGreaterThan(0);
    expect(screen.getByText(/45° right · down-right/i)).toBeTruthy();
  });

  it("undoes and redoes multiple wall drawing changes without losing measurements", () => {
    render(<WallBuilder wallHeightIn={96} onApply={() => undefined} />);
    openBuilder();
    setLength("101");
    addWall();
    setLength("78");
    fireEvent.click(screen.getByRole("button", { name: /45° right/i }));
    addWall();

    expect(screen.getByText("2 walls")).toBeTruthy();
    fireEvent.click(screen.getByTestId("undo-wall-builder"));
    expect(screen.getByText("1 wall")).toBeTruthy();
    expect(screen.getByTestId("redo-wall-builder").hasAttribute("disabled")).toBe(false);
    fireEvent.click(screen.getByTestId("redo-wall-builder"));
    expect(screen.getByText("2 walls")).toBeTruthy();
    expect(screen.getAllByText(/78/).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByTestId("undo-wall-builder"));
    setLength("60");
    fireEvent.click(screen.getByRole("button", { name: /90° left/i }));
    addWall();
    expect(screen.getByTestId("redo-wall-builder").hasAttribute("disabled")).toBe(true);
    expect(screen.getAllByText(/60/).length).toBeGreaterThan(0);
  });

  it("keeps an unfinished measured wall sequence when the surrounding room dialog closes and reopens", async () => {
    function PersistentBuilderHarness() {
      const [open, setOpen] = useState(true);
      const [draft, setDraft] = useState<WallBuilderDraft | null>(null);
      return (
        <>
          <button type="button" onClick={() => setOpen((current) => !current)}>Toggle room dialog</button>
          {open ? <WallBuilder wallHeightIn={96} draft={draft} onDraftChange={setDraft} onApply={() => undefined} /> : null}
        </>
      );
    }

    render(<PersistentBuilderHarness />);
    openBuilder();
    setLength("101");
    addWall();
    setLength("78");
    fireEvent.click(screen.getByRole("button", { name: /45° right/i }));
    addWall();

    await waitFor(() => expect(screen.getByText("2 walls")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Toggle room dialog" }));
    expect(screen.queryByTestId("continuous-wall-builder")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Toggle room dialog" }));

    expect(screen.getByText("2 walls")).toBeTruthy();
    expect(screen.getAllByText(/101/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/78/).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Live clockwise continuous wall preview")).toBeTruthy();
  });

  it("downloads the exact rotated wall layout as PNG or PDF", async () => {
    render(<WallBuilder wallHeightIn={108} onApply={() => undefined} />);
    openBuilder();
    setLength("101");
    addWall();
    fireEvent.click(screen.getByTestId("rotate-wall-builder-view"));

    fireEvent.click(screen.getByTestId("export-wall-builder-png"));
    await waitFor(() => expect(downloadWallBuilderPng).toHaveBeenCalledTimes(1));
    expect(downloadWallBuilderPng).toHaveBeenCalledWith(
      [expect.objectContaining({ lengthIn: 101 })],
      90,
      108,
    );
    expect(screen.getByText("PNG room layout downloaded successfully.")).toBeTruthy();

    fireEvent.click(screen.getByTestId("export-wall-builder-pdf"));
    await waitFor(() => expect(downloadWallBuilderPdf).toHaveBeenCalledTimes(1));
    expect(downloadWallBuilderPdf).toHaveBeenCalledWith(
      [expect.objectContaining({ lengthIn: 101 })],
      90,
      108,
    );
    expect(screen.getByText("PDF room layout downloaded successfully.")).toBeTruthy();
  });

  it("closes, shows saving progress, and applies a measured rectangle atomically", async () => {
    vi.useFakeTimers();
    const onApply = vi.fn();
    render(<WallBuilder wallHeightIn={108} onApply={onApply} />);
    openBuilder();

    setLength("120");
    addWall();
    setLength("96");
    fireEvent.click(screen.getByRole("button", { name: /90° right/i }));
    addWall();
    setLength("120");
    addWall();
    setLength("96");
    addWall();

    expect(screen.getByText("Room closed")).toBeTruthy();
    expect(screen.getByTestId("wall-builder-perimeter").textContent).toContain("432");
    expect(screen.getByTestId("wall-builder-area").textContent).toBe("80.0 sq ft");
    fireEvent.click(screen.getByTestId("apply-continuous-wall-room"));
    expect(screen.getByTestId("apply-continuous-wall-room").getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Saving your measured wall layout…")).toBeTruthy();
    expect(onApply).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply.mock.calls[0][0]).toMatchObject({ width: 120, depth: 96 });
    expect(onApply.mock.calls[0][0].customWalls).toHaveLength(4);
    expect(onApply.mock.calls[0][0].customWalls[0]).toMatchObject({ label: "Wall 1", height: 108 });
    expect(screen.getByText("Room layout saved successfully.")).toBeTruthy();
  });

  it("checks closure without adding walls and applies an open measured path", async () => {
    vi.useFakeTimers();
    const onApply = vi.fn();
    render(<WallBuilder wallHeightIn={96} onApply={onApply} />);
    openBuilder();
    setLength("120");
    addWall();
    setLength("96");
    fireEvent.click(screen.getByRole("button", { name: /90° right/i }));
    addWall();
    setLength("60");
    addWall();

    fireEvent.click(screen.getByRole("button", { name: /check closure/i }));
    expect(screen.getByText(/do not return to the starting point yet/i)).toBeTruthy();
    expect(screen.getAllByText(/Wall [123]/).length).toBeGreaterThanOrEqual(3);
    fireEvent.click(screen.getByTestId("apply-continuous-wall-room"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(450);
    });
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ openWallPath: true }));
    expect(onApply.mock.calls[0][0].customWalls).toHaveLength(3);
  });

  it("blocks applying a replacement outline when design content already exists", () => {
    const onApply = vi.fn();
    render(<WallBuilder wallHeightIn={96} blockedReason="Clear the current design first." onApply={onApply} />);
    openBuilder();
    setLength("120");
    addWall();
    setLength("96");
    fireEvent.click(screen.getByRole("button", { name: /90° right/i }));
    addWall();
    setLength("120");
    addWall();
    setLength("96");
    addWall();

    expect(screen.getByText("Clear the current design first.")).toBeTruthy();
    expect(screen.getByTestId("apply-continuous-wall-room").hasAttribute("disabled")).toBe(true);
    expect(onApply).not.toHaveBeenCalled();
  });
});
