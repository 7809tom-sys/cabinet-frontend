/**
 * Screenshot harness for the design-ownership fix.
 *
 * It builds the page from the REAL modules, not a mock: the same
 * `designOpenPath`, `designStoreLabel`, `newDesignSaveScope`,
 * `designWriteScope`, `draftIdentityFor`, `planGuestDraftAdoption` and
 * `applyGuestDraftAdoption` the Designer and the account pages call, plus the
 * real `groupByProject` the "My designs" dialog uses.
 *
 * Three panels, left to right:
 *   1. BEFORE  - what the old behaviour produced: a link built from the store
 *                the viewer was on, and a draft keyed by the gate email.
 *   2. AFTER   - the same saved rows now: an owner-first link, the honest store
 *                label, and an account-scoped draft with the guest plan adopted.
 *   3. GUEST   - one person designs as a guest, then signs in: the guest plan
 *                moves to their account exactly once and is labelled as adopted.
 *
 * Loaded only by `client/dev/design-ownership.html` during the screenshot run
 * (`e2e/design-ownership-screenshot.spec.ts`). Nothing in the app imports it.
 */
import { groupByProject } from "@/components/design/DesignActions";
import { designOpenPath, designStoreLabel } from "@/lib/designOwnerScope";
import { newDesignSaveScope } from "@/lib/designOwnerScope";
import {
  applyGuestDraftAdoption,
  draftIdentityFor,
  draftStorageKeyFor,
  planGuestDraftAdoption,
} from "@/lib/designDraftOwnership";

const FIRST_CLASS = { id: 44, slug: "firstclass", storeName: "First Class Flooring & Cabinet Design" };

/** The real rows the server returns now: the owning store rides with each design. */
const richDesigns = [
  { id: 481, name: "Maple Life", userId: 7, affiliateId: null, affiliateSlug: null, affiliateName: null, updatedAt: "2026-11-06T01:40:00.000Z", projectName: null, roomLabel: "Kitchen", roomType: "kitchen", placedCabinets: [{}, {}, {}, {}, {}] },
  { id: 470, name: "Guest bath", userId: 7, affiliateId: null, affiliateSlug: null, affiliateName: null, updatedAt: "2026-11-05T18:02:00.000Z", projectName: null, roomLabel: "Bath", roomType: "bath", placedCabinets: [{}, {}] },
  { id: 512, name: "Osprey model kitchen", userId: 7, affiliateId: 44, affiliateSlug: "firstclass", affiliateName: FIRST_CLASS.storeName, updatedAt: "2026-11-04T15:20:00.000Z", projectName: null, roomLabel: "Kitchen", roomType: "kitchen", placedCabinets: [{}, {}, {}, {}, {}, {}, {}] },
];

const el = (tag: string, className?: string, text?: string) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

function panel(title: string, tone: "bad" | "good" | "info") {
  const wrap = el("section", "panel");
  const head = el("h2", `head ${tone}`, title);
  wrap.appendChild(head);
  return wrap;
}

function row(name: string, meta: string, link: string, note?: string, noteTone?: "bad" | "good") {
  const box = el("div", "row");
  const left = el("div", "left");
  left.appendChild(el("p", "name", name));
  left.appendChild(el("p", "meta", meta));
  if (note) left.appendChild(el("p", `note ${noteTone ?? ""}`, note));
  box.appendChild(left);
  const href = el("code", "link", link);
  box.appendChild(href);
  return box;
}

function label(host: HTMLElement, text: string, tone?: "bad" | "good") {
  host.appendChild(el("p", `caption ${tone ?? ""}`, text));
}

/** The OLD link shape: built from the store the viewer was on, not the design. */
function legacyOpenLink(designId: number, storeSlug: string | null) {
  return storeSlug ? `/store/${storeSlug}/design?load=${designId}` : `/design?load=${designId}`;
}

function beforePanel() {
  const node = panel("BEFORE — the store in the address decided everything", "bad");
  label(node, "Tom opened Rich's “Maple Life” from a First Class page. The link was built from that page, and the save had been filed under that store.", "bad");
  const groups = groupByProject(richDesigns as never);
  for (const group of groups) {
    for (const design of group.rooms as typeof richDesigns) {
      node.appendChild(row(
        design.name,
        `${design.affiliateName ?? "no store recorded"} · owner account #${design.userId}`,
        legacyOpenLink(design.id, "firstclass"),
        design.affiliateId === null
          ? "Opens on the First Class storefront, so the Designer asks that store for the plan (it is not that store's) and shows that store's brand."
          : undefined,
        "bad",
      ));
    }
  }
  return node;
}

