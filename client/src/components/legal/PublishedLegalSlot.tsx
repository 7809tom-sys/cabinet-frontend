import type { ReactNode } from "react";
import { useMembershipProgramProcedures, type LegalSlotView } from "@/lib/membershipProgramProcedures";
import type { LegalSheet } from "@shared/legalPages";

export function WarrantySheetTable({ sheet }: { sheet: LegalSheet }) {
  return (
    <div className="max-w-5xl mx-auto px-4 pb-16" data-testid="warranty-sheet">
      <h2 className="text-xl font-semibold mb-2">Per-cabinet warranty sheet</h2>
      <p className="text-sm text-muted-foreground mb-4">
        This table is the spreadsheet uploaded for this page. It does not change the warranty wording above.
      </p>
      <div className="overflow-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              {sheet.headers.map((header) => (
                <th key={header} className="px-3 py-2 text-left font-semibold">{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, index) => (
              <tr key={index} className="border-t border-border">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-2 align-top">{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function PublishedLegalSlot({ slug, children }: { slug: string; children: ReactNode }) {
  const api = useMembershipProgramProcedures();
  const query = api.legalPages.published.useQuery({ slug }, { retry: false });
  const presentation = query.data;
  const custom = presentation && presentation.render !== "site-page";
  return (
    <div>
      {custom && presentation.render === "text" && presentation.bodyText ? (
        <article className="max-w-3xl mx-auto px-4 py-16 whitespace-pre-wrap text-foreground leading-relaxed">{presentation.bodyText}</article>
      ) : custom && presentation.render === "file" && presentation.file ? (
        <div className="max-w-3xl mx-auto px-4 py-16">
          <h1 className="text-3xl font-bold mb-4">Document</h1>
          <p className="text-muted-foreground">The published file is {presentation.file.fileName}.</p>
          {presentation.fileDataUrl ? (
            <a className="mt-3 inline-block font-semibold underline underline-offset-4" href={presentation.fileDataUrl} download={presentation.file.fileName}>
              Download {presentation.file.fileName}
            </a>
          ) : null}
          {presentation.bodyText ? <pre className="mt-6 whitespace-pre-wrap text-sm">{presentation.bodyText}</pre> : null}
        </div>
      ) : (
        children
      )}
      {presentation?.sheet ? <WarrantySheetTable sheet={presentation.sheet} /> : null}
    </div>
  );
}

export type { LegalSlotView };
