// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { CustomerGeneratedImagesList } from "./CustomerGeneratedImages";

afterEach(() => cleanup());

describe("CustomerGeneratedImagesList", () => {
  it("lists the customer's generated images and the linked order", () => {
    render(
      <CustomerGeneratedImagesList
        schemaReady
        images={[{
          id: 5,
          imageType: "cabinet_render",
          model: "gemini-3.1-flash-image",
          purpose: "customer",
          status: "succeeded",
          imageUrl: "https://cdn.example/cab.png",
          orderId: 18,
          designId: 40,
          createdAt: "2026-10-02T15:00:00.000Z",
        }]}
      />,
    );
    expect(screen.getByText(/cabinet_render · succeeded/)).toBeTruthy();
    expect(screen.getByText(/order 18/)).toBeTruthy();
    expect(screen.getByRole("img").getAttribute("src")).toBe("https://cdn.example/cab.png");
  });

  it("shows an empty state", () => {
    render(<CustomerGeneratedImagesList schemaReady images={[]} />);
    expect(screen.getByText(/No generated images/)).toBeTruthy();
  });
});
