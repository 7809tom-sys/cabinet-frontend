import { trpc } from "@/lib/trpc";

/**
 * Email a Countertop Fabrication Sheet to the granite/quartz fabricator.
 *
 * The Designer already has a working "send a generated PDF to a fixed internal
 * recipient" path (`roomLayouts.emailQuote`, used by the 3D room quote) and a
 * working "send a branded message + attachment from the server mailer" path
 * (the backend's `server/email.ts` `sendEmail`, which forwards `attachments` to
 * Resend or SMTP). Neither accepts an arbitrary recipient plus an attachment
 * from a design, and inventing a browser-side mail send would require exposing
 * SMTP credentials to the client, so the frontend calls one new procedure and
 * surfaces the real server answer.
 *
 * Expected cabinet-backend contract:
 *
 *   design.emailFabricationSheet
 *     input: {
 *       designId?: number | null,   // saved design id when there is one
 *       to: string,                 // fabricator email, validated server-side
 *       cc?: string[],
 *       subject: string,
 *       body: string,
 *       fileName: string,           // e.g. countertop-fabrication-123-oak-st.pdf
 *       pdfBase64: string,          // the sheet, base64 (no data: prefix)
 *     }
 *     output: { status: "sent", sentTo: string } | { status: "failed", error: string }
 *
 * Server behaviour it must have:
 *   1. `protectedProcedure`; the caller must own the design id or be staff.
 *   2. Send through `sendEmail`/`sendEmailViaSettings` with
 *      `attachments: [{ filename: fileName, content: base64, contentType: "application/pdf" }]`
 *      so the fabricator receives a file they can save directly.
 *   3. Return `failed` with the provider's exact error rather than throwing for
 *      a mail-provider problem, and `PRECONDITION_FAILED` with
 *      "not_configured" when the mailer is unset — the Designer turns both into
 *      a clear message and never reports a success it did not have.
 *
 * Cast until AppRouter includes it. A missing procedure answers NOT_FOUND; the
 * UI reports that the endpoint is not deployed yet instead of faking a send.
 */
export type EmailFabricationSheetInput = {
  designId?: number | null;
  to: string;
  cc?: string[];
  subject: string;
  body: string;
  fileName: string;
  pdfBase64: string;
};

export type EmailFabricationSheetResult =
  | { status: "sent"; sentTo: string }
  | { status: "failed"; error: string };

type ProcedureError = { message: string; data?: { code?: string } | null; shape?: { data?: { code?: string } } };

export function useEmailFabricationSheet() {
  return (trpc as unknown as {
    design: {
      emailFabricationSheet: {
        useMutation: (options?: {
          onSuccess?: (result: EmailFabricationSheetResult, input: EmailFabricationSheetInput) => void;
          onError?: (error: ProcedureError) => void;
        }) => {
          mutateAsync: (input: EmailFabricationSheetInput) => Promise<EmailFabricationSheetResult>;
          isPending: boolean;
        };
      };
    };
  }).design.emailFabricationSheet.useMutation();
}

/** True when the email endpoint is not on the deployed backend yet. */
export function fabricationEmailEndpointMissing(error: unknown): boolean {
  if (!error) return false;
  const record = typeof error === "object"
    ? (error as { data?: { code?: string }; code?: string; message?: string; shape?: { data?: { code?: string } } })
    : {};
  const code = record.shape?.data?.code ?? record.data?.code ?? record.code;
  if (code === "NOT_FOUND") return true;
  const message = (record.message ?? "").toLowerCase();
  return message.includes("no procedure") || message.includes("not found");
}

/** Message shown when the mailer itself is unset or disabled on the server. */
export function fabricationEmailBlockedMessage(message: string | null | undefined): string | null {
  const raw = (message ?? "").trim();
  if (raw === "not_configured" || raw === "disabled") {
    return "Email is not configured on the server, so the sheet was not sent. Download the PDF and send it from your own mailbox.";
  }
  return null;
}

/**
 * The one user-facing outcome of an email attempt. Every branch is truthful:
 * `sent` only when the server said sent, `endpoint-missing` when the backend has
 * no such route, and `failed` for every real error (including the mailer being
 * unset), with the server's own text kept for the details panel.
 */
export type FabricationEmailOutcome =
  | { kind: "sent"; sentTo: string }
  | { kind: "endpoint-missing" }
  | { kind: "failed"; error: string; blocked: boolean };

export function fabricationEmailOutcome(
  result: EmailFabricationSheetResult | null | undefined,
  error: unknown,
): FabricationEmailOutcome {
  if (error) {
    if (fabricationEmailEndpointMissing(error)) return { kind: "endpoint-missing" };
    const record = error as ProcedureError;
    const message = (record?.message ?? "").trim() || "The email could not be sent.";
    const blocked = fabricationEmailBlockedMessage(message) != null;
    return { kind: "failed", error: blocked ? fabricationEmailBlockedMessage(message)! : message, blocked };
  }
  if (!result) return { kind: "failed", error: "The email could not be sent.", blocked: false };
  if (result.status === "sent") return { kind: "sent", sentTo: result.sentTo };
  const message = (result.error ?? "").trim() || "The email could not be sent.";
  const blocked = fabricationEmailBlockedMessage(message) != null;
  return { kind: "failed", error: blocked ? fabricationEmailBlockedMessage(message)! : message, blocked };
}

/** Minimal, shared recipient validation used by the dialog and its tests. */
export function usableFabricatorEmail(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}
