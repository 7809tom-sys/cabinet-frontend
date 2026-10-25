import { describe, it, expect } from "vitest";
import { TRPCClientError } from "@trpc/client";
import { UNAUTHED_ERR_MSG } from "@shared/const";
import { shouldRedirectToLoginOnError } from "./authRedirect";

// Build a TRPCClientError with a chosen message (constructor takes the message).
function trpcErr(message: string): TRPCClientError<any> {
  return new TRPCClientError(message);
}

describe("shouldRedirectToLoginOnError (browser Back-trap guard)", () => {
  it("NEVER redirects on a background query error, even when unauthorized", () => {
    // This is the core fix: a guest browsing public pages can trigger a
    // protected query that 401s; redirecting here used to break the Back button.
    expect(shouldRedirectToLoginOnError(trpcErr(UNAUTHED_ERR_MSG), "query")).toBe(false);
  });

  it("does not redirect on a non-auth query error", () => {
    expect(shouldRedirectToLoginOnError(trpcErr("Something else broke"), "query")).toBe(false);
  });

  it("redirects on an unauthorized MUTATION error (deliberate action, expired session)", () => {
    expect(shouldRedirectToLoginOnError(trpcErr(UNAUTHED_ERR_MSG), "mutation")).toBe(true);
  });

  it("does NOT redirect on a mutation error that is not the unauthorized message", () => {
    expect(shouldRedirectToLoginOnError(trpcErr("Validation failed"), "mutation")).toBe(false);
  });

  it("ignores non-tRPC errors", () => {
    expect(shouldRedirectToLoginOnError(new Error(UNAUTHED_ERR_MSG), "mutation")).toBe(false);
    expect(shouldRedirectToLoginOnError("nope", "mutation")).toBe(false);
    expect(shouldRedirectToLoginOnError(null, "mutation")).toBe(false);
  });
});
