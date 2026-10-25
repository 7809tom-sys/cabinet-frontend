import type { BuildSheetRow } from "@/components/design/DesignActions";

export type MaterialListPdfArgs = {
  room: { width: number; depth: number };
  styleName: string | null;
  buildRows: BuildSheetRow[];
};

export function canOpenAdministratorMaterialList(role: string | null | undefined): boolean {
  return role === "admin";
}

export function materialListPdfLines(rows: BuildSheetRow[]): string[] {
  return rows
    .filter((row) => row.qty > 0)
    .map((row) => {
      const dimensions = `${row.widthIn}\"W × ${row.heightIn}\"H × ${row.depthIn}\"D`;
      const finish = row.color?.trim() ? ` · ${row.color.trim()}` : "";
      const swing = row.swing ? ` · ${row.swing} hinge` : "";
      return `${row.qty} × ${row.code} — ${row.description}${finish} · ${dimensions}${swing}`;
    });
}

/**
 * Opens a print-ready PDF containing material quantities and specifications only.
 * This deliberately omits every price/cost column; the administrator can use the
 * exact material list for external price shopping without exposing pricing data.
 */
export async function openAdministratorMaterialListPdf(args: MaterialListPdfArgs): Promise<boolean> {
  const lines = materialListPdfLines(args.buildRows);
  if (lines.length === 0) return false;

  // Open synchronously from the user action so the browser does not block the
  // resulting PDF tab while the jsPDF module loads.
  const preview = window.open("", "_blank", "noopener,noreferrer");
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const left = 44;
  const bottom = 744;
  let y = 46;

  const addHeader = () => {
    pdf.setTextColor(17, 40, 68);
    pdf.setFontSize(18);
    pdf.text("Kitchen Design Material List", left, y);
    y += 20;
    pdf.setFontSize(9);
    pdf.setTextColor(82, 97, 116);
    pdf.text(
      `Room: ${args.room.width}\" × ${args.room.depth}\" · Style: ${args.styleName?.trim() || "Not selected"} · Generated ${new Date().toLocaleString()}`,
      left,
      y,
    );
    y += 26;
    pdf.setTextColor(31, 41, 55);
  };

  addHeader();
  for (const line of lines) {
    const wrapped = pdf.splitTextToSize(line, 515) as string[];
    const height = Math.max(15, wrapped.length * 11 + 6);
    if (y + height > bottom) {
      pdf.addPage();
      y = 46;
      addHeader();
    }
    pdf.setFontSize(10);
    pdf.text(wrapped, left, y);
    y += height;
  }

  pdf.setFontSize(8);
  pdf.setTextColor(82, 97, 116);
  pdf.text("Internal administrator material list — specifications and quantities only; no pricing is included.", left, 770);

  const url = String(pdf.output("bloburl"));
  if (preview) {
    preview.location.href = url;
    preview.focus();
  } else {
    pdf.save(`kitchen-material-list-${Date.now()}.pdf`);
  }
  return true;
}
