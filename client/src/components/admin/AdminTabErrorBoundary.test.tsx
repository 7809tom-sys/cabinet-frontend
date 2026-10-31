// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminTabErrorBoundary } from "./AdminTabErrorBoundary";

afterEach(() => {
  cleanup();
});

function guardedTabs(source: string) {
  const blocks = source.match(/<TabsContent\b[\s\S]*?<\/TabsContent>/g) ?? [];
  expect(blocks.length).toBeGreaterThan(0);
  for (const block of blocks) {
    expect(block).toContain("<AdminTabErrorBoundary");
    expect(block).toContain("tabName=");
    expect(block).toContain("</AdminTabErrorBoundary>");
  }
  return blocks.length;
}

describe("AdminTabErrorBoundary", () => {
  it("wraps every admin tab, including the limited sales and designer workspaces", () => {
    const grouped = readFileSync(resolve(process.cwd(), "client/src/components/admin/AdminGroupedTabs.tsx"), "utf8");
    const admin = readFileSync(resolve(process.cwd(), "client/src/pages/Admin.tsx"), "utf8");
    expect(guardedTabs(grouped)).toBeGreaterThanOrEqual(70);
    expect(guardedTabs(admin)).toBe(6);
    expect(grouped).toContain('<AdminTabErrorBoundary tabName="Shipping">');
    expect(admin).toContain('user.role !== "admin"');
    expect(admin).not.toMatch(/email\s*===\s*["']/);
    expect(grouped).not.toMatch(/email\s*===\s*["']/);
  });

  it("shows the tab name, the error message, and Retry, and logs the failure", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let shouldThrow = true;
    function Boom() {
      if (shouldThrow) throw new Error("totalWeightLbs is null");
      return <p>Shipping settings recovered</p>;
    }

    render(
      <AdminTabErrorBoundary tabName="Shipping">
        <Boom />
      </AdminTabErrorBoundary>,
    );

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Shipping");
    expect(alert.textContent).toContain("totalWeightLbs is null");
    expect(errorSpy.mock.calls.some((call) => call.some((part) => String(part).includes('Admin tab "Shipping" failed to render')))).toBe(true);

    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(screen.getByText("Shipping settings recovered")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    errorSpy.mockRestore();
  });
});
