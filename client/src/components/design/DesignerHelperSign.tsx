import { useEffect } from "react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import {
  HelperNoticeBadge,
  HelperQueueList,
  HelperRequestNoticeCard,
  HelperSignCard,
} from "@/components/design/designerHelperCards";
import { helperNoticeRows, useDesignerHelperProcedures } from "@/lib/designerHelperProcedures";

/**
 * The designer's own Helper tab: the sign on/off toggle, the queue he is in,
 * and the customer help requests sent to him.
 *
 * Signing on queues him and says plainly that a customer's design will come up
 * in front of him. Signing off means no request is sent to him. The signed-on
 * time is recorded by the server, so queue order and "who accepted, when" are
 * real facts rather than decoration.
 */
export function DesignerHelperSign() {
  const helper = useDesignerHelperProcedures();
  const sign = helper.designerHelper.mySign.useQuery(undefined, { retry: false, refetchInterval: 30_000 });
  const notices = helper.designerHelper.myNotices.useQuery(undefined, { retry: false, refetchInterval: 30_000 });

  const setSign = helper.designerHelper.setSign.useMutation({
    onSuccess: (result) => {
      toast.success(result.available ? "Helper sign is on" : "Helper sign is off", {
        description: result.available
          ? "You are in the queue. A customer's design will come up in front of you."
          : "You are out of the queue. No customer help requests will be sent to you.",
      });
      void sign.refetch();
    },
    onError: (error) => toast.error("Could not change the helper sign", { description: error.message }),
  });

  const accept = helper.designerHelper.accept.useMutation({
    onSuccess: (result) => {
      toast.success("You accepted this request", { description: result.request.designName ?? undefined });
      void notices.refetch();
    },
    onError: (error) => toast.error("Could not accept the request", { description: error.message }),
  });

  const rows = helperNoticeRows(notices.data);
  const newestId = rows[0]?.request.id;

  // A new request while this tab is open gets an immediate in-app notice.
  useEffect(() => {
    if (!newestId) return;
    const newest = rows.find((row) => row.request.id === newestId);
    if (!newest) return;
    toast.info("An available designer helper is needed", {
      description: `${newest.request.customerName ?? "A customer"} · ${newest.request.designName ?? `design #${newest.request.id}`}`,
      action: { label: "Open design", onClick: () => window.location.assign(newest.designPath) },
    });
  }, [newestId, rows]);

  if (sign.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Spinner className="h-4 w-4" /> Loading your helper sign…
      </div>
    );
  }

  if (sign.error || !sign.data) {
    return (
      <p
        className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground"
        data-testid="designer-helper-sign-unavailable"
      >
        {sign.error?.message
          ?? "The helper queue is not available yet. Its procedures ship with the designer helper queue backend patch."}
      </p>
    );
  }

  const state = sign.data;
  const queuedCount = state.queue.filter((entry) => entry.available).length;

  return (
    <div className="space-y-4">
      <HelperSignCard
        available={state.available}
        signedOnAt={state.signedOnAt}
        designerName={state.designerName}
        email={state.email}
        queuePosition={state.queuePosition}
        queuedCount={queuedCount}
        pending={setSign.isPending}
        onToggle={(next) => setSign.mutate({ available: next })}
      />

      <section className="rounded-xl border border-border bg-card p-5 space-y-3" data-testid="designer-helper-notices">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">Customer help requests</h2>
          {rows.length > 0 && <HelperNoticeBadge count={rows.length} onClick={() => void notices.refetch()} />}
        </div>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
            No customer is waiting for a designer helper right now.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.request.id} className="space-y-2">
                <HelperRequestNoticeCard
                  request={row.request}
                  designPath={row.designPath}
                  onOpen={() => undefined}
                />
                <button
                  type="button"
                  className="text-xs font-semibold text-[#8a6626] underline underline-offset-2"
                  data-testid={`designer-helper-accept-${row.request.id}`}
                  onClick={() => accept.mutate({ requestId: row.request.id })}
                >
                  Accept this request (records who accepted and when)
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <HelperQueueList queue={state.queue.filter((entry) => entry.available)} signedOn={state.available} />
    </div>
  );
}
