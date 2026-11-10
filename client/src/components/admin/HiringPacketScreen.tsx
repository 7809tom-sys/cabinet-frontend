import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  DEFAULT_WORKER_TYPE,
  EMPLOYEE_ONLY_FORMS_NOTE,
  HIRING_STATUS_LABELS,
  I9_ATTESTATION,
  I9_CITIZENSHIP,
  I9_EDITION,
  I9_LIST_A,
  I9_LIST_B,
  I9_LIST_C,
  I9_SECTION1_FIELDS,
  POLICY_ACKNOWLEDGMENT,
  STATE_FILING_STATUSES,
  STATE_WITHHOLDING_PROFILES,
  TYPED_SIGNATURE_CONSENT,
  W9_CLASSIFICATIONS,
  W9_REVISION,
  WORK_STATES,
  WORKER_TYPES,
  WT4_FILING_STATUSES,
  WT4_REVISION,
  W4_EXEMPT_STATEMENT,
  W4_FILING_STATUSES,
  W4_OTHER_DEPENDENT_AMOUNT,
  W4_QUALIFYING_CHILD_AMOUNT,
  W4_STEP5_DECLARATION,
  W4_YEAR,
  canReviewDocument,
  documentLabel,
  formsForWorker,
  maskBank,
  maskSsn,
  progressForWorker,
  stateCertificateTitle,
  visiblePackets,
  type HiringActor,
  type HiringDocumentKind,
  type HiringSettings,
  type PacketSummary,
  type PublicDocument,
  type PublicPacket,
  type WorkStateCode,
  type WorkerType,
} from "@shared/hiringPacket";

export type HiringViewer = { userId: number; role: string; name: string | null; email: string | null };

export type HiringPacketScreenProps = {
  viewer: HiringViewer;
  settings: HiringSettings;
  summaries: PacketSummary[];
  packet: PublicPacket | null;
  onSelectPacket: (packetId: number | null) => void;
  onSave: (kind: HiringDocumentKind, payload: Record<string, unknown>) => void;
  onSign: (kind: HiringDocumentKind, payload: Record<string, unknown>) => void;
  onReview: (kind: HiringDocumentKind) => void;
  onUpload: (kind: HiringDocumentKind, slot: string, file: File) => void;
  onOpenFile: (fileId: number) => void;
  onConfigure: (settings: HiringSettings) => void;
  onWorkerType: (workerType: WorkerType) => void;
  onWorkState: (workState: WorkStateCode | null) => void;
  notice?: string | null;
};

function actorOf(viewer: HiringViewer): HiringActor {
  return { userId: viewer.userId, role: viewer.role, email: viewer.email };
}

function when(value: string | null): string {
  if (!value) return "";
  return value.slice(0, 10);
}

function statusVariant(status: PublicDocument["status"]): "default" | "secondary" | "outline" {
  if (status === "reviewed" || status === "signed") return "default";
  if (status === "in_progress") return "secondary";
  return "outline";
}

