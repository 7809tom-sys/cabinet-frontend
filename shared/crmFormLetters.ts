// Ready-made CRM form letters, one set per account role.
//
// A letter fills the compose subject + body in one click. It never sends: the
// user still edits and presses Send. Only fields the compose box already merges
// are used (contactName, dealTitle, estimatedValue, designLink, quoteLink,
// signature) plus the sender identity fields below. Anything we cannot know
// (order number, tracking number, measurements) stays a clear [bracket]
// placeholder so nobody sends a guessed value.
//
// Pure module: no database, no network.

import { applyCrmMergeFields, type CrmMergeFieldValue } from "./crmMailbox";

export const CRM_FORM_LETTER_ROLES = ["admin", "affiliate", "contractor"] as const;
export type CrmFormLetterRole = (typeof CRM_FORM_LETTER_ROLES)[number];

export type CrmFormLetter = {
  key: string;
  name: string;
  subject: string;
  bodyHtml: string;
};

/** Who the letter speaks for. Missing values become [bracket] placeholders. */
export type CrmSenderProfile = {
  role: CrmFormLetterRole;
  companyName: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
};

const PLACEHOLDER_LABELS: Record<CrmFormLetterRole, { company: string; location: string; phone: string; email: string }> = {
  admin: { company: "Cabinet Dealz", location: "Cabinet Dealz location", phone: "Cabinet Dealz phone", email: "Cabinet Dealz email" },
  affiliate: { company: "store name", location: "store location", phone: "store phone", email: "store email" },
  contractor: { company: "business name", location: "business location", phone: "business phone", email: "business email" },
};

function bracket(label: string): string {
  return `[${label}]`;
}

