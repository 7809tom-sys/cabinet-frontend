/**
 * Resolves which CRM form-letter set the signed-in account sees, plus the
 * company/location/contact identity the letters are signed with.
 *
 * The role comes from the account (`users.role`), not from the mailbox
 * audience, so a contractor always gets contractor letters. Each identity is
 * read from data that already exists:
 *   • admin      → the Cabinet Dealz house brand
 *   • affiliate  → that affiliate's store record (store name, public address or
 *                  service area, public phone, public email), the same record
 *                  the storefront branding uses
 *   • contractor → the contractor's approved access request (business name,
 *                  phone). That record carries no location or business email,
 *                  so those two render as [bracket] placeholders.
 *
 * Pure resolution lives in `shared/crmFormLetters.ts` so it unit-tests without
 * React or tRPC.
 */

import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import {
  ADMIN_CRM_SENDER_PROFILE,
  affiliateCrmSenderProfile,
  contractorCrmSenderProfile,
  crmFormLetterRoleFor,
  type CrmFormLetterRole,
  type CrmSenderProfile,
} from "@shared/crmFormLetters";

type AffiliateRecord = Parameters<typeof affiliateCrmSenderProfile>[0];
type ContractorRequest = Parameters<typeof contractorCrmSenderProfile>[0];

export type CrmFormLetterContext = {
  role: CrmFormLetterRole;
  /** Null while the identity query is still in flight. */
  profile: CrmSenderProfile | null;
  loading: boolean;
};

/**
 * The two procedures are read-only lookups the rest of the CMS already makes.
 * Cast keeps this module valid until AppRouter carries them in this checkout.
 */
const formLetterTrpc = trpc as unknown as {
  contractorAccess: {
    mine: { useQuery: (input: undefined, options: { enabled: boolean; retry: boolean }) => { data?: ContractorRequest | null; isLoading: boolean } };
  };
  affiliates: {
    myReferrals: { useQuery: (input: undefined, options: { enabled: boolean; retry: boolean }) => { data?: { affiliate?: AffiliateRecord | null } | null; isLoading: boolean } };
  };
};

export function useCrmFormLetterContext(audience: "affiliate" | "admin"): CrmFormLetterContext {
  const { user } = useAuth();
  const role = crmFormLetterRoleFor({ userRole: user?.role, audience });

  const contractorRequest = formLetterTrpc.contractorAccess.mine.useQuery(undefined, {
    enabled: role === "contractor",
    retry: false,
  });

  // `myReferrals` already returns the signed-in affiliate's own store record,
  // contact fields included. Nothing new is fetched for admins.
  const myAffiliate = formLetterTrpc.affiliates.myReferrals.useQuery(undefined, {
    enabled: role === "affiliate",
    retry: false,
  });

  if (role === "admin") {
    return { role, profile: ADMIN_CRM_SENDER_PROFILE, loading: false };
  }
  if (role === "contractor") {
    if (contractorRequest.isLoading) return { role, profile: null, loading: true };
    return { role, profile: contractorCrmSenderProfile(contractorRequest.data ?? null), loading: false };
  }
  if (myAffiliate.isLoading) return { role, profile: null, loading: true };
  return { role, profile: affiliateCrmSenderProfile(myAffiliate.data?.affiliate ?? null), loading: false };
}