function Field({ id, label, value, onChange, type = "text" }: { id: string; label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function SecretNumber({ id, label, last4, mask, onValue }: { id: string; label: string; last4: string | null; mask: (last4: string | null) => string; onValue: (value: string) => void }) {
  const [value, setValue] = useState("");
  const shown = mask(last4);
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      {shown ? <p className="text-sm font-mono" data-testid={`${id}-mask`}>{shown}</p> : null}
      <Input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        placeholder={shown ? "Enter a new number to replace it" : ""}
        onChange={(event) => {
          setValue(event.target.value);
          onValue(event.target.value);
        }}
      />
    </div>
  );
}

function Choice({ name, label, checked, onChange }: { name: string; label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-start gap-2 text-sm">
      <input type="radio" name={name} checked={checked} onChange={onChange} className="mt-1" />
      <span>{label}</span>
    </label>
  );
}

export function HiringPacketScreen(props: HiringPacketScreenProps) {
  const actor = actorOf(props.viewer);
  const admin = actor.role === "admin";
  const visible = visiblePackets(actor, props.summaries);
  const [kind, setKind] = useState<HiringDocumentKind>("application");

  return (
    <div className="space-y-6" data-testid="job-board">
      <div>
        <h2 className="font-serif text-xl font-bold">Job Board</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          {admin
            ? "Review each hire's application, Form I-9, Form W-4, state withholding, direct deposit, and handbook signature."
            : "Complete your hiring and onboarding packet. You only see your own forms."}
        </p>
      </div>
      {props.notice ? <p className="text-sm text-destructive" role="alert">{props.notice}</p> : null}
      {admin && !props.packet ? (
        <AdminList
          settings={props.settings}
          summaries={visible}
          onSelectPacket={props.onSelectPacket}
          onConfigure={props.onConfigure}
        />
      ) : null}
      {admin && props.packet ? (
        <AdminReview
          actor={actor}
          packet={props.packet}
          onBack={() => props.onSelectPacket(null)}
          onReview={props.onReview}
          onOpenFile={props.onOpenFile}
          onSaveEmployer={(payload) => props.onSave("w4", payload)}
          onWorkerType={props.onWorkerType}
          onWorkState={props.onWorkState}
        />
      ) : null}
      {!admin && props.packet ? (
        <HirePacket
          settings={props.settings}
          packet={props.packet}
          kind={kind}
          onKind={setKind}
          onSave={props.onSave}
          onSign={props.onSign}
          onUpload={props.onUpload}
          onOpenFile={props.onOpenFile}
        />
      ) : null}
      {!admin && !props.packet ? <p className="text-sm text-muted-foreground">Your packet is being prepared.</p> : null}
    </div>
  );
}

function AdminList({ settings, summaries, onSelectPacket, onConfigure }: {
  settings: HiringSettings;
  summaries: PacketSummary[];
  onSelectPacket: (packetId: number) => void;
  onConfigure: (settings: HiringSettings) => void;
}) {
  const [draft, setDraft] = useState(settings);
  return (
    <div className="space-y-6">
      <form
        className="rounded-lg border border-border p-4 space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          onConfigure(draft);
        }}
      >
        <h3 className="font-semibold">Handbook</h3>
        <p className="text-sm text-muted-foreground">Work state is chosen on each hire. Florida and Wisconsin are the only choices, and nothing is preselected.</p>
        <Field id="handbook-title" label="Handbook title" value={draft.handbookTitle} onChange={(handbookTitle) => setDraft({ ...draft, handbookTitle })} />
        <Field id="handbook-version" label="Handbook version" value={draft.handbookVersion} onChange={(handbookVersion) => setDraft({ ...draft, handbookVersion })} />
        <div className="space-y-1">
          <Label htmlFor="handbook-body">Handbook text</Label>
          <textarea id="handbook-body" className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm" value={draft.handbookBody} onChange={(event) => setDraft({ ...draft, handbookBody: event.target.value })} />
        </div>
        <Button type="submit">Save packet settings</Button>
      </form>
      <div className="space-y-3" data-testid="hiring-admin-list">
        {summaries.length === 0 ? <p className="text-sm text-muted-foreground">No hiring packets yet.</p> : null}
        {summaries.map((summary) => (
          <button
            key={summary.id}
            type="button"
            className="flex w-full items-center justify-between rounded-lg border border-border px-4 py-3 text-left hover:bg-muted/40"
            onClick={() => onSelectPacket(summary.id)}
          >
            <span>
              <span className="font-medium">{summary.applicantName || summary.applicantEmail}</span>
              <span className="block text-sm text-muted-foreground">{summary.applicantEmail}</span>
            </span>
            <span className="text-sm" data-testid={`summary-progress-${summary.id}`}>{summary.progress.signedOrReviewed} of {summary.progress.total} signed</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WorkerTypeBar({ workerType, workState, canEdit, onWorkerType, onWorkState }: {
  workerType: WorkerType;
  workState: WorkStateCode | null;
  canEdit: boolean;
  onWorkerType: (workerType: WorkerType) => void;
  onWorkState: (workState: WorkStateCode | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 rounded-lg border border-border p-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Worker type</p>
        <div role="tablist" aria-label="Worker type" data-testid="worker-type" className="inline-flex rounded-lg border border-border p-1">
          {WORKER_TYPES.map((option) => {
            const selected = workerType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={selected}
                disabled={!canEdit}
                data-testid={`worker-type-${option.value}`}
                className={`rounded-md px-4 py-2 text-sm font-medium ${selected ? "bg-[var(--color-navy)] text-white" : "text-foreground"} disabled:opacity-100`}
                onClick={() => onWorkerType(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
        {!canEdit ? <p className="text-xs text-muted-foreground">Only an administrator can change this.</p> : null}
      </div>
      <div className="space-y-1">
        <Label htmlFor="work-state">Work state</Label>
        <select
          id="work-state"
          data-testid="work-state"
          disabled={!canEdit}
          className="flex h-9 w-56 rounded-md border border-input bg-transparent px-3 text-sm disabled:opacity-100"
          value={workState ?? ""}
          onChange={(event) => onWorkState(event.target.value === "FL" || event.target.value === "WI" ? event.target.value : null)}
        >
          <option value="">Choose Florida or Wisconsin</option>
          {WORK_STATES.map((state) => <option key={state.code} value={state.code}>{state.name}</option>)}
        </select>
      </div>
    </div>
  );
}

function AdminReview({ actor, packet, onBack, onReview, onOpenFile, onSaveEmployer, onWorkerType, onWorkState }: {
  actor: HiringActor;
  packet: PublicPacket;
  onBack: () => void;
  onReview: (kind: HiringDocumentKind) => void;
  onOpenFile: (fileId: number) => void;
  onSaveEmployer: (payload: Record<string, unknown>) => void;
  onWorkerType: (workerType: WorkerType) => void;
  onWorkState: (workState: WorkStateCode | null) => void;
}) {
  const workerType = packet.workerType ?? DEFAULT_WORKER_TYPE;
  const forms = formsForWorker(workerType);
  const visibleDocuments = packet.documents.filter((document) => forms.includes(document.kind));
  const progress = progressForWorker(workerType, packet.documents);
  return (
    <div className="space-y-4" data-testid="hiring-review">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">{packet.applicantName || packet.applicantEmail}</h3>
          <p className="text-sm text-muted-foreground">{packet.applicantEmail}</p>
        </div>
        <Button type="button" variant="outline" onClick={onBack}>All hires</Button>
      </div>
      <WorkerTypeBar workerType={workerType} workState={packet.workState} canEdit onWorkerType={onWorkerType} onWorkState={onWorkState} />
      {workerType === "contractor_1099" ? <p className="text-sm text-muted-foreground" data-testid="employee-forms-note">{EMPLOYEE_ONLY_FORMS_NOTE}</p> : null}
      <Progress value={(progress.signedOrReviewed / progress.total) * 100} />
      <p data-testid="packet-progress">{progress.signedOrReviewed} of {progress.total} signed</p>
      {visibleDocuments.map((document) => {
        const review = canReviewDocument(actor, document.status);
        return (
          <article key={document.kind} className="rounded-lg border border-border p-4 space-y-2" data-testid={`review-${document.kind}`}>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-medium">{documentLabel(document.kind, packet.workState)}</h4>
              <Badge variant={statusVariant(document.status)} data-testid={`status-${document.kind}`}>{HIRING_STATUS_LABELS[document.status]}</Badge>
            </div>
            <p className="text-sm" data-testid={`signed-${document.kind}`}>
              {document.signedAt ? `Signed ${when(document.signedAt)} by ${document.signedByName}` : "Not signed"}
            </p>
            <p className="text-sm" data-testid={`reviewed-${document.kind}`}>
              {document.reviewedAt ? `Reviewed ${when(document.reviewedAt)} by ${document.reviewedByName}` : "Not reviewed"}
            </p>
            <ReviewFacts document={document} />
            {document.files.map((file) => (
              <Button key={file.id} type="button" variant="outline" size="sm" onClick={() => onOpenFile(file.id)}>
                Open {file.filename}
              </Button>
            ))}
            {review.ok ? <Button type="button" onClick={() => onReview(document.kind)}>Mark reviewed</Button> : null}
            {document.kind === "w4" ? <EmployerOnly payload={document.payload} onSave={onSaveEmployer} /> : null}
          </article>
        );
      })}
    </div>
  );
}

function ReviewFacts({ document }: { document: PublicDocument }) {
  const payload = document.payload;
  const ssn = maskSsn(typeof payload.ssnLast4 === "string" ? payload.ssnLast4 : typeof payload.tinLast4 === "string" ? payload.tinLast4 : null);
  const ein = maskSsn(typeof payload.einLast4 === "string" ? payload.einLast4 : null);
  const account = maskBank(typeof payload.accountLast4 === "string" ? payload.accountLast4 : null);
  const routing = maskBank(typeof payload.routingLast4 === "string" ? payload.routingLast4 : null);
  return (
    <div className="text-sm text-muted-foreground space-y-1">
      {ssn ? <p data-testid={`ssn-${document.kind}`}>{document.kind === "w9" ? "TIN" : "SSN"} {ssn}</p> : null}
      {ein ? <p data-testid={`ein-${document.kind}`}>EIN {ein}</p> : null}
      {account ? <p data-testid={`account-${document.kind}`}>Account {account}</p> : null}
      {routing ? <p data-testid={`routing-${document.kind}`}>Routing {routing}</p> : null}
      {typeof payload.position === "string" ? <p>Position {payload.position}</p> : null}
      {typeof payload.startDate === "string" ? <p>Start date {payload.startDate}</p> : null}
      {typeof payload.emergencyContactName === "string" ? <p>Emergency contact {payload.emergencyContactName}</p> : null}
    </div>
  );
}

function EmployerOnly({ payload, onSave }: { payload: Record<string, unknown>; onSave: (payload: Record<string, unknown>) => void }) {
  const [name, setName] = useState(typeof payload.employerNameAndAddress === "string" ? payload.employerNameAndAddress : "");
  const [start, setStart] = useState(typeof payload.firstDateOfEmployment === "string" ? payload.firstDateOfEmployment : "");
  const [ein, setEin] = useState("");
  return (
    <form
      className="grid gap-3 sm:grid-cols-2 pt-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...payload, employerNameAndAddress: name, firstDateOfEmployment: start, ...(ein ? { employerEin: ein } : {}) });
      }}
    >
      <p className="sm:col-span-2 text-sm font-medium">Employers Only</p>
      <Field id="w4-employer-name" label="Employer's name and address" value={name} onChange={setName} />
      <Field id="w4-first-date" label="First date of employment" value={start} onChange={setStart} type="date" />
      <SecretNumber id="w4-ein" label="Employer identification number (EIN)" last4={typeof payload.employerEinLast4 === "string" ? payload.employerEinLast4 : null} mask={maskSsn} onValue={setEin} />
      <div className="sm:col-span-2"><Button type="submit" variant="outline">Save employer block</Button></div>
    </form>
  );
}

function HirePacket({ settings, packet, kind, onKind, onSave, onSign, onUpload, onOpenFile }: {
  settings: HiringSettings;
  packet: PublicPacket;
  kind: HiringDocumentKind;
  onKind: (kind: HiringDocumentKind) => void;
  onSave: (kind: HiringDocumentKind, payload: Record<string, unknown>) => void;
  onSign: (kind: HiringDocumentKind, payload: Record<string, unknown>) => void;
  onUpload: (kind: HiringDocumentKind, slot: string, file: File) => void;
  onOpenFile: (fileId: number) => void;
}) {
  const workerType = packet.workerType ?? DEFAULT_WORKER_TYPE;
  const forms = formsForWorker(workerType);
  const activeKind = forms.includes(kind) ? kind : forms[0]!;
  const progress = progressForWorker(workerType, packet.documents);
  const current = packet.documents.find((document) => document.kind === activeKind);
  return (
    <div className="space-y-4" data-testid="hiring-packet">
      <WorkerTypeBar workerType={workerType} workState={packet.workState} canEdit={false} onWorkerType={() => undefined} onWorkState={() => undefined} />
      <div>
        <Progress value={(progress.signedOrReviewed / progress.total) * 100} />
        <p className="text-sm mt-2" data-testid="packet-progress">{progress.signedOrReviewed} of {progress.total} signed</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {forms.map((item) => {
          const document = packet.documents.find((row) => row.kind === item);
          return (
            <Button key={item} type="button" variant={item === activeKind ? "default" : "outline"} onClick={() => onKind(item)}>
              {documentLabel(item, packet.workState)}
              <Badge variant="secondary" className="ml-2" data-testid={`status-${item}`}>{HIRING_STATUS_LABELS[document?.status ?? "not_started"]}</Badge>
            </Button>
          );
        })}
      </div>
      {current ? (
        <DocumentForm
          key={`${packet.id}-${current.kind}`}
          settings={settings}
          workState={packet.workState}
          document={current}
          onSave={(payload) => onSave(current.kind, payload)}
          onSign={(payload) => onSign(current.kind, payload)}
          onUpload={(slot, file) => onUpload(current.kind, slot, file)}
          onOpenFile={onOpenFile}
        />
      ) : null}
    </div>
  );
}

function DocumentForm({ settings, workState, document, onSave, onSign, onUpload, onOpenFile }: {
  settings: HiringSettings;
  workState: WorkStateCode | null;
  document: PublicDocument;
  onSave: (payload: Record<string, unknown>) => void;
  onSign: (payload: Record<string, unknown>) => void;
  onUpload: (slot: string, file: File) => void;
  onOpenFile: (fileId: number) => void;
}) {
  const [draft, setDraft] = useState<Record<string, unknown>>({ ...document.payload });
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const set = (key: string, value: unknown) => setDraft((current) => ({ ...current, [key]: value }));
  const textOf = (key: string) => (typeof draft[key] === "string" ? draft[key] : "");
  const payload = () => {
    const next = { ...draft };
    for (const [key, value] of Object.entries(secrets)) {
      if (value.trim()) next[key] = value.trim();
    }
    return next;
  };
  const locked = document.status === "signed" || document.status === "reviewed";
  return (
    <form
      className="rounded-lg border border-border p-4 space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(payload());
      }}
    >
      <div className="flex items-center gap-2">
        <h3 className="font-semibold">{document.kind === "state_withholding" && workState !== "WI" ? (stateCertificateTitle(workState ? { ...settings, stateCode: workState } : settings) ?? documentLabel(document.kind, workState)) : documentLabel(document.kind, workState)}</h3>
        <Badge data-testid={`form-status-${document.kind}`}>{HIRING_STATUS_LABELS[document.status]}</Badge>
      </div>
      {document.kind === "i9_section1" ? <p className="text-xs text-muted-foreground">Form I-9, Section 1, edition {I9_EDITION}. Employee side only.</p> : null}
      {document.kind === "w4" ? <p className="text-xs text-muted-foreground">Form W-4 ({W4_YEAR}), Employee's Withholding Certificate. OMB No. 1545-0074.</p> : null}
      {document.kind === "w9" ? <p className="text-xs text-muted-foreground">Form W-9 (Rev. {W9_REVISION}), Request for Taxpayer Identification Number and Certification.</p> : null}
      {document.kind === "application" ? <ApplicationFields draft={draft} set={set} textOf={textOf} /> : null}
      {document.kind === "w9" ? <W9Fields draft={draft} set={set} textOf={textOf} secrets={secrets} setSecrets={setSecrets} /> : null}
      {document.kind === "i9_section1" ? <I9Fields draft={draft} set={set} textOf={textOf} secrets={secrets} setSecrets={setSecrets} onUpload={onUpload} /> : null}
      {document.kind === "w4" ? <W4Fields draft={draft} set={set} textOf={textOf} secrets={secrets} setSecrets={setSecrets} /> : null}
      {document.kind === "state_withholding" ? <StateFields settings={settings} workState={workState} draft={draft} set={set} textOf={textOf} secrets={secrets} setSecrets={setSecrets} /> : null}
      {document.kind === "direct_deposit" ? <DepositFields draft={draft} set={set} textOf={textOf} secrets={secrets} setSecrets={setSecrets} /> : null}
      {document.kind === "policy_acknowledgment" ? <PolicyFields settings={settings} draft={draft} set={set} textOf={textOf} /> : null}
      {document.files.map((file) => (
        <Button key={file.id} type="button" variant="outline" size="sm" onClick={() => onOpenFile(file.id)}>Open {file.filename}</Button>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={locked}>Save</Button>
        <Button type="button" disabled={locked} onClick={() => onSign(payload())}>Sign</Button>
      </div>
      {locked ? <p className="text-sm text-muted-foreground">{document.signedAt ? `Signed ${when(document.signedAt)} by ${document.signedByName}.` : null} {document.reviewedAt ? `Reviewed ${when(document.reviewedAt)} by ${document.reviewedByName}.` : null}</p> : null}
    </form>
  );
}

function ApplicationFields({ set, textOf }: FieldBind) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id="app-first" label="First name" value={textOf("firstName")} onChange={(value) => set("firstName", value)} />
      <Field id="app-middle" label="Middle name" value={textOf("middleName")} onChange={(value) => set("middleName", value)} />
      <Field id="app-last" label="Last name" value={textOf("lastName")} onChange={(value) => set("lastName", value)} />
      <Field id="app-email" label="Email" value={textOf("email")} onChange={(value) => set("email", value)} type="email" />
      <Field id="app-phone" label="Phone" value={textOf("phone")} onChange={(value) => set("phone", value)} />
      <Field id="app-address" label="Address" value={textOf("address")} onChange={(value) => set("address", value)} />
      <Field id="app-city" label="City" value={textOf("city")} onChange={(value) => set("city", value)} />
      <Field id="app-state" label="State" value={textOf("state")} onChange={(value) => set("state", value)} />
      <Field id="app-zip" label="ZIP code" value={textOf("postalCode")} onChange={(value) => set("postalCode", value)} />
      <Field id="app-position" label="Position" value={textOf("position")} onChange={(value) => set("position", value)} />
      <Field id="app-start" label="Start date" value={textOf("startDate")} onChange={(value) => set("startDate", value)} type="date" />
      <Field id="app-emergency-name" label="Emergency contact name" value={textOf("emergencyContactName")} onChange={(value) => set("emergencyContactName", value)} />
      <Field id="app-emergency-relationship" label="Emergency contact relationship" value={textOf("emergencyContactRelationship")} onChange={(value) => set("emergencyContactRelationship", value)} />
      <Field id="app-emergency-phone" label="Emergency contact phone" value={textOf("emergencyContactPhone")} onChange={(value) => set("emergencyContactPhone", value)} />
      <Field id="app-signature" label="Signature (type your legal name)" value={textOf("employeeSignature")} onChange={(value) => set("employeeSignature", value)} />
      <Field id="app-signature-date" label="Date" value={textOf("signatureDate")} onChange={(value) => set("signatureDate", value)} type="date" />
      <p className="sm:col-span-2 text-xs text-muted-foreground">{TYPED_SIGNATURE_CONSENT}</p>
    </div>
  );
}

type FieldBind = {
  draft: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
  textOf: (key: string) => string;
};

function I9Fields({ draft, set, textOf, secrets, setSecrets, onUpload }: FieldBind & { secrets: Record<string, string>; setSecrets: (next: Record<string, string>) => void; onUpload: (slot: string, file: File) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {I9_SECTION1_FIELDS.filter((field) => field.key !== "ssn").map((field) => (
          <Field key={field.key} id={`i9-${field.key}`} label={field.label} type={field.key === "dateOfBirth" ? "date" : "text"} value={textOf(field.key)} onChange={(value) => set(field.key, value)} />
        ))}
        <SecretNumber id="i9-ssn" label="U.S. Social Security Number" last4={typeof draft.ssnLast4 === "string" ? draft.ssnLast4 : null} mask={maskSsn} onValue={(ssn) => setSecrets({ ...secrets, ssn })} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Citizenship or immigration status</legend>
        <p className="text-xs text-muted-foreground">{I9_ATTESTATION}</p>
        {I9_CITIZENSHIP.map((item) => (
          <Choice key={item.value} name="i9-citizenship" label={item.label} checked={draft.citizenshipStatus === item.value} onChange={() => set("citizenshipStatus", item.value)} />
        ))}
      </fieldset>
      {draft.citizenshipStatus === "lawful_permanent_resident" ? <Field id="i9-anumber" label="USCIS or A-Number" value={textOf("uscisANumber")} onChange={(value) => set("uscisANumber", value)} /> : null}
      {draft.citizenshipStatus === "noncitizen_authorized" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="i9-expiration" label="Authorized to work until (mm/dd/yyyy, or N/A)" value={textOf("workAuthorizationExpiration")} onChange={(value) => set("workAuthorizationExpiration", value)} />
          <Field id="i9-anumber-4" label="USCIS A-Number" value={textOf("uscisANumber")} onChange={(value) => set("uscisANumber", value)} />
          <Field id="i9-i94" label="Form I-94 Admission Number" value={textOf("i94AdmissionNumber")} onChange={(value) => set("i94AdmissionNumber", value)} />
          <Field id="i9-passport" label="Foreign Passport Number" value={textOf("foreignPassportNumber")} onChange={(value) => set("foreignPassportNumber", value)} />
          <Field id="i9-country" label="Country of Issuance" value={textOf("foreignPassportCountry")} onChange={(value) => set("foreignPassportCountry", value)} />
        </div>
      ) : null}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Lists of Acceptable Documents</legend>
        <Choice name="i9-list" label="List A — one document for identity and employment authorization" checked={draft.documentList === "A"} onChange={() => set("documentList", "A")} />
        <Choice name="i9-list" label="List B and List C — one identity document and one employment authorization document" checked={draft.documentList === "BC"} onChange={() => set("documentList", "BC")} />
        {draft.documentList === "A" ? <DocumentSelect id="i9-list-a" label="List A document" options={I9_LIST_A} value={textOf("listACode")} onChange={(value) => set("listACode", value)} /> : null}
        {draft.documentList === "BC" ? (
          <>
            <DocumentSelect id="i9-list-b" label="List B document" options={I9_LIST_B} value={textOf("listBCode")} onChange={(value) => set("listBCode", value)} />
            <DocumentSelect id="i9-list-c" label="List C document" options={I9_LIST_C} value={textOf("listCCode")} onChange={(value) => set("listCCode", value)} />
          </>
        ) : null}
      </fieldset>
      {draft.documentList === "A" ? <UploadSlot id="i9-upload-list-a" label="Upload the List A document" onFile={(file) => onUpload("list_a", file)} /> : null}
      {draft.documentList === "BC" ? (
        <>
          <UploadSlot id="i9-upload-list-b" label="Upload the List B document" onFile={(file) => onUpload("list_b", file)} />
          <UploadSlot id="i9-upload-list-c" label="Upload the List C document" onFile={(file) => onUpload("list_c", file)} />
        </>
      ) : null}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={draft.preparerAssisted === true} onChange={(event) => set("preparerAssisted", event.target.checked)} />
        <span>A preparer and/or translator assisted me. They must complete Supplement A.</span>
      </label>
      {draft.preparerAssisted === true ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="i9-preparer-first" label="Preparer or Translator First Name" value={textOf("preparerFirstName")} onChange={(value) => set("preparerFirstName", value)} />
          <Field id="i9-preparer-last" label="Preparer or Translator Last Name" value={textOf("preparerLastName")} onChange={(value) => set("preparerLastName", value)} />
          <Field id="i9-preparer-signature" label="Signature of Preparer or Translator" value={textOf("preparerSignature")} onChange={(value) => set("preparerSignature", value)} />
          <Field id="i9-preparer-date" label="Date (mm/dd/yyyy)" value={textOf("preparerDate")} onChange={(value) => set("preparerDate", value)} type="date" />
        </div>
      ) : null}
      <Field id="i9-signature" label="Signature of Employee" value={textOf("employeeSignature")} onChange={(value) => set("employeeSignature", value)} />
      <Field id="i9-signature-date" label="Today's Date (mm/dd/yyyy)" value={textOf("signatureDate")} onChange={(value) => set("signatureDate", value)} type="date" />
    </div>
  );
}

function DocumentSelect({ id, label, options, value, onChange }: { id: string; label: string; options: readonly { code: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select a document</option>
        {options.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
      </select>
    </div>
  );
}

function UploadSlot({ id, label, onFile }: { id: string; label: string; onFile: (file: File) => void }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <input
        id={id}
        data-testid={id}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
        }}
      />
    </div>
  );
}

function W4Fields({ draft, set, textOf, secrets, setSecrets }: FieldBind & { secrets: Record<string, string>; setSecrets: (next: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium">Step 1: Enter Personal Information</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="w4-first" label="(a) First name and middle initial" value={textOf("firstNameAndMiddleInitial")} onChange={(value) => set("firstNameAndMiddleInitial", value)} />
        <Field id="w4-last" label="Last name" value={textOf("lastName")} onChange={(value) => set("lastName", value)} />
        <Field id="w4-address" label="Address" value={textOf("address")} onChange={(value) => set("address", value)} />
        <Field id="w4-city" label="City or town, state, and ZIP code" value={textOf("cityStateZip")} onChange={(value) => set("cityStateZip", value)} />
        <SecretNumber id="w4-ssn" label="(b) Social security number" last4={typeof draft.ssnLast4 === "string" ? draft.ssnLast4 : null} mask={maskSsn} onValue={(ssn) => setSecrets({ ...secrets, ssn })} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">(c) Filing status</legend>
        {W4_FILING_STATUSES.map((item) => (
          <Choice key={item.value} name="w4-filing" label={item.label} checked={draft.filingStatus === item.value} onChange={() => set("filingStatus", item.value)} />
        ))}
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Step 2: Multiple Jobs or Spouse Works</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={draft.step2cTwoJobs === true} onChange={(event) => set("step2cTwoJobs", event.target.checked)} />
          <span>(c) If there are only two jobs total, you may check this box.</span>
        </label>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Step 3: Claim Dependent and Other Credits</legend>
        <Field id="w4-3a" label={`(a) Multiply the number of qualifying children under age 17 by $${W4_QUALIFYING_CHILD_AMOUNT.toLocaleString("en-US")}`} value={textOf("step3a")} onChange={(value) => set("step3a", value)} />
        <Field id="w4-3b" label={`(b) Multiply the number of other dependents by $${W4_OTHER_DEPENDENT_AMOUNT.toLocaleString("en-US")}`} value={textOf("step3b")} onChange={(value) => set("step3b", value)} />
        <Field id="w4-3" label="3. Add the amounts from Steps 3(a) and 3(b), plus the amount for other credits" value={textOf("step3")} onChange={(value) => set("step3", value)} />
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Step 4: Other Adjustments</legend>
        <Field id="w4-4a" label="(a) Other income (not from jobs)" value={textOf("step4a")} onChange={(value) => set("step4a", value)} />
        <Field id="w4-4b" label="(b) Deductions" value={textOf("step4b")} onChange={(value) => set("step4b", value)} />
        <Field id="w4-4c" label="(c) Extra withholding" value={textOf("step4c")} onChange={(value) => set("step4c", value)} />
      </fieldset>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={draft.exemptFromWithholding === true} onChange={(event) => set("exemptFromWithholding", event.target.checked)} />
        <span>{W4_EXEMPT_STATEMENT}</span>
      </label>
      <p className="text-sm font-medium">Step 5: Sign Here</p>
      <p className="text-xs text-muted-foreground">{W4_STEP5_DECLARATION}</p>
      <Field id="w4-signature" label="Employee's signature (This form is not valid unless you sign it.)" value={textOf("employeeSignature")} onChange={(value) => set("employeeSignature", value)} />
      <Field id="w4-date" label="Date" value={textOf("signatureDate")} onChange={(value) => set("signatureDate", value)} type="date" />
    </div>
  );
}

function W9Fields({ draft, set, textOf, secrets, setSecrets }: FieldBind & { secrets: Record<string, string>; setSecrets: (next: Record<string, string>) => void }) {
  const tinIsEin = draft.tinType === "ein";
  return (
    <div className="space-y-4">
      <Field id="w9-name" label="1 Name of entity/individual. An entry is required." value={textOf("name")} onChange={(value) => set("name", value)} />
      <Field id="w9-business" label="2 Business name/disregarded entity name, if different from above" value={textOf("businessName")} onChange={(value) => set("businessName", value)} />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">3a Federal tax classification. Check only one of the following seven boxes.</legend>
        {W9_CLASSIFICATIONS.map((item) => (
          <Choice key={item.value} name="w9-class" label={item.label} checked={draft.taxClassification === item.value} onChange={() => set("taxClassification", item.value)} />
        ))}
      </fieldset>
      {draft.taxClassification === "llc" ? <Field id="w9-llc" label="LLC tax classification (C, S, or P)" value={textOf("llcClassification")} onChange={(value) => set("llcClassification", value.toUpperCase())} /> : null}
      {draft.taxClassification === "other" ? <Field id="w9-other" label="Other (see instructions)" value={textOf("otherClassification")} onChange={(value) => set("otherClassification", value)} /> : null}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={draft.foreignOwners === true} onChange={(event) => set("foreignOwners", event.target.checked)} />
        <span>3b If you checked Partnership, Trust/estate, or LLC classified as P, check here if you have any foreign partners, owners, or beneficiaries.</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="w9-exempt" label="4 Exempt payee code (if any)" value={textOf("exemptPayeeCode")} onChange={(value) => set("exemptPayeeCode", value)} />
        <Field id="w9-fatca" label="Exemption from FATCA reporting code (if any)" value={textOf("fatcaCode")} onChange={(value) => set("fatcaCode", value)} />
        <Field id="w9-address" label="5 Address (number, street, and apt. or suite no.)" value={textOf("address")} onChange={(value) => set("address", value)} />
        <Field id="w9-city" label="6 City, state, and ZIP code" value={textOf("cityStateZip")} onChange={(value) => set("cityStateZip", value)} />
        <Field id="w9-requester" label="Requester's name and address (optional)" value={textOf("requesterNameAddress")} onChange={(value) => set("requesterNameAddress", value)} />
        <Field id="w9-accounts" label="7 List account number(s) here (optional)" value={textOf("accountNumbers")} onChange={(value) => set("accountNumbers", value)} />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Part I Taxpayer Identification Number (TIN)</legend>
        <Choice name="w9-tin" label="Social security number" checked={!tinIsEin} onChange={() => set("tinType", "ssn")} />
        <Choice name="w9-tin" label="Employer identification number" checked={tinIsEin} onChange={() => set("tinType", "ein")} />
        {tinIsEin ? (
          <SecretNumber id="w9-ein" label="Employer identification number" last4={typeof draft.einLast4 === "string" ? draft.einLast4 : null} mask={maskSsn} onValue={(ein) => setSecrets({ ...secrets, ein })} />
        ) : (
          <SecretNumber id="w9-ssn" label="Social security number" last4={typeof draft.ssnLast4 === "string" ? draft.ssnLast4 : typeof draft.tinLast4 === "string" ? draft.tinLast4 : null} mask={maskSsn} onValue={(ssn) => setSecrets({ ...secrets, ssn })} />
        )}
      </fieldset>
      <p className="text-xs text-muted-foreground">Under penalties of perjury, I certify that the number shown is my correct taxpayer identification number, that I am not subject to backup withholding unless I say so below, that I am a U.S. citizen or other U.S. person, and that the FATCA code entered on this form (if any) is correct.</p>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={draft.backupWithholding === true} onChange={(event) => set("backupWithholding", event.target.checked)} />
        <span>Cross out certification item 2. The IRS has notified me that I am currently subject to backup withholding.</span>
      </label>
      <Field id="w9-signature" label="Signature of U.S. person" value={textOf("employeeSignature")} onChange={(value) => set("employeeSignature", value)} />
      <Field id="w9-date" label="Date" value={textOf("signatureDate")} onChange={(value) => set("signatureDate", value)} type="date" />
    </div>
  );
}

function Wt4Fields({ draft, set, textOf, secrets, setSecrets }: FieldBind & { secrets: Record<string, string>; setSecrets: (next: Record<string, string>) => void }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">Employee's Wisconsin Withholding Exemption Certificate, Form WT-4, {WT4_REVISION}.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="wt4-name" label="Employee's legal name (first name, middle initial, last name)" value={textOf("legalName")} onChange={(value) => set("legalName", value)} />
        <SecretNumber id="wt4-ssn" label="Social security number" last4={typeof draft.ssnLast4 === "string" ? draft.ssnLast4 : null} mask={maskSsn} onValue={(ssn) => setSecrets({ ...secrets, ssn })} />
        <Field id="wt4-address" label="Employee's address (number and street)" value={textOf("address")} onChange={(value) => set("address", value)} />
        <Field id="wt4-city" label="City" value={textOf("city")} onChange={(value) => set("city", value)} />
        <Field id="wt4-state" label="State" value={textOf("residenceState")} onChange={(value) => set("residenceState", value)} />
        <Field id="wt4-zip" label="ZIP code" value={textOf("postalCode")} onChange={(value) => set("postalCode", value)} />
        <Field id="wt4-dob" label="Date of birth" value={textOf("dateOfBirth")} onChange={(value) => set("dateOfBirth", value)} type="date" />
        <Field id="wt4-hire" label="Date of hire" value={textOf("dateOfHire")} onChange={(value) => set("dateOfHire", value)} type="date" />
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Filing status</legend>
        {WT4_FILING_STATUSES.map((item) => (
          <Choice key={item.value} name="wt4-filing" label={item.label} checked={draft.filingStatus === item.value} onChange={() => set("filingStatus", item.value)} />
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="wt4-1a" label="1(a) Exemption for yourself — enter 1" value={textOf("line1a")} onChange={(value) => set("line1a", value)} />
        <Field id="wt4-1b" label="1(b) Exemption for your spouse — enter 1" value={textOf("line1b")} onChange={(value) => set("line1b", value)} />
        <Field id="wt4-1c" label="1(c) Exemption(s) for dependent(s)" value={textOf("line1c")} onChange={(value) => set("line1c", value)} />
        <Field id="wt4-1d" label="1(d) Total — add lines (a) through (c)" value={textOf("line1d")} onChange={(value) => set("line1d", value)} />
        <Field id="wt4-2" label="2 Additional amount per pay period you want deducted" value={textOf("line2")} onChange={(value) => set("line2", value)} />
        <Field id="wt4-3" label="3 I claim complete exemption from withholding. Enter Exempt" value={textOf("line3")} onChange={(value) => set("line3", value)} />
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={draft.wt4Certified === true} onChange={(event) => set("wt4Certified", event.target.checked)} />
        <span>I certify that the number of withholding exemptions claimed on this certificate does not exceed the number to which I am entitled. If claiming complete exemption, I certify that I incurred no Wisconsin income tax liability last year and that I anticipate none this year.</span>
      </label>
      <Field id="wt4-signature" label="Signature" value={textOf("employeeSignature")} onChange={(value) => set("employeeSignature", value)} />
      <Field id="wt4-date" label="Date signed" value={textOf("signatureDate")} onChange={(value) => set("signatureDate", value)} type="date" />
    </div>
  );
}

function StateFields({ settings, workState, draft, set, textOf, secrets, setSecrets }: FieldBind & { settings: HiringSettings; workState: WorkStateCode | null; secrets: Record<string, string>; setSecrets: (next: Record<string, string>) => void }) {
  if (workState === "WI") return <Wt4Fields draft={draft} set={set} textOf={textOf} secrets={secrets} setSecrets={setSecrets} />;
  const effective = workState ? { ...settings, stateCode: workState } : settings;
  const title = stateCertificateTitle(effective);
  if (!title) return <p data-testid="state-unset">An administrator has not chosen the state withholding certificate yet.</p>;
  const profile = STATE_WITHHOLDING_PROFILES.find((item) => item.code === effective.stateCode);
  if (profile && !profile.wagesWithheld) {
    return (
      <div className="space-y-3">
        <p>{title}.</p>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={draft.noWageWithholdingAcknowledged === true} onChange={(event) => set("noWageWithholdingAcknowledged", event.target.checked)} />
          <span>I understand {profile.name} does not withhold income tax on wages.</span>
        </label>
        <Field id="state-signature" label="Signature" value={textOf("employeeSignature")} onChange={(value) => set("employeeSignature", value)} />
        <Field id="state-date" label="Date" value={textOf("signatureDate")} onChange={(value) => set("signatureDate", value)} type="date" />
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <p className="sm:col-span-2 text-sm">{title}</p>
      <Field id="state-name" label="Employee name" value={textOf("employeeName")} onChange={(value) => set("employeeName", value)} />
      <SecretNumber id="state-ssn" label="Social Security number" last4={typeof draft.ssnLast4 === "string" ? draft.ssnLast4 : null} mask={maskSsn} onValue={(ssn) => setSecrets({ ...secrets, ssn })} />
      <Field id="state-address" label="Home address" value={textOf("address")} onChange={(value) => set("address", value)} />
      <Field id="state-city" label="City" value={textOf("city")} onChange={(value) => set("city", value)} />
      <Field id="state-residence" label="State" value={textOf("residenceState")} onChange={(value) => set("residenceState", value)} />
      <Field id="state-zip" label="ZIP code" value={textOf("postalCode")} onChange={(value) => set("postalCode", value)} />
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor="state-filing">Filing status</Label>
        <select id="state-filing" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={textOf("filingStatus")} onChange={(event) => set("filingStatus", event.target.value)}>
          <option value="">Select filing status</option>
          {STATE_FILING_STATUSES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <Field id="state-allowances" label="Withholding allowances" value={textOf("allowances")} onChange={(value) => set("allowances", value)} />
      <Field id="state-extra" label="Additional amount to withhold each pay period" value={textOf("additionalWithholding")} onChange={(value) => set("additionalWithholding", value)} />
      <label className="sm:col-span-2 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={draft.exempt === true} onChange={(event) => set("exempt", event.target.checked)} />
        <span>I claim exemption from withholding.</span>
      </label>
      <Field id="state-signature" label="Signature" value={textOf("employeeSignature")} onChange={(value) => set("employeeSignature", value)} />
      <Field id="state-date" label="Date" value={textOf("signatureDate")} onChange={(value) => set("signatureDate", value)} type="date" />
    </div>
  );
}

function DepositFields({ draft, set, textOf, secrets, setSecrets }: FieldBind & { secrets: Record<string, string>; setSecrets: (next: Record<string, string>) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field id="deposit-name" label="Name on the account" value={textOf("accountHolderName")} onChange={(value) => set("accountHolderName", value)} />
      <Field id="deposit-bank" label="Bank name" value={textOf("bankName")} onChange={(value) => set("bankName", value)} />
      <div className="space-y-1">
        <Label htmlFor="deposit-type">Account type</Label>
        <select id="deposit-type" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={textOf("accountType")} onChange={(event) => set("accountType", event.target.value)}>
          <option value="">Select</option>
          <option value="checking">Checking</option>
          <option value="savings">Savings</option>
        </select>
      </div>
      <SecretNumber id="deposit-routing" label="Routing number" last4={typeof draft.routingLast4 === "string" ? draft.routingLast4 : null} mask={maskBank} onValue={(routingNumber) => setSecrets({ ...secrets, routingNumber })} />
      <SecretNumber id="deposit-account" label="Account number" last4={typeof draft.accountLast4 === "string" ? draft.accountLast4 : null} mask={maskBank} onValue={(accountNumber) => setSecrets({ ...secrets, accountNumber })} />
      <div className="space-y-1">
        <Label htmlFor="deposit-amount-type">What to deposit</Label>
        <select id="deposit-amount-type" className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm" value={textOf("depositType")} onChange={(event) => set("depositType", event.target.value)}>
          <option value="">Select</option>
          <option value="entire_net_pay">Entire net pay</option>
          <option value="fixed">Fixed amount</option>
          <option value="percent">Percent</option>
        </select>
      </div>
      {draft.depositType === "fixed" ? <Field id="deposit-amount" label="Amount" value={textOf("depositAmount")} onChange={(value) => set("depositAmount", value)} /> : null}
      {draft.depositType === "percent" ? <Field id="deposit-percent" label="Percent" value={textOf("depositPercent")} onChange={(value) => set("depositPercent", value)} /> : null}
      <label className="sm:col-span-2 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={draft.authorize === true} onChange={(event) => set("authorize", event.target.checked)} />
        <span>I authorize CabinetDealz to deposit my pay into this account and to correct any deposit made in error.</span>
      </label>
      <Field id="deposit-signature" label="Signature (type your legal name)" value={textOf("employeeSignature")} onChange={(value) => set("employeeSignature", value)} />
      <Field id="deposit-date" label="Date" value={textOf("signatureDate")} onChange={(value) => set("signatureDate", value)} type="date" />
      <p className="sm:col-span-2 text-xs text-muted-foreground">{TYPED_SIGNATURE_CONSENT}</p>
    </div>
  );
}

function PolicyFields({ settings, draft, set, textOf }: FieldBind & { settings: HiringSettings }) {
  const published = Boolean(settings.handbookBody.trim() && settings.handbookVersion.trim());
  return (
    <div className="space-y-3">
      <p className="font-medium">{settings.handbookTitle}{settings.handbookVersion ? ` — version ${settings.handbookVersion}` : ""}</p>
      {published ? <div className="max-h-48 overflow-auto rounded-md border border-border p-3 text-sm whitespace-pre-wrap">{settings.handbookBody}</div> : <p>An administrator has not published the handbook yet.</p>}
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={draft.agreed === true} onChange={(event) => { set("agreed", event.target.checked); set("handbookVersion", settings.handbookVersion); }} />
        <span>{POLICY_ACKNOWLEDGMENT}</span>
      </label>
      <Field id="policy-signature" label="Type your full legal name to sign" value={textOf("employeeSignature")} onChange={(value) => set("employeeSignature", value)} />
      <Field id="policy-date" label="Date" value={textOf("signatureDate")} onChange={(value) => set("signatureDate", value)} type="date" />
    </div>
  );
}
