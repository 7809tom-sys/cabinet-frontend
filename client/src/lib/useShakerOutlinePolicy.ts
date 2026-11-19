/**
 * The 3D Designer's shaker edge policy, as a hook: the on/off toggle (remembered in the
 * browser) and the quality tier for this device. The tier comes from the Designer's own
 * `threeDRenderQualityProfile`, so a phone draws the thinner outline.
 */
import { useEffect, useSyncExternalStore } from "react";
import { threeDRenderQualityProfile } from "@/components/design/InteractiveRoom3D";
import {
  getShakerOutlinePolicy,
  setShakerOutlinePolicy,
  subscribeShakerOutlinePolicy,
  type ShakerOutlinePolicy,
} from "@/lib/shakerFrameOutline";

export function shakerOutlineTierForDevice(): ShakerOutlinePolicy["tier"] {
  if (typeof window === "undefined") return "balanced";
  const navigatorCapabilities = navigator as Navigator & { deviceMemory?: number };
  return threeDRenderQualityProfile({
    canvasWidth: window.innerWidth,
    canvasHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    coarsePointer: window.matchMedia?.("(pointer: coarse)").matches,
    hardwareConcurrency: navigatorCapabilities.hardwareConcurrency ?? null,
    deviceMemoryGb: navigatorCapabilities.deviceMemory ?? null,
  }).tier;
}

export function useShakerOutlinePolicy() {
  const policy = useSyncExternalStore(subscribeShakerOutlinePolicy, getShakerOutlinePolicy, getShakerOutlinePolicy);
  useEffect(() => {
    setShakerOutlinePolicy({ tier: shakerOutlineTierForDevice() });
  }, []);
  return {
    enabled: policy.enabled,
    tier: policy.tier,
    setEnabled: (enabled: boolean) => setShakerOutlinePolicy({ enabled }),
  };
}
