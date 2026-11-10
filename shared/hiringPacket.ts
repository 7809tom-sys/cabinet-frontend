/**
 * Hiring packet for the admin Job Board tab.
 *
 * Form I-9 Section 1 follows the USCIS form, edition 01/20/25 (the current
 * edition on uscis.gov/i-9 as reviewed 06/03/2026). Lists of Acceptable
 * Documents are the lists on that form. Form W-4 follows the 2026 IRS form
 * (created 12/08/2025): Steps 1–5, the exemption box, and the Employers Only
 * block. Form W-9 is Rev. March 2024. Wisconsin employees use Form WT-4
 * (W-204, R. 8-23). Nothing here adds a line those forms do not have.
 *
 * The typed-name signature is the same e-sign the affiliate payout consent
 * already uses. The stored evidence columns match affiliate_legal_signatures
 * (docs/sql/0272 on cabinet-backend): signer, email, content hash, provider,
 * and an optional provider submission id so a DocuSeal session can be attached
 * later without a new table.
 *
 * ID files live under hiring-packets/ in the private bucket. Callers hand them
 * out only as short-lived signed URLs. This module never builds a public URL.
 */

export const JOB_BOARD_TAB = {
  label: "Job Board",
  value: "job-board",
  route: "/admin?tab=job-board",
  component: "JobBoard",
  group: "People",
} as const;

export const HIRING_STORAGE_PREFIX = "hiring-packets/";
export const HIRING_SIGNED_URL_SECONDS = 900;
export const PRIVATE_BUCKET_NAME = "private-files";

export const HIRING_DOCUMENT_KINDS = [
  "application",
  "w9",
  "i9_section1",
  "w4",
  "state_withholding",
  "direct_deposit",
  "policy_acknowledgment",
] as const;
export type HiringDocumentKind = (typeof HIRING_DOCUMENT_KINDS)[number];

export const HIRING_DOCUMENT_LABELS: Record<HiringDocumentKind, string> = {
  application: "Job application",
  w9: "Form W-9",
  i9_section1: "Form I-9, Section 1",
  w4: "Form W-4 (2026)",
  state_withholding: "State withholding",
  direct_deposit: "Direct deposit authorization",
  policy_acknowledgment: "Policy and handbook acknowledgment",
};

export const WORKER_TYPES = [
  { value: "contractor_1099", label: "1099 Contractor" },
  { value: "w2_employee", label: "Employee (W-2)" },
] as const;
export type WorkerType = (typeof WORKER_TYPES)[number]["value"];
export const DEFAULT_WORKER_TYPE: WorkerType = "contractor_1099";

export const WORK_STATES = [
  { code: "FL", name: "Florida" },
  { code: "WI", name: "Wisconsin" },
] as const;
export type WorkStateCode = (typeof WORK_STATES)[number]["code"];

/** Forms a 1099 contractor completes. I-9, W-4, and state withholding stay in the code for employees. */
export const CONTRACTOR_1099_FORMS = ["application", "w9", "direct_deposit", "policy_acknowledgment"] as const satisfies readonly HiringDocumentKind[];
/** Forms a W-2 employee completes. */
export const W2_EMPLOYEE_FORMS = ["application", "i9_section1", "w4", "state_withholding", "direct_deposit", "policy_acknowledgment"] as const satisfies readonly HiringDocumentKind[];

export const EMPLOYEE_ONLY_FORMS_NOTE =
  "Form I-9, Form W-4, and state withholding are not in this packet. Those forms apply to employees. A 1099 contractor does not complete them.";

export const W9_REVISION = "March 2024";
export const WT4_REVISION = "W-204 (R. 8-23)";

export const W9_CLASSIFICATIONS = [
  { value: "individual", label: "Individual/sole proprietor" },
  { value: "c_corporation", label: "C corporation" },
  { value: "s_corporation", label: "S corporation" },
  { value: "partnership", label: "Partnership" },
  { value: "trust_estate", label: "Trust/estate" },
  { value: "llc", label: "Limited liability company" },
  { value: "other", label: "Other" },
] as const;

export const WT4_FILING_STATUSES = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "married_higher_single", label: "Married, but withhold at higher Single rate" },
] as const;

export function formsForWorker(workerType: WorkerType): readonly HiringDocumentKind[] {
  return workerType === "w2_employee" ? W2_EMPLOYEE_FORMS : CONTRACTOR_1099_FORMS;
}

export function normalizeWorkerType(value: string | null | undefined): WorkerType {
  return value === "w2_employee" ? "w2_employee" : DEFAULT_WORKER_TYPE;
}

export function normalizeWorkState(value: string | null | undefined): WorkStateCode | null {
  const code = value?.trim().toUpperCase();
  if (code === "FL" || code === "WI") return code;
  return null;
}

export function documentLabel(kind: HiringDocumentKind, workState: WorkStateCode | null): string {
  if (kind === "w9") return `Form W-9 (Rev. ${W9_REVISION})`;
  if (kind === "state_withholding" && workState === "WI") return "Wisconsin Form WT-4";
  if (kind === "state_withholding" && workState === "FL") return "Florida withholding acknowledgment";
  return HIRING_DOCUMENT_LABELS[kind];
}

export const HIRING_DOCUMENT_STATUSES = ["not_started", "in_progress", "signed", "reviewed"] as const;
export type HiringDocumentStatus = (typeof HIRING_DOCUMENT_STATUSES)[number];

