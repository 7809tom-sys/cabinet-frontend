import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { TOAST_ALERT_MS, TOAST_INFO_MS, VERSION_TOAST_ID, toastDuration } from "./toastDurations";

describe("toast durations", () => {
  it("uses about five seconds for success and info, and about eight for warnings and errors", () => {
    expect(toastDuration("info", undefined)).toBe(TOAST_INFO_MS);
    expect(toastDuration("info", {})).toBe(5000);
    expect(toastDuration("alert", undefined)).toBe(TOAST_ALERT_MS);
    expect(toastDuration("alert", {})).toBe(8000);
  });

  it("keeps an explicit shorter duration and the version-update decision", () => {
    expect(toastDuration("alert", { duration: 7000 })).toBe(7000);
    expect(toastDuration("info", { id: VERSION_TOAST_ID, duration: Number.POSITIVE_INFINITY })).toBe(Number.POSITIVE_INFINITY);
    expect(toastDuration("info", { duration: Number.POSITIVE_INFINITY })).toBe(TOAST_INFO_MS);
  });

  it("leaves a loading spinner up until the caller finishes it", () => {
    expect(toastDuration("loading", undefined)).toBe(Number.POSITIVE_INFINITY);
  });

  it("installs those defaults on the shared toaster, with a close button", () => {
    const source = readFileSync(new URL("../components/ui/sonner.tsx", import.meta.url), "utf8");
    expect(source).toContain("installToastDurations()");
    expect(source).toContain("closeButton");
    expect(source).toContain("duration={TOAST_INFO_MS}");
    expect(source).toContain('withDuration(target.warning.bind(toast), "alert")');
    expect(source).toContain('withDuration(target.error.bind(toast), "alert")');
  });
});
