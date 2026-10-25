export const CUSTOM_CABINET_PROFILES = [
  { id: "standard", label: "Standard cabinet (automatic drawing)", usesGenericImage: false },
  { id: "wall_angle", label: "Angled wall end cabinet (12×12 end wedge, side-hinged door)", usesGenericImage: true },
  { id: "end-angle", label: "Base end angle cabinet", usesGenericImage: true },
  { id: "generic-image", label: "Generic drawing image", usesGenericImage: true },
  { id: "open-shelf-side-door", label: "Open shelf with side-hinged door", usesGenericImage: true },
  { id: "curved-open-shelf", label: "Curved open shelf / end cabinet", usesGenericImage: true },
  { id: "wine-rack", label: "Wine rack / lattice cabinet", usesGenericImage: true },
  { id: "pullout-tower", label: "Pull-out tower / tall open shelf", usesGenericImage: true },
  { id: "knee-drawer", label: "Knee drawer / workstation", usesGenericImage: true },
  { id: "hood-wall-chimney", label: "Wall-mount chimney range hood", usesGenericImage: true },
  { id: "hood-insert", label: "Under-cabinet range hood insert", usesGenericImage: true },
] as const;

export type CustomCabinetProfileId = (typeof CUSTOM_CABINET_PROFILES)[number]["id"];

const CUSTOM_PROFILE_IDS = new Set<string>(CUSTOM_CABINET_PROFILES.map((profile) => profile.id));

export function isCustomCabinetProfile(value: string | null | undefined): value is CustomCabinetProfileId {
  return value != null && CUSTOM_PROFILE_IDS.has(value) && value !== "standard";
}

export function customProfileUsesGenericImage(value: string | null | undefined): boolean {
  return isCustomCabinetProfile(value) && CUSTOM_CABINET_PROFILES.some((profile) => profile.id === value && profile.usesGenericImage);
}
