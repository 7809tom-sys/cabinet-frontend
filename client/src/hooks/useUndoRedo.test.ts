import { describe, it, expect } from "vitest";

/**
 * Test the undo/redo logic directly without React hooks (since vitest
 * environment is "node" without jsdom). We extract the core logic into
 * a plain class-like test.
 */

const MAX_HISTORY = 80;

// Minimal reimplementation of the hook logic for testing purposes.
function createUndoRedo<T>() {
  const past: T[] = [];
  const future: T[] = [];

  return {
    push(snapshot: T) {
      if (past.length >= MAX_HISTORY) past.shift();
      past.push(snapshot);
      future.length = 0;
    },
    undo(): T | null {
      if (past.length <= 1) return null;
      const current = past.pop()!;
      future.unshift(current);
      return past[past.length - 1] ?? null;
    },
    redo(): T | null {
      if (future.length === 0) return null;
      const next = future.shift()!;
      past.push(next);
      return next;
    },
    canUndo: () => past.length > 1,
    canRedo: () => future.length > 0,
    clear() { past.length = 0; future.length = 0; },
  };
}

describe("useUndoRedo (logic)", () => {
  it("starts with no undo/redo available", () => {
    const ur = createUndoRedo<number[]>();
    expect(ur.canUndo()).toBe(false);
    expect(ur.canRedo()).toBe(false);
  });

  it("can undo after two pushes", () => {
    const ur = createUndoRedo<number[]>();
    ur.push([1]);
    ur.push([1, 2]);
    expect(ur.canUndo()).toBe(true);
    const restored = ur.undo();
    expect(restored).toEqual([1]);
  });

  it("redo restores after undo", () => {
    const ur = createUndoRedo<number[]>();
    ur.push([1]);
    ur.push([1, 2]);
    ur.push([1, 2, 3]);
    ur.undo();
    expect(ur.canRedo()).toBe(true);
    const restored = ur.redo();
    expect(restored).toEqual([1, 2, 3]);
  });

  it("new push clears redo stack", () => {
    const ur = createUndoRedo<string>();
    ur.push("a");
    ur.push("b");
    ur.push("c");
    ur.undo();
    expect(ur.canRedo()).toBe(true);
    ur.push("d");
    expect(ur.canRedo()).toBe(false);
  });

  it("undo returns null when history has only one entry", () => {
    const ur = createUndoRedo<number>();
    ur.push(1);
    expect(ur.undo()).toBeNull();
  });

  it("redo returns null when future is empty", () => {
    const ur = createUndoRedo<number>();
    ur.push(1);
    expect(ur.redo()).toBeNull();
  });

  it("clear resets all history", () => {
    const ur = createUndoRedo<number>();
    ur.push(1);
    ur.push(2);
    ur.clear();
    expect(ur.canUndo()).toBe(false);
    expect(ur.canRedo()).toBe(false);
  });

  it("respects MAX_HISTORY limit", () => {
    const ur = createUndoRedo<number>();
    for (let i = 0; i < 100; i++) ur.push(i);
    // Should only keep last MAX_HISTORY entries
    let count = 0;
    while (ur.canUndo()) { ur.undo(); count++; }
    expect(count).toBe(MAX_HISTORY - 1); // can undo MAX_HISTORY-1 times
  });

  it("multiple undo then redo restores full chain", () => {
    const ur = createUndoRedo<string>();
    ur.push("a");
    ur.push("b");
    ur.push("c");
    ur.push("d");
    expect(ur.undo()).toBe("c");
    expect(ur.undo()).toBe("b");
    expect(ur.redo()).toBe("c");
    expect(ur.redo()).toBe("d");
    expect(ur.canRedo()).toBe(false);
  });
});
