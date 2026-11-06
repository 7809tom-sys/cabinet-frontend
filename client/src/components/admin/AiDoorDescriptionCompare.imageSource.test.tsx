// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  aiDoorGeneratedImageSource,
  aiDoorImageSourceLabel,
  aiDoorPreviewSource,
  aiDoorSampleSource,
} from "@/lib/aiDoorImageSource";

vi.mock("@/lib/aiDoorDescribeClient", () => ({
  AI_DOOR_GENERATE_UNAVAILABLE_MESSAGE: "Generate needs the API server's AI door procedure, which is not deployed yet. Copy the prompt instead.",
  aiDoorDescribeProcedureAvailable: () => true,
  useAiDoorDescribe: () => ({
    available: true,
    isPending: false,
    generate: async () => ({ description: null, image: null, imageMessage: null, message: "Not used in these tests.", notConnected: false }),
  }),
}));

import { AiDoorDescriptionCompare } from "./AiDoorDescriptionCompare";

const style = { id: 360001, doorStyle: "Shaker", color: "Gray", renderHex: "#8d8f92" };

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("AI door picture source labels", () => {
  it("labels the style's own saved photo as the photo that was sent", () => {
    render(<AiDoorDescriptionCompare style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    const figure = screen.getByTestId("ai-door-compare-sample-figure");
    expect(within(figure).getByTestId("ai-door-compare-sample").getAttribute("src")).toBe("/uploads/stone-gray.jpg");
    const badge = within(figure).getByTestId("ai-door-source-door-sample");
    expect(badge.textContent).toBe("Door photo sent");
    expect(badge.getAttribute("data-source")).toBe("door-sample");
  });

  it("never badges the local sketch as if it were a result", () => {
    render(<AiDoorDescriptionCompare style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), {
      target: { value: "Shaker door with a 2.75 in stile, raised center panel, painted white." },
    });
    const preview = screen.getByTestId("ai-door-preview-svg");
    // The sketch carries no badge at all, so it cannot read as a photo.
    expect(preview.parentElement?.querySelector("[data-testid='ai-door-source-library-default']")).toBeNull();
    expect(preview.parentElement?.querySelector("[data-testid='ai-door-source-generated']")).toBeNull();
    // It is named in words instead.
    expect(screen.getByTestId("ai-door-sketch-gpt").textContent).toContain("It is not a photo of this door");
  });

  it("puts no AI-generated badge on the picture until a real image exists", () => {
    render(<AiDoorDescriptionCompare style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), {
      target: { value: "Shaker door, flat center panel, painted gray." },
    });
    expect(document.querySelector("[data-testid='ai-door-source-generated']")).toBeNull();
  });

  it("puts no photo badge on a section with no saved sample", () => {
    render(<AiDoorDescriptionCompare style={style} sampleUrl={null} />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    expect(screen.queryByTestId("ai-door-compare-sample-figure")).toBeNull();
    expect(screen.queryByTestId("ai-door-source-door-sample")).toBeNull();
  });
});

describe("aiDoorImageSource helpers", () => {
  it("has exact labels for the three sources", () => {
    expect(aiDoorImageSourceLabel("door-sample")?.label).toBe("Door photo sent");
    expect(aiDoorImageSourceLabel("generated")?.label).toBe("AI generated");
    expect(aiDoorImageSourceLabel("library-default")?.label).toBe("Library default");
    expect(aiDoorImageSourceLabel(null)).toBeNull();
  });

  it("treats an empty or whitespace sample as no sample", () => {
    expect(aiDoorSampleSource("/uploads/x.jpg")).toBe("door-sample");
    expect(aiDoorSampleSource("   ")).toBeNull();
    expect(aiDoorSampleSource(null)).toBeNull();
  });

  it("badges only a real generated image URL", () => {
    expect(aiDoorGeneratedImageSource("/manus-storage/door-style-images/x.png")).toBe("generated");
    expect(aiDoorGeneratedImageSource("")).toBeNull();
    expect(aiDoorGeneratedImageSource(null)).toBeNull();
  });

  it("marks the drawn sketch as the library default, which is never badged", () => {
    expect(aiDoorPreviewSource()).toBe("library-default");
  });
});
