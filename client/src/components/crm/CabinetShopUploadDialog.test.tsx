// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mutateAsync = vi.fn();
const invalidate = vi.fn();
vi.mock("@/lib/trpc", () => ({
  trpc: {
    useUtils: () => ({ crm: { board: { invalidate } } }),
    crmCabinetShops: { importShops: { useMutation: () => ({ mutateAsync, isPending: false }) } },
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CabinetShopUploadDialog } from "./CabinetShopUploadDialog";

afterEach(() => { cleanup(); mutateAsync.mockReset(); invalidate.mockReset(); });

const csv = [
  "name,region,city,address,phone,website,google_rating,review_count,type,brands_carried,rta_competitor,confidence,source",
  "Creative Kitchen Designs,Central FL,Altamonte Springs,\"999 Douglas Ave Ste 2229, Altamonte Springs, FL 32714\",(407) 774-4400,http://www.ckdflorida.com,,,showroom/dealer,Cambria (quartz),,high,Cambria dealer locator",
].join("\n");

describe("CabinetShopUploadDialog", () => {
  it("maps the library columns, previews by state, then imports on confirm", async () => {
    mutateAsync
      .mockResolvedValueOnce({ dryRun: true, inserted: 0, toImport: 1, byState: [{ state: "FL", toImport: 1, duplicates: 0 }], duplicates: [], skipped: [] })
      .mockResolvedValueOnce({ dryRun: false, inserted: 1, toImport: 1, byState: [{ state: "FL", toImport: 1, duplicates: 0 }], duplicates: [], skipped: [] });
    render(<CabinetShopUploadDialog />);
    fireEvent.click(screen.getByTestId("crm-cabinet-shops-upload"));
    const file = new File([csv], "Cabinet Shops in Florida.csv", { type: "text/csv" });
    fireEvent.change(screen.getByLabelText("Cabinet shop list file"), { target: { files: [file] } });
    await screen.findByText("Cabinet Shops in Florida.csv: 1 rows");
    expect((screen.getByPlaceholderText("e.g. FL") as HTMLInputElement).value).toBe("FL");

    fireEvent.click(screen.getByText("Preview"));
    await screen.findByTestId("crm-cabinet-shops-preview");
    const first = mutateAsync.mock.calls[0][0];
    expect(first.dryRun).toBe(true);
    expect(first.defaultState).toBe("FL");
    expect(first.rows[0]).toMatchObject({ name: "Creative Kitchen Designs", city: "Altamonte Springs", website: "http://www.ckdflorida.com", type: "showroom/dealer" });
    expect(screen.getByTestId("crm-cabinet-shops-preview").textContent).toContain("1 new shops to import · 0 duplicates skipped");

    fireEvent.click(screen.getByText("Import 1 shops"));
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
    expect(mutateAsync.mock.calls[1][0].dryRun).toBe(false);
    expect(screen.getByTestId("crm-cabinet-shops-preview").textContent).toContain("Imported 1 shops.");
  });
});
