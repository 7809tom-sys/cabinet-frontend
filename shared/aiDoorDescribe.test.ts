/**
 * The Generate contract and its client half.
 *
 * The API itself is a separate repository, so what this repo can prove is:
 * - the input the browser sends carries the prompt and the photo, never a key;
 * - every failure reads as one plain sentence, with not-connected kept distinct
 *   so a column can say "Claude isn't connected yet" instead of a red alarm;
 * - a build without the procedure answers plainly instead of throwing;
 * - no key name appears in any file that is bundled for the browser.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import {
  AI_DOOR_DESCRIBE_PROCEDURE,
  AI_DOOR_GENERATE_FAILED_MESSAGE,
  AI_DOOR_KEY_SERVICE,
  AI_DOOR_MODEL_ENV_KEYS,
  AI_DOOR_NOT_CONNECTED_MESSAGE,
  aiDoorDescribeInput,
  isAiDoorModel,
  readAiDoorDescribeResult,
} from "./aiDoorDescribe";
import { AI_DOOR_PROMPTS } from "./aiDoorPrompts";

describe("the request the browser sends", () => {
  it("carries the model, its own prompt, and the door photo", () => {
    const input = aiDoorDescribeInput({
      model: "claude",
      prompt: AI_DOOR_PROMPTS.claude,
      imageUrl: "/manus-storage/door.jpg",
      doorName: "Raised Panel Painted",
      styleId: 330026,
    });
    expect(input).toEqual({
      model: "claude",
      prompt: AI_DOOR_PROMPTS.claude,
      image: { url: "/manus-storage/door.jpg" },
      doorName: "Raised Panel Painted",
      styleId: 330026,
      finish: null,
      colorDescription: null,
    });
  });

  it("omits the photo entirely when the style has none", () => {
    const input = aiDoorDescribeInput({ model: "gpt", prompt: "p", imageUrl: "   " });
    expect(input.image).toBeNull();
    expect(input.doorName).toBeNull();
    expect(input.styleId).toBeNull();
  });

  it("has no field that could carry a provider key", () => {
    const input = aiDoorDescribeInput({ model: "gemini", prompt: "p" });
    // The whole key name and the "api key" notion are absent: only the model
    // name, the prompt, and optional door context travel.
    expect(JSON.stringify(input).toLowerCase()).not.toContain("api_key");
    expect(JSON.stringify(input).toLowerCase()).not.toContain("apikey");
    expect(JSON.stringify(input).toLowerCase()).not.toContain("token");
    expect(Object.keys(input).sort()).toEqual(["colorDescription", "doorName", "finish", "image", "model", "prompt", "styleId"]);
  });

  it("names the procedure and the service that must hold the keys", () => {
    expect(AI_DOOR_DESCRIBE_PROCEDURE).toBe("aiDoorDescription.describeWithAi");
    expect(AI_DOOR_KEY_SERVICE).toContain("cabinet-backend");
  });

  it("accepts only the three known models", () => {
    expect(isAiDoorModel("gpt")).toBe(true);
    expect(isAiDoorModel("claude")).toBe(true);
    expect(isAiDoorModel("gemini")).toBe(true);
    expect(isAiDoorModel("llama")).toBe(false);
    expect(isAiDoorModel(null)).toBe(false);
  });
});

describe("reading a result into what a column shows", () => {
  it("returns the text on success", () => {
    const read = readAiDoorDescribeResult("gpt", { status: "ok", model: "gpt", description: "  Style: shaker.  ", providerModel: "m" });
    expect(read).toEqual({ description: "Style: shaker.", image: null, imageMessage: null, message: null, notConnected: false });
  });

  it("returns the drawn door image alongside the text", () => {
    const image = {
      url: "/manus-storage/door-style-images/ai-generated/shaker-gpt-image-2.png",
      painter: "openai" as const,
      providerModel: "gpt-image-2",
      fromDescription: null,
    };
    const read = readAiDoorDescribeResult("gpt", {
      status: "ok",
      model: "gpt",
      description: "Style: shaker.",
      providerModel: "gpt-4.1-mini",
      image,
    });
    expect(read.image).toEqual(image);
    expect(read.imageMessage).toBeNull();
    expect(read.message).toBeNull();
  });

  it("keeps the description and says why there is no picture", () => {
    const read = readAiDoorDescribeResult("claude", {
      status: "ok",
      model: "claude",
      description: "Style: shaker.",
      providerModel: "claude-sonnet-4-6",
      image: null,
      imageMessage: "Google's image model could not draw this door. Try Generate again.",
    });
    expect(read.description).toBe("Style: shaker.");
    expect(read.image).toBeNull();
    expect(read.imageMessage).toContain("could not draw this door");
  });

  it("keeps a missing key distinct, with its plain sentence", () => {
    const read = readAiDoorDescribeResult("claude", {
      status: "not-connected",
      model: "claude",
      message: AI_DOOR_NOT_CONNECTED_MESSAGE.claude,
    });
    expect(read.notConnected).toBe(true);
    expect(read.description).toBeNull();
    expect(read.message).toContain("Claude isn't connected yet");
    expect(read.message).toContain("ANTHROPIC_API_KEY");
  });

  it("falls back to the model's own sentence if the server sends none", () => {
    const read = readAiDoorDescribeResult("gemini", { status: "not-connected", model: "gemini", message: "" });
    expect(read.message).toBe(AI_DOOR_NOT_CONNECTED_MESSAGE.gemini);
  });

  it("passes a provider failure through as one plain sentence", () => {
    const read = readAiDoorDescribeResult("gpt", {
      status: "error",
      model: "gpt",
      code: "rate-limited",
      message: "GPT is busy right now. Try Generate again in a moment.",
    });
    expect(read.notConnected).toBe(false);
    expect(read.message).toContain("busy");
  });

  it("has a message for an empty answer and for no answer at all", () => {
    expect(readAiDoorDescribeResult("gpt", { status: "ok", model: "gpt", description: "   ", providerModel: null }).message)
      .toContain("answered with nothing");
    expect(readAiDoorDescribeResult("gpt", null).message).toBe(AI_DOOR_GENERATE_FAILED_MESSAGE);
  });
});

describe("the client half", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("answers plainly when this build's router has no procedure", async () => {
    vi.doMock("@/lib/trpc", () => ({ trpc: { aiDoorDescription: {} } }));
    const client = await import("../client/src/lib/aiDoorDescribeClient");
    expect(client.aiDoorDescribeProcedureAvailable()).toBe(false);
  });

  it("exposes the procedure when the router carries it", async () => {
    vi.doMock("@/lib/trpc", () => ({
      trpc: { aiDoorDescription: { describeWithAi: { useMutation: () => ({ mutateAsync: vi.fn(), isPending: false }) } } },
    }));
    const client = await import("../client/src/lib/aiDoorDescribeClient");
    expect(client.aiDoorDescribeProcedureAvailable()).toBe(true);
  });
});

describe("no provider key reaches the browser bundle", () => {
  const BROWSER_FILES = [
    "../client/src/components/admin/AiDoorDescriptionCompare.tsx",
    "../client/src/lib/aiDoorDescribeClient.ts",
    "./aiDoorDescribe.ts",
    "./aiDoorPrompts.ts",
  ];

  it("is read from the server environment only", () => {
    for (const file of BROWSER_FILES) {
      const source = readFileSync(new URL(file, import.meta.url), "utf8");
      // A browser file may NAME the variable in a message or a type, but must
      // never read it from an environment it does not have.
      expect(source, file).not.toMatch(/process\.env\[\s*["'](?:OPENAI|ANTHROPIC|GEMINI)/);
      expect(source, file).not.toContain("import.meta.env.OPENAI");
      expect(source, file).not.toContain("import.meta.env.ANTHROPIC");
      // No literal key shape.
      expect(source, file).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
    }
  });

  it("is never placed in a VITE_ variable", () => {
    const envExample = readFileSync(new URL("../.env.example", import.meta.url), "utf8");
    for (const key of Object.values(AI_DOOR_MODEL_ENV_KEYS)) {
      expect(envExample).not.toContain(`VITE_${key}`);
    }
  });
});
