import { describe, expect, it } from "vitest";
import {
  centralDaysSince,
  describeOrderActor,
  formatCentralDate,
  formatCentralTime,
  orderActorEmail,
  orderActorLabel,
  orderActorName,
} from "./orderStatusActor";

describe("order actor label", () => {
  it("stores the name and the email together", () => {
    expect(orderActorLabel("Dana Reaves", "dana@cabinetdealz.com")).toBe("Dana Reaves <dana@cabinetdealz.com>");
  });

  it("falls back to whichever half exists", () => {
    expect(orderActorLabel("Dana", null)).toBe("Dana");
    expect(orderActorLabel(null, "dana@cabinetdealz.com")).toBe("dana@cabinetdealz.com");
    expect(orderActorLabel("  ", "  ")).toBe("Admin");
  });

  it("never exceeds the 255-character column", () => {
    expect(orderActorLabel("x".repeat(400), "y@z.com").length).toBe(255);
  });

  it("reads the name and email back out", () => {
    expect(orderActorName("Dana Reaves <dana@cabinetdealz.com>")).toBe("Dana Reaves");
    expect(orderActorEmail("Dana Reaves <dana@cabinetdealz.com>")).toBe("dana@cabinetdealz.com");
    expect(orderActorName("dana@cabinetdealz.com")).toBe("dana@cabinetdealz.com");
    expect(orderActorEmail("Dana Reaves")).toBeNull();
    expect(orderActorName(null)).toBeNull();
  });
});

describe("Central time display", () => {
  it("renders the timestamp in CT with the suffix", () => {
    // DST ends Nov 1 2026, so Nov 5 is CST (UTC-6): 19:47Z is 1:47 PM.
    expect(formatCentralTime("2026-11-05T19:47:00.000Z")).toBe("Nov 5, 2026, 1:47 PM CT");
  });

  it("uses daylight time in the summer", () => {
    // July is CDT (UTC-5): 19:47Z is 2:47 PM.
    expect(formatCentralTime("2026-07-15T19:47:00.000Z")).toBe("Jul 15, 2026, 2:47 PM CT");
  });

  it("handles standard time in winter", () => {
    // 2026-01-05T20:47:00Z is 2:47 PM CST.
    expect(formatCentralTime("2026-01-05T20:47:00.000Z")).toBe("Jan 5, 2026, 2:47 PM CT");
  });

  it("renders a date-only value", () => {
    expect(formatCentralDate("2026-11-05T19:47:00.000Z")).toBe("Nov 5, 2026");
  });

  it("returns null for nothing and for junk", () => {
    expect(formatCentralTime(null)).toBeNull();
    expect(formatCentralTime("")).toBeNull();
    expect(formatCentralTime("not a date")).toBeNull();
  });
});

describe("describeOrderActor", () => {
  it("builds the sentence shown on the order page", () => {
    const described = describeOrderActor("Verified", {
      by: "Dana Reaves <dana@cabinetdealz.com>",
      at: "2026-11-05T19:47:00.000Z",
    });
    expect(described?.label).toBe("Verified by Dana Reaves · Nov 5, 2026, 1:47 PM CT");
    expect(described?.full).toBe("Dana Reaves · dana@cabinetdealz.com");
  });

  it("is null while the step is still waiting", () => {
    expect(describeOrderActor("Verified", { by: null, at: null })).toBeNull();
  });

  it("still reads sensibly when no actor was recorded", () => {
    const described = describeOrderActor("Shipped", { by: null, at: "2026-11-05T19:47:00.000Z" });
    expect(described?.label).toContain("Shipped by —");
  });
});

describe("stuck age", () => {
  it("counts whole Central calendar days", () => {
    expect(centralDaysSince("2026-11-01T15:00:00.000Z", new Date("2026-11-05T15:00:00.000Z"))).toBe(4);
  });

  it("does not go negative for a future timestamp", () => {
    expect(centralDaysSince("2026-11-09T15:00:00.000Z", new Date("2026-11-05T15:00:00.000Z"))).toBe(0);
  });

  it("returns null when there is no timestamp", () => {
    expect(centralDaysSince(null)).toBeNull();
  });
});
