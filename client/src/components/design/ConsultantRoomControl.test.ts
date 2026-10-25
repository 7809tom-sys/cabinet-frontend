import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ConsultantRoomControl } from "./ConsultantRoomControl";

describe("ConsultantRoomControl", () => {
  it("renders the consultant action as a room-controls toolbar control", () => {
    const html = renderToStaticMarkup(createElement(ConsultantRoomControl, {
      open: false,
      onToggle: () => undefined,
      label: "Design consultant",
    }));
    expect(html).toContain('data-designer-control="consultant-room-controls"');
    expect(html).toContain('aria-label="Design consultant"');
    expect(html).toContain("h-8");
  });
});
