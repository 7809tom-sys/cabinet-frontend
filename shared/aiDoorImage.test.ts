/**
 * Every column is the same two steps: the provider writes a description, then an
 * image model draws the door from it. Claude is a text writer like the other two,
 * not a special case.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AI_DOOR_IMAGE_MODELS,
  AI_DOOR_IMAGE_PLANS,
  aiDoorImageCaption,
  aiDoorImagePlan,
  aiDoorImageStepLabel,
  aiDoorPipelineLabel,
} from "./aiDoorImage";
import { AI_DOOR_MODELS } from "./aiDoorPrompts";

describe("each column is the same two steps", () => {
  it("has a text writer for every column, and always the column's own provider", () => {
    expect(aiDoorImagePlan("gpt").writer).toBe("gpt");
    expect(aiDoorImagePlan("claude").writer).toBe("claude");
    expect(aiDoorImagePlan("gemini").writer).toBe("gemini");
  });

  it("has an image painter for every column, with no column missing one", () => {
    expect(aiDoorImagePlan("gpt").painter).toBe("openai");
    expect(aiDoorImagePlan("claude").painter).toBe("gemini");
    expect(aiDoorImagePlan("gemini").painter).toBe("gemini");
    for (const model of AI_DOOR_MODELS) {
      expect(aiDoorImagePlan(model).painter, model).toMatch(/^(openai|gemini)$/);
    }
  });

  it("reads the same way for all three columns", () => {
    expect(aiDoorPipelineLabel("gpt")).toBe("GPT description → image");
    expect(aiDoorPipelineLabel("claude")).toBe("Claude description → image");
    expect(aiDoorPipelineLabel("gemini")).toBe("Gemini description → image");
  });

  it("covers all three columns and no others", () => {
    expect(Object.keys(AI_DOOR_IMAGE_PLANS).sort()).toEqual([...AI_DOOR_MODELS].sort());
  });

  it("names the env var each writing provider reads, and never a value", () => {
    expect(AI_DOOR_IMAGE_PLANS.gpt.envKey).toBe("OPENAI_API_KEY");
    expect(AI_DOOR_IMAGE_PLANS.claude.envKey).toBe("ANTHROPIC_API_KEY");
    expect(AI_DOOR_IMAGE_PLANS.gemini.envKey).toBe("GEMINI_API_KEY");
    for (const plan of Object.values(AI_DOOR_IMAGE_PLANS)) {
      // Only variable names travel to the browser.
      expect(plan.envKey).toMatch(/^[A-Z][A-Z0-9_]+$/);
      expect(plan.imageModelEnv).toMatch(/^[A-Z][A-Z0-9_]+$/);
      expect(plan.imageModelFallback).not.toMatch(/sk-|AIza/);
    }
  });

  it("names both steps for every column", () => {
    expect(aiDoorImageStepLabel("gpt")).toContain("Step 1 GPT description");
    expect(aiDoorImageStepLabel("claude")).toContain("Step 1 Claude description");
    expect(aiDoorImageStepLabel("claude")).toContain("Step 2 Google's image model image");
  });

  it("uses the image model ids this codebase already runs, not invented ones", () => {
    // gpt-image-2 is what the Designer's photo renders name; the Gemini image
    // model is what server/_core/imageGeneration.ts already calls.
    expect(AI_DOOR_IMAGE_MODELS.openai.fallback).toBe("gpt-image-2");
    expect(AI_DOOR_IMAGE_MODELS.gemini.fallback).toBe("gemini-3.1-flash-image");
    // The Gemini image model is shared with room scenes, so its variable is too.
    expect(AI_DOOR_IMAGE_MODELS.gemini.env).toBe("GEMINI_IMAGE_MODEL");
  });
});

describe("the caption names both steps, in the same order for every column", () => {
  it("names the text step then the image step for GPT", () => {
    const caption = aiDoorImageCaption("gpt", {
      url: "/manus-storage/x.png",
      painter: "openai",
      providerModel: "gpt-image-2",
      fromDescription: null,
    });
    expect(caption).toContain("Step 1: GPT wrote the description");
    expect(caption).toContain("Step 2: OpenAI's image model drew this image");
  });

  it("names Claude as the text writer and Google as the image step", () => {
    const caption = aiDoorImageCaption("claude", {
      url: "/manus-storage/x.png",
      painter: "gemini",
      providerModel: "gemini-3.1-flash-image",
      fromDescription: "claude",
    });
    expect(caption).toContain("Step 1: Claude wrote the description");
    expect(caption).toContain("Step 2: Google's image model drew this image");
    expect(caption).not.toContain("Claude drew");
  });

  it("says the same two steps for Gemini", () => {
    const caption = aiDoorImageCaption("gemini", {
      url: "/manus-storage/x.png",
      painter: "gemini",
      providerModel: "gemini-3.1-flash-image",
      fromDescription: null,
    });
    expect(caption).toContain("Step 1: Gemini wrote the description");
    expect(caption).toContain("Step 2: Google's image model drew this image");
  });

  it("has no caption when there is no picture", () => {
    expect(aiDoorImageCaption("gpt", null)).toBeNull();
  });
});

describe("no key reaches the browser bundle", () => {
  it("names variables in the shared plan but reads none", () => {
    const source = readFileSync(new URL("./aiDoorImage.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/process\.env/);
    expect(source).not.toMatch(/import\.meta\.env/);
    expect(source).not.toMatch(/sk-[A-Za-z0-9]{16,}/);
    expect(source).not.toMatch(/AIza[A-Za-z0-9_-]{16,}/);
  });
});
