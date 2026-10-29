import { describe, expect, it } from "vitest";
import {
  AFFILIATE_CONTRACTOR_DUPLICATE_MESSAGE,
  affiliateSubmitterOptions,
  contractorAccessListInput,
  contractorAccessSourceLabel,
  contractorAccountLabel,
  contractorRequestStatusLabel,
  formatContractorAccessDate,
  listRowContractorEmail,
  listRowContractorName,
  listRowSubmitter,
  validateAffiliateContractorDraft,
  type ContractorAccessListRow,
} from "./contractorAccessForm";

const affiliateRow: ContractorAccessListRow = {
  id: 2,
  businessName: "Build Co",
  phone: "555-0199",
  licenseNumber: "LIC-9",
  status: "pending",
  source: "affiliate",
  submittedByUserId: 9,
  submittedByName: "Ada Partner",
  submittedByEmail: "ada@store.example",
  contractorName: "Sam Builder",
  contractorEmail: "sam@build.example",
};

describe("affiliate contractor request helpers", () => {
  it("keeps the pending queue until an affiliate is selected", () => {
    expect(contractorAccessListInput(null)).toEqual({ status: "pending" });
    expect(contractorAccessListInput(9)).toEqual({ submittedByUserId: 9 });
  });

  it("labels source, status, account, and dates", () => {
    expect(contractorAccessSourceLabel("affiliate")).toBe("Affiliate");
    expect(contractorAccessSourceLabel("self")).toBe("Self");
    expect(contractorRequestStatusLabel("denied")).toBe("Denied");
    expect(contractorRequestStatusLabel("rejected")).toBe("Rejected");
    expect(contractorAccountLabel(true)).toBe("Has an account");
    expect(contractorAccountLabel(false)).toBe("No account yet");
    expect(formatContractorAccessDate(null)).toBe("—");
    expect(formatContractorAccessDate("not-a-date")).toBe("—");
    expect(formatContractorAccessDate("2026-10-01T12:00:00.000Z")).toBe(
      new Date("2026-10-01T12:00:00.000Z").toLocaleDateString(),
    );
  });

  it("describes self-applied and affiliate-submitted rows", () => {
    expect(listRowSubmitter({ ...affiliateRow, source: "self", submittedByUserId: null, submittedByName: null, submittedByEmail: null })).toBe("None");
    expect(listRowSubmitter(affiliateRow)).toBe("Ada Partner · ada@store.example");
    expect(listRowContractorName({ ...affiliateRow, contractorName: null, name: "Casey Customer" })).toBe("Casey Customer");
    expect(listRowContractorEmail({ ...affiliateRow, contractorEmail: null, email: "casey@example.com" })).toBe("casey@example.com");
    expect(listRowContractorName(affiliateRow)).toBe("Sam Builder");
  });

  it("builds one option per submitting affiliate", () => {
    const options = affiliateSubmitterOptions([
      affiliateRow,
      { ...affiliateRow, id: 3, submittedByName: "  " },
      { ...affiliateRow, id: 4, source: "self", submittedByUserId: null, submittedByName: null, submittedByEmail: null },
      { ...affiliateRow, id: 5, submittedByUserId: 4, submittedByName: "Bea Stores", submittedByEmail: "bea@store.example" },
    ]);
    expect(options).toEqual([
      { userId: 9, name: "Ada Partner", email: "ada@store.example" },
      { userId: 4, name: "Bea Stores", email: "bea@store.example" },
    ]);
  });

  it("trims the affiliate request and reports a duplicate as already pending", () => {
    expect(AFFILIATE_CONTRACTOR_DUPLICATE_MESSAGE).toBe("A request for that contractor is already pending.");
    expect(validateAffiliateContractorDraft({
      contractorName: " Sam Builder ",
      contractorEmail: "sam@build.example",
      businessName: " Build Co ",
      phone: " 555-0199 ",
      licenseNumber: " ",
    })).toEqual({
      ok: true,
      value: {
        contractorName: "Sam Builder",
        contractorEmail: "sam@build.example",
        businessName: "Build Co",
        phone: "555-0199",
        licenseNumber: null,
      },
    });
    expect(validateAffiliateContractorDraft({
      contractorName: "",
      contractorEmail: "not-an-email",
      businessName: "",
      phone: "12",
      licenseNumber: "",
    }).ok).toBe(false);
  });
});
