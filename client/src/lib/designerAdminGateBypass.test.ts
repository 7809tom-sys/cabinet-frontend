import { beforeEach, describe, expect, it } from "vitest";
import { stageAdminDesignerGateBypass } from "./designerAdminGateBypass";
import { pageReloadEnv } from "./staleChunkReload";
import { takeDesignerContactHandoff } from "./designerReloadHandoff";

describe("stageAdminDesignerGateBypass", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    pageReloadEnv.storage = () => ({
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => { data.set(k, v); },
      removeItem: (k: string) => { data.delete(k); },
    }) as unknown as Storage;
  });

  it("stages the admin's own email so the Designer skips the email form", () => {
    expect(stageAdminDesignerGateBypass({ role: "admin", email: "boss@example.com", name: "Boss" })).toBe(true);
    expect(takeDesignerContactHandoff()).toEqual({ email: "boss@example.com", name: "Boss", phone: undefined });
  });

  it("stages nothing for guests, non-admins, or an admin with no email", () => {
    for (const user of [null, undefined, { role: "user", email: "a@b.co" }, { role: null, email: "a@b.co" }, { role: "affiliate", email: "a@b.co" }, { role: "admin", email: "  " }, { role: "admin" }]) {
      expect(stageAdminDesignerGateBypass(user)).toBe(false);
      expect(takeDesignerContactHandoff()).toBeNull();
    }
  });
});
