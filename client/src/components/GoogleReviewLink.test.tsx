// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { GoogleReviewLink } from "./GoogleReviewLink";

afterEach(() => {
  cleanup();
});

describe("GoogleReviewLink", () => {
  it("renders nothing when the review URL is not configured", () => {
    const { container } = render(<GoogleReviewLink href="" />);
    expect(container.firstChild).toBeNull();
    expect(screen.queryByTestId("google-review-link")).toBeNull();
  });

  it("renders a discreet new-tab link when a URL is configured", () => {
    render(
      <GoogleReviewLink
        className="footer-review"
        href="https://search.google.com/local/writereview?placeid=TEST_PLACE"
      />,
    );
    const link = screen.getByRole("link", { name: "Review us on Google" });
    expect(link.getAttribute("href")).toBe(
      "https://search.google.com/local/writereview?placeid=TEST_PLACE",
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    expect(link.className).toContain("footer-review");
  });
});
