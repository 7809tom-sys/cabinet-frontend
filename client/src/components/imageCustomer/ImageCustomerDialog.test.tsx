// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageCustomerForm } from "./ImageCustomerDialog";

afterEach(() => cleanup());

describe("ImageCustomerForm", () => {
  it("picks an existing customer and can quick-add a contact", () => {
    const onPick = vi.fn();
    const onQuickAdd = vi.fn();
    const onSearch = vi.fn();
    render(
      <ImageCustomerForm
        options={[{ customerId: 9, customerKind: "crm", name: "Riley Buyer", email: "riley@example.com" }]}
        searching={false}
        saving={false}
        error={null}
        onSearch={onSearch}
        onPick={onPick}
        onQuickAdd={onQuickAdd}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Riley Buyer/ }));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ customerId: 9, customerKind: "crm" }));

    fireEvent.change(screen.getByLabelText("Search customers"), { target: { value: "ada" } });
    fireEvent.click(screen.getByRole("button", { name: "Search" }));
    expect(onSearch).toHaveBeenCalledWith("ada");

    fireEvent.change(screen.getByLabelText("Customer name"), { target: { value: "New Buyer" } });
    fireEvent.change(screen.getByLabelText("Customer email"), { target: { value: "new@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Add and continue" }));
    expect(onQuickAdd).toHaveBeenCalledWith({ name: "New Buyer", email: "new@example.com", phone: "" });
  });
});