export const HIRING_STATUS_LABELS: Record<HiringDocumentStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  signed: "Signed",
  reviewed: "Reviewed",
};

export const I9_EDITION = "01/20/25";
export const I9_FORM_NAME = "Form I-9, Employment Eligibility Verification";

/** Section 1 boxes, in the order they appear on the employee side. */
export const I9_SECTION1_FIELDS = [
  { key: "lastName", label: "Last Name (Family Name)", required: true },
  { key: "firstName", label: "First Name (Given Name)", required: true },
  { key: "middleInitial", label: "Middle Initial (if any)", required: false },
  { key: "otherLastNamesUsed", label: "Other Last Names Used (if any)", required: false },
  { key: "address", label: "Address (Street Number and Name)", required: true },
  { key: "aptNumber", label: "Apt. Number (if any)", required: false },
  { key: "city", label: "City or Town", required: true },
  { key: "state", label: "State", required: true },
  { key: "zipCode", label: "ZIP Code", required: true },
  { key: "dateOfBirth", label: "Date of Birth (mm/dd/yyyy)", required: true },
  { key: "ssn", label: "U.S. Social Security Number", required: false },
  { key: "email", label: "Employee's Email Address", required: false },
  { key: "telephone", label: "Employee's Telephone Number", required: false },
] as const;

export const I9_ATTESTATION =
  "I am aware that federal law provides for imprisonment and/or fines for false statements or use of false documents in connection with the completion of this form. I attest, under penalty of perjury, that this information, including my selection of the box attesting to my citizenship or immigration status, is true and correct.";

export const I9_CITIZENSHIP = [
  { value: "us_citizen", label: "1. A citizen of the United States" },
  { value: "noncitizen_national", label: "2. A noncitizen national of the United States" },
  { value: "lawful_permanent_resident", label: "3. A lawful permanent resident" },
  { value: "noncitizen_authorized", label: "4. A noncitizen authorized to work" },
] as const;
export type I9Citizenship = (typeof I9_CITIZENSHIP)[number]["value"];

export type I9Document = { code: string; label: string };

/** List A: documents that establish both identity and employment authorization. */
export const I9_LIST_A: readonly I9Document[] = [
  { code: "us_passport", label: "U.S. Passport or U.S. Passport Card" },
  { code: "i551", label: "Permanent Resident Card or Alien Registration Receipt Card (Form I-551)" },
  { code: "foreign_passport_i551", label: "Foreign passport with a temporary I-551 stamp or temporary I-551 printed notation on a machine-readable immigrant visa" },
  { code: "i766", label: "Employment Authorization Document that contains a photograph (Form I-766)" },
  { code: "foreign_passport_i94", label: "Foreign passport and Form I-94 or Form I-94A endorsing employment-authorized nonimmigrant status" },
  { code: "fsm_rmi_passport", label: "Passport from the Federated States of Micronesia (FSM) or the Republic of the Marshall Islands (RMI) with Form I-94 or Form I-94A under the Compact of Free Association" },
];

/** List B: documents that establish identity. */
export const I9_LIST_B: readonly I9Document[] = [
  { code: "state_drivers_license", label: "Driver's license or ID card issued by a State or outlying possession of the United States, with a photograph or identifying information" },
  { code: "government_id", label: "ID card issued by a federal, state, or local government agency, with a photograph or identifying information" },
  { code: "school_id", label: "School ID card with a photograph" },
  { code: "voter_registration", label: "Voter's registration card" },
  { code: "military_card", label: "U.S. Military card or draft record" },
  { code: "military_dependent_id", label: "Military dependent's ID card" },
  { code: "merchant_mariner", label: "U.S. Coast Guard Merchant Mariner Card" },
  { code: "tribal_document_b", label: "Native American tribal document" },
  { code: "canadian_drivers_license", label: "Driver's license issued by a Canadian government authority" },
  { code: "school_record", label: "School record or report card (under age 18 only)" },
  { code: "clinic_record", label: "Clinic, doctor, or hospital record (under age 18 only)" },
  { code: "daycare_record", label: "Day-care or nursery school record (under age 18 only)" },
];

/** List C: documents that establish employment authorization. */
export const I9_LIST_C: readonly I9Document[] = [
  { code: "ssn_card", label: "Social Security Account Number card without an employment restriction" },
  { code: "ds_birth", label: "Certification of report of birth issued by the Department of State (Forms DS-1350, FS-545, FS-240)" },
  { code: "birth_certificate", label: "Original or certified copy of a birth certificate issued by a State, county, municipal authority, or territory of the United States bearing an official seal" },
  { code: "tribal_document_c", label: "Native American tribal document" },
  { code: "i197", label: "U.S. Citizen ID Card (Form I-197)" },
  { code: "i179", label: "Identification Card for Use of Resident Citizen in the United States (Form I-179)" },
  { code: "dhs_ead", label: "Employment authorization document issued by the Department of Homeland Security" },
];

export const W4_YEAR = 2026;
export const W4_OMB = "1545-0074";
export const W4_CREATED = "2025-12-08";
/** Line 3(a) on Form W-4 (2026): qualifying children under 17. */
export const W4_QUALIFYING_CHILD_AMOUNT = 2200;
/** Line 3(b) on Form W-4 (2026): other dependents. */
export const W4_OTHER_DEPENDENT_AMOUNT = 500;

