import { describe, expect, it } from "vitest";
import {
  EMPTY_HIRING_SETTINGS,
  HIRING_DOCUMENT_KINDS,
  HIRING_SIGNED_URL_SECONDS,
  HIRING_STORAGE_PREFIX,
  I9_CITIZENSHIP,
  I9_LIST_A,
  I9_LIST_B,
  I9_LIST_C,
  I9_SECTION1_FIELDS,
  JOB_BOARD_TAB,
  PRIVATE_BUCKET_NAME,
  STATE_WITHHOLDING_PROFILES,
  W4_EMPLOYER_FIELDS,
  W4_FILING_STATUSES,
  W4_OTHER_DEPENDENT_AMOUNT,
  W4_QUALIFYING_CHILD_AMOUNT,
  W4_YEAR,
  canReviewDocument,
  canSignDocument,
  deriveStatus,
  hiringAccess,
  hiringObjectKey,
  isHiringStorageKey,
  isPublicStorageUrl,
  maskBank,
  maskSsn,
  mergeSensitiveFields,
  payloadForActor,
  progressFromStatuses,
  redactForLog,
  routingNumberIsValid,
  safeErrorMessage,
  signedLinkRequest,
  stateCertificateTitle,
  stateProfile,
  toPacketSummary,
  toPublicPayload,
  visiblePackets,
  type HiringActor,
  type HiringPacketRef,
} from "./hiringPacket";

const admin: HiringActor = { userId: 1, role: "admin", email: "tom@cabinetdealz.com" };
const hire: HiringActor = { userId: 42, role: "user", email: "ada@example.com" };
const other: HiringActor = { userId: 7, role: "user", email: "other@example.com" };
const designer: HiringActor = { userId: 9, role: "designer", email: "designer@cabinetdealz.com" };
const sales: HiringActor = { userId: 11, role: "sales_rep", email: "sales@cabinetdealz.com" };
const anonymous: HiringActor = { userId: null, role: null, email: null };

function packet(overrides: Partial<HiringPacketRef> = {}): HiringPacketRef {
  return { id: 5, userId: 42, applicantEmail: "ada@example.com", ...overrides };
}

const packets: HiringPacketRef[] = [
  packet(),
  packet({ id: 6, userId: 7, applicantEmail: "other@example.com" }),
  packet({ id: 8, userId: null, applicantEmail: "new.hire@example.com" }),
];

describe("job board tab", () => {
  it("is the People tab on the admin route, not a separate page", () => {
    expect(JOB_BOARD_TAB).toEqual({
      label: "Job Board",
      value: "job-board",
      route: "/admin?tab=job-board",
      component: "JobBoard",
      group: "People",
    });
  });
});

describe("hiring access control", () => {
  it("lets an admin see every packet and review", () => {
    expect(hiringAccess(admin, packet())).toMatchObject({ view: true, review: true, listAll: true, configure: true });
    expect(visiblePackets(admin, packets)).toHaveLength(3);
  });

  it("lets a hire see only their own packet, including one matched by email before the account is linked", () => {
    expect(hiringAccess(hire, packet())).toMatchObject({ view: true, edit: true, review: false, listAll: false });
    expect(hiringAccess(hire, packet({ id: 6, userId: 7, applicantEmail: "other@example.com" })).view).toBe(false);
    const invited: HiringActor = { userId: 15, role: "user", email: "new.hire@example.com" };
    expect(visiblePackets(invited, packets).map((row) => row.id)).toEqual([8]);
    expect(visiblePackets(hire, packets).map((row) => row.id)).toEqual([5]);
  });

  it("hides every packet from a stranger, a designer, a sales rep, and a signed-out visitor", () => {
    const stranger: HiringActor = { userId: 99, role: "user", email: "stranger@example.com" };
    for (const actor of [stranger, designer, sales, anonymous]) {
      expect(hiringAccess(actor, packet()).view).toBe(false);
      expect(hiringAccess(actor, packet()).review).toBe(false);
      expect(hiringAccess(actor, packet()).listAll).toBe(false);
      expect(visiblePackets(actor, packets)).toEqual([]);
    }
    expect(visiblePackets(other, packets).map((row) => row.id)).toEqual([6]);
    expect(hiringAccess(other, packet()).view).toBe(false);
  });

  it("lets a designer open only a packet that is actually theirs", () => {
    const own = packet({ userId: designer.userId, applicantEmail: designer.email! });
    expect(visiblePackets(designer, [...packets, own]).map((row) => row.id)).toEqual([own.id]);
    expect(hiringAccess(designer, own).review).toBe(false);
  });

  it("allows review only by an admin, and only after the document is signed", () => {
    expect(canReviewDocument(admin, "signed")).toEqual({ ok: true, reason: null });
    expect(canReviewDocument(admin, "in_progress").ok).toBe(false);
    expect(canReviewDocument(admin, "not_started").ok).toBe(false);
    expect(canReviewDocument(hire, "signed").ok).toBe(false);
    expect(canReviewDocument(designer, "signed").ok).toBe(false);
    expect(canReviewDocument(anonymous, "signed").ok).toBe(false);
  });
});