function present(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** The sender tokens a letter may use, with a [bracket] fallback for each gap. */
export function crmSenderMergeFields(
  profile: CrmSenderProfile | null | undefined,
  role: CrmFormLetterRole,
): Record<"senderCompany" | "senderLocation" | "senderPhone" | "senderEmail", string> {
  const labels = PLACEHOLDER_LABELS[role];
  // The house brand is always known; a store or business name is not.
  const companyName = present(profile?.companyName) ?? (role === "admin" ? "Cabinet Dealz" : null);
  return {
    senderCompany: companyName ?? bracket(labels.company),
    senderLocation: present(profile?.location) ?? bracket(labels.location),
    senderPhone: present(profile?.phone) ?? bracket(labels.phone),
    senderEmail: present(profile?.email) ?? bracket(labels.email),
  };
}

/** Affiliate wording follows the storefront contact fields the record already has. */
export function affiliateCrmSenderProfile(
  affiliate: {
    storeName?: string | null;
    publicAddress?: string | null;
    serviceArea?: string | null;
    location?: string | null;
    publicPhone?: string | null;
    phone?: string | null;
    publicEmail?: string | null;
    email?: string | null;
  } | null | undefined,
): CrmSenderProfile {
  return {
    role: "affiliate",
    companyName: present(affiliate?.storeName),
    location: present(affiliate?.publicAddress) ?? present(affiliate?.serviceArea) ?? present(affiliate?.location),
    phone: present(affiliate?.publicPhone) ?? present(affiliate?.phone),
    email: present(affiliate?.publicEmail) ?? present(affiliate?.email),
  };
}

/**
 * Contractors keep business name and phone on their access request. There is
 * no location or business email field on that record, so those stay null and
 * the letter shows a [bracket] placeholder instead of being invented.
 */
export function contractorCrmSenderProfile(
  request: { businessName?: string | null; phone?: string | null } | null | undefined,
): CrmSenderProfile {
  return {
    role: "contractor",
    companyName: present(request?.businessName),
    location: null,
    phone: present(request?.phone),
    email: null,
  };
}

export const ADMIN_CRM_SENDER_PROFILE: CrmSenderProfile = {
  role: "admin",
  companyName: "Cabinet Dealz",
  location: null,
  phone: null,
  email: null,
};

type Blueprint = {
  key: string;
  name: string;
  subject: string;
  /** One body per role so an affiliate and a contractor read like themselves. */
  body: Record<CrmFormLetterRole, string>;
};

const CONTACT_LINE = "<p>{{senderCompany}} · {{senderLocation}} · {{senderPhone}} · {{senderEmail}}</p>";

/**
 * House, store, and contractor variants for every letter. `{{sender*}}` is
 * replaced from the account record; anything genuinely unknown stays a
 * [bracket] so the sender has to fill it in.
 */
const BLUEPRINTS: Blueprint[] = [
  {
    key: "design_review_questions",
    name: "Reviewed your design — any questions?",
    subject: "Quick check on your design, {{contactName}}",
    body: {
      admin:
        "<p>Hi {{contactName}},</p>" +
        "<p>Our design team just went through <strong>{{dealTitle}}</strong>. The layout, door styles, and finishes all look ready from our side.</p>" +
        "<p>Questions on anything you see? Reply to this note and we will walk you through it.</p>" +
        "<p>Design: {{designLink}}</p>" +
        "<p>{{signature}}</p>",
      affiliate:
        "<p>Hi {{contactName}},</p>" +
        "<p>Thanks for sending your design over to {{senderCompany}} — we just went through <strong>{{dealTitle}}</strong> together.</p>" +
        "<p>Any questions on the layout, finishes, or the measurements we used? Reply to this note and we will walk you through it.</p>" +
        "<p>Design: {{designLink}}</p>" +
        "<p>{{signature}}</p>",
      contractor:
        "<p>Hi {{contactName}},</p>" +
        "<p>I went through <strong>{{dealTitle}}</strong> with {{senderCompany}} this week. Everything lines up for the install.</p>" +
        "<p>Anything you want moved before we lock it in? Reply here and I will adjust it.</p>" +
        "<p>Design: {{designLink}}</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
    },
  },
  {
    key: "quote_ready",
    name: "Quote is ready",
    subject: "Your quote is ready — {{dealTitle}}",
    body: {
      admin:
        "<p>Hi {{contactName}},</p>" +
        "<p>Your quote for <strong>{{dealTitle}}</strong> is ready. Total: {{estimatedValue}}.</p>" +
        "<p>Take a look when you have a minute. If you want to change a door style, finish, or timing, just tell us and we will rework it.</p>" +
        "<p>{{quoteLink}}</p>" +
        "<p>{{signature}}</p>",
      affiliate:
        "<p>Hi {{contactName}},</p>" +
        "<p>Your quote from {{senderCompany}} for <strong>{{dealTitle}}</strong> is ready. Total: {{estimatedValue}}.</p>" +
        "<p>Take a look when you have a minute. If you want to change a door style, finish, or timing, just tell us and we will rework it.</p>" +
        "<p>{{quoteLink}}</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
      contractor:
        "<p>Hi {{contactName}},</p>" +
        "<p>Here is the quote for <strong>{{dealTitle}}</strong> through {{senderCompany}}: {{estimatedValue}}.</p>" +
        "<p>That covers the cabinets on the plan we reviewed. Add or drop anything and I will send a revised number.</p>" +
        "<p>Questions or changes? Call me at {{senderPhone}} or reply here.</p>" +
        "<p>{{quoteLink}}</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
    },
  },
  {
    key: "quote_follow_up",
    name: "Following up on your quote",
    subject: "Following up on your quote — {{dealTitle}}",
    body: {
      admin:
        "<p>Hi {{contactName}},</p>" +
        "<p>Just checking in on the quote for <strong>{{dealTitle}}</strong>. No rush at all — if now is not the right time, tell us when to circle back.</p>" +
        "<p>Questions on price, lead time, or anything in the quote? Reply here and we will clear it up.</p>" +
        "<p>{{signature}}</p>",
      affiliate:
        "<p>Hi {{contactName}},</p>" +
        "<p>Checking in from {{senderCompany}} on the quote for <strong>{{dealTitle}}</strong>. No rush at all — if now is not the right time, tell us when to circle back.</p>" +
        "<p>Questions on price, lead time, or anything in the quote? Reply here and we will clear it up.</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
      contractor:
        "<p>Hi {{contactName}},</p>" +
        "<p>Wanted to follow up on the <strong>{{dealTitle}}</strong> quote from {{senderCompany}}. No pressure — just let me know if you want to move forward, hold, or talk through the numbers.</p>" +
        "<p>I can hold the pricing for [how long] if that helps.</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
    },
  },
  {
    key: "order_received",
    name: "Order received — thank you",
    subject: "Order received — [order number]",
    body: {
      admin:
        "<p>Hi {{contactName}},</p>" +
        "<p>Thank you — we have your order [order number] for <strong>{{dealTitle}}</strong>.</p>" +
        "<p>What happens next: we verify the order against your design, confirm pricing, and send you the delivery window. Nothing else is needed from you right now.</p>" +
        "<p>{{signature}}</p>",
      affiliate:
        "<p>Hi {{contactName}},</p>" +
        "<p>Thank you — {{senderCompany}} has your order [order number] for <strong>{{dealTitle}}</strong>.</p>" +
        "<p>What happens next: we check the order against your design, confirm pricing, and send you the delivery window. Nothing else is needed from you right now.</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
      contractor:
        "<p>Hi {{contactName}},</p>" +
        "<p>Got it — order [order number] for <strong>{{dealTitle}}</strong> is in with {{senderCompany}}.</p>" +
        "<p>I am reviewing it against the plan today and will confirm pricing and the install window with you. Nothing needed from you right now.</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
    },
  },
  {
    key: "order_verified",
    name: "Order verified — next steps",
    subject: "Order verified — here is what happens next",
    body: {
      admin:
        "<p>Hi {{contactName}},</p>" +
        "<p>Good news — order [order number] is verified. Our shop checks every cabinet before it ships, so nothing goes out on a guess.</p>" +
        "<p>We will send tracking as soon as it leaves, along with the delivery window. If your address or contact number changed, reply now so we can update it.</p>" +
        "<p>{{signature}}</p>",
      affiliate:
        "<p>Hi {{contactName}},</p>" +
        "<p>Order [order number] is verified with {{senderCompany}}. We checked it against your design and the pricing is locked.</p>" +
        "<p>Next you will get tracking as soon as it ships, plus the delivery window. If your address or contact number changed, reply now so we can update it.</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
      contractor:
        "<p>Hi {{contactName}},</p>" +
        "<p>Order [order number] is verified through {{senderCompany}}. Next steps on my side: I book the install for [install date] and confirm the crew and delivery window with you.</p>" +
        "<p>Please make sure the room is clear and the old cabinets are out by [ready date]. Anything changed on site, tell me now.</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
    },
  },
  {
    key: "order_shipped",
    name: "Your order has shipped (tracking)",
    subject: "Your order has shipped — tracking inside",
    body: {
      admin:
        "<p>Hi {{contactName}},</p>" +
        "<p>Your order [order number] is on its way.</p>" +
        "<p>Carrier: [carrier]<br />Tracking: [tracking number]<br />Delivery window: [delivery date]</p>" +
        "<p>Please look everything over when it arrives and tell us within [inspection window] if anything looks off. We will fix it.</p>" +
        "<p>{{signature}}</p>",
      affiliate:
        "<p>Hi {{contactName}},</p>" +
        "<p>Your order [order number] from {{senderCompany}} has shipped.</p>" +
        "<p>Carrier: [carrier]<br />Tracking: [tracking number]<br />Delivery window: [delivery date]</p>" +
        "<p>Please look everything over when it arrives and tell us within [inspection window] if anything looks off. We will fix it.</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
      contractor:
        "<p>Hi {{contactName}},</p>" +
        "<p>Your order [order number] has left the warehouse for {{senderCompany}}.</p>" +
        "<p>Carrier: [carrier]<br />Tracking: [tracking number]<br />Delivery window: [delivery date]</p>" +
        "<p>I will meet the delivery on [install date] and check every box before we start. Please keep the driveway and the install area clear that morning.</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
    },
  },
  {
    key: "need_measurements",
    name: "Need a few measurements",
    subject: "A few measurements we still need — {{dealTitle}}",
    body: {
      admin:
        "<p>Hi {{contactName}},</p>" +
        "<p>We are close on <strong>{{dealTitle}}</strong>. To finish the layout we still need:</p>" +
        "<p>• [wall-to-wall length]<br />• [ceiling height]<br />• [window and door locations]<br />• [outlet and appliance positions]</p>" +
        "<p>A photo of each wall taken from the doorway works too. Send whatever is easy and we will take it from there.</p>" +
        "<p>{{signature}}</p>",
      affiliate:
        "<p>Hi {{contactName}},</p>" +
        "<p>We are close on <strong>{{dealTitle}}</strong> at {{senderCompany}}. To finish the layout we still need:</p>" +
        "<p>• [wall-to-wall length]<br />• [ceiling height]<br />• [window and door locations]<br />• [outlet and appliance positions]</p>" +
        "<p>A photo of each wall taken from the doorway works too. Send whatever is easy and we will take it from there.</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
      contractor:
        "<p>Hi {{contactName}},</p>" +
        "<p>Before I order for <strong>{{dealTitle}}</strong> I need a few numbers from the room:</p>" +
        "<p>• [wall-to-wall length]<br />• [ceiling height]<br />• [window and door locations]<br />• [outlet and appliance positions]</p>" +
        "<p>A phone photo of each wall from the doorway is enough. Once I have those I can set the install date.</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
    },
  },
  {
    key: "post_delivery_check_in",
    name: "Checking in after delivery / review request",
    subject: "How did everything arrive?",
    body: {
      admin:
        "<p>Hi {{contactName}},</p>" +
        "<p>Checking in now that your order has been delivered. We hope the install went smoothly.</p>" +
        "<p>If something is not right, reply here and our team will make it right.</p>" +
        "<p>If everything looks good, a short review would mean a lot to us: [review link]</p>" +
        "<p>{{signature}}</p>",
      affiliate:
        "<p>Hi {{contactName}},</p>" +
        "<p>Checking in from {{senderCompany}} now that your order has been delivered. We hope the install went smoothly.</p>" +
        "<p>If something is not right, reply here and our showroom team will make it right.</p>" +
        "<p>If everything looks good, a short review would mean a lot to us: [review link]</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
      contractor:
        "<p>Hi {{contactName}},</p>" +
        "<p>Checking in now that the install is done. I hope the new kitchen is everything you pictured.</p>" +
        "<p>If a door needs adjusting or anything settled wrong, call me at {{senderPhone}} and I will come back out.</p>" +
        "<p>If you are happy with the work, a short review for {{senderCompany}} would really help: [review link]</p>" +
        "<p>{{signature}}</p>" +
        CONTACT_LINE,
    },
  },
];

function lettersForRole(role: CrmFormLetterRole): CrmFormLetter[] {
  return BLUEPRINTS.map((blueprint) => ({
    key: blueprint.key,
    name: blueprint.name,
    subject: blueprint.subject,
    bodyHtml: blueprint.body[role],
  }));
}

/** The starter letters, kept role-aware: admin brand, affiliate store, contractor business. */
export const CRM_FORM_LETTERS: Record<CrmFormLetterRole, CrmFormLetter[]> = {
  admin: lettersForRole("admin"),
  affiliate: lettersForRole("affiliate"),
  contractor: lettersForRole("contractor"),
};

export function crmFormLettersForRole(role: CrmFormLetterRole): CrmFormLetter[] {
  return CRM_FORM_LETTERS[role] ?? CRM_FORM_LETTERS.admin;
}

/**
 * Merge values for one letter. Deal fields fall back to [bracket] text so a
 * letter never goes out with a blank quote total or a missing design link.
 */
export function crmFormLetterMergeFields(input: {
  role: CrmFormLetterRole;
  profile?: CrmSenderProfile | null;
  deal?: CrmMergeFieldValue;
}): CrmMergeFieldValue {
  const deal = input.deal ?? {};
  return {
    ...deal,
    contactName: present(deal.contactName) ?? bracket("customer name"),
    dealTitle: present(deal.dealTitle) ?? bracket("deal name"),
    estimatedValue: present(deal.estimatedValue) ?? bracket("quote total"),
    designLink: present(deal.designLink) ?? bracket("design link"),
    quoteLink: present(deal.quoteLink) ?? bracket("quote link"),
    ...crmSenderMergeFields(input.profile, input.role),
  };
}

/** Fill one letter for the compose box. Returns copy only; nothing is sent. */
export function fillCrmFormLetter(
  letter: CrmFormLetter,
  fields: CrmMergeFieldValue,
): { subject: string; bodyHtml: string } {
  return {
    subject: applyCrmMergeFields(letter.subject, fields),
    bodyHtml: applyCrmMergeFields(letter.bodyHtml, fields),
  };
}

/**
 * Whether replacing the compose text would throw away something the sender
 * would miss. A blank box, or the greeting/draft that was already there when
 * the compose box opened, is nothing to lose — so no pointless prompt.
 * `baselineBodyText` is the body as it was written programmatically.
 */
export function composeHasTypedText(input: {
  subject: string;
  bodyText: string;
  baselineBodyText?: string;
}): boolean {
  if (input.subject.trim().length > 0) return true;
  const body = normalizeComposeText(input.bodyText);
  if (body.length === 0) return false;
  return body !== normalizeComposeText(input.baselineBodyText ?? "");
}

function normalizeComposeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/** Map the signed-in account to the letter set it should see. */
export function crmFormLetterRoleFor(input: {
  userRole?: string | null;
  audience?: "affiliate" | "admin" | null;
}): CrmFormLetterRole {
  if (input.userRole === "contractor") return "contractor";
  if (input.userRole === "admin") return "admin";
  if (input.audience === "affiliate") return "affiliate";
  return "admin";
}
