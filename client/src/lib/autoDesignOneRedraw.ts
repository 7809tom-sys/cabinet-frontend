/**
 * Tom, Nov 16 2026 (voice 12:19 PM CT): the ONE-REDRAW RULE.
 *
 * If Auto Design hits an error while it places the plan, or while a post-build
 * redraw / re-plan runs (over-range fill, panel sync, clearance fillers…), it
 * gets at most ONE retry. A second failure stops that step and the user sees a
 * visible error naming the step and the real message. Nothing loops: a step
 * that keeps rewriting the plan it just wrote is stopped after one redraw, and
 * the designer keeps the last good plan.
 */

export type AutoDesignStepFailure = { step: string; message: string; attempts: number };

export type OneRetryResult<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; failure: AutoDesignStepFailure };

export function errorMessageOf(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}

/** The text shown to the user when a step stops. */
export function autoDesignStepFailureText(failure: AutoDesignStepFailure): string {
  return `Auto Design stopped at the ${failure.step} step after ${failure.attempts === 1 ? "one try" : `${failure.attempts} tries`}: ${failure.message}. The last good plan is kept; build again to retry.`;
}

/** Run `fn`; on a throw try exactly once more; a second throw is returned, never rethrown. */
export function runWithOneRetry<T>(step: string, fn: (attempt: number) => T): OneRetryResult<T> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return { ok: true, value: fn(attempt), attempts: attempt };
    } catch (error) {
      lastError = error;
    }
  }
  return { ok: false, failure: { step, message: errorMessageOf(lastError), attempts: 2 } };
}

/**
 * Per-build guard for the post-build effects. A new user-started build resets it
 * (`beginBuild`); nothing else does. Each step may fail once and be retried on
 * its next run; the second failure stops it for this build. A step that is
 * re-fired by its OWN write (its input is the plan it just produced) may redraw
 * once more; a further self-triggered write is refused and reported.
 */
export class AutoDesignRedrawGuard {
  private buildIdValue = 0;
  private failures = new Map<string, number>();
  private lastOutput = new Map<string, { output: unknown; selfRedraws: number }>();
  private stoppedSteps = new Map<string, AutoDesignStepFailure>();

  constructor(private readonly onStop: (failure: AutoDesignStepFailure) => void = () => {}) {}

  get buildId(): number {
    return this.buildIdValue;
  }

  beginBuild(): number {
    this.buildIdValue += 1;
    this.failures.clear();
    this.lastOutput.clear();
    this.stoppedSteps.clear();
    return this.buildIdValue;
  }

  stopped(step: string): AutoDesignStepFailure | null {
    return this.stoppedSteps.get(step) ?? null;
  }

  canRun(step: string): boolean {
    return !this.stoppedSteps.has(step);
  }

  /** Record a throw. Returns true when the step may still retry once. */
  recordFailure(step: string, error: unknown): boolean {
    const attempts = (this.failures.get(step) ?? 0) + 1;
    this.failures.set(step, attempts);
    if (attempts < 2) return true;
    this.stop({ step, message: errorMessageOf(error), attempts });
    return false;
  }

  /**
   * Ask before writing `output` that was computed from `input`. Refuses (and
   * stops the step) when the step is rewriting its own previous output for the
   * second time in a row.
   */
  allowWrite(step: string, input: unknown, output: unknown): boolean {
    if (!this.canRun(step)) return false;
    const previous = this.lastOutput.get(step);
    const selfRedraws = previous && previous.output === input ? previous.selfRedraws + 1 : 0;
    if (selfRedraws > 1) {
      this.stop({ step, message: "it kept redrawing the plan it had just drawn", attempts: selfRedraws + 1 });
      return false;
    }
    this.lastOutput.set(step, { output, selfRedraws });
    return true;
  }

  /** Run one effect body under the guard. Never throws. */
  run(step: string, body: () => void): void {
    if (!this.canRun(step)) return;
    try {
      body();
    } catch (error) {
      this.recordFailure(step, error);
    }
  }

  private stop(failure: AutoDesignStepFailure): void {
    if (this.stoppedSteps.has(failure.step)) return;
    this.stoppedSteps.set(failure.step, failure);
    this.onStop(failure);
  }
}
