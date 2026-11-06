import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

/**
 * A harness for the vendor catalog table, used to capture the before/after
 * screenshots for the density work.
 *
 * It renders the SAME markup the real CatalogPage renders, with the same data, so
 * a screenshot of this page is an honest picture of the catalog at 1280–1440px.
 * Toggle "compact" to compare the old layout with the new one. This is dev-only
 * scaffolding for the screenshots; the shipping table lives in VendorPortal.tsx.
 */

type Row = {
  sku: string;
  description: string;
  vendorCost: string;
  style: string;
  category: string;
  list: string;
  cost: string;
  wholesale: string;
  contractor: string;
  onHand: string;
  published: boolean;
  status: string;
};

const ROWS: Row[] = [
  { sku: "W3024", description: '30" x 24" Wall Cabinet — Carmel Shaker', vendorCost: "No cost on file", style: "Terra Shaker (Ashford)", category: "Wall Cabinet", list: "$449.34", cost: "$284.39 calculated", wholesale: "$389.00", contractor: "$410.00", onHand: "12", published: true, status: "approved" },
  { sku: "W3012", description: '30" x 12" Wall Cabinet — Carmel Shaker', vendorCost: "No cost on file", style: "Terra Shaker (Ashford)", category: "Wall Cabinet", list: "$219.00", cost: "$138.61 calculated", wholesale: "$189.00", contractor: "$199.00", onHand: "4", published: true, status: "approved" },
  { sku: "B24", description: '24" Base Cabinet — one door, one drawer', vendorCost: "$142.10", style: "Terra Shaker (Ashford)", category: "Base Cabinet", list: "$224.55", cost: "$142.10 on file", wholesale: "$195.00", contractor: "$205.00", onHand: "26", published: true, status: "approved" },
  { sku: "3DB18", description: '18" 3 Drawer Base Cabinet', vendorCost: "$284.39", style: "Terra Shaker (Ashford)", category: "Drawer Base", list: "$449.34", cost: "$284.39 on file", wholesale: "$389.00", contractor: "$410.00", onHand: "8", published: true, status: "approved" },
  { sku: "BBC36", description: '36" x 24" x 12" Blind Base Corner Cabinet with a very long supplier description', vendorCost: "No cost on file", style: "Terra Shaker (Ashford)", category: "Corner Base", list: "$512.00", cost: "$324.04 calculated", wholesale: "$449.00", contractor: "$469.00", onHand: "0", published: false, status: "pending" },
  { sku: "TK8", description: '8" Toe Kick — Carmel Shaker', vendorCost: "$12.40", style: "Terra Shaker (Ashford)", category: "Toe Kick", list: "$19.60", cost: "$12.40 on file", wholesale: "$17.00", contractor: "$18.00", onHand: "140", published: true, status: "approved" },
];

