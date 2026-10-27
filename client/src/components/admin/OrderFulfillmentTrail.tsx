import { buildOrderStatusTrail, type OrderTrailInput, type OrderTrailStep } from "@shared/orderStatusTrail";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Circle, ImageIcon, MailWarning } from "lucide-react";

export type OrderFulfillmentFields = OrderTrailInput & {
  requestNumber?: string;
  imageGeneratedCount?: number | null;
  lastImageGeneratedAt?: string | Date | null;
  crmSyncStatus?: string | null;
  crmSyncError?: string | null;
  distributorEmails?: Array<{ distributorId: number; distributorName?: string; status: string; sentTo?: string | null; error?: string | null; sentAt?: string | null }>;
};

function when(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function Step({ step }: { step: OrderTrailStep }) {
  return (
    <li className="min-w-0 flex-1" data-testid={`order-step-${step.key}`} data-done={step.done ? "true" : "false"}>
      <div className="flex items-center gap-2">
        {step.done ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />}
        <span className={`text-xs font-medium ${step.done ? "text-foreground" : "text-muted-foreground"}`}>{step.label}</span>
      </div>
      <div className="mt-1 pl-6 text-[11px] leading-snug text-muted-foreground">
        {step.done && step.at ? <div>{when(step.at)}</div> : null}
        {step.actor ? <div>{step.actor}</div> : null}
        {step.detail ? <div>{step.detail}</div> : null}
        {!step.done && !step.detail ? <div>Waiting</div> : null}
      </div>
    </li>
  );
}

export default function OrderFulfillmentTrail({ order }: { order: OrderFulfillmentFields }) {
  const steps = buildOrderStatusTrail(order);
  const count = order.imageGeneratedCount ?? 0;
  const missingEmail = order.distributorEmailStatus === "no_email" || (order.distributorEmails ?? []).some((row) => row.status === "no_email");
  return (
    <div className="space-y-2" data-testid="order-fulfillment-trail">
      <ol className="flex flex-col gap-3 sm:flex-row sm:gap-2">
        {steps.map((step) => <Step key={step.key} step={step} />)}
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
