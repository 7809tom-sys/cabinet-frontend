import { pageReloadEnv } from "./staleChunkReload";

/**
 * The designer's contact gate is kept in memory only, so any page load asks a
 * guest for their email again before their draft comes back. When the customer
 * reloads because Chrome blocked the 3D view, the contact is handed to that one
 * next load, which goes straight back to the design and its 3D view.
 */
const HANDOFF_KEY = "cabinetdealz.designerContactHandoff";
const HANDOFF_MAX_AGE_MS = 60_000;

export interface DesignerContactHandoff {
  email: string;
  name?: string;
  phone?: string;
}

export function handOffDesignerContact(contact: DesignerContactHandoff): void {
  try {
    pageReloadEnv.storage()?.setItem(HANDOFF_KEY, JSON.stringify({ ...contact, at: pageReloadEnv.now() }));
  } catch {
    /* storage unavailable: the gate asks again */
  }
}

/** Reads and removes the handoff; null when there is none or it is stale. */
export function takeDesignerContactHandoff(): DesignerContactHandoff | null {
  try {
    const storage = pageReloadEnv.storage();
    const raw = storage?.getItem(HANDOFF_KEY);
    if (raw == null) return null;
    storage?.removeItem(HANDOFF_KEY);
    const parsed = JSON.parse(raw) as { email?: unknown; name?: unknown; phone?: unknown; at?: unknown };
    const at = Number(parsed.at);
    if (typeof parsed.email !== "string" || !parsed.email || !Number.isFinite(at) || pageReloadEnv.now() - at > HANDOFF_MAX_AGE_MS) return null;
    return {
      email: parsed.email,
      name: typeof parsed.name === "string" && parsed.name ? parsed.name : undefined,
      phone: typeof parsed.phone === "string" && parsed.phone ? parsed.phone : undefined,
    };
  } catch {
    return null;
  }
}
