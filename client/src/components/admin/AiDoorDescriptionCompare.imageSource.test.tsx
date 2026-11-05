// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
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
    generate: async () => ({ description: null, message: "Not used in these tests.", notConnected: false }),
  }),
}));

import { AiDoorDescriptionCompare } from "./AiDoorDescriptionCompare";

const style = { id: 360001, doorStyle: "Shaker", color: "Gray", renderHex: "#8d8f92" };

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe("AI door-description picture source labels", () => {
  it("labels the style's own saved photo as the door sample photo", () => {
    render(<AiDoorDescriptionCompare style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    const figure = screen.getByTestId("ai-door-compare-sample-figure");
    expect(within(figure).getByTestId("ai-door-compare-sample").getAttribute("src")).toBe("/uploads/stone-gray.jpg");
    const badge = within(figure).getByTestId("ai-door-source-door-sample");
    expect(badge.textContent).toBe("Door sample photo");
    expect(badge.getAttribute("data-source")).toBe("door-sample");
  });

  it("labels a preview drawn from the library default profile as Library default", () => {
    render(<AiDoorDescriptionCompare style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), {
      target: { value: "Shaker door with a 2.75 in stile, raised center panel, painted white." },
    });
    const preview = screen.getByTestId("ai-door-preview-svg");
    const badge = preview.parentElement?.querySelector("[data-testid='ai-door-source-library-default']") as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.textContent).toBe("Library default");
    expect(badge.getAttribute("data-source")).toBe("library-default");
  });

  it("never shows an AI generated label, because no picture there comes from an AI image call", () => {
    render(<AiDoorDescriptionCompare style={style} sampleUrl="/uploads/stone-gray.jpg" />);
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    // Even after a Generate-style answer is pasted back, the picture is still a
    // local library-default draw, not an AI image.
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), {
      target: { value: "Shaker door, flat center panel, painted gray." },
    });
    expect(document.querySelector("[data-testid='ai-door-source-ai-generated']")).toBeNull();
    expect(document.body.textContent).not.toContain("AI generated");
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
    expect(aiDoorImageSourceLabel("door-sample")?.label).toBe("Door sample photo");
    expect(aiDoorImageSourceLabel("library-default")?.label).toBe("Library default");
    expect(aiDoorImageSourceLabel("ai-generated")?.label).toBe("AI generated");
    expect(aiDoorImageSourceLabel(null)).toBeNull();
  });

  it("treats an empty or whitespace sample as no sample", () => {
    expect(aiDoorSampleSource("/uploads/x.jpg")).toBe("door-sample");
    expect(aiDoorSampleSource("   ")).toBeNull();
    expect(aiDoorSampleSource(null)).toBeNull();
  });

  it("marks the drawn preview as the library default", () => {
    expect(aiDoorPreviewSource()).toBe("library-default");
  });
});
