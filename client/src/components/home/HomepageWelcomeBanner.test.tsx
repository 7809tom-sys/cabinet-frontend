import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { HomepageWelcomeBanner } from "./HomepageWelcomeBanner";

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

describe("HomepageWelcomeBanner", () => {
  it("renders no banner for a guest", () => {
    expect(renderToStaticMarkup(<HomepageWelcomeBanner user={null} />)).toBe("");
  });

  it("greets an authenticated user by first name and provides account shortcuts", () => {
    const html = renderToStaticMarkup(
      <HomepageWelcomeBanner user={{ name: "Tom Reaves", email: "tom@example.com" }} />
    );

    expect(html).toContain("Welcome back,");
    expect(html).toContain("Tom");
    expect(html).toContain("Continue designing");
    expect(html).toContain("My account");
  });
});
