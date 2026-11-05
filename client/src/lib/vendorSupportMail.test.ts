import { describe, expect, it } from "vitest";
import {
  VENDOR_EMAIL_PURPOSES,
  isVendorEmailAddress,
  vendorAddressSections,
  vendorEmailPurposeLabel,
  vendorInboxAssignedTo,
} from "./vendorSupportMail";

describe("vendor email purposes", () => {
  it("gives every vendor the same four sections", () => {
    expect(VENDOR_EMAIL_PURPOSES.map((purpose) => purpose.label)).toEqual([
      "Claims",
      "Support",
      "Sales",
      "Sales Communication",
    ]);
    const sections = vendorAddressSections(undefined);
    expect(sections).toHaveLength(4);
    expect(sections.every((section) => section.address === "" && section.saved === null)).toBe(true);
  });

  it("files a saved address into the matching section", () => {
    const sections = vendorAddressSections([
      { purpose: "claims", address: "claims@uscd.example" },
      { purpose: "sales", address: "sales@uscd.example" },
    ]);
    expect(sections.find((section) => section.purpose === "claims")?.address).toBe("claims@uscd.example");
    expect(sections.find((section) => section.purpose === "sales")?.address).toBe("sales@uscd.example");
    expect(sections.find((section) => section.purpose === "support")?.address).toBe("");
    expect(sections.find((section) => section.purpose === "sales_communication")?.address).toBe("");
  });

  it("labels a message type and validates addresses", () => {
    expect(vendorEmailPurposeLabel("sales_communication")).toBe("Sales Communication");
    expect(vendorEmailPurposeLabel(null)).toBe("Unfiled");
    expect(isVendorEmailAddress("claims@vendor.example")).toBe(true);
    expect(isVendorEmailAddress("not-an-address")).toBe(false);
  });

  it("names the assigned Cabinet Deals staff member", () => {
    expect(vendorInboxAssignedTo({ id: 1, assignedToName: "Dana" })).toBe("Dana");
    expect(vendorInboxAssignedTo({ id: 1, assignedToEmail: "dana@cabinetdealz.com" })).toBe("dana@cabinetdealz.com");
    expect(vendorInboxAssignedTo({ id: 1 })).toBe("Unassigned");
  });
});
