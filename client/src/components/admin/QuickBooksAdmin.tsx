/**
 * QuickBooksAdmin — Admin panel for QuickBooks Online integration.
 * Shows connection status, connect/disconnect controls, and per-order sync buttons.
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import { BookOpen, CheckCircle2, XCircle, RefreshCw, Link2, Unlink, Upload } from "lucide-react";

export default function QuickBooksAdmin() {
  const [syncing, setSyncing] = useState<number | null>(null);

  const { data: status, isLoading, refetch } = trpc.qbo.status.useQuery(undefined, {
    refetchInterval: 30_000,
  });

  const syncOrder = trpc.qbo.syncOrder.useMutation({
    onSuccess: (data) => {
      toast.success(`Synced to QuickBooks — Invoice #${data.invoiceId}`);
      setSyncing(null);
    },
    onError: (err) => {
      toast.error(err.message || "Sync failed");
      setSyncing(null);
    },
  });

  const syncAll = trpc.qbo.syncAll.useMutation({
    onSuccess: (data) => {
      if (data.errors.length > 0) {
        toast.warning(`Synced ${data.synced}/${data.total} orders. ${data.errors.length} failed.`);
      } else {
        toast.success(`Synced ${data.synced} order${data.synced === 1 ? "" : "s"} to QuickBooks.`);
      }
    },
    onError: (err) => toast.error(err.message || "Batch sync failed"),
  });

  const handleDisconnect = async () => {
    if (!confirm("Disconnect QuickBooks? You will need to reconnect to sync orders.")) return;
    try {
      await fetch("/api/qbo/disconnect", { method: "POST" });
      toast.success("Disconnected from QuickBooks.");
      refetch();
    } catch {
      toast.error("Failed to disconnect.");
    }
  };

  const isConnected = status?.connected;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-green-600" />
          QuickBooks Online Integration
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Connect your QuickBooks Online account to automatically sync Cabinet Dealz orders as invoices.
        </p>
      </div>

      {/* Connection Status Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            {isLoading ? (
              <Spinner className="h-4 w-4" />
            ) : isConnected ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <XCircle className="h-4 w-4 text-muted-foreground" />
            )}
            Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="h-4 w-4" /> Checking connection...
            </div>
          ) : isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300">
                  Connected
                </Badge>
                <span className="text-sm text-muted-foreground">
                  Company ID: <code className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{status.realmId}</code>
                </span>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Environment: <strong>{status.environment}</strong></p>
                <p>Connected: {status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : "—"}</p>
                <p>Token expires: {status.refreshTokenExpiresAt ? new Date(status.refreshTokenExpiresAt).toLocaleDateString() : "—"}</p>
              </div>
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => { window.location.href = "/api/qbo/connect"; }}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reconnect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={handleDisconnect}
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Not connected. Click below to authorize Cabinet Dealz to access your QuickBooks Online company.
              </p>
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                <p className="font-semibold">Before connecting:</p>
                <p>1. Make sure <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">QBO_CLIENT_ID</code> and <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">QBO_CLIENT_SECRET</code> are set in Admin → Secrets.</p>
                <p>2. Add <code className="font-mono bg-amber-100 dark:bg-amber-900 px-1 rounded">https://www.cabinetdealz.com/api/qbo/callback</code> as a Redirect URI in your Intuit Developer app.</p>
              </div>
              <Button
                className="gap-2 bg-green-700 hover:bg-green-800 text-white"
                onClick={() => { window.location.href = "/api/qbo/connect"; }}
              >
                <Link2 className="h-4 w-4" />
                Connect to QuickBooks
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Batch Sync Card */}
      {isConnected && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-green-600" />
              Sync Orders
            </CardTitle>
            <CardDescription>
              Push unsynced orders to QuickBooks as invoices. Each order is created once; re-syncing an already-synced order will create a duplicate in QBO.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="gap-2 bg-green-700 hover:bg-green-800 text-white"
              onClick={() => syncAll.mutate()}
              disabled={syncAll.isPending}
            >
              {syncAll.isPending ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {syncAll.isPending ? "Syncing..." : "Sync All Unsynced Orders"}
            </Button>
            <p className="text-xs text-muted-foreground">
              You can also sync individual orders from the <strong>Incoming Orders</strong> tab using the "Sync to QBO" button on each order row.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Setup Instructions */}
      <Card className="border-dashed">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-muted-foreground">Setup Instructions</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p><strong>1.</strong> Go to <a href="https://developer.intuit.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">developer.intuit.com</a> and create an app (select QuickBooks Online Accounting scope).</p>
          <p><strong>2.</strong> Copy the Client ID and Client Secret from the app's Keys & OAuth tab.</p>
          <p><strong>3.</strong> Add <code className="font-mono bg-muted px-1 rounded">https://www.cabinetdealz.com/api/qbo/callback</code> as a Redirect URI.</p>
          <p><strong>4.</strong> In Admin → Secrets, add <code className="font-mono bg-muted px-1 rounded">QBO_CLIENT_ID</code>, <code className="font-mono bg-muted px-1 rounded">QBO_CLIENT_SECRET</code>, and optionally <code className="font-mono bg-muted px-1 rounded">QBO_ENVIRONMENT</code> (sandbox or production).</p>
          <p><strong>5.</strong> Click "Connect to QuickBooks" above and authorize the app.</p>
          <p><strong>6.</strong> Use "Sync All Unsynced Orders" to push existing orders, or orders will sync individually from the Incoming Orders tab.</p>
        </CardContent>
      </Card>
    </div>
  );
}
