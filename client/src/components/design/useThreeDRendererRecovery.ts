import { useCallback, useEffect, useRef, useState, type MutableRefObject } from "react";
import type * as THREE from "three";
import {
  THREE_D_BACKGROUND_RETRY_MS,
  THREE_D_RESTORE_WAIT_MS,
  THREE_D_START_RETRY_DELAYS_MS,
  lastThreeDStartFailure,
  type ThreeDRendererHost,
} from "./threeDRendererHost";

/**
 * "running": the view should have a renderer (the scene effect asks for one).
 * "starting": a start failed and a silent retry is scheduled.
 * "unavailable": the quick retries are used up; retries continue in the background.
 * "blocked": Chrome blocked WebGL for the site; only a reload by the customer lifts it.
 * "suspended": the page is hidden, so the view holds no context until it is shown again.
 */
export type ThreeDRendererStatus = "running" | "starting" | "unavailable" | "blocked" | "suspended";

export interface ThreeDRendererRecovery {
  status: ThreeDRendererStatus;
  /** The context is lost and the view is waiting for Chrome to restore it. */
  paused: boolean;
  /** Bumped when Chrome restores the context; the scene must be rebuilt against it. */
  generation: number;
  /** The scene effect could not get a renderer. */
  startFailed: () => void;
  /** The scene effect has a renderer. */
  started: () => void;
  /** Follows context loss and restore on the renderer; returns the detach function. */
  attach: (renderer: THREE.WebGLRenderer) => () => void;
  retryNow: () => void;
}

const pageHidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";

/**
 * Starts the 3D view without the customer's help. A start that fails is retried
 * silently with backoff, and a context lost to a GPU reset is rebuilt when
 * Chrome restores it or replaced when Chrome does not. Nothing counts or caps
 * resets. While the page is hidden the view gives its context back: Chrome
 * blocks WebGL for a whole site after a second GPU reset that hits while the
 * site holds a context, and most resets (sleep and wake, driver updates) happen
 * while nobody is looking at the page.
 */
export function useThreeDRendererRecovery(
  hostRef: MutableRefObject<ThreeDRendererHost | null>,
  options: { surface: string; onBlocked?: () => void },
): ThreeDRendererRecovery {
  const [status, setStatus] = useState<ThreeDRendererStatus>(() => (pageHidden() ? "suspended" : "running"));
  const [paused, setPaused] = useState(false);
  const [generation, setGeneration] = useState(0);
  const failuresRef = useRef(0);
  const nextDelayRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const startFailed = useCallback(() => {
    const failures = ++failuresRef.current;
    if (lastThreeDStartFailure() === "blocked") {
      nextDelayRef.current = THREE_D_BACKGROUND_RETRY_MS;
      setStatus("blocked");
      optionsRef.current.onBlocked?.();
      return;
    }
    const quick = failures <= THREE_D_START_RETRY_DELAYS_MS.length;
    nextDelayRef.current = quick ? THREE_D_START_RETRY_DELAYS_MS[failures - 1] : THREE_D_BACKGROUND_RETRY_MS;
    setStatus(quick ? "starting" : "unavailable");
  }, []);

  const started = useCallback(() => {
    failuresRef.current = 0;
  }, []);

  const attach = useCallback((renderer: THREE.WebGLRenderer) => {
    const canvas = renderer.domElement;
    const onLost = () => setPaused(true);
    const onRestored = () => {
      setPaused(false);
      setGeneration((value) => value + 1);
    };
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, []);

  const retryNow = useCallback(() => {
    failuresRef.current = 0;
    hostRef.current?.dispose();
    setStatus("running");
  }, [hostRef]);

  useEffect(() => {
    if (status === "running" || status === "suspended") return;
    const timer = window.setTimeout(() => {
      // The failed renderer goes, so the next attempt asks for a fresh context.
      hostRef.current?.dispose();
      setStatus("running");
    }, nextDelayRef.current);
    return () => window.clearTimeout(timer);
  }, [status, hostRef]);

  useEffect(() => {
    // The scene has already detached from the renderer (its effect cleanup runs first).
    if (status === "suspended") hostRef.current?.dispose();
  }, [status, hostRef]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (pageHidden()) {
        setPaused(false);
        setStatus("suspended");
        return;
      }
      failuresRef.current = 0;
      setStatus((current) => (current === "suspended" ? "running" : current));
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    if (!paused) return;
    // Chrome does not restore a context once it has blocked the site; start a
    // new one, which either works or reports the block.
    const timer = window.setTimeout(() => {
      setPaused(false);
      hostRef.current?.dispose();
      failuresRef.current = 0;
      nextDelayRef.current = 0;
      setStatus("starting");
    }, THREE_D_RESTORE_WAIT_MS);
    return () => window.clearTimeout(timer);
  }, [paused, hostRef]);

  return { status, paused, generation, startFailed, started, attach, retryNow };
}
