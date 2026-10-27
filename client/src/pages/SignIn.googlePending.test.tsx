// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  signInWithOAuth: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  resetPasswordForEmail: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  supabase: { auth },
}));

vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({
      auth: {
        me: { invalidate: vi.fn(), fetch: vi.fn() },
        signInDestination: { fetch: vi.fn() },
      },
    }),
  },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({ t: (key: string) => key, lang: "en" }),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import SignIn from "./SignIn";
import { toast } from "sonner";

function signInButton() {
  return screen.getByRole("button", { name: "Sign In" }) as HTMLButtonElement;
}

function googleButton() {
  return screen.getByRole("button", { name: /Continue with Google/ }) as HTMLButtonElement;
}

function dispatchPageShow(persisted: boolean) {
  const event = new Event("pageshow");
  Object.defineProperty(event, "persisted", { value: persisted });
  act(() => {
    window.dispatchEvent(event);
  });
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

describe("SignIn Google pending state", () => {
  beforeEach(() => {
    auth.getSession.mockReset();
    auth.signInWithOAuth.mockReset();
    auth.signInWithPassword.mockReset();
    auth.getSession.mockResolvedValue({ data: { session: null } });
    auth.signInWithOAuth.mockImplementation(() => new Promise(() => {}));
    auth.signInWithPassword.mockImplementation(() => new Promise(() => {}));
    (toast.error as Mock).mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("re-enables email Sign In when Chrome restores the page from bfcache", () => {
    render(<SignIn />);
    fireEvent.click(googleButton());

    expect(signInButton().disabled).toBe(true);
    expect(googleButton().disabled).toBe(true);
    expect(googleButton().querySelector('[role="status"]')).not.toBeNull();

    dispatchPageShow(false);
    expect(signInButton().disabled).toBe(true);

    dispatchPageShow(true);

    expect(signInButton().disabled).toBe(false);
    expect(googleButton().disabled).toBe(false);
    expect(googleButton().querySelector('[role="status"]')).toBeNull();

    fireEvent.change(document.getElementById("login-email")!, { target: { value: "a@example.com" } });
    fireEvent.change(document.getElementById("login-password")!, { target: { value: "secret12" } });
    fireEvent.click(signInButton());

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "a@example.com",
      password: "secret12",
    });
  });

  it("re-enables the buttons when the page is visible again after the OAuth redirect hid it", () => {
    render(<SignIn />);
    fireEvent.click(googleButton());
    expect(signInButton().disabled).toBe(true);

    setVisibility("visible");
    expect(signInButton().disabled).toBe(true);

    setVisibility("hidden");
    expect(signInButton().disabled).toBe(true);
    expect(googleButton().disabled).toBe(true);

    setVisibility("visible");
    expect(signInButton().disabled).toBe(false);
    expect(googleButton().disabled).toBe(false);
  });

  it("clears a Google attempt that is still on this page after 15 seconds", () => {
    vi.useFakeTimers();
    render(<SignIn />);
    fireEvent.click(googleButton());
    expect(signInButton().disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(14_999);
    });
    expect(signInButton().disabled).toBe(true);
    expect(googleButton().disabled).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(signInButton().disabled).toBe(false);
    expect(googleButton().disabled).toBe(false);
  });

  it("keeps the buttons disabled when Google accepts the redirect and this page has not unloaded", async () => {
    let resolveOAuth: (value: { error: null }) => void = () => {};
    auth.signInWithOAuth.mockImplementation(
      () => new Promise<{ error: null }>((resolve) => {
        resolveOAuth = resolve;
      }),
    );
    render(<SignIn />);
    fireEvent.click(googleButton());

    await act(async () => {
      resolveOAuth({ error: null });
    });

    expect(signInButton().disabled).toBe(true);
    expect(googleButton().disabled).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("still clears immediately when Google sign-in returns an error", async () => {
    let resolveOAuth: (value: { error: Error | null }) => void = () => {};
    auth.signInWithOAuth.mockImplementation(
      () => new Promise<{ error: Error | null }>((resolve) => {
        resolveOAuth = resolve;
      }),
    );
    vi.useFakeTimers();
    render(<SignIn />);
    const timersAfterRender = vi.getTimerCount();
    fireEvent.click(googleButton());
    expect(vi.getTimerCount()).toBe(timersAfterRender + 1);

    await act(async () => {
      resolveOAuth({ error: new Error("popup blocked") });
    });

    expect(signInButton().disabled).toBe(false);
    expect(googleButton().disabled).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("popup blocked");
    expect(vi.getTimerCount()).toBe(timersAfterRender);
  });

  it("does not abandon an in-progress email sign-in when the page is shown again", () => {
    render(<SignIn />);
    fireEvent.change(document.getElementById("login-email")!, { target: { value: "a@example.com" } });
    fireEvent.change(document.getElementById("login-password")!, { target: { value: "secret12" } });
    const submit = signInButton();
    fireEvent.click(submit);
    expect(submit.disabled).toBe(true);

    dispatchPageShow(true);
    setVisibility("hidden");
    setVisibility("visible");

    expect(submit.disabled).toBe(true);
    expect(auth.signInWithOAuth).not.toHaveBeenCalled();
  });

  it("removes the page listeners and the safety timer on unmount", () => {
    vi.useFakeTimers();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const removeWindow = vi.spyOn(window, "removeEventListener");
    const removeDocument = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<SignIn />);
    fireEvent.click(googleButton());
    const timerIndex = setTimeoutSpy.mock.calls.findIndex((call) => call[1] === 15_000);
    expect(timerIndex).toBeGreaterThanOrEqual(0);
    const timerId = setTimeoutSpy.mock.results[timerIndex]?.value;

    unmount();

    expect(removeWindow.mock.calls.some(([type]) => type === "pageshow")).toBe(true);
    expect(removeDocument.mock.calls.some(([type]) => type === "visibilitychange")).toBe(true);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(timerId);
  });
});
