import { useState } from "react";
import { auditWalzcraftDoor, type AuditStyle, type PercentNote } from "@shared/walzcraftDoorAudit";
import { readApprovals, writeApproval, type ApprovalState } from "@shared/walzcraftDistributorMatches";

const STEPS = ["Profile", "Color and features", "Approve"] as const;

function PercentLine({ item }: { item: PercentNote }) {
  return (
    <li className="rounded border border-border bg-white px-2 py-1 text-xs">
      <span className="font-semibold">{item.label}:</span>{" "}
      {item.pct == null ? "not scored" : `${item.pct}%`}
      {item.estimated ? " estimated" : ""}
      <span className="mt-0.5 block text-muted-foreground">{item.note}</span>
    </li>
  );
}

/**
 * Audit a new door against WalzCraft. Render this only on the door editor.
 * The designer, the wall section, and the closet do not mount it.
 */
export function DoorEditorWalzAudit({ style }: { style: AuditStyle & { id?: number | null } }) {
  const report = auditWalzcraftDoor(style);
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState(0);
  const [approval, setApproval] = useState<ApprovalState | null>(() => {
    if (!report.door) return null;
    return readApprovals()[report.door.id] ?? null;
  });
  const profile = report.profiles[picked] ?? report.profiles[0] ?? null;

  const approve = (next: ApprovalState) => {
    if (!report.door) return;
    const value = approval === next ? null : next;
    writeApproval(report.door.id, value);
    setApproval(value);
  };

  return (
    <section data-testid="door-editor-walzcraft-audit" className="space-y-2 rounded-lg border border-[#d7a46c] bg-[#fffdf9] px-3 py-3 text-[#244338]">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide">WalzCraft audit</h3>
        <p className="text-xs text-muted-foreground">Match a new door to a WalzCraft profile, check the color and features, then approve. This stays on the door editor.</p>
      </div>
      <ol className="flex gap-2 text-[11px] font-semibold">
        {STEPS.map((label, index) => (
          <li key={label} className={index === step ? "text-[#244338]" : "text-[#244338]/50"}>{index + 1}. {label}</li>
        ))}
      </ol>
      {step === 0 && (
        <div data-testid="walz-audit-profiles" className="space-y-1">
          {!report.door && <p className="text-xs">No WalzCraft door matches this distributor and name yet.</p>}
          {report.door && !report.exact && <p className="text-xs italic">Closest sheet row. It is a candidate until you approve it.</p>}
          {report.profiles.map((item, index) => (
            <button
              key={`${item.rank}-${item.name}`}
              type="button"
              data-testid={`walz-audit-profile-${item.rank}`}
              onClick={() => setPicked(index)}
              className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left text-xs ${index === picked ? "border-[#d7a46c] bg-white" : "border-[#244338]/20"}`}
            >
              <span>{item.name}{item.code ? ` · ${item.code}` : ""}</span>
              <span>{item.pct}% profile match</span>
            </button>
          ))}
        </div>
      )}
      {step === 1 && (
        <ul data-testid="walz-audit-probabilities" className="space-y-1">
          <PercentLine item={report.color} />
          {report.features.map((item) => <PercentLine key={item.label} item={item} />)}
          {profile && <li className="text-xs">Selected profile {profile.name}: {profile.pct}% from the sheet.</li>}
        </ul>
      )}
      {step === 2 && (
        <div data-testid="walz-audit-approve" className="flex flex-wrap items-center gap-2">
          <button type="button" data-testid="walz-audit-approve-button" onClick={() => approve("approved")} className={`rounded px-3 py-1 text-sm font-semibold ${approval === "approved" ? "bg-[#244338] text-[#fffdf9]" : "border-2 border-[#244338]"}`}>
            {approval === "approved" ? "Approved" : "Approve"}
          </button>
          <button type="button" data-testid="walz-audit-reject-button" onClick={() => approve("rejected")} className={`rounded px-3 py-1 text-sm font-semibold ${approval === "rejected" ? "bg-[#d7a46c]" : "border-2 border-[#d7a46c]"}`}>
            {approval === "rejected" ? "Rejected" : "Reject"}
          </button>
          <span className="text-xs italic text-[#244338]/70">Saved in this browser only.</span>
        </div>
      )}
      <div className="flex gap-2">
        {step > 0 && <button type="button" className="rounded border px-2 py-1 text-xs" onClick={() => setStep((value) => value - 1)}>Back</button>}
        {step < 2 && <button type="button" data-testid="walz-audit-next" className="rounded border border-[#244338] px-2 py-1 text-xs font-semibold" onClick={() => setStep((value) => value + 1)}>Next</button>}
      </div>
    </section>
  );
}