export const W4_FILING_STATUSES = [
  { value: "single_or_married_filing_separately", label: "Single or Married filing separately" },
  { value: "married_filing_jointly", label: "Married filing jointly or Qualifying surviving spouse" },
  { value: "head_of_household", label: "Head of household (Check only if you're unmarried and pay more than half the costs of keeping up a home for yourself and a qualifying individual.)" },
] as const;
export type W4FilingStatus = (typeof W4_FILING_STATUSES)[number]["value"];

export const W4_STEP5_DECLARATION =
  "Under penalties of perjury, I declare that this certificate, to the best of my knowledge and belief, is true, correct, and complete.";

/** Employers Only block. The employee does not complete these. */
export const W4_EMPLOYER_FIELDS = ["employerNameAndAddress", "firstDateOfEmployment", "employerEin"] as const;

export const W4_EXEMPT_STATEMENT =
  "I claim exemption from withholding for 2026, and I certify that I meet both of the conditions for exemption for 2026. I understand I will need to submit a new Form W-4 for 2027.";

export type StateWithholdingProfile = {
  code: string;
  name: string;
  /** False when the state does not withhold income tax on wages. */
  wagesWithheld: boolean;
};

const WAGE_TAX_FREE = new Set(["AK", "FL", "NV", "NH", "SD", "TN", "TX", "WA", "WY"]);

const STATE_NAMES: readonly [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "California"],
  ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"],
  ["GA", "Georgia"], ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"],
  ["IA", "Iowa"], ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"],
  ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"],
  ["NJ", "New Jersey"], ["NM", "New Mexico"], ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"],
  ["OH", "Ohio"], ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"],
  ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"], ["WV", "West Virginia"], ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
];

/** Every state the admin can select. Nothing in the packet defaults to one of them. */
export const STATE_WITHHOLDING_PROFILES: readonly StateWithholdingProfile[] = STATE_NAMES.map(([code, name]) => ({
  code,
  name,
  wagesWithheld: !WAGE_TAX_FREE.has(code),
}));

export const STATE_FILING_STATUSES = [
  { value: "single", label: "Single" },
  { value: "married", label: "Married" },
  { value: "married_withhold_at_single_rate", label: "Married, but withhold at the single rate" },
  { value: "head_of_household", label: "Head of household" },
] as const;

export const TYPED_SIGNATURE_CONSENT =
  "I understand that typing my name constitutes a legally binding electronic signature.";

export const POLICY_ACKNOWLEDGMENT =
  "I have read the policy and handbook shown here. I agree to follow them. I understand that typing my name is my electronic signature.";

export type HiringSettings = {
  stateCode: string | null;
  handbookTitle: string;
  handbookVersion: string;
  handbookBody: string;
};

export const EMPTY_HIRING_SETTINGS: HiringSettings = {
  stateCode: null,
  handbookTitle: "Employee handbook",
  handbookVersion: "",
  handbookBody: "",
};

export type HiringActor = {
  userId: number | null;
  role: string | null;
  email?: string | null;
};

export type HiringPacketRef = {
  id: number;
  userId: number | null;
  applicantEmail: string;
};

export type HiringAccess = {
  view: boolean;
  edit: boolean;
  review: boolean;
  listAll: boolean;
  configure: boolean;
};

export type IdFileSlot = "list_a" | "list_b" | "list_c";

export type HiringFileRef = {
  id?: number;
  documentKind: HiringDocumentKind;
  slot: string;
  filename?: string;
  mimeType?: string;
};

export type SignatureEvidence = {
  signerName: string;
  signerEmail: string | null;
  contentSha256: string;
  provider: "typed-name";
  providerSubmissionId: string | null;
  signedAt: string;
};

export type PublicFile = {
  id: number;
  documentKind: HiringDocumentKind;
  slot: string;
  filename: string;
  mimeType: string;
};

export type PublicDocument = {
  kind: HiringDocumentKind;
  status: HiringDocumentStatus;
  payload: Record<string, unknown>;
  signedAt: string | null;
  signedByName: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  files: PublicFile[];
};

export type PublicPacket = {
  id: number;
  userId: number | null;
  applicantName: string;
  applicantEmail: string;
  workerType: WorkerType;
  workState: WorkStateCode | null;
  documents: PublicDocument[];
};

export type PacketSummary = {
  id: number;
  userId: number | null;
  applicantName: string;
  applicantEmail: string;
  workerType: WorkerType;
  workState: WorkStateCode | null;
  progress: PacketProgress;
};

export type PacketProgress = {
  total: number;
  signedOrReviewed: number;
  byStatus: Record<HiringDocumentStatus, number>;
};

const SENSITIVE_KEYS = /^(ssn|tin|ein|socialsecuritynumber|accountnumber|routingnumber|bankaccount|employerein)$/i;
const SSN_PATTERN = /\b\d{3}-?\d{2}-?\d{4}\b/g;
const LONG_DIGIT_PATTERN = /\b\d{8,17}\b/g;

export function stateProfile(code: string | null | undefined): StateWithholdingProfile | null {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return STATE_WITHHOLDING_PROFILES.find((profile) => profile.code === normalized) ?? null;
}

export function stateCertificateTitle(settings: HiringSettings): string | null {
  const profile = stateProfile(settings.stateCode);
  if (!profile) return null;
  return profile.wagesWithheld
    ? `${profile.name} employee's withholding certificate`
    : `${profile.name} does not withhold income tax on wages`;
}

export function isAdmin(actor: HiringActor): boolean {
  return actor.role === "admin" && actor.userId != null;
}

