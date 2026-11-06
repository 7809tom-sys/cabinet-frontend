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
  AI_DOOR_PROMPT_MAX_CHARS,
  aiDoorDescribeInput,
  aiDoorSendsInstructions,
  aiDoorStatusLabel,
  aiDoorStatusSentence,
  composeAiDoorPrompt,
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
    expect(Object.keys(input).sort()).toEqual(["doorName", "image", "model", "prompt", "styleId"]);
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
    expect(read).toEqual({ description: "Style: shaker.", message: null, notConnected: false, reason: null });
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

  it("names a specific reason for each failure so the indicator never just says error", () => {
    expect(readAiDoorDescribeResult("gpt", { status: "ok", model: "gpt", description: "", providerModel: null }).reason)
      .toBe("empty-response");
    expect(readAiDoorDescribeResult("claude", { status: "not-connected", model: "claude", message: "" }).reason)
      .toBe("not-connected");
    expect(readAiDoorDescribeResult("gpt", { status: "error", model: "gpt", code: "timeout", message: "slow" }).reason)
      .toBe("timeout");
    expect(readAiDoorDescribeResult("gpt", { status: "error", model: "gpt", code: "rate-limited", message: "busy" }).reason)
      .toBe("rate-limited");
    expect(readAiDoorDescribeResult("gemini", { status: "error", model: "gemini", code: "provider-error", message: "x" }).reason)
      .toBe("provider-error");
  });

  it("has a short label and a plain sentence for every reason", () => {
    const reasons = ["not-connected", "timeout", "rate-limited", "empty-response", "handoff-failed", "provider-error"] as const;
    for (const reason of reasons) {
      const label = aiDoorStatusLabel(reason);
      expect(label, reason).not.toBe("");
      expect(label.toLowerCase(), reason).not.toBe("error");
      expect(aiDoorStatusSentence({ model: "gpt", reason }), reason).not.toBe("");
    }
    // The handoff sentence says the text did not reach the door field, which is
    // the one failure a model reply alone cannot detect.
    expect(aiDoorStatusSentence({ model: "gpt", reason: "handoff-failed" })).toContain("description field");
  });
});

describe("the operator's own instructions", () => {
  it("are appended to the standing prompt so the model actually receives them", () => {
    const composed = composeAiDoorPrompt({
      prompt: AI_DOOR_PROMPTS.gpt,
      instructions: "This is the Haven Harbor door, rails look 2-3/4 in.",
    });
    expect(composed.startsWith(AI_DOOR_PROMPTS.gpt)).toBe(true);
    expect(composed).toContain("This is the Haven Harbor door");
    // The standing prompt is still there, not replaced.
    expect(composed).toContain("Style family:");
  });

  it("leave the prompt untouched when the operator typed nothing", () => {
    expect(composeAiDoorPrompt({ prompt: AI_DOOR_PROMPTS.claude, instructions: "   " })).toBe(AI_DOOR_PROMPTS.claude);
    expect(composeAiDoorPrompt({ prompt: AI_DOOR_PROMPTS.claude })).toBe(AI_DOOR_PROMPTS.claude);
  });

  it("can never exceed the server's prompt limit, even with a very long instruction", () => {
    const composed = composeAiDoorPrompt({
      prompt: AI_DOOR_PROMPTS.gemini,
      instructions: "x".repeat(20_000),
    });
    expect(composed.length).toBeLessThanOrEqual(AI_DOOR_PROMPT_MAX_CHARS);
    // The standing prompt survives intact; only the instruction is clipped.
    expect(composed.startsWith(AI_DOOR_PROMPTS.gemini)).toBe(true);
  });

  it("travel in the request, both appended and as their own key", () => {
    const instructions = "Ignore the glare on the left stile.";
    const input = aiDoorDescribeInput({
      model: "gpt",
      prompt: AI_DOOR_PROMPTS.gpt,
      instructions,
    });
    expect(input.prompt).toContain(instructions);
    // Forward-compatible: an updated server can read the separate key, and an
    // older one still gets the text because it is inside `prompt`.
    expect(input.instructions).toBe(instructions);
  });

  it("are left out of the request entirely when the field was empty", () => {
    const input = aiDoorDescribeInput({ model: "gpt", prompt: AI_DOOR_PROMPTS.gpt, instructions: "  " });
    // Backward compatible with the deployed router: no new key at all.
    expect("instructions" in input).toBe(false);
    expect(input.prompt).toBe(AI_DOOR_PROMPTS.gpt);
  });

  it("are reported as sent only when there is real text", () => {
    expect(aiDoorSendsInstructions("2 3/4 rails")).toBe(true);
    expect(aiDoorSendsInstructions("   ")).toBe(false);
    expect(aiDoorSendsInstructions(null)).toBe(false);
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
