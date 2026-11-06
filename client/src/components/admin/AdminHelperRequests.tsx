import { useState } from "react";
import { useSearch } from "wouter";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { AdminHelperRequestCard, AdminHelperRequestRow } from "@/components/design/designerHelperCards";
import { helperNoticeRows, useDesignerHelperProcedures } from "@/lib/designerHelperProcedures";
import type { HelperRequest } from "@shared/designerHelperQueue";

/**
 * Admin view of the designer helper queue: one card per request with every
 * field, and a Join action that records who joined and when before opening the
 * customer's design.
 */
export function AdminHelperRequests() {
  const search = useSearch();
  const highlighted = Number(new URLSearchParams(search).get("request") ?? "") || null;
  const helper = useDesignerHelperProcedures();
  const inbox = helper.designerHelper.adminInbox.useQuery(undefined, { retry: false, refetchInterval: 20_000 });
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [selected, setSelected] = useState<HelperRequest | null>(null);

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

  const rows = helperNoticeRows(inbox.data);

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
          Every customer who asked for a designer helper. Joining opens the customer's shared design and records
          who joined and when.
        </p>
      </div>

      {selected && (
        <AdminHelperRequestCard
          request={selected}
          joining={joiningId === selected.id}
          onJoin={() => {
            setJoiningId(selected.id);
            join.mutate({ requestId: selected.id });
          }}
          onOpenRequest={() => setSelected(null)}
        />
      )}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          No customer has asked for a designer helper yet.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border border-border bg-card" data-testid="admin-helper-request-list">
          {rows.map((row) => (
            <AdminHelperRequestRow
              key={row.request.id}
              request={row.request}
              joining={joiningId === row.request.id}
              onJoin={() => {
                setJoiningId(row.request.id);
                join.mutate({ requestId: row.request.id });
              }}
            />
          ))}
        </ul>
      )}

      {highlighted != null && !rows.some((row) => row.request.id === highlighted) && (
        <p className="text-xs text-muted-foreground">Request #{highlighted} is not in the current list.</p>
      )}
    </div>
  );
}
