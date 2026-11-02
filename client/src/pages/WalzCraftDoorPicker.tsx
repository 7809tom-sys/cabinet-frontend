import { useEffect, useMemo, useRef, useState } from "react";
import { TintedSlab } from "@/components/walzcraft/TintedSlab";
import { WalzProfileSvg, formatInches } from "@/components/walzcraft/WalzProfileSvg";
import {
  rankProfilesForShade,
  rankShades,
  shadesForProfile,
  familyForShade,
  GLAZE_OPTIONS,
  drawerProfileOptions,
  stepsFor,
  WALZCRAFT_PROFILE_TEMPLATES,
  WALZCRAFT_SHADE_FAMILIES,
  type DoorType,
  type GlazeOption,
  type CabinetZone,
  type Step,
  type WalzProfileTemplate,
  type DoorSelection,
} from "@shared/walzcraftDoorTemplates";
import {
  candidateDoors,
  doorDisplayName,
  doorsForShade,
  doorsForTemplate,
  profileConfidenceFor,
  type DistributorDoorMatch,
} from "@shared/walzcraftDistributorMatches";


// NOTE: Shaker doors use the separate DL Shaker blueprint
// (docs/rules/SHAKER_DOOR_RULE.md + shared/shakerDoorBlueprint.ts).
// This picker is WalzCraft raised-panel / five-piece only.

const STEP_LABELS: Record<Step, string> = {
  color: "Color",
  type: "Slab or five-piece",
  profile: "Door profile",
  drawers: "Drawer profile",
  glaze: "Glaze",
  review: "Review",
};

type PickerState = DoorSelection;

