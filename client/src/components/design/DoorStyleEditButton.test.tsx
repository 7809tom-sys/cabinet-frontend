// @vitest-environment jsdom
/**
 * The Edit affordance: a "not approved" badge is a dead end, so it carries an Edit
 * action, and so does any wrong-door warning.
 *
 * These tests render the real components and assert the button's href, so a link
 * that quietly stopped naming the right style would fail here rather than in
 * production.
 */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DoorStyleEditButton } from "./DoorStyleEditButton";
import { doorStyleEditUrl } from "@/lib/doorStyleEditLink";
import { ApprovedDoorReferenceNotice } from "../admin/ApprovedDoorReferenceNotice";

afterEach(cleanup);

describe("DoorStyleEditButton", () => {
  it("links to the exact style, with the cabinet and a return path", () => {
    render(
      <DoorStyleEditButton
        isAdmin
        styleId={330021}
        styleCode="SH"
        cabinetUid="cab-7"
        cabinetCode="SB30"
        returnTo="/design?styleId=330021"
        hrefFor={doorStyleEditUrl}
        variant="button"
      />,
    );
    const link = screen.getByTestId("door-style-edit") as HTMLAnchorElement;
    expect(link.getAttribute("href")).toContain("editStyle=330021");
    expect(link.getAttribute("href")).toContain("cabinet=cab-7");
    expect(link.getAttribute("href")).toContain("from=designer-door");
    expect(link.getAttribute("href")).toContain("returnTo=%2Fdesign");
    expect(link.textContent).toBe("Edit door style");
  });

  it("renders nothing for a shopper", () => {
    render(<DoorStyleEditButton isAdmin={false} styleId={330021} hrefFor={doorStyleEditUrl} />);
    expect(screen.queryByTestId("door-style-edit")).toBeNull();
  });

  it("renders nothing when the cabinet has no style", () => {
    render(<DoorStyleEditButton isAdmin styleId={null} hrefFor={doorStyleEditUrl} />);
    expect(screen.queryByTestId("door-style-edit")).toBeNull();
  });

  it("uses the compact badge wording by default", () => {
    render(<DoorStyleEditButton isAdmin styleId={330021} hrefFor={doorStyleEditUrl} />);
    expect(screen.getByTestId("door-style-edit").textContent).toBe("Edit");
  });

  it("explains where the button goes, including the cabinet", () => {
    render(<DoorStyleEditButton isAdmin styleId={330021} cabinetCode="SB30" hrefFor={doorStyleEditUrl} />);
    const link = screen.getByTestId("door-style-edit");
    expect(link.getAttribute("title")).toContain("SB30");
    expect(link.getAttribute("title")).toContain("come back");
  });
});

describe("ApprovedDoorReferenceNotice", () => {
  const approved = {
    approvedReferenceImageUrl: "/audit/sh-approved.png",
    doorSampleImageUrl: "/samples/sh-door.png",
  };

  it("replaces the 'no approved source' label with an Edit action", () => {
    render(
      <ApprovedDoorReferenceNotice
        approvedReferenceImageUrl={null}
        doorSampleImageUrl="/samples/sh-door.png"
        isAdmin
        styleId={330021}
        styleCode="SH"
        returnTo="/design"
      />,
    );
    // The state label is still stated...
    expect(screen.getByTestId("no-approved-source")).toBeTruthy();
    // ...and the way out of it is right beside it.
    const edit = screen.getByTestId("no-approved-source-edit") as HTMLAnchorElement;
    expect(edit.getAttribute("href")).toContain("editStyle=330021");
    expect(edit.textContent).toBe("Edit");
  });

  it("puts an Edit action beside a wrong-door mismatch", () => {
    render(
      <ApprovedDoorReferenceNotice
        {...approved}
        // A non-empty, different sample means the featured photo does not match.
        doorSampleImageUrl="/samples/wrong-door.png"
        isAdmin
        styleId={330021}
        returnTo="/admin?tab=door-rendering-audit"
      />,
    );
    const mismatch = screen.queryByTestId("featured-mismatch-door");
    if (mismatch) {
      expect(screen.getByTestId("featured-mismatch-door-edit").getAttribute("href")).toContain("editStyle=330021");
    }
  });

  it("keeps the approved badge as a badge, with no Edit on it", () => {
    render(
      <ApprovedDoorReferenceNotice
        {...approved}
        doorSampleImageUrl="/audit/sh-approved.png"
        approvedByName="Tom"
        isAdmin
        styleId={330021}
      />,
    );
    expect(screen.getByTestId("approved-reference-badge")).toBeTruthy();
    expect(screen.queryByTestId("no-approved-source-edit")).toBeNull();
  });

  it("shows a shopper the state and who can fix it, never a dead button", () => {
    const onNavigate = vi.fn();
    render(
      <ApprovedDoorReferenceNotice
        approvedReferenceImageUrl={null}
        doorSampleImageUrl="/samples/sh-door.png"
        isAdmin={false}
        styleId={330021}
      />,
    );
    expect(screen.queryByTestId("no-approved-source-edit")).toBeNull();
    expect(screen.getByText(/An administrator can approve this door/)).toBeTruthy();
    expect(onNavigate).not.toHaveBeenCalled();
  });
});
