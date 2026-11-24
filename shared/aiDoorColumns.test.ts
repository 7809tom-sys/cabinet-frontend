import { describe, expect, it } from "vitest";
import {
  AI_DOOR_COLUMNS_MIGRATION_FILE,
  AI_DOOR_SAVED_IMAGE_FAILED_NOTE,
  aiDoorColumnPayloadKey,
  aiDoorColumnSaveErrorMessage,
  aiDoorColumnSaveInput,
  columnImageNeedsSave,
  isAiDoorColumnsMigrationError,
  readAiDoorColumns,
  seedAiDoorColumns,
} from "./aiDoorColumns";

const GPT_COLUMN = {
  imageUrl: "/manus-storage/door-style-images/ai-generated/gpt.png",
  model: "gpt-image-2",
  text: "Server GPT description.",
  renderHex: "#aabbcc",
  generatedAt: "2026-11-24T12:00:00.000Z",
};

describe("readAiDoorColumns", () => {
  it("reads the three columns and ignores empties", () => {
    expect(readAiDoorColumns({
      gpt: GPT_COLUMN,
      claude: { imageUrl: null, model: null, text: "  ", renderHex: null, generatedAt: "" },
      gemini: { imageUrl: " /g.png ", model: "gemini-3.1-flash-image", text: null, renderHex: null, generatedAt: "t" },
      other: { text: "nope" },
    })).toEqual({
      gpt: GPT_COLUMN,
      gemini: {
        imageUrl: "/g.png",
        model: "gemini-3.1-flash-image",
        text: null,
        renderHex: null,
        generatedAt: "t",
      },
    });
  });

  it("accepts a JSON string and treats null, junk, and empty as no columns", () => {
    expect(readAiDoorColumns(JSON.stringify({ claude: { text: "From JSON" } }))?.claude?.text).toBe("From JSON");
    expect(readAiDoorColumns(null)).toBeNull();
    expect(readAiDoorColumns("not json")).toBeNull();
    expect(readAiDoorColumns({})).toBeNull();
    expect(readAiDoorColumns([])).toBeNull();
  });
});

describe("seedAiDoorColumns", () => {
  it("lets the server text and image win over localStorage", () => {
    const local = {
      fields: { gpt: "Browser draft that should lose.", claude: "Browser Claude." },
      chosen: "claude" as const,
      reference: { gpt: "Browser draft that should lose." },
    };
    const seeded = seedAiDoorColumns({ gpt: GPT_COLUMN }, local);
    expect(seeded.fields.gpt).toBe("Server GPT description.");
    expect(seeded.fields.claude).toBe("Browser Claude.");
    expect(seeded.images.gpt?.url).toBe(GPT_COLUMN.imageUrl);
    expect(seeded.images.gpt?.painter).toBe("openai");
    expect(seeded.images.claude).toBeUndefined();
    expect(seeded.renderHexByColumn.gpt).toBe("#aabbcc");
    expect(seeded.chosen).toBe("claude");
    expect(seeded.reference.gpt).toContain("Browser draft");
  });

  it("keeps the browser draft when the server has no column", () => {
    const seeded = seedAiDoorColumns(null, {
      fields: { gemini: "Pasted Gemini." },
      chosen: null,
      reference: {},
    });
    expect(seeded.fields.gemini).toBe("Pasted Gemini.");
    expect(seeded.images.gemini).toBeUndefined();
  });
});

describe("save input", () => {
  it("sends the picture and the text, and skips a column with neither", () => {
    expect(aiDoorColumnSaveInput(4, "gpt", {
      text: " A door ",
      imageUrl: " /gpt.png ",
      model: "gpt-image-2",
      renderHex: " #112233 ",
    })).toEqual({
      doorStyleId: 4,
      column: "gpt",
      text: "A door",
      imageUrl: "/gpt.png",
      model: "gpt-image-2",
      renderHex: "#112233",
    });
    expect(aiDoorColumnSaveInput(4, "claude", { text: "   ", imageUrl: null })).toBeNull();
  });

  it("uses the column name when the provider model is blank", () => {
    expect(aiDoorColumnSaveInput(4, "gemini", { text: "text", model: "  " })?.model).toBe("gemini");
  });
});

describe("columnImageNeedsSave", () => {
  const saved = {
    status: "idle" as const,
    imageUrl: "/a.png",
    renderHex: null,
    savedImageUrl: "/a.png",
    savedRenderHex: null,
    dirty: false,
  };

  it("saves a picture URL that was not in the last save, including one that arrives after the text", () => {
    expect(columnImageNeedsSave({ ...saved, savedImageUrl: null, dirty: true })).toBe(true);
    expect(columnImageNeedsSave({ ...saved, imageUrl: "/late.png", dirty: true })).toBe(true);
  });

  it("does not save a seeded picture just because the panel opened, or a loading clear", () => {
    expect(columnImageNeedsSave(saved)).toBe(false);
    expect(columnImageNeedsSave({ ...saved, status: "loading", imageUrl: null })).toBe(false);
    expect(columnImageNeedsSave({ ...saved, status: null, imageUrl: "/a.png" })).toBe(false);
  });

  it("saves a sampled hex only after this visit changed the column", () => {
    expect(columnImageNeedsSave({ ...saved, renderHex: "#abc123", dirty: false })).toBe(false);
    expect(columnImageNeedsSave({ ...saved, renderHex: "#abc123", dirty: true })).toBe(true);
  });
});

describe("save errors", () => {
  it("shows the 0281 missing-columns sentence from a PRECONDITION_FAILED error", () => {
    const error = {
      message: `Run ${AI_DOOR_COLUMNS_MIGRATION_FILE}`,
      data: { code: "PRECONDITION_FAILED", message: `Run ${AI_DOOR_COLUMNS_MIGRATION_FILE}` },
    };
    expect(isAiDoorColumnsMigrationError(error)).toBe(true);
    expect(aiDoorColumnSaveErrorMessage(error)).toContain(AI_DOOR_COLUMNS_MIGRATION_FILE);
    expect(aiDoorColumnSaveErrorMessage(error)).toContain("PRECONDITION_FAILED");
  });

  it("still says something when the failure has no message", () => {
    expect(aiDoorColumnSaveErrorMessage(null)).toBe("The AI door column could not be saved.");
    expect(isAiDoorColumnsMigrationError({ message: "network" })).toBe(false);
  });
});

describe("saved image note", () => {
  it("names a broken stored URL in the words the panel shows", () => {
    expect(AI_DOOR_SAVED_IMAGE_FAILED_NOTE.toLowerCase()).toContain("saved image failed to load");
  });
});

describe("payload key", () => {
  it("changes when the late image URL changes", () => {
    const first = aiDoorColumnSaveInput(1, "gpt", { text: "door", imageUrl: null });
    const second = aiDoorColumnSaveInput(1, "gpt", { text: "door", imageUrl: "/late.png" });
    expect(aiDoorColumnPayloadKey(first!)).not.toBe(aiDoorColumnPayloadKey(second!));
  });
});
