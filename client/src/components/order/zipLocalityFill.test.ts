import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyZipLookup,
  checkoutZip5,
  emptyZipFillMemory,
  rememberManualCity,
  rememberManualState,
  type ZipFillMemory,
} from "./zipLocalityFill";

const ny = { city: "New York", state: "NY" };
const ca = { city: "Beverly Hills", state: "CA" };

function fill(
  city: string,
  state: string,
  memory: ZipFillMemory,
  zip5: string | null,
  lookup: { city: string; state: string } | null | undefined,
) {
  return applyZipLookup({ city, state, memory, zip5, lookup });
}

describe("checkout ZIP autofill", () => {
  it("reads a 5-digit ZIP and the first five of ZIP+4", () => {
    expect(checkoutZip5("10001")).toBe("10001");
    expect(checkoutZip5("10001-1234")).toBe("10001");
    expect(checkoutZip5(" 90210-0000 ")).toBe("90210");
  });

  it("ignores partial and bad ZIP text", () => {
    expect(checkoutZip5("")).toBeNull();
    expect(checkoutZip5("1000")).toBeNull();
    expect(checkoutZip5("100011")).toBeNull();
    expect(checkoutZip5("nope")).toBeNull();
    expect(checkoutZip5("10001-12")).toBeNull();
  });

  it("fills city and state from a known ZIP", () => {
    const next = fill("", "", emptyZipFillMemory(), "10001", ny);
    expect(next.city).toBe("New York");
    expect(next.state).toBe("NY");
    expect(next.memory.appliedZip5).toBe("10001");
  });

  it("keeps a city or state the customer typed for this ZIP", () => {
    let memory = rememberManualCity(emptyZipFillMemory(), "10001");
    let next = fill("Brooklyn", "", memory, "10001", ny);
    expect(next.city).toBe("Brooklyn");
    expect(next.state).toBe("NY");

    memory = rememberManualState(next.memory, "10001");
    next = fill(next.city, "NJ", memory, "10001", ny);
    expect(next).toEqual(fill("Brooklyn", "NJ", memory, "10001", ny));
    expect(next.city).toBe("Brooklyn");
    expect(next.state).toBe("NJ");
  });

  it("does not overwrite a hand edit when the same ZIP is looked up again", () => {
    const first = fill("", "", emptyZipFillMemory(), "10001", ny);
    const edited = rememberManualCity(first.memory, "10001");
    const again = fill("Brooklyn", first.state, edited, "10001", ny);
    expect(again.city).toBe("Brooklyn");
    expect(again.state).toBe("NY");
  });

  it("fills from a new ZIP even after a hand edit", () => {
    const first = fill("", "", emptyZipFillMemory(), "10001", ny);
    const edited = rememberManualCity(rememberManualState(first.memory, "10001"), "10001");
    const next = fill("Brooklyn", "NJ", edited, "90210", ca);
    expect(next.city).toBe("Beverly Hills");
    expect(next.state).toBe("CA");
  });

  it("leaves city and state alone when the lookup is unknown or still loading", () => {
    const seeded = { city: "Brooklyn", state: "NJ", memory: emptyZipFillMemory() };
    expect(fill(seeded.city, seeded.state, seeded.memory, "99999", null)).toMatchObject({
      city: "Brooklyn",
      state: "NJ",
    });
    expect(fill(seeded.city, seeded.state, seeded.memory, "10001", undefined)).toEqual({
      city: "Brooklyn",
      state: "NJ",
      memory: seeded.memory,
    });
    expect(fill(seeded.city, seeded.state, seeded.memory, null, ny)).toEqual({
      city: "Brooklyn",
      state: "NJ",
      memory: seeded.memory,
    });
  });

  it("wires checkout through the existing debounced ZIP and the public lookup", () => {
    const source = readFileSync(resolve(process.cwd(), "client/src/components/order/OrderReview.tsx"), "utf8");
    const timers = source.match(/setTimeout\(\(\) => setZipDebounced\(zip\.trim\(\)\), 350\)/g) ?? [];
    expect(timers).toHaveLength(1);
    expect(source).toContain("const zip5 = checkoutZip5(zipDebounced)");
    expect(source).toContain("trpc.freight.lookupZip.useQuery(");
    expect(source).toContain("{ zip: zip5 ?? \"\" }");
    expect(source).toContain("enabled: zip5 != null, retry: false");
    expect(source).toContain("enabled: deliveryMethod === \"ship\" && zipDebounced.length >= 5 && city.trim().length > 0 && taxState.length === 2 && addressLine1.trim().length > 0 && freightInput.items.length > 0");
    expect(source).toContain("enabled: deliveryMethod === \"ship\" && hasHardwareLines && zipDebounced.length >= 5 && city.trim().length > 0 && addressLine1.trim().length > 0");
    expect(source).toContain('onChange={(e) => editCity(e.target.value)}');
    expect(source).toContain("onValueChange={editTaxState}");
    expect(source).not.toContain("usZipLocalities");
  });
});
