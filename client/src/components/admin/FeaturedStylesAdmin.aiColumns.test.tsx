// @vitest-environment jsdom
/**
 * Edit Door saves the GPT / Claude / Gemini columns with the rest of the style,
 * and still shows the approved AI picture from the official profile.
 */
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const styles: Record<string, unknown>[] = [
  {
    id: 1,
    ourName: "White Shaker",
    distributorName: null,
    supplierBrandName: "Faircrest",
    aliasName: null,
    isFeatured: true,
    featuredRank: 1,
    isActive: true,
    distributorId: 1,
    roomScenes: null,
    grainDirection: null,
    color: null,
    renderHex: null,
    aiProfileImageUrl: "/uploads/gemini-door.png",
    approvedReferenceImageUrl: null,
    approvedVersionId: null,
    aiColumns: {
      gpt: {
        imageUrl: "/manus-storage/door-style-images/ai-generated/gpt-stored.png",
        model: "gpt-image-2",
        text: "Style family: shaker. Painted warm white.",
        renderHex: "#f4f1ea",
        generatedAt: "2026-11-24T12:00:00.000Z",
      },
    },
  },
];

const pendingRef = vi.hoisted(() => ({
  mutate: (() => {}) as (input: unknown) => void,
  mutateAsync: vi.fn(async (input: unknown) => input),
}));

vi.mock("@/lib/trpc", () => {
  const mut = () => ({
    mutate: (input: unknown) => pendingRef.mutate(input),
    mutateAsync: pendingRef.mutateAsync,
    isPending: false,
  });
  const q = (path: string) => () => ({
    data: path.includes("listForAdmin") ? styles : path.includes("skuCounts") ? [] : [],
    isLoading: false,
    refetch: async () => ({}),
  });
  const make = (path: string): unknown => new Proxy(() => {}, {
    get: (_target, key: string) => {
      if (key === "useQuery") return q(path);
      if (key === "useMutation") return mut;
      if (key === "useUtils") return () => make("utils");
      if (key === "invalidate" || key === "fetch") return vi.fn();
      return make(`${path}.${key}`);
    },
    apply: () => make(path),
  });
  return { trpc: make("trpc") };
});

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), message: vi.fn() }) }));

import FeaturedStylesAdmin from "./FeaturedStylesAdmin";
import { toast } from "sonner";
import { AI_DOOR_COLUMNS_MIGRATION_FILE } from "@shared/aiDoorColumns";

const firstStyle = { ...styles[0] };

beforeEach(() => {
  localStorage.clear();
  styles[0] = { ...firstStyle };
  pendingRef.mutateAsync.mockReset();
  pendingRef.mutateAsync.mockImplementation(async (input: unknown) => input);
  pendingRef.mutate = () => {};
  vi.stubGlobal("open", vi.fn());
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function openEditor() {
  render(<FeaturedStylesAdmin />);
  fireEvent.click(screen.getAllByLabelText("Edit style")[0]);
  return screen.getByRole("dialog");
}

describe("Edit Door AI columns", () => {
  it("reopens onto the stored GPT image and leaves the approved AI tile on the official profile picture", () => {
    const dialog = openEditor();
    expect(screen.getByTestId("four-source-image-approved-ai-image").getAttribute("src")).toBe("/uploads/gemini-door.png");
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    expect((dialog.querySelector("[data-testid='ai-door-image-src-gpt']") as HTMLImageElement).getAttribute("src"))
      .toBe("/manus-storage/door-style-images/ai-generated/gpt-stored.png");
    expect(dialog.querySelector("[data-testid='ai-door-sketch-gpt']")).toBeNull();
    expect((screen.getByTestId("ai-door-field-gpt") as HTMLTextAreaElement).value).toContain("shaker");
  });

  it("flushes the column on Save Changes, including the stored image", async () => {
    openEditor();
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: "Style family: shaker. Edited during this visit." } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(pendingRef.mutateAsync.mock.calls.length).toBeGreaterThan(1));
    const column = pendingRef.mutateAsync.mock.calls
      .map((call) => call[0] as Record<string, unknown>)
      .find((input) => input.column === "gpt");
    expect(column).toMatchObject({
      doorStyleId: 1,
      column: "gpt",
      imageUrl: "/manus-storage/door-style-images/ai-generated/gpt-stored.png",
      text: "Style family: shaker. Edited during this visit.",
      renderHex: "#f4f1ea",
    });
    const styleSave = pendingRef.mutateAsync.mock.calls
      .map((call) => call[0] as Record<string, unknown>)
      .find((input) => input.ourName === "White Shaker");
    expect(styleSave?.id).toBe(1);
  });

  it("keeps the dialog open and shows the 0281 error when the columns are missing", async () => {
    pendingRef.mutateAsync.mockImplementation(async (input: unknown) => {
      const record = input as { column?: string };
      if (record.column) {
        throw { message: `Run ${AI_DOOR_COLUMNS_MIGRATION_FILE}`, data: { code: "PRECONDITION_FAILED" } };
      }
      return input;
    });
    openEditor();
    fireEvent.click(screen.getByTestId("ai-door-compare-start"));
    fireEvent.change(screen.getByTestId("ai-door-field-gpt"), { target: { value: "Style family: shaker. Needs a save." } });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    await waitFor(() => expect(screen.getByTestId("ai-door-column-save-error").textContent).toContain(AI_DOOR_COLUMNS_MIGRATION_FILE));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save Changes" })).toBeTruthy();
    expect(vi.mocked(toast.error)).toHaveBeenCalled();
    expect(String(vi.mocked(toast.error).mock.calls.at(-1)?.[0])).toContain("0281_ai_door_profile");
  });
});
