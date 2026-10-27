import { useEffect, useState, useSyncExternalStore } from "react";
import { ATTACH_CUSTOMER_MESSAGE } from "@shared/imageCustomerLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import type { ImageCustomerOption } from "@/components/imageCustomer/imageGenerationTypes";
import { useImageGenerationProcedures } from "@/lib/imageGenerationProcedures";
import { imageCustomerPromptOpen, settleImageCustomerPrompt, subscribeImageCustomerPrompt } from "@/lib/imageCustomerPrompt";

export function ImageCustomerForm({
  options,
  searching,
  saving,
  error,
  onSearch,
  onPick,
  onQuickAdd,
  onCancel,
}: {
  options: ImageCustomerOption[];
  searching: boolean;
  saving: boolean;
  error: string | null;
  onSearch: (query: string) => void;
  onPick: (option: ImageCustomerOption) => void;
  onQuickAdd: (input: { name: string; email: string; phone: string }) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  return (
    <div className="space-y-4">
      <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); onSearch(query.trim()); }}>
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, email, or phone" aria-label="Search customers" />
        <Button type="submit" variant="outline" disabled={searching}>Search</Button>
      </form>
      <ul className="max-h-40 space-y-1 overflow-y-auto">
        {options.length === 0 ? <li className="text-sm text-muted-foreground">Search for an account or CRM contact.</li> : options.map((option) => (
          <li key={`${option.customerKind}:${option.customerId}`}>
            <button type="button" className="w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => onPick(option)}>
              <span className="font-medium">{option.name || option.email || `#${option.customerId}`}</span>
              <span className="ml-2 text-muted-foreground">{option.customerKind === "crm" ? "CRM" : "Account"}</span>
            </button>
          </li>
        ))}
      </ul>
      <form className="space-y-2 border-t pt-3" onSubmit={(event) => { event.preventDefault(); onQuickAdd({ name: name.trim(), email: email.trim(), phone: phone.trim() }); }}>
        <p className="text-sm font-medium">Or add a CRM contact</p>
        <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name" aria-label="Customer name" />
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Email" aria-label="Customer email" />
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="Phone" aria-label="Customer phone" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button type="submit" disabled={saving || name.trim().length < 2 || (!email.trim() && !phone.trim())}>Add and continue</Button>
        </DialogFooter>
      </form>
    </div>
  );
}

export function ImageCustomerDialog() {
  const open = useSyncExternalStore(subscribeImageCustomerPrompt, imageCustomerPromptOpen, () => false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const procedures = useImageGenerationProcedures();
  const search = procedures.imageGenerations.search.useQuery(
    { query },
    { enabled: open && query.trim().length > 0, retry: false },
  );
  const quickAdd = procedures.imageGenerations.quickAdd.useMutation();

  useEffect(() => {
    if (!open) {
      setQuery("");
      setError(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) settleImageCustomerPrompt(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Attach a customer</DialogTitle>
          <DialogDescription>{ATTACH_CUSTOMER_MESSAGE}</DialogDescription>
        </DialogHeader>
        <ImageCustomerForm
          options={search.data?.customers ?? []}
          searching={search.isFetching}
          saving={quickAdd.isPending}
          error={error}
          onSearch={setQuery}
          onPick={(option) => settleImageCustomerPrompt({ customerId: option.customerId, customerKind: option.customerKind })}
          onCancel={() => settleImageCustomerPrompt(null)}
          onQuickAdd={(input) => {
            setError(null);
            void quickAdd.mutateAsync({
              name: input.name,
              email: input.email || undefined,
              phone: input.phone || undefined,
            }).then((created) => {
              settleImageCustomerPrompt({ customerId: created.customerId, customerKind: "crm" });
            }).catch((reason: unknown) => {
              setError(reason instanceof Error ? reason.message : "The customer could not be saved.");
            });
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
