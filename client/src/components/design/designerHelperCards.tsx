import type { ReactNode } from "react";
import { Link2, HandHeart, Loader2, Share2, Users, BellRing, CircleDot } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  HELPER_QUEUE_FRONT_COPY,
  HELPER_SIGN_OFF_COPY,
  HELPER_SIGN_ON_COPY,
  helperRequestOwnerLabel,
  helperRequestSummaryRows,
  helperRequestTimeLabel,
  helperStatusLabel,
  type HelperQueueEntry,
  type HelperRequest,
  type HelperRequestStatus,
} from "@shared/designerHelperQueue";

/**
 * Presentational cards for the designer helper queue.
 *
 * Nothing here calls tRPC, the database, or the mailer: each card takes plain
 * values and callbacks. The connected wrappers
 * (`DesignerHelperShare`, `DesignerHelperSign`, `DesignerHelperRequests`) pass
 * live data in, and the screenshot harness renders these same cards with
 * fixtures, so a capture shows the shipped markup rather than a mock-up.
 */

export function HelperShareButton({
  onClick,
  compact = false,
  disabled = false,
}: {
  onClick: () => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size={compact ? "sm" : "default"}
      disabled={disabled}
      data-testid="designer-helper-share-button"
      // The full label stays readable: the host lays this out full-width rather
      // than squeezing it to an ellipsis, which is what a customer needs to find.
      className={`gap-1.5 whitespace-nowrap border-[#a87f33]/50 text-[#8a6626] hover:bg-[#a87f33]/10 ${compact ? "h-7 shrink-0 px-2 text-[10px]" : "h-10 w-full justify-center px-3 text-xs font-semibold"}`}
      title="Share this design and get a designer helper"
      aria-label="Share / Get a designer helper"
      onClick={onClick}
    >
      <HandHeart className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      Share / Get a designer helper
    </Button>
  );
}

