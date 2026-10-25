import { useCallback, useRef } from "react";

/**
 * A lightweight undo/redo hook that tracks snapshots of arbitrary state.
 * The hook does NOT own the state itself — it stores snapshots and provides
 * undo/redo callbacks that return the restored snapshot. The caller is
 * responsible for applying the snapshot to their own useState.
 *
 * Usage:
 *   const { push, undo, redo, canUndo, canRedo } = useUndoRedo<Snapshot>();
 *   // After every user action that mutates state:
 *   push(currentSnapshot);
 *   // On Ctrl+Z:
 *   const prev = undo();
 *   if (prev) applySnapshot(prev);
 */

const MAX_HISTORY = 80;

export interface UndoRedoHandle<T> {
  push: (snapshot: T) => void;
  undo: () => T | null;
  redo: () => T | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clear: () => void;
}

export function useUndoRedo<T>(): UndoRedoHandle<T> {
  // We use refs to avoid re-renders when the history changes.
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);

  const push = useCallback((snapshot: T) => {
    past.current = [...past.current.slice(-(MAX_HISTORY - 1)), snapshot];
    future.current = []; // new action clears the redo stack
  }, []);

  const undo = useCallback((): T | null => {
    if (past.current.length <= 1) return null; // need at least 2: one to pop, one to restore
    const current = past.current.pop()!;
    future.current = [current, ...future.current];
    return past.current[past.current.length - 1] ?? null;
  }, []);

  const redo = useCallback((): T | null => {
    if (future.current.length === 0) return null;
    const next = future.current.shift()!;
    past.current = [...past.current, next];
    return next;
  }, []);

  const canUndo = useCallback(() => past.current.length > 1, []);
  const canRedo = useCallback(() => future.current.length > 0, []);
  const clear = useCallback(() => { past.current = []; future.current = []; }, []);

  return { push, undo, redo, canUndo, canRedo, clear };
}
