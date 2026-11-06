import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, Mail, Package, Send, ShieldCheck, ShoppingCart, Truck } from "lucide-react";
import {
  buildOrderTimeline,
  groupTimelineByDay,
  type OrderEventRecord,
  type OrderTimelineEntry,
  type OrderTimelineSource,
} from "@/lib/orderTimeline";

function iconFor(action: string) {
  switch (action) {
    case "purchased": return ShoppingCart;
    case "order_received_email": return Mail;
    case "distributor_emailed":
    case "distributor_email_resent": return Send;
    case "verified": return ShieldCheck;
    case "shipped": return Truck;
    case "signed": return CheckCircle2;
    case "receipt_sent": return Mail;
    default: return Circle;
  }
}

/**
 * The sales order Activity timeline. Every line names who did it, in a plain
 * sentence, with the exact Central time:
 *
 *   Tom Reaves bought cabinets · Nov 5, 2026, 6:40 PM CT
 *   Selena Ortiz approved the order · Nov 5, 2026, 7:02 PM CT
 *
 * `events` are the rows from order_events (append-only, so repeats show up).
 * When an order predates that log the timeline is derived from its own
 * `*_At` / `*_By` columns, and the entry is marked "from the order record".
 */
export default function OrderActivityTimeline({
  order,
  events = [],
  loading = false,
}: {
  order: OrderTimelineSource;
  events?: readonly OrderEventRecord[];
  loading?: boolean;
}) {
  const timeline = useMemo(() => buildOrderTimeline(order, events), [order, events]);
  const groups = useMemo(() => groupTimelineByDay(timeline), [timeline]);

  return (
    <section className="space-y-3 rounded-lg border p-4" data-testid="order-activity-timeline">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Activity</h3>
        <p className="text-[11px] text-muted-foreground">Newest last. All times Central.</p>
      </div>

      {loading && timeline.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="order-activity-loading">Loading activity…</p>
      )}

      {!loading && timeline.length === 0 && (
        <p className="text-sm text-muted-foreground" data-testid="order-activity-empty">
          Nothing has happened on this order yet.
        </p>
      )}

      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.day}>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{group.day}</p>
            <ol className="space-y-2 border-l pl-3">
              {group.entries.map((entry: OrderTimelineEntry) => {
                const Icon = iconFor(entry.action);
                return (
                  <li key={entry.key} className="flex items-start gap-2" data-testid={`order-activity-${entry.action}`}>
                    <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 text-sm">
                      <span className="font-medium">{entry.actor}</span>{" "}
                      <span>{entry.text}</span>
                      <span className="text-muted-foreground"> · {new Date(entry.at).toLocaleString("en-US", {
                        timeZone: "America/Chicago",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        hour12: true,
                      })} CT</span>
                      {entry.derived && (
                        <Badge variant="outline" className="ml-2 align-middle text-[10px]" data-testid="order-activity-derived">
                          from the order record
                        </Badge>
                      )}
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>

      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <Package className="h-3 w-3" />
        Every action is logged with the person who did it. Resends appear as their own line.
      </p>
    </section>
  );
}
