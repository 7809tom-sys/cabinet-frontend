import QRCode from "qrcode";

/**
 * Generate a QR code as a PNG data URL for embedding in print sheets / images.
 * Uses a high error-correction level so the code still scans if the printout
 * is smudged or partially obscured.
 */
export async function makeQrDataUrl(
  value: string,
  opts?: { size?: number; margin?: number },
): Promise<string> {
  return QRCode.toDataURL(value, {
    errorCorrectionLevel: "M",
    margin: opts?.margin ?? 1,
    width: opts?.size ?? 240,
    color: { dark: "#0f2540", light: "#ffffff" },
  });
}
