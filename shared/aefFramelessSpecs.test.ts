import { describe, expect, it } from "vitest";
import { aefFramelessSpec, isAefFramelessStyleCode } from "./aefFramelessSpecs";

describe("AltaEuro frameless style codes", () => {
  it("recognizes Luxe, Zenit, Syncron, Torino, and Palermo codes", () => {
    for (const code of ["LSA", "lsa", "LSN", "ZSA", "ZCC", "SSH", "SCA", "TWP", "PGW"]) {
      expect(isAefFramelessStyleCode(code), code).toBe(true);
      expect(aefFramelessSpec(code), code).not.toBeNull();
    }
    expect(aefFramelessSpec("LSA")?.finishSheen).toBe("gloss");
    expect(aefFramelessSpec("ZSA")?.finishSheen).toBe("matte");
    expect(aefFramelessSpec("SSH")?.finishSheen).toBe("satin");
    expect(aefFramelessSpec("PGW")?.finishSheen).toBe("gloss");
    expect(aefFramelessSpec("TWP")?.finishSheen).toBe("satin");
  });

  it("does not treat Madison Shaker Cinder or a bare Z code as AltaEuro", () => {
    expect(isAefFramelessStyleCode("SC")).toBe(false);
    expect(aefFramelessSpec("SC")).toBeNull();
    expect(isAefFramelessStyleCode("Z")).toBe(false);
    expect(aefFramelessSpec("Z")).toBeNull();
    expect(isAefFramelessStyleCode("SW")).toBe(false);
    expect(isAefFramelessStyleCode("SEO")).toBe(false);
    expect(isAefFramelessStyleCode("")).toBe(false);
    expect(isAefFramelessStyleCode(null)).toBe(false);
  });
});
