// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const publishState = vi.hoisted(() => ({
  status: "ready" as "ready" | "missing" | "loading" | "error",
  rows: [] as Array<{ featureKey: string; published: boolean }>,
  errorMessage: null as string | null,
}));

vi.mock("@/lib/useAffiliateFeaturePublish", () => ({
  useAffiliateFeaturePublish: () => ({
    status: publishState.status,
    errorMessage: publishState.errorMessage,
    rows: publishState.rows,
    anyPublished: (featureKey: string) => publishState.rows.some((row) => row.published && row.featureKey === featureKey),
    isPublished: () => false,
  }),
}));

import { AffiliatePublishedFeature } from "./AffiliatePublishedFeature";

afterEach(() => {
  cleanup();
  publishState.status = "ready";
  publishState.rows = [];
  publishState.errorMessage = null;
});

describe("affiliate feature gate", () => {
  it("blocks a feature the server has not published", () => {
    render(<AffiliatePublishedFeature feature="closet_studio"><p>Studio</p></AffiliatePublishedFeature>);
    expect(screen.getByTestId("affiliate-feature-blocked").textContent).toContain("Closet Studio is not published for affiliates.");
    expect(screen.queryByText("Studio")).toBeNull();
  });

  it("opens a feature after the server says it is published", () => {
    publishState.rows = [{ featureKey: "bathroom_builder", published: true }];
    render(<AffiliatePublishedFeature feature="bathroom_builder"><p>Bath</p></AffiliatePublishedFeature>);
    expect(screen.getByText("Bath")).toBeTruthy();
  });

  it("leaves the existing screen up when the publish procedure is not deployed", () => {
    publishState.status = "missing";
    render(<AffiliatePublishedFeature feature="kitchen_designer"><p>Kitchen</p></AffiliatePublishedFeature>);
    expect(screen.getByText("Kitchen")).toBeTruthy();
  });

  it("shows a real publish-list failure and does not show it for a quote request", () => {
    publishState.status = "error";
    publishState.errorMessage = "the publish list failed";
    render(<AffiliatePublishedFeature feature="closet_studio"><p>Studio</p></AffiliatePublishedFeature>);
    expect(screen.getByTestId("affiliate-feature-error").textContent).toContain("Could not check whether Closet Studio is published for affiliates");
    expect(screen.queryByText("Studio")).toBeNull();
  });

  it("keeps the quote request page up when the list errors, is still loading, or has the switch off", () => {
    publishState.status = "error";
    publishState.errorMessage = "You do not have required permission (10002).";
    const { rerender } = render(<AffiliatePublishedFeature feature="quote"><p>Quote page</p></AffiliatePublishedFeature>);
    expect(screen.getByText("Quote page")).toBeTruthy();
    expect(screen.queryByTestId("affiliate-feature-error")).toBeNull();
    expect(screen.queryByTestId("affiliate-feature-blocked")).toBeNull();

    publishState.status = "loading";
    rerender(<AffiliatePublishedFeature feature="quote"><p>Quote page</p></AffiliatePublishedFeature>);
    expect(screen.getByText("Quote page")).toBeTruthy();

    publishState.status = "ready";
    publishState.rows = [];
    rerender(<AffiliatePublishedFeature feature="quote"><p>Quote page</p></AffiliatePublishedFeature>);
    expect(screen.getByText("Quote page")).toBeTruthy();
    expect(screen.queryByText("Quote requests is not published for affiliates.")).toBeNull();
  });
});
