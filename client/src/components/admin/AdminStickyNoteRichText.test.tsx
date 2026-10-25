import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AdminStickyNoteRichText, applyAdminStickyNoteFormat } from "./AdminStickyNoteRichText";

describe("AdminStickyNoteRichText", () => {
  it("applies bold and italic markers around the selected note text", () => {
    expect(applyAdminStickyNoteFormat("Review the handle layout", 7, 10, "bold")).toMatchObject({
      value: "Review **the** handle layout",
      selectionStart: 9,
      selectionEnd: 12,
    });
    expect(applyAdminStickyNoteFormat("Check frame center", 6, 11, "italic").value).toBe("Check *frame* center");
  });

  it("adds and removes bulleted and numbered lists for the selected lines", () => {
    const bullet = applyAdminStickyNoteFormat("First\nSecond", 0, 12, "bulleted-list");
    expect(bullet.value).toBe("- First\n- Second");
    expect(applyAdminStickyNoteFormat(bullet.value, 0, bullet.value.length, "bulleted-list").value).toBe("First\nSecond");
    expect(applyAdminStickyNoteFormat("First\nSecond", 0, 12, "numbered-list").value).toBe("1. First\n2. Second");
  });

  it("renders only the supported bold, italic, and list formatting through escaped React markup", () => {
    const markup = renderToStaticMarkup(<AdminStickyNoteRichText value={"**Important** *update*\n- Call the supplier\n- Confirm finish\n1. Review\n2. Approve\n<script>alert(1)</script>"} />);
    expect(markup).toContain("<strong>Important</strong>");
    expect(markup).toContain("<em>update</em>");
    expect(markup).toContain("<ul");
    expect(markup).toContain("<ol");
    expect(markup).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(markup).not.toContain("<script>alert(1)</script>");
  });
});
