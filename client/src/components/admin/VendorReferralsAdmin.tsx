import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  formatVendorReferralDate,
  isVendorReferralStatus,
  VENDOR_REFERRAL_STATUSES,
  vendorReferralStatusLabel,
  type VendorReferralRow,
  type VendorReferralStatus,
} from "@/lib/vendorReferralForm";
import { toast } from "sonner";

// `vendorReferrals` ships in the paired cabinet-backend PR. Cast until AppRouter includes it.
function useVendorReferralsAdminApi() {
  return trpc as unknown as {
    vendorReferrals: {
      adminList: {
        useQuery: () => {
          data?: VendorReferralRow[];
          isLoading: boolean;
          isError: boolean;
          error: { message: string } | null;
          refetch: () => void;
        };
      };
      adminUpdateStatus: {
        useMutation: (options?: {
          onSuccess?: () => void;
          onError?: (error: { message: string }) => void;
        }) => {
          mutate: (input: { id: number; status: VendorReferralStatus }) => void;
          isPending: boolean;
        };
      };
    };
    useUtils: () => {
      vendorReferrals: { adminList: { invalidate: () => Promise<void> } };
    };
  };
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "onboarded") return "default";
  if (status === "contacted") return "secondary";
  if (status === "declined") return "destructive";
  return "outline";
}

function displayText(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? text : "—";
}

function StatusSelect({
  row,
  disabled,
  onChange,
}: {
  row: VendorReferralRow;
  disabled: boolean;
  onChange: (status: VendorReferralStatus) => void;
}) {
  return (
    <select
      aria-label={`Status for ${row.vendorName}`}
      className="border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 md:w-36"
      value={isVendorReferralStatus(row.status) ? row.status : "new"}
      disabled={disabled}
      onChange={(event) => {
        const status = event.target.value;
        if (!isVendorReferralStatus(status) || status === row.status) return;
        onChange(status);
      }}
    >
      {VENDOR_REFERRAL_STATUSES.map((status) => (
        <option key={status} value={status}>
          {vendorReferralStatusLabel(status)}
        </option>
      ))}
    </select>
  );
}

export default function VendorReferralsAdmin() {
  const api = useVendorReferralsAdminApi();
  const utils = api.useUtils();
  const list = api.vendorReferrals.adminList.useQuery();
  const updateStatus = api.vendorReferrals.adminUpdateStatus.useMutation({
    onSuccess: () => {
      void utils.vendorReferrals.adminList.invalidate();
      toast.success("Referral status updated");
    },
    onError: (error) => toast.error(error.message || "Couldn't update the referral status."),
  });
  const rows = list.data ?? [];

  return (
    <div className="space-y-4" data-testid="vendor-referrals-admin">
      <div>
        <h2 className="text-xl font-semibold">Vendor Referrals</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Referrals affiliates sent from their dashboard.
        </p>
      </div>

      {list.isLoading ? (
        <div className="flex justify-center py-12">
          <Spinner className="h-6 w-6 text-primary" />
        </div>
      ) : list.isError ? (
        <Card>
          <CardContent className="space-y-3 py-6 text-center">
            <p className="text-sm text-destructive" role="alert">
              Couldn't load vendor referrals: {list.error?.message || "Unknown error"}
            </p>
            <Button variant="outline" size="sm" onClick={() => list.refetch()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No vendor referrals yet.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="max-w-full overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Affiliate</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium whitespace-nowrap">{row.vendorName}</TableCell>
                    <TableCell className="whitespace-nowrap">{displayText(row.affiliateName)}</TableCell>
                    <TableCell className="whitespace-nowrap">{displayText(row.contactName)}</TableCell>
                    <TableCell className="max-w-[14rem] break-all">{displayText(row.email)}</TableCell>
                    <TableCell className="whitespace-nowrap">{displayText(row.phone)}</TableCell>
                    <TableCell className="max-w-xs whitespace-pre-wrap break-words">{displayText(row.notes)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {formatVendorReferralDate(row.createdAt)}
                    </TableCell>
                    <TableCell className="min-w-36">
                      <div className="mb-1 md:hidden">
                        <Badge variant={statusVariant(row.status)}>{vendorReferralStatusLabel(row.status)}</Badge>
                      </div>
                      <StatusSelect
                        row={row}
                        disabled={updateStatus.isPending}
                        onChange={(status) => updateStatus.mutate({ id: row.id, status })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
