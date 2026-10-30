// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ContractorApplicationFields } from "./ContractorApplicationFields";

function Harness() {
  const [businessName, setBusinessName] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  return (
    <ContractorApplicationFields
      businessName={businessName}
      phone={phone}
      licenseNumber={licenseNumber}
      onBusinessNameChange={setBusinessName}
      onPhoneChange={setPhone}
      onLicenseNumberChange={setLicenseNumber}
    />
  );
}

describe("contractor application fields", () => {
  it("keeps the self-service labels and ids", () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText("Business name"), { target: { value: "Build Co" } });
    fireEvent.change(screen.getByLabelText("Phone"), { target: { value: "555-0100" } });
    fireEvent.change(screen.getByLabelText("License (optional)"), { target: { value: "LIC-1" } });
    expect((screen.getByLabelText("Business name") as HTMLInputElement).id).toBe("apply-business");
    expect((screen.getByLabelText("Phone") as HTMLInputElement).id).toBe("apply-phone");
    expect((screen.getByLabelText("License (optional)") as HTMLInputElement).id).toBe("apply-license");
    expect((screen.getByLabelText("Business name") as HTMLInputElement).value).toBe("Build Co");
    expect((screen.getByLabelText("License (optional)") as HTMLInputElement).required).toBe(false);
    expect((screen.getByLabelText("Phone") as HTMLInputElement).required).toBe(true);
  });

  it("leaves the /contractor application copy and submit payload in place", () => {
    const dashboard = readFileSync(resolve(process.cwd(), "client/src/pages/ContractorDashboard.tsx"), "utf8");
    const form = dashboard.slice(dashboard.indexOf("<form"), dashboard.indexOf("Apply for contractor access"));
    expect(form).toContain("Contractor tools stay closed until an admin approves this request. Your account remains a customer in the meantime.");
    expect(form).toContain("<ContractorApplicationFields");
    expect(form).toContain("submit.mutate({ businessName: businessName.trim(), phone: phone.trim(), licenseNumber: licenseNumber.trim() || null })");
    expect(form).toContain('className="grid gap-3"');
    expect(dashboard).toContain('trpc.contractorAccess.submit.useMutation');
    expect(dashboard).toContain('trpc.contractorAccess.mine.useQuery');
    expect(dashboard).not.toContain("submitForContractor");
    expect(dashboard).not.toContain("myAffiliateRequests");
  });
});