describe("official I-9 and W-4 fields", () => {
  it("keeps Form I-9 Section 1 to the employee boxes on edition 01/20/25", () => {
    expect(I9_SECTION1_FIELDS.map((field) => field.label)).toEqual([
      "Last Name (Family Name)",
      "First Name (Given Name)",
      "Middle Initial (if any)",
      "Other Last Names Used (if any)",
      "Address (Street Number and Name)",
      "Apt. Number (if any)",
      "City or Town",
      "State",
      "ZIP Code",
      "Date of Birth (mm/dd/yyyy)",
      "U.S. Social Security Number",
      "Employee's Email Address",
      "Employee's Telephone Number",
    ]);
    expect(I9_CITIZENSHIP.map((item) => item.value)).toEqual([
      "us_citizen",
      "noncitizen_national",
      "lawful_permanent_resident",
      "noncitizen_authorized",
    ]);
    expect(I9_LIST_A.length).toBeGreaterThan(0);
    expect(I9_LIST_B.length).toBeGreaterThan(0);
    expect(I9_LIST_C.length).toBeGreaterThan(0);
    expect(I9_SECTION1_FIELDS.some((field) => field.key === "employerSignature")).toBe(false);
  });

  it("uses the 2026 Form W-4 amounts and does not let a hire write the employer block", () => {
    expect(W4_YEAR).toBe(2026);
    expect(W4_QUALIFYING_CHILD_AMOUNT).toBe(2200);
    expect(W4_OTHER_DEPENDENT_AMOUNT).toBe(500);
    expect(W4_FILING_STATUSES.map((item) => item.value)).toEqual([
      "single_or_married_filing_separately",
      "married_filing_jointly",
      "head_of_household",
    ]);
    expect(W4_EMPLOYER_FIELDS).toEqual(["employerNameAndAddress", "firstDateOfEmployment", "employerEin"]);
    const stripped = payloadForActor("w4", { lastName: "Lovelace", employerEin: "123456789", employerNameAndAddress: "CabinetDealz" }, hire);
    expect(stripped).toEqual({ lastName: "Lovelace" });
    expect(payloadForActor("w4", { employerEin: "123456789" }, admin).employerEin).toBe("123456789");
  });
});

describe("state withholding is configured, not hardcoded", () => {
  it("has no selected state until an administrator sets one", () => {
    expect(EMPTY_HIRING_SETTINGS.stateCode).toBeNull();
    expect(stateProfile(null)).toBeNull();
    expect(stateCertificateTitle(EMPTY_HIRING_SETTINGS)).toBeNull();
    expect(STATE_WITHHOLDING_PROFILES.map((profile) => profile.code)).not.toContain("");
  });

  it("follows whichever state the setting names", () => {
    expect(stateCertificateTitle({ ...EMPTY_HIRING_SETTINGS, stateCode: "ny" })).toBe("New York employee's withholding certificate");
    expect(stateProfile("TX")?.wagesWithheld).toBe(false);
    expect(stateCertificateTitle({ ...EMPTY_HIRING_SETTINGS, stateCode: "TX" })).toBe("Texas does not withhold income tax on wages");
    expect(stateProfile("ZZ")).toBeNull();
  });
});