function afterPanel() {
  const node = panel("AFTER — the design's own store decides where it opens", "good");
  label(node, "Same rows, same account. Each link is built from the design, and the store it saves to is stated on the row.", "good");
  const groups = groupByProject(richDesigns as never);
  for (const group of groups) {
    for (const design of group.rooms as typeof richDesigns) {
      node.appendChild(row(
        design.name,
        `${designStoreLabel(design)} · owner account #${design.userId}`,
        designOpenPath(design),
        design.affiliateId === null ? undefined : `Saves to ${designStoreLabel(design)} - opens there`,
        design.affiliateId === null ? undefined : "good",
      ));
    }
  }
  return node;
}

/** A tiny stand-in for the browser storage the Designer writes to. */
function memoryStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    keys: () => Array.from(map.keys()),
  };
}

function scopeRows() {
  const node = panel("WHERE A SAVE GOES", "info");
  label(node, "The same rule the server applies (newDesignStoreDecision), read through the shared helper.");
  const cases = [
    { who: "Tom — platform admin, First Class page open", input: { urlScope: "firstclass", role: "admin", viewerAffiliateId: null, storeAffiliateId: 44 } },
    { who: "Rich — First Class designer", input: { urlScope: "firstclass", role: "designer", viewerAffiliateId: 44, storeAffiliateId: 44 } },
    { who: "A First Class customer", input: { urlScope: "firstclass", role: "user", viewerAffiliateId: null, storeAffiliateId: 44 } },
    { who: "A guest browsing First Class", input: { urlScope: "firstclass", role: null, viewerAffiliateId: null, storeAffiliateId: 44 } },
  ];
  for (const item of cases) {
    const scope = newDesignSaveScope(item.input);
    const labelText = scope === "owner" ? "owner — the person's own account" : `firstclass — ${FIRST_CLASS.storeName}`;
    node.appendChild(row(item.who, "new design saved here", labelText, scope === "owner" ? "Saved to the account, so it appears on any device." : undefined, "good"));
  }
  return node;
}

function guestPanel() {
  const node = panel("GUEST WORK SIGNS IN WITH THEM", "good");
  const storage = memoryStorage();
  const before = draftIdentityFor({});
  const guestKey = draftStorageKeyFor(FIRST_CLASS.slug, before);
  storage.setItem(guestKey, JSON.stringify({ v: 2, originScope: FIRST_CLASS.slug, room: { width: 132 }, placed: [{ uid: "a" }, { uid: "b" }] }));

  label(node, `Guest draft key: ${guestKey.replace("cabinet-dealz:designer-draft:v2:", "")}`, "info");
  const plan = planGuestDraftAdoption(storage, FIRST_CLASS.slug, 7);
  const adopted = applyGuestDraftAdoption(storage, plan);
  const accountKey = draftStorageKeyFor(FIRST_CLASS.slug, draftIdentityFor({ accountId: 7 }));

  node.appendChild(row("On sign-in", "designer is open as a guest with 2 placed cabinets", adopted ? "adopted into account #7" : "nothing to adopt", adopted ? "The plan is now theirs on every device, under one account key." : undefined, "good"));
  node.appendChild(row("Account draft key", "written once, then the guest copy is deleted", accountKey.replace("cabinet-dealz:designer-draft:v2:", ""), undefined));
  node.appendChild(row("Guest copy", "removed so a second person on this browser cannot pick it up", storage.getItem(guestKey) == null ? "deleted" : "still present", undefined, "good"));
  node.appendChild(row("Second sign-in", "a different account on the same browser", planGuestDraftAdoption(storage, FIRST_CLASS.slug, 9).reason === "no-guest-draft" ? "nothing to adopt" : "would adopt", "Nothing crosses accounts.", "good"));
  node.appendChild(row("Keys now holding a draft", "this store, this browser", storage.keys().join(" · "), undefined));
  return node;
}

export function run() {
  const root = document.getElementById("root")!;
  const strip = el("header", "strip");
  strip.appendChild(el("h1", undefined, "Designs belong to the account that saved them"));
  strip.appendChild(el("p", undefined, "Tom's two reports: a design opened under the wrong store; a new save that never appeared on his login."));
  root.appendChild(strip);

  const grid = el("div", "grid");
  grid.appendChild(beforePanel());
  grid.appendChild(afterPanel());
  const right = el("div", "stack");
  right.appendChild(scopeRows());
  right.appendChild(guestPanel());
  grid.appendChild(right);
  root.appendChild(grid);

  const status = {
    rows: richDesigns.length,
    mapleLifeOwner: richDesigns[0]!.userId,
    mapleLifeLink: designOpenPath(richDesigns[0]!),
    storeDesignLink: designOpenPath(richDesigns[2]!),
    adminSaveScope: newDesignSaveScope({ urlScope: "firstclass", role: "admin", viewerAffiliateId: null, storeAffiliateId: 44 }),
    customerSaveScope: newDesignSaveScope({ urlScope: "firstclass", role: "user", viewerAffiliateId: null, storeAffiliateId: 44 }),
  };
  (window as unknown as { __designOwnershipShot?: unknown }).__designOwnershipShot = status;
}

void run();
