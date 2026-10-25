import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { OpeningSizeEditor } from "./OpeningSizeEditor";

describe("OpeningSizeEditor", () => {
  it("exposes exact window size, sill, and four-direction position controls", () => {
    const markup = renderToStaticMarkup(
      createElement(LanguageProvider, null, createElement(OpeningSizeEditor, {
        opening: {
          uid: "kitchen-window",
          kind: "window",
          label: "Kitchen Window",
          side: "top",
          offset: 30,
          width: 36,
          height: 30,
          sill: 36,
        },
        room: { width: 144, depth: 120, ceilingHeight: 96 },
        onChange: () => undefined,
        onDelete: () => undefined,
      })),
    );

    expect(markup).toContain('title="Move window down 1 inch"');
    expect(markup).toContain('title="Move window up 1 inch"');
    expect(markup).toContain('aria-label="Move toward start of wall"');
    expect(markup).toContain('aria-label="Move toward end of wall"');
  });
});
