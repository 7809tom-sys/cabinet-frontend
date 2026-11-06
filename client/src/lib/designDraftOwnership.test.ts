import { describe, expect, it } from "vitest";
import {
  accountDraftIdentity,
  applyGuestDraftAdoption,
  draftIdentityCandidates,
  draftIdentityFor,
  draftOriginScope,
  draftStorageKeyFor,
  firstRestorableDraft,
  planGuestDraftAdoption,
} from "@/lib/designDraftOwnership";

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
    keys: () => Array.from(map.keys()),
    value: (key: string) => map.get(key) ?? null,
  };
}

const plan = (originScope: string) => JSON.stringify({ v: 2, originScope, placed: [{ uid: "a" }] });

describe("drafts belong to an account, not an email typed into the gate", () => {
  it("keys a signed-in person's draft by their account id", () => {
    expect(draftIdentityFor({ accountId: 7, email: "rich@example.com" })).toBe("acct-7");
    expect(accountDraftIdentity(7)).toBe("acct-7");
  });

  it("keeps the email and guest keys for anyone who is not signed in", () => {
    expect(draftIdentityFor({ email: "Rich@Example.com " })).toBe("rich@example.com");
    expect(draftIdentityFor({})).toBe("guest");
  });

  it("looks for the account's draft first, then its email, then guest work", () => {
    expect(draftIdentityCandidates({ accountId: 7, email: "rich@example.com" }))
      .toEqual(["acct-7", "rich@example.com", "guest"]);
    expect(draftIdentityCandidates({})).toEqual(["guest"]);
  });

  it("restores the first key that actually holds a readable plan", () => {
    const storage = memoryStorage({
      [draftStorageKeyFor("owner", "rich@example.com")]: plan("owner"),
      [draftStorageKeyFor("owner", "guest")]: plan("owner"),
    });
    const found = firstRestorableDraft(storage, "owner", ["acct-7", "rich@example.com", "guest"]);
    expect(found?.identity).toBe("rich@example.com");
  });

  it("ignores a corrupt payload instead of blanking the canvas with it", () => {
    const storage = memoryStorage({
      [draftStorageKeyFor("owner", "acct-7")]: "{not json",
      [draftStorageKeyFor("owner", "guest")]: plan("owner"),
    });
    expect(firstRestorableDraft(storage, "owner", ["acct-7", "guest"])?.identity).toBe("guest");
  });

  it("never restores another store's draft", () => {
    const storage = memoryStorage({ [draftStorageKeyFor("firstclass", "acct-7")]: plan("firstclass") });
    expect(firstRestorableDraft(storage, "owner", ["acct-7", "guest"])).toBeNull();
    expect(draftOriginScope(storage.value(draftStorageKeyFor("firstclass", "acct-7")))).toBe("firstclass");
  });
});

describe("guest work made before signing in is attached to the account", () => {
  it("copies the guest plan onto the account and removes the guest copy", () => {
    const storage = memoryStorage({ [draftStorageKeyFor("owner", "guest")]: plan("owner") });
    const adoption = planGuestDraftAdoption(storage, "owner", 7);
    expect(adoption.reason).toBe("adopted");
    expect(applyGuestDraftAdoption(storage, adoption)).toBe(true);
    expect(storage.value(draftStorageKeyFor("owner", "acct-7"))).toBe(plan("owner"));
    expect(storage.value(draftStorageKeyFor("owner", "guest"))).toBeNull();
  });

  it("keeps the account's own plan when it already has one, and still clears the guest copy", () => {
    const accountKey = draftStorageKeyFor("owner", "acct-7");
    const storage = memoryStorage({
      [accountKey]: plan("owner"),
      [draftStorageKeyFor("owner", "guest")]: plan("owner"),
    });
    const adoption = planGuestDraftAdoption(storage, "owner", 7);
    expect(adoption.reason).toBe("account-draft-wins");
    expect(applyGuestDraftAdoption(storage, adoption)).toBe(false);
    expect(storage.value(accountKey)).toBe(plan("owner"));
    expect(storage.value(draftStorageKeyFor("owner", "guest"))).toBeNull();
  });

  it("adopts once: a second account on the same browser gets nothing", () => {
    const storage = memoryStorage({ [draftStorageKeyFor("owner", "guest")]: plan("owner") });
    applyGuestDraftAdoption(storage, planGuestDraftAdoption(storage, "owner", 7));
    expect(planGuestDraftAdoption(storage, "owner", 9).reason).toBe("no-guest-draft");
    expect(storage.value(draftStorageKeyFor("owner", "acct-9"))).toBeNull();
  });

  it("drops an unreadable guest payload rather than adopting it", () => {
    const guestKey = draftStorageKeyFor("owner", "guest");
    const storage = memoryStorage({ [guestKey]: "[]" });
    const adoption = planGuestDraftAdoption(storage, "owner", 7);
    expect(adoption.reason).toBe("no-guest-draft");
    expect(adoption.removeKey).toBe(guestKey);
    expect(applyGuestDraftAdoption(storage, adoption)).toBe(false);
    expect(storage.value(guestKey)).toBeNull();
  });
});
