/**
 * Screenshot harness for the Countertop Fabrication Sheet.
 *
 * Builds a real kitchen from the app's own design model, renders the real
 * Designer panel against it, and exposes the generated sheet plus the PDF bytes
 * on `window.__fabricationSheet` so the Playwright spec can assert on real
 * numbers and save the PDF as an artifact.
 *
 * Dev-only: loaded from client/dev/fabrication-sheet.html, imported by nothing in
 * the app, and reachable at no route.
 */
import { createRoot } from "react-dom/client";
import type React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import type { AnyRouter } from "@trpc/server";
import superjson from "superjson";
import { LanguageProvider } from "@/contexts/LanguageContext";
import "@/index.css";
import { CountertopFabricationSheetActions } from "@/components/design/CountertopFabricationSheetActions";
import {
  buildCountertopFabricationSheet,
  type CountertopFabricationSheet,
} from "@/lib/countertopFabricationSheet";
import {
  buildFabricationSheetPdf,
  ensureJsPdf,
  fabricationSheetEmailBody,
} from "@/lib/countertopFabricationSheetPdf";
import type { PlacedCabinet, RoomData, SinkFixture } from "@/lib/design";

const room: RoomData = { width: 144, depth: 120, ceilingHeight: 96 };

const base = (overrides: Partial<PlacedCabinet>): PlacedCabinet => ({
  uid: "base",
  cabinetId: 1,
  masterCode: "B-24",
  description: '24" Base Cabinet',
  category: "Base",
  placement: "base",
  x: 0,
  y: 0,
  width: 24,
  depth: 24,
  height: 34.5,
  rotation: 0,
  ...overrides,
});

const placed: PlacedCabinet[] = [
  base({ uid: "back-1", masterCode: "B-36", x: 0, y: 0, width: 36, wallId: "top", wallOffset: 0 }),
  base({ uid: "back-2", masterCode: "B-36", x: 36, y: 0, width: 36, wallId: "top", wallOffset: 36 }),
  base({ uid: "back-3", masterCode: "B-36", x: 72, y: 0, width: 36, wallId: "top", wallOffset: 72 }),
  base({ uid: "back-4", masterCode: "B-36", x: 108, y: 0, width: 36, wallId: "top", wallOffset: 108 }),
  base({ uid: "front-1", masterCode: "B-54", x: 0, y: 96, width: 54, wallId: "bottom", wallOffset: 0 }),
  base({ uid: "sb-36", masterCode: "SB36", description: '36" Sink Base Cabinet', x: 54, y: 96, width: 36, wallId: "bottom", wallOffset: 54 }),
  base({ uid: "front-2", masterCode: "B-54", x: 90, y: 96, width: 54, wallId: "bottom", wallOffset: 90 }),
];

const sinks: SinkFixture[] = [{
  uid: "sink-1",
  type: "double",
  x: 55.5,
  y: 97.5,
  width: 33,
  depth: 20,
  faucet: true,
  wallSide: "bottom",
  cabinetUid: "sb-36",
  sourceWidth: 33,
  sourceDepth: 20,
}];

const sheetInput = {
  room,
  placed,
  sinks,
  edgeProfileId: "eased",
  backsplash: { heightIn: 4 },
  selectedSurfaces: [{
    id: 1,
    name: "Calacatta Quartz",
    category: "Surfaces",
    subCategory: "Countertops",
    pelicanCode: "PL-CT-CAL",
    size: '126" x 63"',
    countertopScope: "all" as const,
  }],
  job: {
    designId: 4711,
    designName: "Rivera kitchen",
    projectName: "123 Oak St",
    roomLabel: "Kitchen",
    roomType: "kitchen",
    customerName: "J. Rivera",
    customerEmail: "rivera@example.com",
  },
};

const sheet: CountertopFabricationSheet = buildCountertopFabricationSheet(sheetInput);

/**
 * A local tRPC client so the panel's email dialog can mount. Nothing is called:
 * the screenshot never sends mail, and the dialog is opened only to show its
 * fields. The mutation itself is what would reach the backend.
 *
 * The app's `AppRouter` type lives in the backend repository, and tRPC's
 * `createTRPCReact` only accepts a real router type, so the created hooks object
 * is cast for this dev-only harness.
 */
type HarnessTrpc = {
  Provider: React.ComponentType<{
    client: unknown;
    queryClient: QueryClient;
    children: React.ReactNode;
  }>;
  createClient: (options: { links: unknown[] }) => unknown;
};
const harnessQueryClient = new QueryClient();
const trpcLoose = createTRPCReact<AnyRouter>() as unknown as HarnessTrpc;
const harnessClient = trpcLoose.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

declare global {
  interface Window {
    __fabricationSheet?: {
      status: "ok" | "error";
      sheet: CountertopFabricationSheet;
      email: { subject: string; text: string };
      pdfBase64?: string;
      error?: string;
    };
  }
}

const planSummary = document.getElementById("plan-summary");
if (planSummary) {
  planSummary.innerHTML = [
    `<strong>${placed.length}</strong> base cabinets · room ${room.width}" × ${room.depth}"`,
    `<strong>${sheet.totals.runCount}</strong> countertop runs · <strong>${sheet.totals.squareFeet}</strong> sq ft`,
    `<strong>${sheet.totals.cutoutCount}</strong> opening(s): ${sheet.runs.flatMap((run) => run.cutouts).map((cutout) => `${cutout.kind} ${cutout.alongIn}" × ${cutout.acrossIn}" at ${cutout.centerFromStartIn}"`).join(", ")}`,
    `<strong>${sheet.unknowns.length}</strong> field(s) left blank because the design does not store them`,
  ].join("<br />");
}

createRoot(document.getElementById("panel")!).render(
  <trpcLoose.Provider client={harnessClient} queryClient={harnessQueryClient}>
    <QueryClientProvider client={harnessQueryClient}>
      <LanguageProvider>
        <CountertopFabricationSheetActions input={sheetInput} brandName="CabinetDealz" />
      </LanguageProvider>
    </QueryClientProvider>
  </trpcLoose.Provider>,
);

// The same panel at the real Designer sidebar width, so the capture shows how it
// actually sits beside the price summary.
createRoot(document.getElementById("panel-sidebar")!).render(
  <trpcLoose.Provider client={harnessClient} queryClient={harnessQueryClient}>
    <QueryClientProvider client={harnessQueryClient}>
      <LanguageProvider>
        <CountertopFabricationSheetActions input={sheetInput} brandName="CabinetDealz" />
      </LanguageProvider>
    </QueryClientProvider>
  </trpcLoose.Provider>,
);

// Build the PDF the panel would download, so the spec can save it as an artifact.
void (async () => {
  const JsPdf = await ensureJsPdf();
  const pdf = buildFabricationSheetPdf(sheet, "CabinetDealz", JsPdf);
  const bytes = new Uint8Array(pdf.output("arraybuffer") as ArrayBuffer);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) binary += String.fromCharCode(bytes[index]!);

  window.__fabricationSheet = {
    status: "ok",
    sheet,
    email: fabricationSheetEmailBody(sheet, { brandName: "CabinetDealz" }),
    pdfBase64: btoa(binary),
  };
})().catch((error: unknown) => {
  window.__fabricationSheet = {
    status: "error",
    sheet,
    email: fabricationSheetEmailBody(sheet, { brandName: "CabinetDealz" }),
    error: error instanceof Error ? error.message : String(error),
  };
});
