import { buildOrderStatusTrail, type OrderTrailInput, type OrderTrailKey, type OrderTrailStep } from "@shared/orderStatusTrail";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ImageIcon, MailWarning } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";

export type OrderFulfillmentFields = OrderTrailInput & {
  requestNumber?: string;
  imageGeneratedCount?: number | null;
  lastImageGeneratedAt?: string | Date | null;
  crmSyncStatus?: string | null;
  crmSyncError?: string | null;
  distributorEmails?: Array<{ distributorId: number; distributorName?: string; status: string; sentTo?: string | null; error?: string | null; sentAt?: string | null }>;
};

/** Steps an administrator can advance by hand. Email sent is not one of them. */
export const ORDER_TRAIL_ACTION_KEYS: readonly OrderTrailKey[] = ["verified", "shipped", "signed"] as const;

export type OrderTrailAction = {
  /** Runs the step's mutation. The caller owns the confirmation dialog. */
  run: () => void;
  /** A step that is already done is not offered again. */
  disabled?: boolean;
  pending?: boolean;
  /** Tooltip/label explaining what clicking does, or why it cannot. */
  hint?: string;
};

function when(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function Step({
  step,
  action,
}: {
  step: OrderTrailStep;
  action?: OrderTrailAction;
}) {
  const actionable = action != null && !action.disabled && !action.pending;
  const label = step.done ? `Mark ${step.label} again` : `Mark ${step.label}`;

  const body = (
    <>
      <div className="flex items-center gap-2">
        {action?.pending ? (
          <Spinner className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : step.done ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
        ) : (
          <Circle className={`h-4 w-4 shrink-0 ${actionable ? "text-primary" : "text-muted-foreground"}`} />
        )}
        <span className={`text-xs font-medium ${step.done ? "text-foreground" : actionable ? "text-primary" : "text-muted-foreground"}`}>
          {step.label}
        </span>
      </div>
      <div className="mt-1 pl-6 text-[11px] leading-snug text-muted-foreground">
        {step.done && step.at ? <div>{when(step.at)}</div> : null}
        {step.actor ? <div>{step.actor}</div> : null}
        {step.detail ? <div>{step.detail}</div> : null}
        {!step.done && !step.detail ? <div>Waiting</div> : null}
        {actionable ? <div className="text-primary underline-offset-2 group-hover:underline">{label}</div> : null}
        {action?.disabled && !step.done && action.hint ? <div>{action.hint}</div> : null}
      </div>
    </>
  );

  return (
    <li className="min-w-0 flex-1" data-testid={`order-step-${step.key}`} data-done={step.done ? "true" : "false"}>
      {action ? (
        <button
          type="button"
          onClick={action.run}
          disabled={!actionable}
          aria-label={label}
          title={action.hint ?? label}
          data-testid={`order-step-action-${step.key}`}
          className={`group w-full rounded-md text-left transition-colors ${
            actionable ? "cursor-pointer hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40" : "cursor-default"
          }`}
        >
          {body}
        </button>
      ) : (
        body
      )}
    </li>
  );
}

export default function OrderFulfillmentTrail({
  order,
  actions,
}: {
  order: OrderFulfillmentFields;
  /** When present, the verified/shipped/signed steps become buttons. */
  actions?: Partial<Record<OrderTrailKey, OrderTrailAction>>;
}) {
  const steps = buildOrderStatusTrail(order);
  const count = order.imageGeneratedCount ?? 0;
  const missingEmail = order.distributorEmailStatus === "no_email" || (order.distributorEmails ?? []).some((row) => row.status === "no_email");
  return (
    <div className="space-y-2" data-testid="order-fulfillment-trail">
      <ol className="flex flex-col gap-3 sm:flex-row sm:gap-2">
        {steps.map((step) => (
          <Step
            key={step.key}
            step={step}
            action={ORDER_TRAIL_ACTION_KEYS.includes(step.key) ? actions?.[step.key] : undefined}
          />
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {order.distributorEmailStatus === "sent" && (
          <Badge variant="outline" className="border-emerald-300 text-emerald-700" data-testid="distributor-email-sent">
            Email sent{order.distributorEmailSentAt ? ` ${when(String(order.distributorEmailSentAt))}` : ""}{order.distributorEmailTo ? ` to ${order.distributorEmailTo}` : ""}
          </Badge>
        )}
        {order.distributorEmailStatus === "failed" && (
          <Badge variant="outline" className="border-red-300 text-red-700" data-testid="distributor-email-failed">
            Email failed{order.distributorEmailError ? `: ${order.distributorEmailError}` : ""}
          </Badge>
        )}
        {missingEmail && (
          <Badge variant="outline" className="border-amber-300 text-amber-700" data-testid="distributor-email-missing">
            <MailWarning className="mr-1 h-3 w-3" /> No order email set
          </Badge>
        )}
        {count > 0 && (
          <Badge variant="outline" className="border-emerald-300 text-emerald-800" data-testid="order-image-generated">
            <ImageIcon className="mr-1 h-3 w-3" /> Image generated · {count}
            {order.lastImageGeneratedAt ? ` · ${when(String(order.lastImageGeneratedAt))}` : ""}
          </Badge>
        )}
        {order.crmSyncStatus === "failed" && (
          <Badge variant="outline" className="border-red-300 text-red-700" data-testid="crm-sync-failed">
            CRM sync failed{order.crmSyncError ? `: ${order.crmSyncError}` : ""}
          </Badge>
        )}
        {order.crmSyncStatus === "new_sale" && (
          <Badge variant="outline" data-testid="crm-sync-new-sale">CRM: New Sale</Badge>
        )}
      </div>
    </div>
  );
}
