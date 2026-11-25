/**
 * Vendor-facing "How this works" panel for the inventory sync key.
 * Every statement mirrors the backend sync route (POST /api/vendor-inventory/sync):
 * JSON body `{ rows: [...] }` or `{ csv: "..." }`, Bearer key stored as a hash,
 * about 30 requests a minute per key, unknown SKUs reported and not created,
 * and a new key does not revoke older keys.
 */

export const INVENTORY_SYNC_JSON_EXAMPLE = `POST https://cabinetdealz.com/api/vendor-inventory/sync
Authorization: Bearer vif_YOUR_KEY_HERE
Content-Type: application/json

{
  "rows": [
    { "sku": "B36", "quantityOnHand": 0, "outOfStock": true, "backorder": true, "restockDate": "2026-12-15" },
    { "sku": "W3012", "discontinued": true }
  ]
}`;

export const INVENTORY_SYNC_CSV_EXAMPLE = `{ "csv": "sku,on hand,out of stock,backorder,discontinued,restock date\\nB36,0,yes,yes,no,2026-12-15" }`;

export function InventorySyncHowItWorks() {
  return (
    <details className="rounded-lg border bg-muted/20 p-3 text-sm" data-testid="inventory-sync-how-it-works">
      <summary className="cursor-pointer font-medium">How this works</summary>
      <ol className="mt-3 list-decimal space-y-2 pl-5">
        <li>This key is a password for your own inventory system. It lets that system send stock updates for this vendor only.</li>
        <li>Paste the key into your inventory software, or give it to whoever runs your integration. It goes in the Authorization header as Bearer followed by the key.</li>
        <li>
          Your system sends stock updates to Cabinetdealz with a POST to /api/vendor-inventory/sync as JSON. Send a list of rows, or put your CSV text in a field named csv. Each row needs a SKU that is already on this page. You can include on hand, out of stock, back ordered, discontinued, restock date (YYYY-MM-DD), lead time days, and minimum order. Use true or false without quotes for yes/no fields.
          <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">{INVENTORY_SYNC_JSON_EXAMPLE}</pre>
          <p className="mt-2 text-xs text-muted-foreground">CSV option, same address and header:</p>
          <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 font-mono text-xs">{INVENTORY_SYNC_CSV_EXAMPLE}</pre>
        </li>
        <li>The rows above update automatically after each sync, so nobody has to type them in. An on-hand count of 0 marks the item out of stock. SKUs we don't recognize are listed in the reply and are not created. These updates stay in this portal. The public catalog availability display doesn't change.</li>
        <li>The key is shown only once, right after you generate it. Cabinetdealz stores only a hash of it, so it can't be shown again.</li>
        <li>Each key can send about 30 updates a minute.</li>
        <li>Treat the key like a password and don't share screenshots of it. If it's exposed, generate a new key, put it in your software, then click Revoke on the old one. Generating a new key does not turn off older keys.</li>
      </ol>
    </details>
  );
}