export function HelperSignCard({
  available,
  signedOnAt,
  designerName,
  email,
  queuePosition,
  queuedCount,
  pending = false,
  onToggle,
}: {
  available: boolean;
  signedOnAt: string | null;
  designerName: string;
  email: string | null;
  queuePosition: number | null;
  queuedCount: number;
  pending?: boolean;
  onToggle: (next: boolean) => void;
}) {
  const signedOn = signedOnAt ? helperRequestTimeLabel(signedOnAt) : null;
  return (
    <section
      className="rounded-xl border border-border bg-card p-5 space-y-4"
      data-testid="designer-helper-sign"
      data-helper-sign={available ? "on" : "off"}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <HandHeart className={`h-5 w-5 ${available ? "text-emerald-600" : "text-muted-foreground"}`} aria-hidden="true" />
            Helper sign
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {available
              ? "You are taking customer designer-helper requests."
              : "You are not taking customer designer-helper requests."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {available ? "On" : "Off"}
          </span>
          <Switch
            checked={available}
            disabled={pending}
            onCheckedChange={onToggle}
            aria-label="Helper sign"
            data-testid="designer-helper-sign-switch"
          />
        </div>
      </div>

      <div
        className={`rounded-lg border px-3 py-2.5 text-sm ${available ? "border-emerald-200 bg-emerald-50 text-emerald-950" : "border-border bg-muted/40 text-foreground"}`}
        data-testid="designer-helper-sign-message"
        role="status"
      >
        <p>{available ? HELPER_SIGN_ON_COPY : HELPER_SIGN_OFF_COPY}</p>
        {available && (
          <p className="mt-1 text-xs opacity-90" data-testid="designer-helper-queue-message">
            {HELPER_QUEUE_FRONT_COPY}
          </p>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
        <div className="rounded-lg border border-border p-2.5">
          <dt className="text-muted-foreground">Designer</dt>
          <dd className="font-semibold text-foreground">{designerName || "—"}</dd>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <dt className="text-muted-foreground">Email on file</dt>
          <dd className="break-all font-semibold text-foreground">{email || "None on file"}</dd>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <dt className="text-muted-foreground">Place in queue</dt>
          <dd className="font-semibold text-foreground" data-testid="designer-helper-queue-position">
            {queuePosition == null ? "Not queued" : `#${queuePosition} of ${queuedCount}`}
          </dd>
        </div>
        <div className="rounded-lg border border-border p-2.5">
          <dt className="text-muted-foreground">Signed on</dt>
          <dd className="font-semibold text-foreground">{signedOn || "Not signed on"}</dd>
        </div>
      </dl>

      {!email && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          Your account has no email address on file, so a help request can appear in the app but cannot be emailed to you.
        </p>
      )}
    </section>
  );
}

export function HelperQueueList({
  queue,
  signedOn,
}: {
  queue: readonly HelperQueueEntry[];
  signedOn: boolean;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3" data-testid="designer-helper-queue">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold">
          <Users className="h-5 w-5 text-[#a87f33]" aria-hidden="true" />
          Designer helper queue
        </h2>
        <Badge variant="outline">{queue.length} signed on</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Requests go to everyone whose Helper sign is on, longest-waiting designer first. Each entry carries the
        designer's regular email address so the request can also be mailed to them.
      </p>
      {queue.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
          No designer has their Helper sign on, so a new request waits in the admin queue.
        </p>
      ) : (
        <ol className="divide-y rounded-lg border border-border" data-testid="designer-helper-queue-rows">
          {queue.map((entry, index) => (
            <li key={entry.designerUserId} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
              <span className="flex items-center gap-2">
                <span className="w-5 text-xs font-semibold text-muted-foreground">{index + 1}</span>
                <span className="font-medium">{entry.designerName}</span>
                {!signedOn && !entry.available && <Badge variant="outline">sign off</Badge>}
              </span>
              <span className="text-xs text-muted-foreground">{entry.email ?? "no email on file"}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** One in-app notice for a designer: an available designer helper is needed. */
export function HelperRequestNoticeCard({
  request,
  designPath,
  onOpen,
  compact = false,
}: {
  request: Pick<HelperRequest, "id" | "customerName" | "designName" | "helpNote" | "requestedAt" | "status" | "acceptedByName" | "acceptedAt" | "joinedByName" | "joinedAt">;
  designPath: string;
  onOpen: () => void;
  compact?: boolean;
}) {
  return (
    <article
      className={`rounded-lg border border-[#a87f33]/40 bg-[#fdf8ee] p-3 ${compact ? "text-xs" : "text-sm"}`}
      data-testid="designer-helper-notice"
    >
      <div className="flex items-start gap-2">
        <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-[#a87f33]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">
            A designer helper is needed on {request.designName?.trim() || `design #${request.id}`}
          </p>
          <p className="mt-0.5 text-muted-foreground">
            {request.customerName?.trim() || "A customer"} · requested {helperRequestTimeLabel(request.requestedAt) || "just now"}
          </p>
          {request.helpNote?.trim() && (
            <p className="mt-1 line-clamp-2 text-muted-foreground">“{request.helpNote.trim()}”</p>
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            {helperStatusLabel(request.status)} · {helperRequestOwnerLabel(request)}
          </p>
          <a
            href={designPath}
            onClick={onOpen}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#8a6626] underline underline-offset-2"
          >
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            Open the customer's shared design
          </a>
        </div>
      </div>
    </article>
  );
}

export function HelperNoticeBadge({
  count,
  onClick,
  href,
}: {
  count: number;
  onClick?: () => void;
  href?: string;
}) {
  const label = count === 1 ? "1 designer helper request" : `${count} designer helper requests`;
  const inner = (
    <>
      <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
      {count} helper {count === 1 ? "request" : "requests"}
      <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#a87f33] px-1 text-[10px] font-bold text-white">
        {count > 9 ? "9+" : count}
      </span>
    </>
  );
  const className = "relative inline-flex h-8 items-center gap-1.5 rounded-md border border-[#a87f33]/50 bg-[#fdf8ee] px-2 text-[11px] font-semibold text-[#8a6626] hover:bg-[#a87f33]/10";

  if (href) {
    return (
      <a
        href={href}
        data-testid="designer-helper-notice-badge"
        aria-label={label}
        title="Open the customer's shared design"
        className={className}
      >
        {inner}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="designer-helper-notice-badge"
      aria-label={label}
      className={className}
    >
      {inner}
    </button>
  );
}

function statusTone(status: HelperRequestStatus): "default" | "secondary" | "destructive" | "outline" {
  if (status === "open") return "default";
  if (status === "accepted" || status === "joined") return "secondary";
  if (status === "cancelled") return "destructive";
  return "outline";
}

/**
 * The admin pop-up. Every fact the request carries, including who accepted and
 * when, plus two actions: open the request, or join the customer's design now.
 */
export function AdminHelperRequestCard({
  request,
  joining = false,
  onJoin,
  onOpenRequest,
  dense = false,
}: {
  request: HelperRequest;
  joining?: boolean;
  onJoin: () => void;
  onOpenRequest: () => void;
  dense?: boolean;
}) {
  const rows = helperRequestSummaryRows(request);
  const contact = rows.find((row) => row.label === "Contact")?.value ?? "";
  return (
    <div
      className={`w-full overflow-hidden rounded-lg border border-border bg-popover shadow-lg ${dense ? "text-xs" : "text-sm"}`}
      data-testid="admin-helper-request-popup"
    >
      <div className="flex items-start gap-2 border-b border-border bg-[#1a2744] px-3 py-2 text-white">
        <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-[#e0b56e]" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">A customer wants a designer helper</p>
          <p className="text-[11px] text-white/80">
            Request #{request.id} · {helperRequestTimeLabel(request.requestedAt) || "just now"}
          </p>
        </div>
        <Badge variant={statusTone(request.status)} className="shrink-0 capitalize">
          {helperStatusLabel(request.status)}
        </Badge>
      </div>
      <dl className="grid grid-cols-[7.5rem_1fr] gap-x-2 gap-y-1 px-3 py-2.5">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="text-foreground" data-testid={`admin-helper-request-${row.label.toLowerCase().replace(/\s+/g, "-")}`}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
      {contact.includes("@") && (
        <p className="px-3 pb-1 text-[11px] text-muted-foreground">
          Reply-to the customer from the request; the designer is also notified at the address on their account.
        </p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border bg-muted/40 px-3 py-2">
        <Button
          type="button"
          size="sm"
          className="gap-1.5 bg-[#1a2744] hover:bg-[#24375f]"
          disabled={joining}
          data-testid="admin-helper-request-join"
          onClick={onJoin}
        >
          {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
          Join the design
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-1.5"
          data-testid="admin-helper-request-open"
          onClick={onOpenRequest}
        >
          <Link2 className="h-3.5 w-3.5" />
          Open request
        </Button>
      </div>
    </div>
  );
}

/** Small helper row used inside the admin requests tab. */
export function AdminHelperRequestRow({
  request,
  onJoin,
  joining = false,
}: {
  request: HelperRequest;
  onJoin: () => void;
  joining?: boolean;
}) {
  return (
    <li className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3 py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          {request.customerName?.trim() || "Customer"}
          <Badge variant={statusTone(request.status)} className="capitalize">{helperStatusLabel(request.status)}</Badge>
        </p>
        <p className="text-xs text-muted-foreground">
          {request.designName?.trim() || `Design #${request.designId ?? "—"}`} ·{" "}
          {request.customerEmail?.trim() || "no email"} · {helperRequestTimeLabel(request.requestedAt)}
        </p>
        {request.helpNote?.trim() && (
          <p className="mt-0.5 text-xs text-muted-foreground">“{request.helpNote.trim()}”</p>
        )}
        <p className="mt-0.5 text-[11px] text-muted-foreground">{helperRequestOwnerLabel(request)}</p>
      </div>
      <Button type="button" size="sm" variant="outline" className="gap-1.5" disabled={joining} onClick={onJoin}>
        {joining ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
        Join design
      </Button>
    </li>
  );
}

export function HelperSection({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}
