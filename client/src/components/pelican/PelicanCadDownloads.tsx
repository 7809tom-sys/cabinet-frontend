import { pelicanCadDownloads } from "@/lib/pelicanCadModels";

/**
 * Links to Pelican's own drawing for this SKU. The file is the manufacturer
 * CAD (DWG, IGES, or STEP), not the mesh the designer draws.
 */
export function PelicanCadDownloads({
  pelicanCode,
  compact = false,
}: {
  pelicanCode?: string | null;
  compact?: boolean;
}) {
  const files = pelicanCadDownloads(pelicanCode);
  if (files.length === 0) return null;
  if (compact) {
    const file = files.find((entry) => entry.designerReady) ?? files[0]!;
    return (
      <a
        href={file.cadUrl}
        download={file.sourceFileName}
        data-testid="pelican-cad-download"
        className="text-[10px] font-medium text-[#1d4e89] underline-offset-2 hover:underline"
      >
        Manufacturer {file.fileType.toUpperCase()}
      </a>
    );
  }
  return (
    <div data-testid="pelican-cad-downloads" className="mt-4 rounded-lg border border-border/80 bg-muted/30 p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manufacturer drawings</div>
      <ul className="mt-2 space-y-1.5">
        {files.map((file) => (
          <li key={file.slug} className="flex flex-wrap items-baseline gap-x-2 text-sm">
            <a
              href={file.cadUrl}
              download={file.sourceFileName}
              className="font-medium text-[#1d4e89] underline-offset-2 hover:underline"
            >
              {file.label} · {file.fileType.toUpperCase()}
            </a>
            <span className="text-xs text-muted-foreground">{file.sourceFileName}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">
        Pelican's CAD file for this model. The designer draws the converted mesh when it is an open bowl, and keeps the measured basin otherwise.
      </p>
    </div>
  );
}
