import { useMemo, useState } from "react";
import { WalzProfileSvg, formatInches } from "@/components/walzcraft/WalzProfileSvg";
import {
  rankProfiles,
  rankShades,
  GLAZE_OPTIONS,
  drawerFrontFor,
  stepsFor,
  WALZCRAFT_PROFILE_TEMPLATES,
  type DoorType,
  type GlazeOption,
  type CabinetZone,
  type Step,
  type WalzProfileTemplate,
  type DrawerFrontSpec,
} from "@shared/walzcraftDoorTemplates";

// NOTE: Shaker doors use the separate DL Shaker blueprint
// (docs/rules/SHAKER_DOOR_RULE.md + shared/shakerDoorBlueprint.ts).
// This picker is WalzCraft raised-panel / five-piece only.

const STEP_LABELS: Record<Step, string> = {
  type: "Door type",
  profile: "Profile",
  shade: "Shade color",
  glaze: "Glaze",
  drawers: "Drawer fronts",
  review: "Review",
};

interface PickerState {
  doorType: DoorType;
  profileId: string | null;
  shadeId: string | null;
  glaze: Record<string, GlazeOption>;
  drawerOverride: Record<CabinetZone, "match" | "slab">;
}

const INITIAL_STATE: PickerState = {
  doorType: "five-piece",
  profileId: null,
  shadeId: null,
  glaze: {},
  drawerOverride: { wall: "match", base: "match" },
};

function SlabIcon({ selected }: { selected: boolean }) {
  return (
    <svg viewBox="0 0 80 60" className="h-16 w-20" aria-hidden="true">
      <rect
        x="6"
        y="6"
        width="68"
        height="48"
        fill="#fffdf9"
        stroke={selected ? "#d7a46c" : "#244338"}
        strokeWidth="2"
      />
    </svg>
  );
}

function FivePieceIcon({ selected }: { selected: boolean }) {
  const stroke = selected ? "#d7a46c" : "#244338";
  return (
    <svg viewBox="0 0 80 60" className="h-16 w-20" aria-hidden="true">
      <rect x="6" y="6" width="68" height="48" fill="#fffdf9" stroke={stroke} strokeWidth="2" />
      <rect x="18" y="16" width="44" height="28" fill="#f6f3ed" stroke={stroke} strokeWidth="1.5" />
    </svg>
  );
}

