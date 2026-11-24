import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export type WarehouseOpenRow = {
  id: number | null;
  distributorId: number;
  zip: string;
  name: string;
  address: string | null;
  isOpen: boolean;
  recorded: boolean;
  onOriginList: boolean;
};

type WarehouseList = {
  available: boolean;
  migration: string;
  warehouses: WarehouseOpenRow[];
};

type SetOpenInput = {
  distributorId: number;
  zip: string;
  isOpen: boolean;
  name?: string;
};

/**
 * The admin client is typed from AppRouter. This screen calls the warehouses
 * procedures added with migration 0287. The cast keeps the toggle compiling
 * against the generated router type that ships with this repo.
 */
type WarehouseClient = {
  useUtils: () => {
    warehouses: { list: { invalidate: (input?: { distributorId?: number }) => Promise<void> } };
  };
  warehouses: {
    list: {
      useQuery: (
        input: { distributorId: number },
        opts?: { enabled?: boolean },
      ) => {
        data: WarehouseList | undefined;
        isLoading: boolean;
      };
    };
    setOpen: {
      useMutation: (opts: {
        onSuccess: (_saved: unknown, variables: SetOpenInput) => void;
        onError: (error: { message: string }) => void;
      }) => {
        mutate: (input: SetOpenInput) => void;
        isPending: boolean;
      };
    };
  };
};

function warehouseClient(): WarehouseClient {
  return trpc as unknown as WarehouseClient;
}

/**
 * Open or close a distributor warehouse without removing it from the record.
 * The switch does not edit Shipping Origin ZIPs. A closed warehouse is never
 * chosen as a freight origin; opening it makes that ZIP selectable again.
 */
export function WarehouseOpenControls({ distributorId }: { distributorId: number }) {
  const api = warehouseClient();
  const utils = api.useUtils();
  const list = api.warehouses.list.useQuery(
    { distributorId },
    { enabled: Number.isInteger(distributorId) && distributorId > 0 },
  );
  const setOpen = api.warehouses.setOpen.useMutation({
    onSuccess: (_saved, variables) => {
      toast.success(variables.isOpen ? `${variables.zip} is open for shipping` : `${variables.zip} is closed and will not be used as an origin`);
      void utils.warehouses.list.invalidate({ distributorId });
    },
    onError: (error) => toast.error(error.message || "Could not update the warehouse"),
  });

  if (!Number.isInteger(distributorId) || distributorId <= 0) return null;
  if (list.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" /> Loading warehouses…
      </div>
    );
  }
  if (!list.data?.available) {
    return (
      <p className="text-sm text-amber-800" data-testid="warehouse-open-migration">
        Warehouse open/closed is not installed yet. Run docs/sql/{list.data?.migration ?? "0287_warehouses_open_closed.tidb.sql"} in the TiDB SQL editor. Until then every warehouse stays open.
      </p>
    );
  }
  const rows = list.data.warehouses;
  return (
    <div className="space-y-2" data-testid="warehouse-open-controls">
      <p className="text-sm font-medium">Warehouse open / closed</p>
      <p className="text-xs text-muted-foreground">
        Close a warehouse to keep it on record without using it as a freight origin. Open it again to make that ZIP selectable. This does not add or remove Shipping Origin ZIPs.
      </p>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No warehouses are recorded for this line yet.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={`${row.distributorId}-${row.zip}`} className="flex items-start justify-between gap-3 rounded-md border bg-background px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{row.name} · {row.zip}</p>
                {row.address ? <p className="truncate text-xs text-muted-foreground">{row.address}</p> : null}
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant={row.isOpen ? "secondary" : "outline"}>{row.isOpen ? "Open" : "Closed"}</Badge>
                  {!row.onOriginList ? <Badge variant="outline">Not a shipping origin</Badge> : null}
                </div>
              </div>
              <Switch
                checked={row.isOpen}
                disabled={setOpen.isPending}
                aria-label={`${row.isOpen ? "Close" : "Open"} ${row.name} ${row.zip}`}
                onCheckedChange={(isOpen) => setOpen.mutate({
                  distributorId: row.distributorId,
                  zip: row.zip,
                  isOpen,
                  ...(row.recorded ? {} : { name: row.name }),
                })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
