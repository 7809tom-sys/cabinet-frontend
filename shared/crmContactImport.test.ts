import { describe, expect, it } from "vitest";
import {
  CONTACT_IMPORT_BATCH_SIZE,
  chunkRows,
  guessContactColumnMapping,
  importedContactNote,
  isValidContactEmail,
  mapContactRow,
  normalizeLastPurchaseDate,
  planContactImport,
} from "./crmContactImport";

describe("customer list import mapping", () => {
  it("guesses common legacy headers", () => {
    const mapping = guessContactColumnMapping(["First Name", "Last Name", "E-mail Address", "Phone #", "Street", "Town", "ST", "Zip Code", "Last Order Date", "Comments"]);
    expect(mapping).toEqual({ firstName: 0, lastName: 1, email: 2, phone: 3, address: 4, city: 5, state: 6, zip: 7, lastPurchaseDate: 8, notes: 9 });
  });

  it("joins first + last name and lowercases email", () => {
    const row = mapContactRow(["Jane", "Doe", " Jane.Doe@Example.COM "], { firstName: 0, lastName: 1, email: 2 });
    expect(row.name).toBe("Jane Doe");
    expect(row.email).toBe("jane.doe@example.com");
  });

  it("validates emails", () => {
    for (const ok of ["a@b.co", "first.last+tag@sub.example.com"]) expect(isValidContactEmail(ok)).toBe(true);
    for (const bad of ["", "no-at", "a@b", "a@@b.com", "a b@c.com", ".a@b.com", "a..b@c.com", "a@b.123"]) expect(isValidContactEmail(bad)).toBe(false);
  });

  it("normalizes Excel serial and US dates", () => {
    expect(normalizeLastPurchaseDate(44562)).toBe("2022-01-01");
    expect(normalizeLastPurchaseDate("3/7/1998")).toBe("1998-03-07");
    expect(normalizeLastPurchaseDate("1987")).toBe("1987");
    expect(normalizeLastPurchaseDate("")).toBeNull();
  });

  it("reports invalid, missing and in-file duplicate emails with spreadsheet row numbers", () => {
    const plan = planContactImport([
      ["Ann", "ann@example.com"],
      ["Bob", "not-an-email"],
      ["", ""],
      ["Cy", ""],
      ["Ann again", "ANN@example.com"],
    ], { name: 0, email: 1 });
    expect(plan.valid.map((row) => row.rowNumber)).toEqual([2]);
    expect(plan.rejected).toEqual([
      { rowNumber: 3, email: "not-an-email", reason: "invalid_email" },
      { rowNumber: 5, email: "", reason: "missing_email" },
      { rowNumber: 6, email: "ann@example.com", reason: "duplicate_in_file" },
    ]);
  });

  it("plans and batches a 50,000-row file", () => {
    const rows = Array.from({ length: 50_000 }, (_, i) => [`Customer ${i}`, `c${i}@example.com`, "NH"]);
    const started = Date.now();
    const plan = planContactImport(rows, { name: 0, email: 1, state: 2 });
    expect(plan.valid).toHaveLength(50_000);
    const batches = chunkRows(plan.valid);
    expect(batches).toHaveLength(Math.ceil(50_000 / CONTACT_IMPORT_BATCH_SIZE));
    expect(batches.every((batch) => batch.length <= CONTACT_IMPORT_BATCH_SIZE)).toBe(true);
    expect(Date.now() - started).toBeLessThan(5000);
  });

  it("writes a factual note with the source tag and import date", () => {
    expect(importedContactNote({ address: "1 Main St", city: "Concord", state: "NH", zip: "03301", lastPurchaseDate: "1999-05-01", notes: null }, "New Hampshire legacy", "2026-11-23"))
      .toBe('Imported from customer list "New Hampshire legacy" on 2026-11-23.\nAddress: 1 Main St, Concord, NH 03301\nLast purchase: 1999-05-01');
  });
});
