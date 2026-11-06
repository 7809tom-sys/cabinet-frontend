import { useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { AdminHelperRequestCard, AdminHelperRequestRow } from "@/components/design/designerHelperCards";
import { helperNoticeRows, useDesignerHelperProcedures } from "@/lib/designerHelperProcedures";

/**
 * Admin view of the designer helper queue: one row per live request, and the
 * full card for the one being worked. The Join action records who joined and
 * when before opening the customer's design.
 *
 * "Open request" from the pop-up lands here with `?request=<id>`, which opens
 * that request's card; clearing it returns to the plain list.
 */
export function AdminHelperRequests() {
  const search = useSearch();
  const [requestedId, setRequestedId] = useState<number | null>(() => {
    const raw = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search).get("request");
    const id = Number(raw ?? "");
    return Number.isInteger(id) && id > 0 ? id : null;
  });
  const helper = useDesignerHelperProcedures();
  const inbox = helper.designerHelper.adminInbox.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const [joiningId, setJoiningId] = useState<number | null>(null);

  const join = helper.designerHelper.join.useMutation({
    onSuccess: (result) => {
      toast.success("Joined the customer's design", { description: result.joinedByName });
      window.location.assign(result.designPath);
    },
    onError: (error) => {
      setJoiningId(null);
      toast.error("Could not join the design", { description: error.message });
    },
  });

  const startJoin = (requestId: number) => {
    setJoiningId(requestId);
    join.mutate({ requestId });
  };

  const rows = helperNoticeRows(inbox.data);
  const selected = requestedId == null ? null : rows.find((row) => row.request.id === requestedId)?.request ?? null;

  if (inbox.isLoading) {
    return (
      <div className="flex items-center gap-2 py-8 text-muted-foreground">
        <Spinner className="h-4 w-4" /> Loading designer helper requests…
      </div>
    );
  }

  if (inbox.error) {
    return (
      <p
        className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground"
        data-testid="admin-helper-requests-unavailable"
      >
        {inbox.error.message}
      </p>
    );
  }

  return (
    <div className="space-y-4" data-testid="admin-helper-requests">
      <div>
        <h2 className="font-serif text-2xl font-bold">Designer helper requests</h2>
        <p className="text-sm text-muted-foreground">
          Every customer waiting on a designer helper. Joining opens the customer's shared design and records who
          joined and when.
        </p>
      </div>

      {selected && (
        <AdminHelperRequestCard
          request={selected}
          joining={joiningId === selected.id}
          onJoin={() => startJoin(selected.id)}
          onOpenRequest={() => setRequestedId(null)}
        />
      )}

      {requestedId != null && !selected && (
        <p className="text-xs text-muted-foreground" data-testid="admin-helper-request-missing">
          Request #{requestedId} is no longer waiting — it was closed, or the customer's design was removed.
        </p>
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No customer is waiting on a designer helper right now.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border border-border bg-card" data-testid="admin-helper-request-list">
          {rows.map((row) => (
            <AdminHelperRequestRow
              key={row.request.id}
              request={row.request}
              joining={joiningId === row.request.id}
              onJoin={() => startJoin(row.request.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
