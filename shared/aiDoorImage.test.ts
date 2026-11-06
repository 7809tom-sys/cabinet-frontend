/**
 * Which provider draws each column's door, and who is honest about it.
 *
 * Anthropic returns text only, so Claude's column cannot draw its own picture.
 * That is written down here rather than discovered at runtime, so the UI can say
 * which model drew the image instead of implying Claude did.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  AI_DOOR_IMAGE_MODELS,
  AI_DOOR_IMAGE_PLANS,
  aiDoorImageCaption,
  aiDoorImagePlan,
  aiDoorModelCanDrawImage,
} from "./aiDoorImage";
import { AI_DOOR_MODELS } from "./aiDoorPrompts";

describe("who draws what", () => {
  it("lets GPT and Gemini draw their own picture", () => {
    expect(aiDoorModelCanDrawImage("gpt")).toBe(true);
    expect(aiDoorModelCanDrawImage("gemini")).toBe(true);
    expect(aiDoorImagePlan("gpt").painter).toBe("openai");
    expect(aiDoorImagePlan("gemini").painter).toBe("gemini");
    // Their own provider writes and draws.
    expect(aiDoorImagePlan("gpt").painterIsWriter).toBe(true);
    expect(aiDoorImagePlan("gemini").painterIsWriter).toBe(true);
  });

  it("never claims Claude can draw, and names the model that does", () => {
    expect(aiDoorModelCanDrawImage("claude")).toBe(false);
    const plan = aiDoorImagePlan("claude");
    expect(plan.writer).toBe("claude");
    expect(plan.painter).toBe("gemini");
    expect(plan.route).toBe("description-then-image");
    expect(plan.note).toContain("Claude cannot return an image");
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

  it("uses the image model ids this codebase already runs, not invented ones", () => {
    // gpt-image-2 is what the Designer's photo renders name; the Gemini image
    // model is what server/_core/imageGeneration.ts already calls.
    expect(AI_DOOR_IMAGE_MODELS.openai.fallback).toBe("gpt-image-2");
    expect(AI_DOOR_IMAGE_MODELS.gemini.fallback).toBe("gemini-3.1-flash-image");
    // The Gemini image model is shared with room scenes, so its variable is too.
    expect(AI_DOOR_IMAGE_MODELS.gemini.env).toBe("GEMINI_IMAGE_MODEL");
  });
});

describe("the caption says who drew the picture", () => {
  it("credits the own-provider for GPT and Gemini", () => {
    const caption = aiDoorImageCaption("gpt", {
      url: "/manus-storage/x.png",
      painter: "openai",
      providerModel: "gpt-image-2",
      fromDescription: null,
    });
    expect(caption).toContain("OpenAI's image model drew this door");
  });

  it("credits the image model and Claude's description for Claude", () => {
    const caption = aiDoorImageCaption("claude", {
      url: "/manus-storage/x.png",
      painter: "gemini",
      providerModel: "gemini-3.1-flash-image",
      fromDescription: "claude",
    });
    expect(caption).toContain("Google's image model drew this door");
    expect(caption).toContain("Claude's description");
    // It never says Claude drew it.
    expect(caption).not.toContain("Claude drew");
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
