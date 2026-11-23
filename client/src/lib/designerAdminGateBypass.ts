import { handOffDesignerContact } from "./designerReloadHandoff";

/** The slice of the server's auth.me user this bypass reads. */
export interface DesignerAdminCandidate {
  role?: string | null;
  email?: string | null;
  name?: string | null;
}

/**
 * Signed-in admins skip the Designer's email form. The role comes from auth.me
 * (the server's answer), never from the URL or client storage. For a confirmed
 * admin with an email on file, this stages the same one-shot handoff the
 * Designer already reads on mount (`takeDesignerContactHandoff`), so it opens
 * past the email form with the admin's own email. Guests and non-admins get
 * nothing staged and see the form as before. Returns true when staged.
 */
export function stageAdminDesignerGateBypass(user: DesignerAdminCandidate | null | undefined): boolean {
  if (!user || user.role !== "admin") return false;
  const email = typeof user.email === "string" ? user.email.trim() : "";
  if (!email) return false;
  handOffDesignerContact({ email, name: user.name ?? undefined });
  return true;
}
