// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { WallPicker } from "./WallPicker";

afterEach(cleanup);

describe("WallPicker custom room targets", () => {
  it("shows only user-drawn walls and returns their exact ids", () => {
    const onPick = vi.fn();
    render(
      <LanguageProvider>
        <WallPicker
          onPick={onPick}
          customTargets={[
            { id: "custom-wall-1", label: "Wall 1" },
            { id: "custom-wall-2", label: "Wall 2 · +45°" },
          ]}
        />
      </LanguageProvider>,
    );

    expect(screen.getByRole("button", { name: "Wall 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Wall 2 · +45°" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /back/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /front/i })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Wall 2 · +45°" }));
    expect(onPick).toHaveBeenCalledWith("custom-wall-2");
  });
});
