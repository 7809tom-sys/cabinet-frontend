/** CSV is passed through. The first sheet of an Excel file becomes CSV for the same server parser. */
export async function fileToCsv(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv") || file.type.includes("csv") || file.type.startsWith("text/")) {
    return file.text();
  }
  const XLSX = await import("xlsx");
  const book = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const sheet = book.Sheets[book.SheetNames[0] ?? ""];
  if (!sheet) throw new Error("That workbook has no sheets.");
  return XLSX.utils.sheet_to_csv(sheet);
}
