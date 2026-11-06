/**
 * Which browser draft belongs to whom, and what happens to work a guest made
 * before signing in.
 *
 * A draft is local recovery data, not an account object. It has to follow the
 * ACCOUNT, not the email typed into the gate and not whichever tab happens to
 * hold a session: two people sharing a browser, or the same person in two tabs,
 * must never adopt each other's unsaved plan.
 *
 * Draft identity order (first match wins on restore, and the first is the one
 * new writes use):
 *   1. `acct-<userId>` — the signed-in account (from the server's auth.me for
 *      this request's own bearer token).
 *   2. `<email>` — the pre-account key, kept so an existing draft is not lost.
 *   3. `guest` — work made before anyone signed in.
 *
 * Guest work is adopted into the account on sign-in, once, and only when the
 * account has no draft of its own for that store. The guest key is then removed
 * so a second person on the same browser cannot pick up the first person's plan.
 */
import {
  designerDraftStorageKey,
  normalizeStoreScope,
  type StoreScope,
} from "@/lib/affiliateContext";

type DraftStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const GUEST_DRAFT_IDENTITY = "guest";

/** Stable identity fragment for a signed-in account. */
export function accountDraftIdentity(accountId: number): string {
  return `acct-${accountId}`;
}

/**
 * The key new drafts are written to. Signed in: the account. Otherwise the
 * gate email (a returning guest keeps their plan on this device), else guest.
 */
export function draftIdentityFor(input: {
  accountId?: number | null;
  email?: string | null;
}): string {
  if (input.accountId != null && Number.isFinite(input.accountId) && input.accountId > 0) {
    return accountDraftIdentity(input.accountId);
  }
  const email = (input.email ?? "").trim().toLowerCase();
  return email || GUEST_DRAFT_IDENTITY;
}

/** Keys to look at on restore, most specific first. */
export function draftIdentityCandidates(input: {
  accountId?: number | null;
  email?: string | null;
}): string[] {
  const candidates: string[] = [];
  const add = (identity: string) => {
    if (identity && !candidates.includes(identity)) candidates.push(identity);
  };
  if (input.accountId != null && Number.isFinite(input.accountId) && input.accountId > 0) {
    add(accountDraftIdentity(input.accountId));
  }
  add((input.email ?? "").trim().toLowerCase());
  add(GUEST_DRAFT_IDENTITY);
  return candidates;
}

export function draftStorageKeyFor(scope: StoreScope, identity: string): string {
  return designerDraftStorageKey(scope, identity);
}

/** A draft payload is a plain object. Arrays and scalars are corrupt. */
function isDraftPayload(parsed: unknown): boolean {
  return Boolean(parsed) && typeof parsed === "object" && !Array.isArray(parsed);
}

/**
 * The first of `identities` that has a draft, with the key it was found under.
 * A corrupt payload counts as absent: restoring it would blank the canvas.
 */
export function firstRestorableDraft(
  storage: DraftStorage,
  scope: StoreScope,
  identities: readonly string[],
): { identity: string; key: string; raw: string } | null {
  for (const identity of identities) {
    const key = draftStorageKeyFor(scope, identity);
    const raw = storage.getItem(key);
    if (!raw) continue;
    try {
      if (!isDraftPayload(JSON.parse(raw))) continue;
    } catch {
      continue;
    }
    return { identity, key, raw };
  }
  return null;
}

export type GuestDraftAdoption = {
  /** False when there is nothing to adopt, or the account already has work. */
  adopt: boolean;
  /** Identity whose draft should be copied, when adopting. */
  sourceIdentity: string | null;
  sourceKey: string | null;
  targetKey: string | null;
  /** Guest key to delete after a successful copy (always, even when skipped). */
  removeKey: string | null;
  reason: "adopted" | "account-draft-wins" | "no-guest-draft";
};

/**
 * Decide whether a guest draft becomes the signed-in account's draft.
 *
 * The account's own draft always wins: adopting a guest plan over a plan the
 * person already saved on another device would silently replace real work. The
 * guest copy is removed either way, so it cannot be adopted by a later account.
 */
export function planGuestDraftAdoption(
  storage: DraftStorage,
  scope: StoreScope,
  accountId: number,
): GuestDraftAdoption {
  const accountKey = draftStorageKeyFor(scope, accountDraftIdentity(accountId));
  const guestKey = draftStorageKeyFor(scope, GUEST_DRAFT_IDENTITY);
  const guestRaw = storage.getItem(guestKey);
  if (!guestRaw) {
    return { adopt: false, sourceIdentity: null, sourceKey: null, targetKey: accountKey, removeKey: null, reason: "no-guest-draft" };
  }
  const usable = (() => {
    try {
      return isDraftPayload(JSON.parse(guestRaw));
    } catch {
      return false;
    }
  })();
  if (!usable) {
    return { adopt: false, sourceIdentity: null, sourceKey: null, targetKey: accountKey, removeKey: guestKey, reason: "no-guest-draft" };
  }
  if (storage.getItem(accountKey)) {
    return { adopt: false, sourceIdentity: null, sourceKey: null, targetKey: accountKey, removeKey: guestKey, reason: "account-draft-wins" };
  }
  return {
    adopt: true,
    sourceIdentity: GUEST_DRAFT_IDENTITY,
    sourceKey: guestKey,
    targetKey: accountKey,
    removeKey: guestKey,
    reason: "adopted",
  };
}

/** Apply a plan. Returns true when a guest plan was moved onto the account. */
export function applyGuestDraftAdoption(storage: DraftStorage, plan: GuestDraftAdoption): boolean {
  if (!plan.adopt || !plan.sourceKey || !plan.targetKey) {
    if (plan.removeKey) storage.removeItem(plan.removeKey);
    return false;
  }
  const raw = storage.getItem(plan.sourceKey);
  if (!raw) {
    if (plan.removeKey) storage.removeItem(plan.removeKey);
    return false;
  }
  storage.setItem(plan.targetKey, raw);
  if (plan.removeKey) storage.removeItem(plan.removeKey);
  return true;
}

/** Store scope of a draft payload, so a store's plan never restores elsewhere. */
export function draftOriginScope(raw: string | null): string | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { originScope?: unknown };
    return typeof parsed.originScope === "string" ? normalizeStoreScope(parsed.originScope) : null;
  } catch {
    return null;
  }
}
