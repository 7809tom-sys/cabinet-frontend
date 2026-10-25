import { describe, expect, it } from "vitest";
import { cabinetEditConfigHref, cabinetEditConfigLink } from "./cabinetEditConfigLink";

describe("cabinetEditConfigLink", () => {
  it("exposes an isolated Edit Config destination for an administrator-provided URL", () => {
    expect(cabinetEditConfigLink("/catalog/B-30?edit=1")).toEqual({
      href: "/catalog/B-30?edit=1",
      target: "_blank",
      rel: "noopener noreferrer",
    });
  });

  it("does not expose an Edit Config destination without administrator access", () => {
    expect(cabinetEditConfigLink(undefined)).toBeNull();
  });
});

describe("cabinetEditConfigHref", () => {
  it("opens the exact selected cabinet record in edit mode rather than a SKU-only fallback", () => {
    expect(cabinetEditConfigHref("B-30", 930030)).toBe(
      "/catalog/B-30?edit=1&cabinetId=930030",
    );
  });

  it("does not expose a configuration destination without an exact valid cabinet ID", () => {
    expect(cabinetEditConfigHref("B-30", undefined)).toBeNull();
    expect(cabinetEditConfigHref("B-30", 0)).toBeNull();
  });
});