describe("masking, redaction, and private files", () => {
  it("shows only the last four of an SSN or bank number", () => {
    expect(maskSsn("6789")).toBe("•••-••-6789");
    expect(maskBank("4321")).toBe("••••4321");
    expect(maskSsn(null)).toBe("");
    const published = toPublicPayload({
      firstName: "Ada",
      ssn: "123-45-6789",
      accountNumber: "0012345678",
      routingNumber: "021000021",
      employerEin: "12-3456789",
    });
    expect(published).toEqual({ firstName: "Ada", ssnLast4: "6789", accountLast4: "5678", routingLast4: "0021", employerEinLast4: "6789" });
    expect(JSON.stringify(published)).not.toContain("123456789");
    expect(JSON.stringify(published)).not.toContain("123-45-6789");
  });

  it("does not store a mask over a real number, and does not log the number", () => {
    const merged = mergeSensitiveFields({ ssn: "123456789", accountNumber: "0012345678" }, { ssn: "•••-••-6789", accountNumber: "", city: "Austin" });
    expect(merged.ssn).toBe("123456789");
    expect(merged.accountNumber).toBe("0012345678");
    expect(merged.city).toBe("Austin");
    const replaced = mergeSensitiveFields({ ssn: "123456789" }, { ssn: "987-65-4321" });
    expect(replaced.ssn).toBe("987654321");

    const logged = JSON.stringify(redactForLog({
      ssn: "123-45-6789",
      accountNumber: "0012345678",
      note: "SSN 123-45-6789 routing 021000021",
      nested: { routingNumber: "021000021" },
    }));
    expect(logged).not.toContain("123-45-6789");
    expect(logged).not.toContain("123456789");
    expect(logged).not.toContain("0012345678");
    expect(logged).not.toContain("021000021");
    expect(safeErrorMessage(new Error("duplicate 123-45-6789"))).not.toContain("123-45-6789");
  });

  it("keeps ID files in the private bucket and refuses a public URL", () => {
    const key = hiringObjectKey(5, "i9_section1", "list_a", "Passport scan.pdf");
    expect(key.startsWith(HIRING_STORAGE_PREFIX)).toBe(true);
    expect(isHiringStorageKey(key)).toBe(true);
    expect(isHiringStorageKey("../hiring-packets/1/secret.pdf")).toBe(false);
    expect(isHiringStorageKey("library-documents/handbook.pdf")).toBe(false);
    expect(signedLinkRequest(key)).toEqual({ key, bucket: PRIVATE_BUCKET_NAME, expiresInSeconds: HIRING_SIGNED_URL_SECONDS });
    expect(PRIVATE_BUCKET_NAME).toBe("private-files");
    expect(isPublicStorageUrl("/manus-storage/hiring-packets/5/id.pdf")).toBe(true);
    expect(isPublicStorageUrl("https://example.supabase.co/storage/v1/object/public/site-media/id.pdf")).toBe(true);
    expect(() => signedLinkRequest("site-media/id.pdf")).toThrow(/not in the hiring packet/);
  });

  it("checks the routing number instead of accepting any 9 digits", () => {
    expect(routingNumberIsValid("021000021")).toBe(true);
    expect(routingNumberIsValid("123456789")).toBe(false);
  });
});

describe("document status", () => {
  it("moves from not started, to in progress, to signed, to reviewed", () => {
    expect(deriveStatus({ payload: {}, signedAt: null, reviewedAt: null })).toBe("not_started");
    expect(deriveStatus({ payload: { firstName: "Ada" }, signedAt: null, reviewedAt: null })).toBe("in_progress");
    expect(deriveStatus({ payload: { firstName: "Ada" }, signedAt: "2026-11-02", reviewedAt: null })).toBe("signed");
    expect(deriveStatus({ payload: { firstName: "Ada" }, signedAt: "2026-11-02", reviewedAt: "2026-11-03" })).toBe("reviewed");
    expect(progressFromStatuses(["signed", "reviewed", "in_progress"])).toMatchObject({
      total: HIRING_DOCUMENT_KINDS.length,
      signedOrReviewed: 2,
      byStatus: { not_started: 3, in_progress: 1, signed: 1, reviewed: 1 },
    });
  });

  it("does not sign an I-9 until Section 1, the document choice, and the upload are present", () => {
    const settings = { ...EMPTY_HIRING_SETTINGS, stateCode: "NY" };
    const incomplete = canSignDocument("i9_section1", { firstName: "Ada" }, settings, []);
    expect(incomplete.ok).toBe(false);
    const ready = canSignDocument("i9_section1", {
      lastName: "Lovelace",
      firstName: "Ada",
      address: "1 Main",
      city: "Austin",
      state: "TX",
      zipCode: "78701",
      dateOfBirth: "1990-01-02",
      citizenshipStatus: "us_citizen",
      documentList: "A",
      listACode: "us_passport",
      employeeSignature: "Ada Lovelace",
      signatureDate: "2026-11-10",
    }, settings, [{ documentKind: "i9_section1", slot: "list_a" }]);
    expect(ready.ok).toBe(true);
  });

  it("refuses to sign a state form when no state is configured, and signs the configured state", () => {
    const body = {
      employeeName: "Ada Lovelace",
      ssn: "123456789",
      address: "1 Main",
      city: "Austin",
      residenceState: "TX",
      postalCode: "78701",
      filingStatus: "single",
      allowances: 1,
      employeeSignature: "Ada Lovelace",
      signatureDate: "2026-11-10",
    };
    expect(canSignDocument("state_withholding", body, EMPTY_HIRING_SETTINGS).ok).toBe(false);
    expect(canSignDocument("state_withholding", body, { ...EMPTY_HIRING_SETTINGS, stateCode: "NY" }).ok).toBe(true);
    expect(canSignDocument("state_withholding", {
      noWageWithholdingAcknowledged: true,
      employeeSignature: "Ada Lovelace",
      signatureDate: "2026-11-10",
    }, { ...EMPTY_HIRING_SETTINGS, stateCode: "FL" }).ok).toBe(true);
  });
});

describe("summaries", () => {
  it("leaves sensitive values off the admin list", () => {
    const summary = toPacketSummary({
      id: 5,
      userId: 42,
      applicantName: "Ada Lovelace",
      applicantEmail: "ada@example.com",
      statuses: ["signed"],
    });
    expect(JSON.stringify(summary)).not.toContain("ssn");
    expect(summary.progress.signedOrReviewed).toBe(1);
  });
});
