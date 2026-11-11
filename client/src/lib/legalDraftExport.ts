import { jsPDF } from "jspdf";
import JSZip from "jszip";

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** A .docx Tom can download and send himself. Nothing is emailed. */
export async function agreementDraftDocx(title: string, body: string): Promise<Blob> {
  const paragraphs = body.split(/\n/).map((line) => (
    `<w:p><w:r><w:t xml:space="preserve">${xmlEscape(line)}</w:t></w:r></w:p>`
  )).join("");
  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder("word")?.file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
<w:p><w:r><w:t>${xmlEscape(title)}</w:t></w:r></w:p>
${paragraphs}
</w:body></w:document>`);
  return zip.generateAsync({ type: "blob" });
}

/** A PDF of the same draft text. Nothing is emailed. */
export function agreementDraftPdf(title: string, body: string): Blob {
  const pdf = new jsPDF({ unit: "pt", format: "letter" });
  const lines = pdf.splitTextToSize(`${title}\n\n${body}`, 520) as string[];
  let y = 56;
  for (const line of lines) {
    if (y > 740) {
      pdf.addPage();
      y = 56;
    }
    pdf.text(line, 46, y);
    y += 14;
  }
  return pdf.output("blob");
}

export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
