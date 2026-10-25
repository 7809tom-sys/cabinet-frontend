import { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * Captures the browser's native PWA install prompt and exposes:
 * - `canInstall`  — true when the browser is ready to show the install UI
 * - `install()`   — triggers the native install prompt
 * - `isInstalled` — true if the app is already running in standalone mode
 */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("SW registration failed:", err));
    }

    // Detect standalone mode (already installed)
    const mq = window.matchMedia("(display-mode: standalone)");
    setIsInstalled(mq.matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);
    const handler = (e: MediaQueryListEvent) => setIsInstalled(e.matches);
    mq.addEventListener("change", handler);

    // Capture the install prompt
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Clear prompt after install
    const onAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };
    window.addEventListener("appinstalled", onAppInstalled);

    return () => {
      mq.removeEventListener("change", handler);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setDeferredPrompt(null);
  }

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    install,
  };
}