export function ownsPacket(actor: HiringActor, packet: HiringPacketRef): boolean {
  if (actor.userId != null && packet.userId != null && actor.userId === packet.userId) return true;
  const email = actor.email?.trim().toLowerCase();
  const packetEmail = packet.applicantEmail.trim().toLowerCase();
  return Boolean(email && packetEmail && email === packetEmail);
}

/** Admin sees every packet. Anyone else sees only a packet they own. */
export function hiringAccess(actor: HiringActor, packet: HiringPacketRef | null): HiringAccess {
  const admin = isAdmin(actor);
  const owner = packet != null && ownsPacket(actor, packet);
  const signedIn = actor.userId != null;
  return {
    view: admin || owner,
    edit: signedIn && (owner || (admin && packet != null)),
    review: admin && packet != null,
    listAll: admin,
    configure: admin,
  };
}

export function visiblePackets<T extends HiringPacketRef>(actor: HiringActor, packets: readonly T[]): T[] {
  if (isAdmin(actor)) return [...packets];
  if (actor.userId == null && !actor.email) return [];
  return packets.filter((packet) => ownsPacket(actor, packet));
}

export function emptyProgress(): PacketProgress {
  return {
    total: HIRING_DOCUMENT_KINDS.length,
    signedOrReviewed: 0,
    byStatus: { not_started: HIRING_DOCUMENT_KINDS.length, in_progress: 0, signed: 0, reviewed: 0 },
  };
}

export function progressFromStatuses(statuses: readonly HiringDocumentStatus[], total = HIRING_DOCUMENT_KINDS.length): PacketProgress {
  const byStatus: Record<HiringDocumentStatus, number> = { not_started: 0, in_progress: 0, signed: 0, reviewed: 0 };
  for (const status of statuses) byStatus[status] += 1;
  const missing = total - statuses.length;
  if (missing > 0) byStatus.not_started += missing;
  return {
    total,
    signedOrReviewed: byStatus.signed + byStatus.reviewed,
    byStatus,
  };
}

/** Progress counts only the forms that belong to this worker type. */
export function progressForWorker(
  workerType: WorkerType,
  documents: readonly { kind: HiringDocumentKind; status: HiringDocumentStatus }[],
): PacketProgress {
  const applicable = formsForWorker(workerType);
  const byKind = new Map(documents.map((document) => [document.kind, document.status]));
  return progressFromStatuses(applicable.map((kind) => byKind.get(kind) ?? "not_started"), applicable.length);
}

export function maskSsn(last4: string | null | undefined): string {
  const digits = (last4 ?? "").replace(/\D/g, "").slice(-4);
  return digits.length === 4 ? `•••-••-${digits}` : "";
}

export function maskBank(last4: string | null | undefined): string {
  const digits = (last4 ?? "").replace(/\D/g, "").slice(-4);
  return digits.length === 4 ? `••••${digits}` : "";
}

export function last4Digits(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const digits = String(value).replace(/\D/g, "");
  if (digits.length < 4) return null;
  return digits.slice(-4);
}

function isMaskPlaceholder(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return value.includes("•") || value.includes("*") || /^x+$/i.test(value.trim());
}

const SENSITIVE_PAYLOAD_KEYS = ["ssn", "tin", "ein", "accountNumber", "routingNumber", "employerEin"] as const;

const TIN_LAST4: Record<string, string> = {
  ssn: "ssnLast4",
  tin: "tinLast4",
  ein: "einLast4",
  employerEin: "employerEinLast4",
};

export function toPublicPayload(payload: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const source = payload ?? {};
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (key in TIN_LAST4) {
      const last4 = last4Digits(value);
      if (last4) next[TIN_LAST4[key]!] = last4;
      continue;
    }
    if (key === "accountNumber") {
      const last4 = last4Digits(value);
      if (last4) next.accountLast4 = last4;
      continue;
    }
    if (key === "routingNumber") {
      const last4 = last4Digits(value);
      if (last4) next.routingLast4 = last4;
      continue;
    }
    next[key] = value;
  }
  return next;
}

/**
 * Keep a stored SSN or bank number when the client sends a blank or a mask.
 * A new full number replaces it. A mask is never written back.
 */
export function mergeSensitiveFields(
  previous: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(previous ?? {}) };
  for (const [key, value] of Object.entries(incoming)) {
    if ((SENSITIVE_PAYLOAD_KEYS as readonly string[]).includes(key)) {
      if (value == null || value === "" || isMaskPlaceholder(value)) continue;
      const digits = String(value).replace(/\D/g, "");
      if (!digits) continue;
      merged[key] = digits;
      continue;
    }
    merged[key] = value;
  }
  return merged;
}

export function stripEmployerFields(payload: Record<string, unknown>): Record<string, unknown> {
  const next = { ...payload };
  for (const key of W4_EMPLOYER_FIELDS) delete next[key];
  return next;
}

export function payloadForActor(
  kind: HiringDocumentKind,
  payload: Record<string, unknown>,
  actor: HiringActor,
): Record<string, unknown> {
  if (kind === "w4" && !isAdmin(actor)) return stripEmployerFields(payload);
  return payload;
}

function redactString(value: string): string {
  return value.replace(SSN_PATTERN, "[redacted]").replace(LONG_DIGIT_PATTERN, "[redacted]");
}

/** Drop SSN, bank, and routing values before anything is written to a log. */
export function redactForLog(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number") {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length >= 8) return "[redacted]";
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => redactForLog(item));
  if (value && typeof value === "object") {
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      next[key] = SENSITIVE_KEYS.test(key) ? "[redacted]" : redactForLog(item);
    }
    return next;
  }
  return value;
}

