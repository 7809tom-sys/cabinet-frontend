import { describe, it, expect } from "vitest";
import {
  addScan,
  setScanQty,
  removeScan,
  totalScanQty,
  normalizeScanCode,
  type ScanItem,
} from "./scanList";

describe("scanList reducer", () => {
  it("adds a new code", () => {
    const out = addScan([], "B24");
    expect(out).toEqual([{ code: "B24", qty: 1 }]);
  });

  it("bumps qty on a repeat scan (case/space-insensitive) instead of duplicating", () => {
    let list: ScanItem[] = [];
    list = addScan(list, "B24");
    list = addScan(list, " b24 ");
    list = addScan(list, "B24", 3);
    expect(list).toHaveLength(1);
    expect(list[0]).toEqual({ code: "B24", qty: 5 });
  });

  it("keeps distinct codes as separate rows in scan order", () => {
    let list: ScanItem[] = [];
    list = addScan(list, "B24");
    list = addScan(list, "W3030", 2);
    list = addScan(list, "SB36");
    expect(list.map((i) => i.code)).toEqual(["B24", "W3030", "SB36"]);
    expect(totalScanQty(list)).toBe(4);
  });

  it("ignores blank codes", () => {
    expect(addScan([], "   ")).toEqual([]);
    expect(addScan([{ code: "B24", qty: 1 }], "")).toEqual([{ code: "B24", qty: 1 }]);
  });

  it("manual add with explicit qty works like a scan", () => {
    const list = addScan([], "DB24-3", 4);
    expect(list).toEqual([{ code: "DB24-3", qty: 4 }]);
  });

  it("sets an explicit qty, clamped 1..999", () => {
    const list: ScanItem[] = [{ code: "B24", qty: 1 }];
    expect(setScanQty(list, 0, 10)[0].qty).toBe(10);
    expect(setScanQty(list, 0, 0)[0].qty).toBe(1);
    expect(setScanQty(list, 0, 5000)[0].qty).toBe(999);
    expect(setScanQty(list, 9, 5)).toBe(list); // out of range -> unchanged ref
  });

  it("caps accumulated qty at 999", () => {
    let list = addScan([], "B24", 998);
    list = addScan(list, "B24", 50);
    expect(list[0].qty).toBe(999);
  });

  it("removes a row by index", () => {
    const list: ScanItem[] = [
      { code: "B24", qty: 1 },
      { code: "W3030", qty: 2 },
    ];
    expect(removeScan(list, 0)).toEqual([{ code: "W3030", qty: 2 }]);
    expect(removeScan(list, 9)).toBe(list); // out of range -> unchanged ref
  });

  it("normalizeScanCode collapses whitespace + uppercases", () => {
    expect(normalizeScanCode("  b 24 ")).toBe("B 24");
    expect(normalizeScanCode("db24-3")).toBe("DB24-3");
  });
});
