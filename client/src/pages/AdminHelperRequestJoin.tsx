import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useDesignerHelperProcedures } from "@/lib/designerHelperProcedures";

/**
 * "Join the design" lands here from the admin pop-up and the requests tab.
 *
 * The record is written first — who joined and when — and only then does the
 * browser move to the customer's own saved design in the Designer's assisted
 * mode. A failure keeps the admin on this page with the plain reason rather
 * than opening a design with no join recorded.
 */
export default function AdminHelperRequestJoinPage({ requestId }: { requestId: number }) {
  const [, navigate] = useLocation();
  const helper = useDesignerHelperProcedures();
  const started = useRef(false);

  const join = helper.designerHelper.join.useMutation({
    onSuccess: (result) => {
      toast.success("Joined the customer's design", { description: result.joinedByName });
      window.location.assign(result.designPath);
    },
  });

  useEffect(() => {
    if (started.current || !Number.isFinite(requestId) || requestId <= 0) return;
    started.current = true;
    join.mutate({ requestId });
    // `join` identity changes per render in the shimmed client; run once per id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

  if (!Number.isFinite(requestId) || requestId <= 0) {
    return (
      <div className="container max-w-md py-20 text-center">
        <h1 className="font-serif text-2xl font-bold mb-2">Request not found</h1>
        <p className="text-muted-foreground mb-4">That designer helper request id is not valid.</p>
        <Button onClick={() => navigate("/admin?tab=helper-requests")}>Back to helper requests</Button>
      </div>
    );
  }

  if (join.error) {
    return (
      <div className="container max-w-md py-20 text-center">
        <h1 className="font-serif text-2xl font-bold mb-2">Could not join the design</h1>
        <p className="text-muted-foreground mb-4">{join.error.message}</p>
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => navigate("/admin?tab=helper-requests")}>Back to helper requests</Button>
          <Button
            onClick={() => {
              started.current = true;
              join.mutate({ requestId });
            }}
          >
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24">
      <Spinner className="h-6 w-6 text-primary" />
      <p className="text-sm text-muted-foreground">Recording that you joined, then opening the customer's design…</p>
    </div>
  );
}
