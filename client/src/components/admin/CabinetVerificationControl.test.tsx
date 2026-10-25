import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CabinetVerificationControl } from "./CabinetVerificationControl";

describe("CabinetVerificationControl", () => {
  it("uses a prominent pink review-required treatment before verification", () => {
    const html = renderToStaticMarkup(
      <CabinetVerificationControl checked={false} onCheckedChange={() => undefined} />
    );

    expect(html).toContain("Mark as Verified");
    expect(html).toContain("Review required");
    expect(html).toContain("border-rose-400");
    expect(html).toContain("bg-rose-50");
    expect(html).toContain("Mark cabinet configuration as verified");
  });

  it("switches to a confirmed green state after verification", () => {
    const html = renderToStaticMarkup(
      <CabinetVerificationControl
        checked
        onCheckedChange={() => undefined}
        verifiedDescription="Verified on 8/25/2026"
      />
    );

    expect(html).toContain("Verified");
    expect(html).toContain("Verified on 8/25/2026");
    expect(html).toContain("border-emerald-300");
    expect(html).not.toContain("Review required");
  });
});
