import { isCustomCabinetProfile } from "./customCabinetProfiles";

export type CustomCabinetRenderMode = "standard" | "generic-image" | "vector-profile";

/**
 * Resolves the source of a non-standard cabinet elevation face. A configured
 * image can inform Cabinet Config styling, but dimensions and profile rules
 * always own the visible geometry.
 */
export function resolveCustomCabinetRender(
  profile: string | null | undefined,
  genericDrawingUrl: string | null | undefined,
  isAppliance: boolean,
): CustomCabinetRenderMode {
  if (isAppliance || !isCustomCabinetProfile(profile)) return "standard";
  void genericDrawingUrl;
  return "vector-profile";
}