export function safeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : "The hiring packet could not be saved.";
  return String(redactForLog(raw));
}

export function hiringObjectKey(packetId: number, kind: HiringDocumentKind, slot: string, filename: string): string {
  const safeSlot = slot.replace(/[^a-z0-9_]+/gi, "").slice(0, 32) || "file";
  const safeName = filename.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+/, "").slice(0, 80) || "document";
  return `${HIRING_STORAGE_PREFIX}${packetId}/${kind}/${safeSlot}-${safeName}`;
}

export function isHiringStorageKey(key: string): boolean {
  const normalized = key.replace(/^\/+/, "");
  return normalized.startsWith(HIRING_STORAGE_PREFIX) && !normalized.includes("..");
}

/** A signed URL request. The key stays in the private bucket; there is no public path. */
export function signedLinkRequest(storageKey: string): { key: string; bucket: typeof PRIVATE_BUCKET_NAME; expiresInSeconds: number } {
  if (!isHiringStorageKey(storageKey)) {
    throw new Error("That file is not in the hiring packet.");
  }
  return { key: storageKey.replace(/^\/+/, ""), bucket: PRIVATE_BUCKET_NAME, expiresInSeconds: HIRING_SIGNED_URL_SECONDS };
}

export function isPublicStorageUrl(url: string): boolean {
  const value = url.trim().toLowerCase();
  if (!value) return false;
  if (value.includes("/manus-storage/")) return true;
  if (value.includes("site-media")) return true;
  if (value.includes("/object/public/")) return true;
  if (value.startsWith("/uploads/")) return true;
  return false;
}

const ID_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const MAX_ID_BYTES = 10 * 1024 * 1024;