const INITIAL_STATE: PickerState = {
  doorType: "five-piece",
  profileId: null,
  shadeId: null,
  colorFamilyId: null,
  glaze: {},
  drawer: { wall: null, base: null },
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

function ToggleSwitch({
  checked,
  onClick,
  testId,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  testId: string;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-testid={testId}
      onClick={onClick}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors ${
        checked ? "border-[#244338] bg-[#244338]" : "border-[#244338]/30 bg-[#244338]/10"
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-[#fffdf9] shadow transition-transform ${
          checked ? "translate-x-6" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function continueHint(step: Step): string {
  switch (step) {
    case "color": return "Pick a color family to continue";
    case "profile": return "Turn on a door profile to continue";
    case "drawers": return "Choose a wall and a base drawer profile to continue";
    default: return "";
  }
}

function SeenAt({ doors, templateId, templateName }: { doors: DistributorDoorMatch[]; templateId?: string; templateName?: string }) {
  if (doors.length === 0) return null;
  return (
    <span data-testid="seen-at" className="mt-1 block text-xs text-[#244338]">
      {doors.slice(0, 3).map((d) => {
        const pct = templateId ? profileConfidenceFor(d, templateId, templateName) : null;
        return (
          <span key={d.id} className="block">
            Seen at: {d.distributor} {doorDisplayName(d)}{pct != null ? ` · ${pct}%` : ""}
          </span>
        );
      })}
      {doors.length > 3 && <span className="block text-[#244338]/60">+{doors.length - 3} more distributor doors</span>}
    </span>
  );
}

export function buildingTitle(door: DistributorDoorMatch | null): string {
  return door ? `Building: ${doorDisplayName(door)}` : "Building: choose a door";
}

function BuildingBanner({
  door,
  candidates,
  onChoose,
  large,
  detail,
}: {
  door: DistributorDoorMatch | null;
  candidates: DistributorDoorMatch[];
  onChoose: (id: string | null) => void;
  large: boolean;
  detail: string;
}) {
  return (
    <div data-testid="building-banner" className="sticky top-0 z-20 mb-6 flex flex-wrap items-center gap-4 rounded-lg border-2 border-[#d7a46c] bg-[#fffdf9] p-3 shadow-sm">
      {door?.photo ? (
        <img src={door.photo} alt={`${doorDisplayName(door)} brochure door`} className="h-16 w-12 rounded border border-[#244338]/20 object-contain" />
      ) : (
        <div className="h-16 w-12 rounded border border-dashed border-[#244338]/30" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <div data-testid="building-title" className={`font-serif font-semibold text-[#244338] ${large ? "text-3xl" : "text-xl"}`}>
          {buildingTitle(door)}
        </div>
        {door && <div className="text-xs text-[#244338]/70">from {door.distributor}</div>}
        {detail && <div className="text-xs text-[#244338]/70">{detail}</div>}
      </div>
      {candidates.length > 1 && (
        <label className="text-xs text-[#244338]">
          <span className="mb-1 block font-semibold">Which distributor door are you building?</span>
          <select
            data-testid="building-door-select"
            value={door?.id ?? ""}
            onChange={(e) => onChoose(e.target.value || null)}
            className="rounded border border-[#244338]/40 bg-[#fffdf9] px-2 py-1 text-sm text-[#244338]"
          >
            <option value="">Choose a door…</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.distributor} · {doorDisplayName(c)}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}

export default function WalzCraftDoorPicker() {
  const [state, setState] = useState<PickerState>(INITIAL_STATE);
  const [stepIndex, setStepIndex] = useState(0);

  const steps = useMemo(() => stepsFor(state.doorType), [state.doorType]);
  const activeStep: Step = steps[Math.min(stepIndex, steps.length - 1)] ?? "color";

  const selectedTemplate: WalzProfileTemplate | null = useMemo(() => {
    if (!state.profileId) return null;
    return WALZCRAFT_PROFILE_TEMPLATES.find((t) => t.id === state.profileId) ?? null;
  }, [state.profileId]);

  // Family leaders (top-ranked shades across all families)
  const familyLeaders = useMemo(() => rankShades(), []);

  // The four shades of the chosen family
  const familyShades = useMemo(() => {
    if (!state.colorFamilyId) return [];
    return rankShades(state.colorFamilyId);
  }, [state.colorFamilyId]);

  const selectedFamily = useMemo(() => {
    if (!state.colorFamilyId) return null;
    return WALZCRAFT_SHADE_FAMILIES.find((f) => f.id === state.colorFamilyId) ?? null;
  }, [state.colorFamilyId]);

  const selectedShade = useMemo(() => {
    if (!state.shadeId) return null;
    const fromFamily = familyShades.find((r) => r.shade.id === state.shadeId)?.shade;
    if (fromFamily) return fromFamily;
    // fall back to any family
    for (const fam of WALZCRAFT_SHADE_FAMILIES) {
      const found = rankShades(fam.id).find((r) => r.shade.id === state.shadeId)?.shade;
      if (found) return found;
    }
    return null;
  }, [state.shadeId, familyShades]);

  const rankedProfiles = useMemo(
    () => rankProfilesForShade(state.shadeId, 4),
    [state.shadeId],
  );

  const [chosenDoorId, setChosenDoorId] = useState<string | null>(null);
  const doorCandidates = useMemo(
    () =>
      candidateDoors({
        doorType: state.doorType,
        templateId: state.profileId,
        templateName: selectedTemplate?.name ?? null,
        shadeName: selectedShade?.name ?? null,
      }),
    [state.doorType, state.profileId, selectedTemplate, selectedShade],
  );
  const buildingDoor: DistributorDoorMatch | null =
    doorCandidates.find((d) => d.id === chosenDoorId) ?? (doorCandidates.length === 1 ? doorCandidates[0] : null);
  const shadesRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (state.colorFamilyId) shadesRef.current?.scrollIntoView?.({ behavior: "smooth", block: "nearest" });
  }, [state.colorFamilyId]);

  const glazeFor = (id: string): GlazeOption => state.glaze[id] ?? "none";

  const setDoorType = (doorType: DoorType) => {
    setState((prev) => ({
      ...prev,
      doorType,
      profileId: doorType === "slab" ? null : prev.profileId,
      drawer: { wall: null, base: null },
    }));
    // Stay on the type step (index is the same in both step lists).
    setStepIndex(stepsFor(doorType).indexOf("type"));
  };

  const selectFamily = (familyId: string) => {
    setState((prev) => {
      const shades = rankShades(familyId);
      const keepShade = shades.some((r) => r.shade.id === prev.shadeId);
      // Picking a family selects its top shade so Continue enables immediately
      // (previously Continue stayed disabled until a second, below-the-fold shade click).
      return {
        ...prev,
        colorFamilyId: familyId,
        shadeId: keepShade ? prev.shadeId : (shades[0]?.shade.id ?? null),
      };
    });
  };

  const cycleShade = (dir: 1 | -1) => {
    if (familyShades.length === 0) return;
    setState((prev) => {
      const ids = familyShades.map((r) => r.shade.id);
      const currentIdx = prev.shadeId ? ids.indexOf(prev.shadeId) : -1;
      const nextIdx =
        currentIdx === -1
          ? dir === 1
            ? 0
            : ids.length - 1
          : (currentIdx + dir + ids.length) % ids.length;
      return { ...prev, shadeId: ids[nextIdx] };
    });
  };

  const toggleProfile = (id: string) => {
    setState((prev) => ({
      ...prev,
      profileId: prev.profileId === id ? null : id,
    }));
  };

  const toggleDrawer = (zone: CabinetZone, optionId: string) => {
    setState((prev) => ({
      ...prev,
      drawer: {
        ...prev.drawer,
        [zone]: prev.drawer[zone] === optionId ? null : optionId,
      },
    }));
  };

  const canContinue = (): boolean => {
    switch (activeStep) {
      case "color":
        return state.shadeId !== null;
      case "type":
        return true;
      case "profile":
        return state.profileId !== null;
      case "drawers":
        return state.drawer.wall !== null && state.drawer.base !== null;
      case "glaze":
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
    setChosenDoorId(null);
  };

  // Drawer options per zone
  const wallDrawerOptions = useMemo(
    () => drawerProfileOptions(selectedTemplate, "wall", state.doorType),
    [selectedTemplate, state.doorType],
  );
  const baseDrawerOptions = useMemo(
    () => drawerProfileOptions(selectedTemplate, "base", state.doorType),
    [selectedTemplate, state.doorType],
  );

  const drawerOptionFor = (zone: CabinetZone, id: string | null) => {
    if (!id) return null;
    const opts = zone === "wall" ? wallDrawerOptions : baseDrawerOptions;
    return opts.find((o) => o.id === id) ?? null;
  };

  const wallDrawer = drawerOptionFor("wall", state.drawer.wall);
  const baseDrawer = drawerOptionFor("base", state.drawer.base);

  // Profile family note
  const profileFamilyNote = useMemo(() => {
    if (!selectedTemplate) return null;
    const shadeFamily = state.shadeId ? familyForShade(state.shadeId) : null;
    const profileShades = shadesForProfile(selectedTemplate.id);
    if (profileShades.length === 0) return null;
    const profileFamilyId = profileShades[0].familyId;
    if (shadeFamily && shadeFamily.id === profileFamilyId) return null;
    return profileShades.map((s) => s.name).join(", ");
  }, [selectedTemplate, state.shadeId]);

  return (
    <div className="min-h-screen bg-[#f6f3ed] px-4 py-10">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 font-serif text-3xl font-semibold text-[#244338]">
          WalzCraft door picker
        </h1>

        <BuildingBanner
          door={buildingDoor}
          candidates={doorCandidates}
          onChoose={setChosenDoorId}
          large={activeStep === "review"}
          detail={[selectedShade?.name, state.doorType === "slab" ? "Slab" : "Five-piece"].filter(Boolean).join(" · ")}
        />

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
              <li key={s}>
                <button
                  type="button"
                  data-testid={`step-pill-${s}`}
                  disabled={!isDone && !isActive}
                  onClick={() => isDone && setStepIndex(i)}
                  className={`${base} ${cls} disabled:cursor-default`}
                >
                  {STEP_LABELS[s]}
                </button>
              </li>
            );
          })}
        </ol>

        {/* Step: color */}
        {activeStep === "color" && (
          <section data-testid="step-color" className="space-y-6">
            <h2 className="text-xl font-semibold text-[#244338]">Color</h2>

            {/* Family leaders */}
            <div>
              <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#244338]/70">
                Families
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {familyLeaders.map(({ shade, confidence }) => {
                  const family = WALZCRAFT_SHADE_FAMILIES.find((f) => f.id === shade.familyId);
                  if (!family) return null;
                  const selected = state.colorFamilyId === family.id;
                  return (
                    <button
                      key={family.id}
                      type="button"
                      data-testid={`color-family-${family.id}`}
                      onClick={() => selectFamily(family.id)}
                      className={`flex items-center gap-3 rounded-lg border-2 bg-[#fffdf9] p-3 text-left transition-colors ${
                        selected
                          ? "border-[#d7a46c]"
                          : "border-[#244338]/20 hover:border-[#244338]/40"
                      }`}
                    >
                      <span
                        className="h-10 w-10 shrink-0 rounded border border-[#244338]/30"
                        style={{ backgroundColor: shade.hex }}
                      />
                      <span className="flex-1">
                        <span className="block font-semibold text-[#244338]">{family.name}</span>
                        <span className="block text-xs text-[#244338]/70">
                          {shade.name}, WalzCraft color (estimated match)
                        </span>
                        <SeenAt doors={doorsForShade(shade.name)} />
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Four shades of chosen family */}
            {selectedFamily && (
              <div ref={shadesRef}>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[#244338]/70">
                  Four {selectedFamily.name} shades
                </h3>
                <div className="grid gap-4 md:grid-cols-2">
                  {familyShades.map(({ shade, confidence }) => {
                    const selected = state.shadeId === shade.id;
                    return (
                      <button
                        key={shade.id}
                        type="button"
                        data-testid={`shade-card-${shade.id}`}
                        onClick={() => setState((prev) => ({ ...prev, shadeId: shade.id }))}
                        className={`flex items-center gap-4 rounded-lg border-2 bg-[#fffdf9] p-4 text-left transition-colors ${
                          selected
                            ? "border-[#d7a46c]"
                            : "border-[#244338]/20 hover:border-[#244338]/40"
                        }`}
                      >
                        <span
                          className="h-16 w-16 shrink-0 rounded border border-[#244338]/30"
                          style={{ backgroundColor: shade.hex }}
                        />
                        <span className="flex-1">
                          <span className="block font-semibold text-[#244338]">{shade.name}</span>
                          <span className="block text-xs text-[#244338]/70">{shade.finish}</span>
                          <SeenAt doors={doorsForShade(shade.name)} />
                          {shade.hexEstimated && (
                            <span className="mt-1 block text-xs italic text-[#244338]/50">
                              est. hex
                            </span>
                          )}
                        </span>
                        <span className="rounded bg-[#d7a46c] px-2 py-0.5 text-xs font-semibold text-[#244338]">
                          WalzCraft color (estimated match)
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    data-testid="shade-prev"
                    onClick={() => cycleShade(-1)}
                    className="rounded border-2 border-[#244338] bg-transparent px-3 py-1 text-sm font-semibold text-[#244338] hover:bg-[#244338]/5"
                  >
                    Prev shade
                  </button>
                  <button
                    type="button"
                    data-testid="shade-next"
                    onClick={() => cycleShade(1)}
                    className="rounded border-2 border-[#244338] bg-transparent px-3 py-1 text-sm font-semibold text-[#244338] hover:bg-[#244338]/5"
                  >
                    Next shade
                  </button>
                </div>
              </div>
            )}

            {/* Preview */}
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

        {/* Step: type */}
        {activeStep === "type" && (
          <section data-testid="step-type" className="space-y-4">
            <h2 className="text-xl font-semibold text-[#244338]">Slab or five-piece</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(["slab", "five-piece"] as DoorType[]).map((t) => {
                const selected = state.doorType === t;
                return (
                  <button
                    key={t}
                    type="button"
                    data-testid={`door-type-${t}`}
                    onClick={() => setDoorType(t)}
                    className={`flex flex-col items-start gap-3 rounded-lg border-2 p-5 text-left transition-colors ${
                      selected
                        ? "border-[#d7a46c] bg-[#fffdf9]"
                        : "border-[#244338]/20 bg-[#fffdf9]/60 hover:border-[#244338]/40"
                    }`}
                  >
                    {t === "slab" ? (
                      <span className="flex items-center gap-3">
                        <SlabIcon selected={selected} />
                        <TintedSlab className="h-28 w-14" tint={{ hex: selectedShade?.hex ?? null, colorName: selectedShade ? `${selectedShade.name}, WalzCraft color` : "choose a color", estimated: selectedShade?.hexEstimated ?? true }} />
                      </span>
                    ) : <FivePieceIcon selected={selected} />}
                    <span className="text-lg font-semibold text-[#244338]">
                      {t === "slab" ? "Slab" : "Five-piece"}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-[#244338]/80">
              Slab skips the profile step and goes straight to drawer profiles.
            </p>
            <p className="text-xs text-[#244338]/60">
              Shaker doors use the DL Shaker blueprint and are not part of this picker.
            </p>
          </section>
        )}

        {/* Step: profile */}
        {activeStep === "profile" && (
          <section data-testid="step-profile" className="space-y-4">
            <h2 className="text-xl font-semibold text-[#244338]">
              Best door profiles for this shade
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              {rankedProfiles.map(({ template, confidence }) => {
                const selected = state.profileId === template.id;
                return (
                  <div
                    key={template.id}
                    data-testid={`profile-card-${template.id}`}
                    className={`flex flex-col gap-3 rounded-lg border-2 bg-[#fffdf9] p-4 transition-colors ${
                      selected ? "border-[#d7a46c]" : "border-[#244338]/20"
                    }`}
                  >
                    <div className="rounded bg-white p-2">
                      <WalzProfileSvg template={template} glaze={glazeFor(template.id)} />
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#244338]">
                        {template.name}
                      </span>
                      <ToggleSwitch
                        checked={selected}
                        onClick={() => toggleProfile(template.id)}
                        testId={`profile-toggle-${template.id}`}
                        label={`Select ${template.name}`}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[#244338]/80">
                        Frame: {template.frameProfile ?? "unpublished"} · Panel:{" "}
                        {template.panelProfile ?? "unpublished"}
                      </span>
                      <span className="rounded bg-[#d7a46c] px-2 py-0.5 text-xs font-semibold text-[#244338]">
                        {confidence}% profile match (estimated)
                      </span>
                    </div>
                    <SeenAt doors={doorsForTemplate(template.id, template.name)} templateId={template.id} templateName={template.name} />
                    <div className="h-1.5 w-full overflow-hidden rounded bg-[#244338]/10">
                      <div
                        className="h-full bg-[#244338]"
                        style={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            {profileFamilyNote && (
              <p className="rounded border border-[#d7a46c]/60 bg-[#d7a46c]/10 p-3 text-sm text-[#244338]">
                This profile&apos;s own shades: {profileFamilyNote}
              </p>
            )}
            <p className="text-xs text-[#244338]/60">
              Values marked * are estimated where WalzCraft does not publish them.
            </p>
          </section>
        )}

        {/* Step: drawers */}
        {activeStep === "drawers" && (
          <section data-testid="step-drawers" className="space-y-4">
            <h2 className="text-xl font-semibold text-[#244338]">Drawer profile</h2>
            <div className="grid gap-4 md:grid-cols-2">
              {(["wall", "base"] as CabinetZone[]).map((zone) => {
                const options = zone === "wall" ? wallDrawerOptions : baseDrawerOptions;
                const selectedId = state.drawer[zone];
                return (
                  <div
                    key={zone}
                    className="rounded-lg border border-[#244338]/20 bg-[#fffdf9] p-4"
                  >
                    <h3 className="mb-3 font-semibold text-[#244338]">
                      {zone === "wall" ? "Wall cabinets" : "Base cabinets"}
                    </h3>
                    <div className="space-y-3">
                      {options.map((opt) => {
                        const checked = selectedId === opt.id;
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-start gap-3 rounded border p-3 ${
                              checked ? "border-[#d7a46c]" : "border-[#244338]/15"
                            }`}
                          >
                            <div className="flex-1">
                              <div className="font-medium text-[#244338]">{opt.label}</div>
                              <div className="text-xs text-[#244338]/80">
                                Rail: {opt.spec.railProfile ?? "—"}
                              </div>
                              <p className="mt-1 text-xs text-[#244338]/70">{opt.spec.note}</p>
                            </div>
                            <ToggleSwitch
                              checked={checked}
                              onClick={() => toggleDrawer(zone, opt.id)}
                              testId={`drawer-toggle-${zone}-${opt.id}`}
                              label={`Select ${opt.label} for ${zone}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
                          {template.name}
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

        {/* Step: review */}
        {activeStep === "review" && (
          <section data-testid="step-review" className="space-y-4">
            <h2 className="text-xl font-semibold text-[#244338]">Review</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <dl className="space-y-2 rounded-lg border border-[#244338]/20 bg-[#fffdf9] p-4 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-[#244338]/70">Color family</dt>
                  <dd className="font-medium text-[#244338]">
                    {selectedFamily ? selectedFamily.name : "—"}
                  </dd>
                </div>
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
                <div className="flex justify-between gap-2">
                  <dt className="text-[#244338]/70">Door type</dt>
                  <dd className="font-medium text-[#244338]">{state.doorType}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#244338]/70">Profile</dt>
                  <dd className="text-right font-medium text-[#244338]">
                    {selectedTemplate
                      ? selectedTemplate.name
                      : "—"}
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
                    {wallDrawer
                      ? `${wallDrawer.label}${wallDrawer.spec.railProfile ? ` · ${wallDrawer.spec.railProfile}` : ""}`
                      : "—"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-[#244338]/70">Base drawer</dt>
                  <dd className="text-right font-medium text-[#244338]">
                    {baseDrawer
                      ? `${baseDrawer.label}${baseDrawer.spec.railProfile ? ` · ${baseDrawer.spec.railProfile}` : ""}`
                      : "—"}
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
              data-testid="step-continue"
              onClick={goNext}
              disabled={!canContinue()}
              title={canContinue() ? undefined : continueHint(activeStep)}
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
