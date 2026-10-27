import { useState } from "react";
import { CRM_STAGES, CRM_STAGE_LABELS, type CrmStage } from "@shared/crm";
import { CRM_STAGE_COLORS } from "@shared/crmMailbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus } from "lucide-react";

type Lang = "en" | "es";

export function CrmStageBoard<T extends { id: number; stage: CrmStage }>({
  deals,
  lang,
  onMove,
  onQuickAdd,
  renderCard,
}: {
  deals: T[];
  lang: Lang;
  onMove: (id: number, stage: CrmStage) => void;
  onQuickAdd: (stage: CrmStage, title: string) => void;
  renderCard: (deal: T) => React.ReactNode;
}) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-3" data-testid="crm-stage-board">
      {CRM_STAGES.map((stage) => {
        const items = deals.filter((deal) => deal.stage === stage);
        return (
          <CrmStageGroup
            key={stage}
            stage={stage}
            lang={lang}
            count={items.length}
            onMove={onMove}
            onQuickAdd={onQuickAdd}
          >
            {items.map((deal) => <div key={deal.id}>{renderCard(deal)}</div>)}
          </CrmStageGroup>
        );
      })}
    </div>
  );
}

function CrmStageGroup({
  stage,
  lang,
  count,
  onMove,
  onQuickAdd,
  children,
}: {
  stage: CrmStage;
  lang: Lang;
  count: number;
  onMove: (id: number, stage: CrmStage) => void;
  onQuickAdd: (stage: CrmStage, title: string) => void;
  children: React.ReactNode;
}) {
  const [title, setTitle] = useState("");
  const [over, setOver] = useState(false);
  const color = CRM_STAGE_COLORS[stage];
  return (
    <section
      className={`min-w-[240px] w-[240px] shrink-0 rounded-xl border bg-slate-50/80 ${over ? "ring-2 ring-[#c9a227]" : "border-slate-200"}`}
      onDragOver={(event) => { event.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        const id = Number(event.dataTransfer.getData("text/deal-id"));
        if (id) onMove(id, stage);
      }}
    >
      <header className="flex items-center justify-between gap-2 rounded-t-xl px-3 py-2 text-white" style={{ backgroundColor: color }}>
        <h4 className="text-sm font-semibold">{CRM_STAGE_LABELS[stage][lang]}</h4>
        <span className="rounded-full bg-white/20 px-2 text-xs">{count}</span>
      </header>
      <div className="space-y-2 p-2 min-h-[8rem]">{children}</div>
      <form
        className="flex gap-1 border-t border-slate-200 p-2"
        onSubmit={(event) => {
          event.preventDefault();
          const next = title.trim();
          if (!next) return;
          onQuickAdd(stage, next);
          setTitle("");
        }}
      >
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={lang === "es" ? "Agregar trato" : "Quick add"}
          aria-label={`Quick add ${CRM_STAGE_LABELS[stage][lang]}`}
          className="h-8 bg-white text-xs"
        />
        <Button type="submit" size="icon" variant="outline" className="h-8 w-8 shrink-0" aria-label="Add deal">
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </form>
    </section>
  );
}