export function acceptIdUpload(mimeType: string, sizeBytes: number): string | null {
  if (!ID_MIME_TYPES.has(mimeType)) return "Upload a JPG, PNG, WebP, or PDF file.";
  if (sizeBytes <= 0 || sizeBytes > MAX_ID_BYTES) return "That file must be under 10 MB.";
  return null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasText(payload: Record<string, unknown>, key: string): boolean {
  return text(payload[key]).length > 0;
}

function digitsOf(value: unknown): string {
  return text(String(value ?? "")).replace(/\D/g, "");
}

export function routingNumberIsValid(value: unknown): boolean {
  const digits = digitsOf(value);
  if (!/^\d{9}$/.test(digits)) return false;
  const n = digits.split("").map((digit) => Number(digit));
  const sum = 3 * (n[0]! + n[3]! + n[6]!) + 7 * (n[1]! + n[4]! + n[7]!) + (n[2]! + n[5]! + n[8]!);
  return sum % 10 === 0;
}

function isIsoDate(value: unknown): boolean {
  const raw = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const parsed = new Date(`${raw}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === raw;
}

function money(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));
  if (!Number.isFinite(number) || number < 0) return null;
  return Math.round(number * 100) / 100;
}

function payloadHasAnyValue(payload: Record<string, unknown>): boolean {
  return Object.entries(payload).some(([key, value]) => {
    if ((SENSITIVE_PAYLOAD_KEYS as readonly string[]).includes(key)) return digitsOf(value).length > 0;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return Number.isFinite(value);
    if (typeof value === "string") return value.trim().length > 0;
    return value != null;
  });
}

export function documentHasProgress(payload: Record<string, unknown> | null | undefined): boolean {
  return payloadHasAnyValue(payload ?? {});
}

export function deriveStatus(input: {
  payload: Record<string, unknown> | null | undefined;
  signedAt: string | null;
  reviewedAt: string | null;
}): HiringDocumentStatus {
  if (input.reviewedAt) return "reviewed";
  if (input.signedAt) return "signed";
  if (documentHasProgress(input.payload)) return "in_progress";
  return "not_started";
}

export type FieldErrors = string[];

function requireFields(payload: Record<string, unknown>, fields: readonly { key: string; label: string; required: boolean }[]): FieldErrors {
  const errors: string[] = [];
  for (const field of fields) {
    if (field.required && !hasText(payload, field.key)) errors.push(`${field.label} is required.`);
  }
  return errors;
}

function validateSsn(payload: Record<string, unknown>, required: boolean): FieldErrors {
  const digits = digitsOf(payload.ssn);
  if (!digits) return required ? ["U.S. Social Security Number is required."] : [];
  if (!/^\d{9}$/.test(digits)) return ["Enter the 9-digit Social Security number."];
  return [];
}

function listHas(list: readonly I9Document[], code: unknown): boolean {
  return list.some((item) => item.code === text(code));
}

function validateI9(payload: Record<string, unknown>, files: readonly HiringFileRef[]): FieldErrors {
  const errors = requireFields(payload, I9_SECTION1_FIELDS);
  errors.push(...validateSsn(payload, false));
  if (hasText(payload, "dateOfBirth") && !isIsoDate(payload.dateOfBirth)) errors.push("Date of Birth must be a real date.");
  if (hasText(payload, "middleInitial") && text(payload.middleInitial).length > 1) errors.push("Middle Initial is one letter.");
  const status = text(payload.citizenshipStatus);
  if (!I9_CITIZENSHIP.some((item) => item.value === status)) {
    errors.push("Check one box for citizenship or immigration status.");
  }
  if (status === "lawful_permanent_resident" && !hasText(payload, "uscisANumber")) {
    errors.push("Enter the USCIS or A-Number for a lawful permanent resident.");
  }
  if (status === "noncitizen_authorized") {
    if (!hasText(payload, "workAuthorizationExpiration")) {
      errors.push("Enter the work authorization expiration date, or N/A if it does not expire.");
    } else if (text(payload.workAuthorizationExpiration).toUpperCase() !== "N/A" && !isIsoDate(payload.workAuthorizationExpiration)) {
      errors.push("Work authorization expiration must be a date or N/A.");
    }
    const proofs = [hasText(payload, "uscisANumber"), hasText(payload, "i94AdmissionNumber"), hasText(payload, "foreignPassportNumber") && hasText(payload, "foreignPassportCountry")].filter(Boolean);
    if (proofs.length !== 1) errors.push("Enter one of: USCIS A-Number, Form I-94 Admission Number, or foreign passport number and country of issuance.");
  }
  if (payload.preparerAssisted === true) {
    for (const key of ["preparerLastName", "preparerFirstName", "preparerSignature", "preparerDate"]) {
      if (!hasText(payload, key)) errors.push("The preparer and/or translator certification is incomplete.");
    }
    if (hasText(payload, "preparerDate") && !isIsoDate(payload.preparerDate)) errors.push("Preparer date must be a real date.");
  }
  const choice = text(payload.documentList);
  if (choice === "A") {
    if (!listHas(I9_LIST_A, payload.listACode)) errors.push("Select one List A document.");
    if (!files.some((file) => file.slot === "list_a")) errors.push("Upload the List A document.");
  } else if (choice === "BC") {
    if (!listHas(I9_LIST_B, payload.listBCode)) errors.push("Select one List B document.");
    if (!listHas(I9_LIST_C, payload.listCCode)) errors.push("Select one List C document.");
    if (!files.some((file) => file.slot === "list_b")) errors.push("Upload the List B document.");
    if (!files.some((file) => file.slot === "list_c")) errors.push("Upload the List C document.");
  } else {
    errors.push("Present one List A document, or one List B document and one List C document.");
  }
  if (!hasText(payload, "employeeSignature")) errors.push("Signature of Employee is required.");
  if (!isIsoDate(payload.signatureDate)) errors.push("Today's Date (mm/dd/yyyy) is required.");
  return errors;
}

function validateW4(payload: Record<string, unknown>): FieldErrors {
  const errors: string[] = [];
  if (!hasText(payload, "firstNameAndMiddleInitial")) errors.push("Step 1(a) first name and middle initial is required.");
  if (!hasText(payload, "lastName")) errors.push("Step 1(a) last name is required.");
  if (!hasText(payload, "address")) errors.push("Step 1(a) address is required.");
  if (!hasText(payload, "cityStateZip")) errors.push("Step 1(a) city or town, state, and ZIP code is required.");
  errors.push(...validateSsn(payload, true));
  const filing = text(payload.filingStatus);
  if (!W4_FILING_STATUSES.some((item) => item.value === filing)) errors.push("Step 1(c) filing status is required.");
  const exempt = payload.exemptFromWithholding === true;
  const laterSteps = ["step2cTwoJobs", "step3a", "step3b", "step3", "step4a", "step4b", "step4c"];
  const laterFilled = laterSteps.some((key) => {
    if (key === "step2cTwoJobs") return payload[key] === true;
    return money(payload[key]) != null && money(payload[key]) !== 0;
  });
  if (exempt && laterFilled) errors.push("Leave Steps 2–4 blank when you claim exemption from withholding.");
  if (!exempt) {
    for (const key of ["step3a", "step3b", "step3", "step4a", "step4b", "step4c"] as const) {
      if (payload[key] != null && payload[key] !== "" && money(payload[key]) == null) errors.push("Enter dollar amounts as numbers.");
    }
  }
  if (!hasText(payload, "employeeSignature")) errors.push("Employee's signature is required.");
  if (!isIsoDate(payload.signatureDate)) errors.push("Step 5 date is required.");
  return errors;
}

function validateWt4(payload: Record<string, unknown>): FieldErrors {
  const errors: string[] = [];
  if (!hasText(payload, "legalName")) errors.push("Employee's legal name is required.");
  errors.push(...validateSsn(payload, true));
  if (!hasText(payload, "address")) errors.push("Employee's address is required.");
  if (!hasText(payload, "city")) errors.push("City is required.");
  if (!hasText(payload, "residenceState")) errors.push("State is required.");
  if (!hasText(payload, "postalCode")) errors.push("ZIP code is required.");
  if (hasText(payload, "dateOfBirth") && !isIsoDate(payload.dateOfBirth)) errors.push("Date of birth must be a real date.");
  if (!hasText(payload, "dateOfBirth")) errors.push("Date of birth is required.");
  if (!WT4_FILING_STATUSES.some((item) => item.value === text(payload.filingStatus))) {
    errors.push("Check Single, Married, or Married but withhold at the higher Single rate.");
  }
  const exempt = text(payload.line3).toLowerCase() === "exempt";
  if (!exempt) {
    for (const [key, label, max] of [["line1a", "Line 1(a)", 1], ["line1b", "Line 1(b)", 1], ["line1c", "Line 1(c)", 99]] as const) {
      const raw = payload[key];
      const count = raw === "" || raw == null ? null : Number(raw);
      if (count == null || !Number.isInteger(count) || count < 0 || count > max) errors.push(`${label} must be a whole number.`);
    }
    const total = Number(payload.line1a ?? 0) + Number(payload.line1b ?? 0) + Number(payload.line1c ?? 0);
    if (payload.line1d != null && payload.line1d !== "" && Number(payload.line1d) !== total) {
      errors.push("Line 1(d) is the total of lines 1(a) through 1(c).");
    }
    if (payload.line2 != null && payload.line2 !== "" && money(payload.line2) == null) errors.push("Line 2 must be a dollar amount.");
  }
  if (payload.wt4Certified !== true) errors.push("Certify the number of Wisconsin withholding exemptions.");
  if (!hasText(payload, "employeeSignature")) errors.push("Signature is required.");
  if (!isIsoDate(payload.signatureDate)) errors.push("Date signed is required.");
  return errors;
}

function validateState(payload: Record<string, unknown>, settings: HiringSettings, workState: string | null = null): FieldErrors {
  const code = (workState ?? settings.stateCode ?? "").trim().toUpperCase();
  if (code === "WI") return validateWt4(payload);
  const profile = stateProfile(code);
  if (!profile) return ["An administrator has not chosen the state for this withholding certificate."];
  const errors: string[] = [];
  if (!hasText(payload, "employeeSignature")) errors.push("Signature is required.");
  if (!isIsoDate(payload.signatureDate)) errors.push("Date is required.");
  if (!profile.wagesWithheld) {
    if (payload.noWageWithholdingAcknowledged !== true) {
      errors.push(`Acknowledge that ${profile.name} does not withhold income tax on wages.`);
    }
    return errors;
  }
  if (!hasText(payload, "employeeName")) errors.push("Employee name is required.");
  errors.push(...validateSsn(payload, true));
  if (!hasText(payload, "address")) errors.push("Home address is required.");
  if (!hasText(payload, "city")) errors.push("City is required.");
  if (!hasText(payload, "residenceState")) errors.push("State is required.");
  if (!hasText(payload, "postalCode")) errors.push("ZIP code is required.");
  if (!STATE_FILING_STATUSES.some((item) => item.value === text(payload.filingStatus))) errors.push("Filing status is required.");
  if (payload.exempt !== true) {
    const allowances = payload.allowances;
    if (allowances != null && allowances !== "" && (!Number.isInteger(Number(allowances)) || Number(allowances) < 0)) {
      errors.push("Allowances must be a whole number.");
    }
    if (payload.additionalWithholding != null && payload.additionalWithholding !== "" && money(payload.additionalWithholding) == null) {
      errors.push("Additional withholding must be a dollar amount.");
    }
  }
  return errors;
}

function validateApplication(payload: Record<string, unknown>): FieldErrors {
  const errors: string[] = [];
  const required: [string, string][] = [
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["email", "Email"],
    ["phone", "Phone"],
    ["address", "Address"],
    ["city", "City"],
    ["state", "State"],
    ["postalCode", "ZIP code"],
    ["position", "Position"],
    ["startDate", "Start date"],
    ["emergencyContactName", "Emergency contact name"],
    ["emergencyContactRelationship", "Emergency contact relationship"],
    ["emergencyContactPhone", "Emergency contact phone"],
  ];
  for (const [key, label] of required) {
    if (!hasText(payload, key)) errors.push(`${label} is required.`);
  }
  if (hasText(payload, "email") && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(payload.email))) errors.push("Enter a valid email.");
  if (hasText(payload, "startDate") && !isIsoDate(payload.startDate)) errors.push("Start date must be a real date.");
  if (!hasText(payload, "employeeSignature")) errors.push("Signature is required.");
  if (!isIsoDate(payload.signatureDate)) errors.push("Signature date is required.");
  return errors;
}

function validateDeposit(payload: Record<string, unknown>): FieldErrors {
  const errors: string[] = [];
  if (!hasText(payload, "accountHolderName")) errors.push("Name on the account is required.");
  if (!hasText(payload, "bankName")) errors.push("Bank name is required.");
  if (text(payload.accountType) !== "checking" && text(payload.accountType) !== "savings") errors.push("Choose checking or savings.");
  if (!routingNumberIsValid(payload.routingNumber)) errors.push("Enter a valid 9-digit routing number.");
  const account = digitsOf(payload.accountNumber);
  if (account.length < 4 || account.length > 17) errors.push("Enter the account number.");
  const amountType = text(payload.depositType);
  if (!["entire_net_pay", "fixed", "percent"].includes(amountType)) errors.push("Choose what to deposit.");
  if (amountType === "fixed" && (money(payload.depositAmount) == null || money(payload.depositAmount) === 0)) errors.push("Enter the fixed amount.");
  if (amountType === "percent") {
    const percent = Number(payload.depositPercent);
    if (!Number.isFinite(percent) || percent <= 0 || percent > 100) errors.push("Enter a percent from 1 to 100.");
  }
  if (payload.authorize !== true) errors.push("Authorization is required.");
  if (!hasText(payload, "employeeSignature")) errors.push("Signature is required.");
  if (!isIsoDate(payload.signatureDate)) errors.push("Signature date is required.");
  return errors;
}

function validateW9(payload: Record<string, unknown>): FieldErrors {
  const errors: string[] = [];
  if (!hasText(payload, "name")) errors.push("Line 1, name of entity/individual, is required.");
  const classification = text(payload.taxClassification);
  if (!W9_CLASSIFICATIONS.some((item) => item.value === classification)) errors.push("Line 3a federal tax classification is required.");
  if (classification === "llc" && !["C", "S", "P"].includes(text(payload.llcClassification).toUpperCase())) {
    errors.push("Enter the LLC tax classification (C, S, or P).");
  }
  if (classification === "other" && !hasText(payload, "otherClassification")) errors.push("Describe the other federal tax classification.");
  if (!hasText(payload, "address")) errors.push("Line 5 address is required.");
  if (!hasText(payload, "cityStateZip")) errors.push("Line 6 city, state, and ZIP code is required.");
  const ssn = digitsOf(payload.ssn);
  const ein = digitsOf(payload.ein);
  if (Boolean(ssn) === Boolean(ein)) errors.push("Enter either a Social Security number or an employer identification number.");
  if (ssn && !/^\d{9}$/.test(ssn)) errors.push("Enter the 9-digit Social Security number.");
  if (ein && !/^\d{9}$/.test(ein)) errors.push("Enter the 9-digit employer identification number.");
  if (!hasText(payload, "employeeSignature")) errors.push("Signature of U.S. person is required.");
  if (!isIsoDate(payload.signatureDate)) errors.push("Date is required.");
  return errors;
}

function validatePolicy(payload: Record<string, unknown>, settings: HiringSettings): FieldErrors {
  const errors: string[] = [];
  if (!settings.handbookBody.trim() || !settings.handbookVersion.trim()) {
    errors.push("An administrator has not published the handbook yet.");
  }
  if (text(payload.handbookVersion) !== settings.handbookVersion.trim()) {
    errors.push("This acknowledgment is for a different handbook version.");
  }
  if (payload.agreed !== true) errors.push("Acknowledge the policy and handbook.");
  if (text(payload.employeeSignature).length < 2) errors.push("Type your full legal name to sign.");
  if (!isIsoDate(payload.signatureDate)) errors.push("Signature date is required.");
  return errors;
}

export function validateDocument(
  kind: HiringDocumentKind,
  payload: Record<string, unknown>,
  settings: HiringSettings,
  files: readonly HiringFileRef[] = [],
  workState: string | null = null,
): FieldErrors {
  const mine = files.filter((file) => file.documentKind === kind);
  switch (kind) {
    case "application":
      return validateApplication(payload);
    case "w9":
      return validateW9(payload);
    case "i9_section1":
      return validateI9(payload, mine);
    case "w4":
      return validateW4(payload);
    case "state_withholding":
      return validateState(payload, settings, workState);
    case "direct_deposit":
      return validateDeposit(payload);
    case "policy_acknowledgment":
      return validatePolicy(payload, settings);
    default:
      return ["Unknown form."];
  }
}

export function canSignDocument(
  kind: HiringDocumentKind,
  payload: Record<string, unknown>,
  settings: HiringSettings,
  files: readonly HiringFileRef[] = [],
  workState: string | null = null,
): { ok: boolean; errors: FieldErrors } {
  const errors = validateDocument(kind, payload, settings, files, workState);
  return { ok: errors.length === 0, errors };
}

export function canReviewDocument(actor: HiringActor, status: HiringDocumentStatus): { ok: boolean; reason: string | null } {
  if (!isAdmin(actor)) return { ok: false, reason: "Only an administrator can review a hiring document." };
  if (status !== "signed") return { ok: false, reason: "Review is available after the hire signs." };
  return { ok: true, reason: null };
}

export function canonicalPayload(payload: Record<string, unknown>): string {
  const keys = Object.keys(payload).sort();
  const sorted: Record<string, unknown> = {};
  for (const key of keys) sorted[key] = payload[key];
  return JSON.stringify(sorted);
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function signatureEvidence(input: {
  signerName: string;
  signerEmail: string | null;
  payload: Record<string, unknown>;
  signedAt?: string;
}): Promise<SignatureEvidence> {
  return {
    signerName: input.signerName.trim(),
    signerEmail: input.signerEmail,
    contentSha256: await sha256Hex(canonicalPayload(input.payload)),
    provider: "typed-name",
    providerSubmissionId: null,
    signedAt: input.signedAt ?? new Date().toISOString(),
  };
}

export function emptyDocumentPayload(): Record<HiringDocumentKind, Record<string, unknown>> {
  return {
    application: {},
    w9: {},
    i9_section1: {},
    w4: {},
    state_withholding: {},
    direct_deposit: {},
    policy_acknowledgment: {},
  };
}

export function toPublicDocument(document: {
  kind: HiringDocumentKind;
  payload: Record<string, unknown> | null;
  signedAt: string | null;
  signedByName: string | null;
  reviewedAt: string | null;
  reviewedByName: string | null;
  files?: PublicFile[];
}): PublicDocument {
  return {
    kind: document.kind,
    status: deriveStatus(document),
    payload: toPublicPayload(document.payload),
    signedAt: document.signedAt,
    signedByName: document.signedByName,
    reviewedAt: document.reviewedAt,
    reviewedByName: document.reviewedByName,
    files: document.files ?? [],
  };
}

export function toPacketSummary(packet: {
  id: number;
  userId: number | null;
  applicantName: string;
  applicantEmail: string;
  workerType?: WorkerType;
  workState?: WorkStateCode | null;
  statuses: readonly HiringDocumentStatus[];
}): PacketSummary {
  const workerType = normalizeWorkerType(packet.workerType);
  return {
    id: packet.id,
    userId: packet.userId,
    applicantName: packet.applicantName,
    applicantEmail: packet.applicantEmail,
    workerType,
    workState: normalizeWorkState(packet.workState),
    progress: progressFromStatuses(packet.statuses),
  };
}
