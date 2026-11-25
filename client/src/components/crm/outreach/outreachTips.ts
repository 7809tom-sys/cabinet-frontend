// Sales CRM → Outreach: the small pop-up tips (lightbulb buttons) shown next to
// each outreach action. Edit the wording here; nothing else needs to change.
// Keep each tip to one or two sentences and only describe what the Outreach
// panel really does (see OutreachPanel.tsx and @shared/crmOutreach).

export type OutreachTipId =
  | "status"
  | "mode"
  | "dailyCap"
  | "perContactCap"
  | "firstContact"
  | "followUp"
  | "offer"
  | "enroll"
  | "approveQueue"
  | "replied"
  | "afterQuote"
  | "moveCard"
  | "suppression";

export type OutreachTip = {
  /** Short heading shown in bold at the top of the pop-up. */
  title: string;
  /** One or two sentences. */
  body: string;
};

export const OUTREACH_TIPS: Record<OutreachTipId, OutreachTip> = {
  status: {
    title: "When does it send?",
    body: "Emails only go out when OUTREACH_ENABLED is true on the server, the Outreach on switch is on, and the mode is Approval queue or Automatic. Until then, \"Not sending\" shows here.",
  },
  mode: {
    title: "Pick a mode",
    body: "Start with Preview only to see what the drafts look like, then switch to Approval queue so you OK each email. Use Automatic only once you trust the drafts.",
  },
  dailyCap: {
    title: "Daily cap",
    body: "The most outreach emails sent in any 24 hours, across all contacts. Keep it modest while you're still checking replies by hand.",
  },
  perContactCap: {
    title: "Max emails per contact",
    body: "A contact gets no more than this many emails from the sequence, even if more steps are set up.",
  },
  firstContact: {
    title: "First contact",
    body: "Step 1 goes out first, counted from the day you enrol the list. In the brief, give one reason for writing and one easy next step, like replying or trying the online designer.",
  },
  followUp: {
    title: "Follow-up after no reply",
    body: "Later steps only reach people who haven't replied, because a reply stops their sequence. Give each follow-up a new angle instead of \"just checking in\", and space them a few days apart.",
  },
  offer: {
    title: "Offers",
    body: "The AI only mentions an offer you type here, word for word. Leave it blank and no offer is mentioned.",
  },
  enroll: {
    title: "Enrol a list",
    body: "Enrol one focused list at a time. Suppressed addresses, contacts already enrolled, won or lost deals, and bad emails are skipped, and nothing sends until outreach is on.",
  },
  approveQueue: {
    title: "Before you approve",
    body: "Read each draft and use Edit to fix the wording, or Email me a test copy to see it as the customer will. Approved drafts send on the next scheduled run, within the caps.",
  },
  replied: {
    title: "When someone replies",
    body: "Their sequence stops on its own (or shows Needs Tom if they asked whether it's automated). Answer them yourself from the Email view, and only Resume if they ask you to check back later.",
  },
  afterQuote: {
    title: "After a quote is sent",
    body: "Outreach doesn't stop by itself when a deal is quoted. Stop that contact here so automatic emails don't cross your own quote follow-up.",
  },
  moveCard: {
    title: "When to move a card",
    body: "Outreach only moves cards forward: a click or reply moves a New card to Contacted, and starting a design moves a New or Contacted card to Qualified. Move cards to Image review, Quoted, Won or Lost yourself; outreach never touches those.",
  },
  suppression: {
    title: "Never email list",
    body: "Add anyone who asks not to be emailed. Unsubscribes, bounces, spam complaints and \"stop\" replies are added for you.",
  },
};

export const OUTREACH_TIP_IDS = Object.keys(OUTREACH_TIPS) as OutreachTipId[];
