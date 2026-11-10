import { Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useCustomerOfferings } from "@/lib/useCustomerOfferings";
import { toast } from "sonner";

/** The one admin yes/no. Yes shows the customer offerings group. No hides all of it. */
export function CustomerOfferingsSwitch() {
  const offerings = useCustomerOfferings();
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2" data-testid="customer-offerings-switch">
      {offerings.visible ? <Eye className="h-4 w-4 text-emerald-600" aria-hidden /> : <EyeOff className="h-4 w-4 text-muted-foreground" aria-hidden />}
      <span className="text-sm font-medium">{offerings.visible ? "Yes" : "No"}</span>
      <Switch
        checked={offerings.visible}
        disabled={offerings.loading || offerings.saving}
        aria-label="Show the customer offerings group"
        onCheckedChange={(checked) => {
          offerings.setVisible(checked);
          toast.success(checked ? "Customer group is on" : "Customer group is off");
        }}
      />
    </div>
  );
}
