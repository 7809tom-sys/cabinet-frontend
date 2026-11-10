import { describe, expect, it } from "vitest";
import { affiliatePublishListStatus, publishListUnavailable } from "./useAffiliateFeaturePublish";

const permission = { message: "You do not have required permission (10002).", data: { code: "FORBIDDEN" } };

describe("affiliate publish list status", () => {
  it("treats a permission refusal and a missing procedure as unavailable", () => {
    expect(publishListUnavailable(permission)).toBe(true);
    expect(publishListUnavailable({ message: "You do not have required permission (10002)." })).toBe(true);
    expect(publishListUnavailable({ data: { code: "UNAUTHORIZED" }, message: "Please login (10001)" })).toBe(true);
    expect(publishListUnavailable({ data: { code: "NOT_FOUND" }, message: "No procedure found on path" })).toBe(true);
    expect(publishListUnavailable({ message: "Database not available", data: { code: "INTERNAL_SERVER_ERROR" } })).toBe(false);
    expect(publishListUnavailable(null)).toBe(false);
  });

  it("leaves the list closed for an affiliate instead of raising the admin permission error", () => {
    expect(affiliatePublishListStatus({
      authLoading: false,
      canReadPublishList: false,
      queryLoading: false,
      error: permission,
      hasRows: false,
    })).toBe("missing");
  });

  it("keeps an admin load failure visible and an admin list usable", () => {
    expect(affiliatePublishListStatus({
      authLoading: false,
      canReadPublishList: true,
      queryLoading: false,
      error: { message: "Database not available", data: { code: "INTERNAL_SERVER_ERROR" } },
      hasRows: false,
    })).toBe("error");
    expect(affiliatePublishListStatus({
      authLoading: false,
      canReadPublishList: true,
      queryLoading: false,
      error: null,
      hasRows: true,
    })).toBe("ready");
    expect(affiliatePublishListStatus({
      authLoading: true,
      canReadPublishList: false,
      queryLoading: false,
      error: null,
      hasRows: false,
    })).toBe("loading");
  });

  it("fails open when an admin read is refused or the procedure is not deployed", () => {
    expect(affiliatePublishListStatus({
      authLoading: false,
      canReadPublishList: true,
      queryLoading: false,
      error: permission,
      hasRows: false,
    })).toBe("missing");
    expect(affiliatePublishListStatus({
      authLoading: false,
      canReadPublishList: true,
      queryLoading: false,
      error: { data: { code: "NOT_FOUND" }, message: "No procedure found on path" },
      hasRows: false,
    })).toBe("missing");
  });
});
