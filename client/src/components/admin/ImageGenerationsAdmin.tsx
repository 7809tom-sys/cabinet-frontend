import { useState } from "react";
import { ImageGenerationsReport } from "@/components/imageCustomer/ImageGenerationsReport";
import { useImageGenerationProcedures } from "@/lib/imageGenerationProcedures";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

function dateInput(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export default function ImageGenerationsAdmin() {
  const today = new Date();
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - 30);
  const [from, setFrom] = useState(dateInput(start));
  const [to, setTo] = useState(dateInput(today));
  const procedures = useImageGenerationProcedures();
  const query = procedures.imageGenerations.summary.useQuery({ from, to }, { retry: false });

  if (query.isLoading) return <div className="flex justify-center py-12"><Spinner className="h-6 w-6 text-primary" /></div>;
  if (query.error || !query.data) {
    return (
      <div className="space-y-3 py-8 text-center">
        <p className="text-destructive">Couldn't load image generations{query.error ? `: ${query.error.message}` : ""}.</p>
        <Button variant="outline" size="sm" onClick={() => query.refetch()}>Retry</Button>
      </div>
    );
  }
  return (
    <ImageGenerationsReport
      summary={query.data}
      from={from}
      to={to}
      onFromChange={setFrom}
      onToChange={setTo}
    />
  );
}
