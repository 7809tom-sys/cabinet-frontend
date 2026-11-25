/**
 * Manifest for Pelican manufacturer drawings.
 *
 * CabinetDealz keeps large binaries on the backend at /manus-storage/, and the
 * frontend proxies that path to the Railway API. This environment has no
 * storage credentials and the backend has no public call that accepts a CAD or
 * GLB upload, so these files ship from client/public and Vite serves them.
 *
 * If CABINET_STORAGE_UPLOAD_URL and CABINET_STORAGE_TOKEN are set, this script
 * still does not upload: the backend contract for that endpoint is not in this
 * repo. It prints the files and the public URLs and exits without sending them.
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const roots = [
  ["client/public/models/pelican", "/models/pelican"],
  ["client/public/cad/pelican", "/cad/pelican"],
];

const files = [];
for (const [dir, urlBase] of roots) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    files.push({
      path,
      url: `${urlBase}/${name}`,
      bytes: statSync(path).size,
      storageKey: `pelican/${dir.endsWith("models/pelican") ? "models" : "cad"}/${name}`,
    });
  }
}

const credentialed = Boolean(process.env.CABINET_STORAGE_UPLOAD_URL && process.env.CABINET_STORAGE_TOKEN);
console.log(JSON.stringify({
  credentialed,
  upload: credentialed
    ? "Credentials are set, but this repo does not contain the backend upload call. Leave the files in client/public until that call exists."
    : "No CABINET_STORAGE_UPLOAD_URL or CABINET_STORAGE_TOKEN. Files stay in client/public, which is what the designer loads.",
  fileCount: files.length,
  bytes: files.reduce((sum, file) => sum + file.bytes, 0),
  files,
}, null, 2));
