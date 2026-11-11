// Draft sales-rep agreement. The signup fee is intentionally unset.
// Job Boarding (W-9, non-compete, government ID) stays on the cabinet-backend
// branch cursor/job-boarding-salesperson-onboarding-8095. This text does not
// collect a tax id and does not replace that packet.

export const SALES_REP_AGREEMENT_VERSION = "draft-2026-11-11";

export function buildSalesRepAgreementText(): string {
  return [
    "DRAFT — for Tom and his attorney to review. This is not the website Terms & Conditions and it is not a warranty.",
    "",
    `Sales Rep Agreement`,
    `Version: sales-rep-agreement@${SALES_REP_AGREEMENT_VERSION}`,
    "",
    "1. Independent contractor",
    "You are a 1099 independent contractor. You are not an employee of Cabinet Dealz. You are responsible for your own taxes. You have no authority to bind Cabinet Dealz.",
    "Authorized reps for this program are expected in Florida and Wisconsin. An admin still has to approve you before you count as a sales rep.",
    "",
    "2. What you are paid",
    "When you sell an affiliate account, you earn the flat fee and the residual rate saved in Cabinet Dealz commission settings at the time that account pays. Those amounts are copied onto the commission. A later settings change does not rewrite commissions already earned.",
    "The residual is a percent of that affiliate's confirmed order sales for as long as the account remains a customer. Confirmed order sales are the same gross used for affiliate commissions: orders whose status is confirmed.",
    "",
    "3. Signup fee",
    "TODO: Tom has not set a sales rep signup fee. There is no fee checkout until an admin enters an amount and turns the checkout on.",
    "",
    "4. Paperwork",
    "After approval, the Job Boarding packet still applies: your information, the non-compete, Form W-9, and a government ID. This page does not collect a Social Security number or an EIN.",
    "",
    "5. Governing law",
    "This agreement is governed by the laws of the State of Florida. Disputes are brought in the courts of Sarasota County, Florida, the county of Cabinet Dealz's principal place of business.",
  ].join("\n");
}
