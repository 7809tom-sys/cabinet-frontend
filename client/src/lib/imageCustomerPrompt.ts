import type { ImageCustomerChoice } from "@shared/imageCustomerLink";

type PendingRequest = {
  resolve: (choice: ImageCustomerChoice | null) => void;
};

let pending: PendingRequest | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function imageCustomerPromptOpen(): boolean {
  return pending != null;
}

export function subscribeImageCustomerPrompt(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Opens the customer picker. Resolves null when the person dismisses it. */
export function requestImageCustomerLink(): Promise<ImageCustomerChoice | null> {
  if (pending) {
    pending.resolve(null);
    pending = null;
  }
  return new Promise((resolve) => {
    pending = { resolve };
    notify();
  });
}

export function settleImageCustomerPrompt(choice: ImageCustomerChoice | null): void {
  const current = pending;
  pending = null;
  current?.resolve(choice);
  notify();
}
