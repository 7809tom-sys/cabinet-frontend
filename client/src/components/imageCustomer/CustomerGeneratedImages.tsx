import { useState } from "react";
import type { CustomerGeneratedImage } from "@/components/imageCustomer/imageGenerationTypes";
import { useImageGenerationProcedures } from "@/lib/imageGenerationProcedures";

function when(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function CustomerGeneratedImagesList({
  schemaReady,
  images,
}: {
  schemaReady: boolean;
  images: CustomerGeneratedImage[];
}) {
  if (!schemaReady) {
    return <p className="text-xs text-muted-foreground">Image history is not installed yet.</p>;
  }
  if (images.length === 0) {
    return <p className="text-xs text-muted-foreground">No generated images for this customer yet.</p>;
  }
  return (
    <ul className="space-y-2">
      {images.map((image) => (
        <li key={image.id} className="flex gap-2 rounded-md border p-2">
          {image.imageUrl ? (
            <img src={image.imageUrl} alt={image.imageType} className="h-14 w-14 rounded object-cover" />
          ) : (
            <div className="h-14 w-14 rounded bg-muted" />
          )}
          <div className="min-w-0 text-xs">
            <p className="font-medium">{image.imageType} · {image.status}</p>
            <p className="text-muted-foreground">{when(image.createdAt)}{image.orderId ? ` · order ${image.orderId}` : ""}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function CustomerGeneratedImages({
  customerId,
  customerKind,
  title = "Generated images",
}: {
  customerId: number;
  customerKind: "user" | "crm";
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details
      className="text-sm"
      onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer text-primary">{title}</summary>
      {open ? <CustomerGeneratedImagesQuery customerId={customerId} customerKind={customerKind} /> : null}
    </details>
  );
}

function CustomerGeneratedImagesQuery({
  customerId,
  customerKind,
}: {
  customerId: number;
  customerKind: "user" | "crm";
}) {
  const procedures = useImageGenerationProcedures();
  const query = procedures.imageGenerations.forCustomer.useQuery(
    { customerId, customerKind },
    { enabled: true, retry: false },
  );
  if (query.isLoading) return <p className="text-xs text-muted-foreground mt-2">Loading images…</p>;
  if (query.error) return <p className="text-xs text-destructive mt-2">{query.error.message}</p>;
  return (
    <div className="mt-2">
      <CustomerGeneratedImagesList
        schemaReady={query.data?.schemaReady ?? false}
        images={query.data?.images ?? []}
      />
    </div>
  );
}