export default function CatalogDensityPreview({ compact }: { compact: boolean }) {
  const [on, setOn] = useState<Record<string, boolean>>({});

  return (
    <div className="min-h-screen bg-background p-4" data-testid="catalog-density-preview">
      <div className={compact ? "mx-auto max-w-[1216px]" : "mx-auto max-w-[1216px]"}>
        <h1 className={compact ? "text-lg font-semibold leading-tight" : "text-2xl font-bold tracking-tight"}>
          {compact ? "My Catalog" : "My Catalog"}
        </h1>
        {!compact && (
          <p className="mt-1 text-muted-foreground">Vendor catalog and pricing for this supply line.</p>
        )}

        <div className={compact ? "mb-2 mt-2 flex flex-wrap items-center gap-1.5" : "mb-4 mt-4 flex flex-wrap items-center gap-3"}>
          {["Clark and Son", "8 SKUs", "All Styles", "All Categories"].map((chip) => (
            <Badge key={chip} variant="outline" className={compact ? "px-1.5 py-0 text-[11px] font-normal" : "px-2.5 py-1"}>{chip}</Badge>
          ))}
        </div>

        <div className={compact ? "overflow-x-auto rounded-md border" : "overflow-x-auto rounded-md border"}>
          <Table className={compact ? "w-full table-fixed text-[13px]" : "w-full"}>
            <TableHeader>
              <TableRow>
                {[
                  ["Img", "w-10"],
                  ["SKU", "w-24"],
                  ["Description", "w-[200px]"],
                  ["Vend. cost", "w-[76px]"],
                  ["Style", "w-[110px]"],
                  ["Category", "w-20"],
                  ["List", "w-[68px]"],
                  ["Cost", "w-[72px]"],
                  ["Wholesale", "w-[76px]"],
                  ["Contractor", "w-[74px]"],
                  ["On hand", "w-14"],
                  ["Visible", "w-[50px]"],
                  ["Status", "w-[78px]"],
                  ["Actions", "w-14"],
                ].map(([label, width]) => (
                  <TableHead
                    key={label}
                    className={compact
                      ? `h-7 ${width} whitespace-nowrap px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground`
                      : `h-10 ${width} px-2`}
                  >
                    {label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row.sku} className={compact ? "h-8" : undefined}>
                  <TableCell className={compact ? "px-1.5 py-1" : "p-2"}>
                    <div className={compact ? "h-6 w-6 rounded bg-muted" : "h-10 w-10 rounded bg-muted"} />
                  </TableCell>
                  <TableCell className={compact ? "px-1.5 py-1 font-mono text-[13px] leading-tight whitespace-nowrap" : "p-2 font-mono text-xs"}>{row.sku}</TableCell>
                  <TableCell className={compact ? "max-w-[200px] truncate px-1.5 py-1 text-[13px] leading-tight" : "max-w-[200px] truncate p-2 text-sm"} title={compact ? row.description : undefined}>
                    {row.description}
                  </TableCell>
                  <TableCell className={compact ? "px-1.5 py-1 text-right text-[13px] leading-tight whitespace-nowrap" : "p-2 text-right text-sm"}>{row.vendorCost}</TableCell>
                  <TableCell className={compact ? "truncate px-1.5 py-1" : "p-2"}>
                    <Badge variant="secondary" className={compact ? "max-w-full truncate px-1 py-0 text-[10px] font-normal" : "text-xs"}>{row.style}</Badge>
                  </TableCell>
                  <TableCell className={compact ? "px-1.5 py-1 text-[13px] leading-tight whitespace-nowrap" : "p-2 text-xs"}>{row.category}</TableCell>
                  {[row.list, row.cost, row.wholesale, row.contractor, row.onHand].map((value, index) => {
                    const calculated = value.endsWith(" calculated");
                    const shown = calculated ? value.replace(" calculated", "") : value.replace(" on file", "");
                    return (
                      <TableCell key={index} className={compact ? "px-1.5 py-1 text-right text-[13px] leading-tight whitespace-nowrap tabular-nums" : "p-2 text-right text-sm"}>
                        <span title={value} className={compact && calculated ? "italic text-muted-foreground" : undefined}>
                          {shown}
                          {compact && calculated && <span aria-hidden className="ml-0.5 text-[9px] not-italic">≈</span>}
                        </span>
                      </TableCell>
                    );
                  })}
                  <TableCell className={compact ? "px-1.5 py-1 text-center" : "p-2 text-center"}>
                    <Switch
                      checked={on[row.sku] ?? row.published}
                      onCheckedChange={(checked) => setOn({ ...on, [row.sku]: checked })}
                    />
                  </TableCell>
                  <TableCell className={compact ? "px-1.5 py-1" : "p-2"}>
                    <Badge variant={row.status === "approved" ? "default" : "secondary"} className={compact ? "px-1 py-0 text-[10px] font-normal" : "text-xs"}>
                      {row.status}
                    </Badge>
                  </TableCell>
                  <TableCell className={compact ? "px-1.5 py-1 text-center" : "p-2"}>
                    <Button size="icon" variant="ghost" className={compact ? "h-6 w-6" : "h-8 w-8"}>
                      <Upload className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