function DoorElevation({
  shadeHex,
  doorType,
  className,
}: {
  shadeHex: string;
  doorType: DoorType;
  className?: string;
}) {
  if (doorType === "slab") {
    return (
      <svg viewBox="0 0 120 180" className={className} aria-hidden="true">
        <rect x="4" y="4" width="112" height="172" fill={shadeHex} stroke="#244338" strokeWidth="2" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 180" className={className} aria-hidden="true">
      <rect x="4" y="4" width="112" height="172" fill={shadeHex} stroke="#244338" strokeWidth="2" />
      <rect x="22" y="22" width="76" height="136" fill={shadeHex} stroke="#244338" strokeWidth="1.5" />
      <rect x="30" y="30" width="60" height="120" fill={shadeHex} stroke="#244338" strokeWidth="1" opacity="0.85" />
    </svg>
  );
}

export default function WalzCraftDoorPicker() {
  const [state, setState] = useState<PickerState>(INITIAL_STATE);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(() => stepsFor(state.doorType), [state.doorType]);
  const activeStep: Step = steps[Math.min(stepIndex, steps.length - 1)] ?? "type";

  const rankedProfiles = useMemo(() => rankProfiles(WALZCRAFT_PROFILE_TEMPLATES, 4), []);
  const rankedShades = useMemo(() => rankShades(4, state.doorType), [state.doorType]);

  const selectedTemplate: WalzProfileTemplate | null = useMemo(() => {
    if (!state.profileId) return null;
    return WALZCRAFT_PROFILE_TEMPLATES.find((t) => t.id === state.profileId) ?? null;
  }, [state.profileId]);

  const selectedShade = useMemo(() => {
    if (!state.shadeId) return null;
    return rankedShades.find((r) => r.shade.id === state.shadeId)?.shade ?? null;
  }, [state.shadeId, rankedShades]);

  const glazeFor = (id: string): GlazeOption => state.glaze[id] ?? "none";

  const setDoorType = (doorType: DoorType) => {
    setState((prev) => ({
      ...prev,
      doorType,
      profileId: doorType === "slab" ? null : prev.profileId,
    }));
    setStepIndex(0);
  };

  const canContinue = (): boolean => {
    switch (activeStep) {
      case "type":
        return true;
      case "profile":
        return state.profileId !== null;
      case "shade":
        return state.shadeId !== null;
      case "glaze":
        return true;
      case "drawers":
        return true;
      case "review":
        return true;
      default:
        return false;
    }
  };

  const goNext = () => {
    if (!canContinue()) return;
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  };

  const goBack = () => {
    setStepIndex((i) => Math.max(i - 1, 0));
  };

  const startOver = () => {
    setState(INITIAL_STATE);
    setStepIndex(0);
  };

  const drawerSpec = (zone: CabinetZone): DrawerFrontSpec => {
    const override = state.drawerOverride[zone];
    if (override === "slab") {
      return drawerFrontFor(null, zone, "slab");
    }
    return drawerFrontFor(selectedTemplate, zone, state.doorType);
  };

  const wallDrawer = drawerSpec("wall");
  const baseDrawer = drawerSpec("base");

  return (
    <div className="min-h-screen bg-[#f6f3ed] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 font-serif text-3xl font-semibold text-[#244338]">
          WalzCraft door picker
        </h1>

        {/* Stepper */}
        <ol className="mb-8 flex flex-wrap items-center gap-2">
          {steps.map((s, i) => {
            const isActive = s === activeStep;
            const isDone = i < stepIndex;
            const base =
              "rounded-full px-3 py-1 text-sm font-medium border transition-colors";
            const cls = isActive
              ? "bg-[#244338] text-[#fffdf9] border-[#244338]"
              : isDone
                ? "bg-[#d7a46c] text-[#244338] border-[#d7a46c]"
                : "bg-transparent text-[#244338] border-[#244338]/30";
            return (
              <li key={s} className={`${base} ${cls}`}>
                {STEP_LABELS[s]}
              </li>
            );
          })}
        </ol>

        {/* Step: type */}
        {activeStep === "type" && (
          <section data-testid="step-type" className="space-y-4">
            <h2 className="text-xl font-semibold text-[#244338]">Door type</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(["slab", "five-piece"] as DoorType[]).map((t) => {
                const selected = state.doorType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDoorType(t)}
                    className={`flex flex-col items-start gap-3 rounded-lg border-2 p-5 text-left transition-colors ${
                      selected
                        ? "border-[#d7a46c] bg-[#fffdf9]"
                        : "border-[#244338]/20 bg-[#fffdf9]/60 hover:border-[#244338]/40"
                    }`}
                  >
                    {t === "slab" ? <SlabIcon selected={selected} /> : <FivePieceIcon selected={selected} />}
                    <span className="text-lg font-semibold text-[#244338]">
                      {t === "slab" ? "Slab" : "Five-piece"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-[#244338]/80">
              Slab skips the profile step and goes straight to color.
            </p>
            <p className="text-xs text-[#244338]/60">
              Shaker doors use the DL Shaker blueprint and are not part of this picker.
            </p>
          </section>
        )}

        {/* Step: profile */}
        {activeStep === "profile" && (
          <section data-testid="step-profile" className="space-y-4">
            <h2 className="text-xl font-semibold text-[#244338]">Top 4 WalzCraft reference profiles</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {rankedProfiles.map(({ template, confidence }) => {
                const selected = state.profileId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    data-testid={`profile-card-${template.id}`}
                    onClick={() =>
                      setState((prev) => ({ ...prev, profileId: template.id }))
                    }
                    className={`flex flex-col gap-3 rounded-lg border-2 bg-[#fffdf9] p-4 text-left transition-colors ${
                      selected ? "border-[#d7a46c]" : "border-[#244338]/20 hover:border-[#244338]/40"
                    }`}
                  >
                    <div className="rounded bg-white p-2">
                      <WalzProfileSvg template={template} glaze={glazeFor(template.id)} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#244338]">
                        {template.id} {template.name}
                      </span>
                      <span className="rounded bg-[#d7a46c] px-2 py-0.5 text-xs font-semibold text-[#244338]">
                        {confidence}% match
                      </span>
                    </div>
                    <div className="text-xs text-[#244338]/80">
                      <div>
                        Frame: {template.frameProfile ?? "unpublished"} · Panel:{" "}
                        {template.panelProfile ?? "unpublished"}
                      </div>
                      <div>Corner: {template.corner}</div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded bg-[#244338]/10">
                      <div
                        className="h-full bg-[#244338]"
                        style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-[#244338]/60">
              Values marked * are estimated where WalzCraft does not publish them.
            </p>
          </section>
        )}

        {/* Step: shade */}
        {activeStep === "shade" && (
          <section data-testid="step-shade" className="space-y-4">
            <h2 className="text-xl font-semibold text-[#244338]">Top 4 shade colors</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {rankedShades.map(({ shade, confidence }) => {
                const selected = state.shadeId === shade.id;
                return (
                  <button
                    key={shade.id}
                    type="button"
                    data-testid={`shade-card-${shade.id}`}
                    onClick={() => setState((prev) => ({ ...prev, shadeId: shade.id }))}
                    className={`flex items-center gap-4 rounded-lg border-2 bg-[#fffdf9] p-4 text-left transition-colors ${
                      selected ? "border-[#d7a46c]" : "border-[#244338]/20 hover:border-[#244338]/40"
                    }`}
                  >
                    <span
                      className="h-16 w-16 shrink-0 rounded border border-[#244338]/30"
                      style={{ backgroundColor: shade.hex }}
                    />
                    <span className="flex-1">
                      <span className="block font-semibold text-[#244338]">{shade.name}</span>
                      <span className="block text-xs text-[#244338]/70">{shade.finish}</span>
                    </span>
                    <span className="rounded bg-[#d7a46c] px-2 py-0.5 text-xs font-semibold text-[#244338]">
                      {confidence}% match
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-6 rounded-lg border border-[#244338]/20 bg-[#fffdf9] p-4">
              <DoorElevation
                shadeHex={selectedShade?.hex ?? "#f2efe6"}
                doorType={state.doorType}
                className="h-40 w-auto"
              />
              <div className="text-sm text-[#244338]/80">
                <div className="font-semibold text-[#244338]">Preview</div>
                <div>{selectedShade ? selectedShade.name : "Select a shade"}</div>
              </div>
            </div>
          </section>
        )}

        {/* Step: glaze */}
        {activeStep === "glaze" && (
          <section data-testid="step-glaze" className="space-y-4">
            <h2 className="text-xl font-semibold text-[#244338]">Glaze per profile</h2>
            <p className="text-sm text-[#244338]/80">
              Glaze is drawn as a 1/8&quot; line in the profile&apos;s recesses.
            </p>
            <div className="space-y-3">
              {rankedProfiles.map(({ template }) => {
                const isSelected = state.profileId === template.id;
                const current = glazeFor(template.id);
                return (
                  <div
                    key={template.id}
                    className={`flex flex-col gap-3 rounded-lg border bg-[#fffdf9] p-4 md:flex-row md:items-center ${
                      isSelected ? "border-[#d7a46c]" : "border-[#244338]/20"
                    }`}
                  >
                    <div className="w-full md:w-56">
                      <WalzProfileSvg template={template} glaze={current} />
                    </div>
                    <div className="flex-1">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-semibold text-[#244338]">
                          {template.id} {template.name}
                        </span>
                        {isSelected && (
                          <span className="rounded bg-[#244338] px-2 py-0.5 text-xs font-semibold text-[#fffdf9]">
                            Selected
                          </span>
                        )}
                      </div>
                      <div className="inline-flex overflow-hidden rounded border border-[#244338]/30">
                        {GLAZE_OPTIONS.map((opt) => {
                          const active = current === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              data-testid={`glaze-${template.id}-${opt.id}`}
                              onClick={() =>
                                setState((prev) => ({
                                  ...prev,
                                  glaze: { ...prev.glaze, [template.id]: opt.id },
                                }))
                              }
                              className={`px-3 py-1 text-sm font-medium transition-colors ${
                                active
                                  ? "bg-[#244338] text-[#fffdf9]"
                                  : "bg-[#fffdf9] text-[#244338] hover:bg-[#f6f3ed]"
                              }`}
                            >
                              {opt.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Step: drawers */}
        {activeStep === "drawers" && (
          <section data-testid="step-drawers" className="space-y-4">
            <h2 className="text-xl font-semibold text-[#244338]">Drawer fronts</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(["wall", "base"] as CabinetZone[]).map((zone) => {
                const spec = zone === "wall" ? wallDrawer : baseDrawer;
                const override = state.drawerOverride[zone];
                return (
                  <div
                    key={zone}
                    className="rounded-lg border border-[#244338]/20 bg-[#fffdf9] p-4"
                  >
                    <h3 className="mb-2 font-semibold text-[#244338]">
                      {zone === "wall" ? "Wall cabinets" : "Base cabinets"}
                    </h3>
                    <dl className="space-y-1 text-sm text-[#244338]/80">
                      <div className="flex justify-between gap-2">
                        <dt>Style</dt>
                        <dd className="font-medium text-[#244338]">{spec.style}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>Rail profile</dt>
                        <dd className="font-medium text-[#244338]">
                          {spec.railProfile ?? "—"}
                        </dd>
                      </div>
                    </dl>
                    <p className="mt-2 text-xs text-[#244338]/70">{spec.note}</p>
                    <div className="mt-3 inline-flex overflow-hidden rounded border border-[#244338]/30">
                      <button
                        type="button"
                        data-testid={`drawer-${zone}-match`}
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            drawerOverride: { ...prev.drawerOverride, [zone]: "match" },
                          }))
                        }
                        className={`px-3 py-1 text-sm font-medium ${
                          override === "match"
                            ? "bg-[#244338] text-[#fffdf9]"
                            : "bg-[#fffdf9] text-[#244338] hover:bg-[#f6f3ed]"
                        }`}
                      >
                        Match door
                      </button>
                      <button
                        type="button"
                        data-testid={`drawer-${zone}-slab`}
                        onClick={() =>
                          setState((prev) => ({
                            ...prev,
                            drawerOverride: { ...prev.drawerOverride, [zone]: "slab" },
                          }))
                        }
                        className={`px-3 py-1 text-sm font-medium ${
                          override === "slab"
                            ? "bg-[#244338] text-[#fffdf9]"
                            : "bg-[#fffdf9] text-[#244338] hover:bg-[#f6f3ed]"
                        }`}
                      >
                        Slab
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Step: review */}
        {activeStep === "review" && (
          <section data-testid="step-review" className="space-y-4">
            <h2 className="text-xl font-semibold text-[#244338]">Review</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <dl className="space-y-2 rounded-lg border border-[#244338]/20 bg-[#fffdf9] p-4 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#244338]/70">Door type</dt>
                  <dd className="font-medium text-[#244338]">{state.doorType}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#244338]/70">Profile</dt>
                  <dd className="text-right font-medium text-[#244338]">
                    {selectedTemplate
                      ? `${selectedTemplate.id} ${selectedTemplate.name}`
                      : "—"}
                  </dd>
                </div>
                {selectedTemplate && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#244338]/70">Codes</dt>
                    <dd className="text-right font-medium text-[#244338]">
                      {selectedTemplate.frameProfile ?? "unpublished"} /{" "}
                      {selectedTemplate.panelProfile ?? "unpublished"}
                    </dd>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-[#244338]/70">Shade</dt>
                  <dd className="flex items-center gap-2 font-medium text-[#244338]">
                    {selectedShade && (
                      <span
                        className="inline-block h-4 w-4 rounded border border-[#244338]/30"
                        style={{ backgroundColor: selectedShade.hex }}
                      />
                    )}
                    {selectedShade ? selectedShade.name : "—"}
                  </dd>
                </div>
                {selectedTemplate && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#244338]/70">Glaze</dt>
                    <dd className="font-medium text-[#244338]">
                      {glazeFor(selectedTemplate.id)}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <dt className="text-[#244338]/70">Wall drawer</dt>
                  <dd className="text-right font-medium text-[#244338]">
                    {wallDrawer.style}
                    {wallDrawer.railProfile ? ` · ${wallDrawer.railProfile}` : ""}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#244338]/70">Base drawer</dt>
                  <dd className="text-right font-medium text-[#244338]">
                    {baseDrawer.style}
                    {baseDrawer.railProfile ? ` · ${baseDrawer.railProfile}` : ""}
                  </dd>
                </div>
                {selectedTemplate && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-[#244338]/70">Frame width</dt>
                    <dd className="font-medium text-[#244338]">
                      {formatInches(selectedTemplate.frameWidth.value)}
                      {selectedTemplate.frameWidth.estimated ? "*" : ""}
                    </dd>
                  </div>
                )}
              </dl>
              <div className="rounded-lg border border-[#244338]/20 bg-[#fffdf9] p-4">
                {selectedTemplate ? (
                  <WalzProfileSvg
                    template={selectedTemplate}
                    glaze={glazeFor(selectedTemplate.id)}
                  />
                ) : (
                  <p className="text-sm text-[#244338]/70">No profile selected.</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={startOver}
              className="rounded border-2 border-[#d7a46c] bg-transparent px-4 py-2 text-sm font-semibold text-[#244338] hover:bg-[#d7a46c]/10"
            >
              Start over
            </button>
          </section>
        )}

        {/* Nav */}
        <div className="mt-8 flex items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0}
            className="rounded border-2 border-[#244338] bg-transparent px-4 py-2 text-sm font-semibold text-[#244338] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Back
          </button>
          {activeStep !== "review" && (
            <button
              type="button"
              onClick={goNext}
              disabled={!canContinue()}
              className="rounded bg-[#244338] px-4 py-2 text-sm font-semibold text-[#fffdf9] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Continue
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
