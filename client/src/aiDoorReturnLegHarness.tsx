/**
 * Dev-only capture harness for the AI door-description return leg.
 *
 * Tom's report was that a described door never came back into the Edit Door
 * Style field, so the designer never saw it. This page renders the SHIPPED
 * components against fixed data so each half of that path can be photographed:
 *
 *   ?state=saved   the answer landed in the door's description field; the column
 *                  shows its green check.
 *   ?state=waiting the call is in flight; the column shows "Sending to AI…".
 *   ?state=failed  the model could not answer; the column names the reason.
 *   ?state=door    the door the 3D Designer builds from that description, using
 *                  the real `designerFacePlan` / `designerCatalogDoorProfile`
 *                  pipeline and the real `addCabinet` mesh builder.
 *
 * NOTHING HERE IS A LIVE MODEL CALL. The description is a realistic answer in
 * the shipped prompt's own labelled shape, returned by a stub standing in for
 * `aiDoorDescription.describeWithAi`. No provider key is available to this
 * machine and none is used: every "AI" result on this page is mocked, and the
 * capture is labelled as such.
 *
 * Imported by nothing in the app. Loaded only by
 * `e2e/ai-door-description-return-leg.spec.ts`, the same way the other
 * `client/dev/*-shot.html` pages are used.
 */
import * as THREE from "three";
import { createRoot } from "react-dom/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createTRPCReact } from "@trpc/react-query";
import { httpBatchLink } from "@trpc/client";
import superjson from "superjson";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnyRouter } from "@trpc/server";
import { addCabinet } from "@/components/design/InteractiveRoom3D";
import { AiDoorDescriptionCompare } from "@/components/admin/AiDoorDescriptionCompare";
import { aiDoorPreviewGeometry } from "@/lib/aiDoorPreview";
import { designerCatalogDoorProfile } from "@/lib/doorStyleAppearance";
import { designerFacePlan } from "@/lib/designerFacePlan";
import { resolveDoorColor } from "@shared/doorColorResolve";
import { parseAiDoorDescription } from "@shared/aiDoorDescription";
import { RESTORED_DOOR_LIGHTS } from "@shared/doorRenderLights";
import type { CabinetFacePlan } from "@shared/doorFaceRecognition";
import "../src/index.css";

/**
 * The answer the stub returns: a realistic description in exactly the shape the
 * standing prompt asks for, so the parser reads every field and the designer
 * has real numbers to build from.
 */
export const MOCK_DESCRIPTION = [
  "Style family: raised panel",
  "Frame construction: five-piece, mitered corners",
  "Stile width: 2 1/2 in",
  "Rail width: 2 1/2 in",
  "Top rail: 2 1/2 in",
  "Bottom rail: 2 1/2 in",
  "Mid rail: none",
  "Panel type: raised",
  "Bevel width: 3/4 in",
  "Panel profile: raised centre with a sloped pillow bevel",
  "Door outside profile: eased square edge",
  "Inside edge: ogee",
  "Moulding: none",
  "Beads and grooves: none",
  "Finish: painted",
  "Color: warm ivory",
  "Sheen: matte",
  "Undertone: warm",
  "Grain direction: none",
  "Material: painted MDF",
  "Door proportions: narrow door, about 1:2",
].join("\n");

/** The door row the editor is describing. Shape matches `AiDoorCompareStyle`. */
const STYLE = {
  id: 330026,
  doorStyle: "Raised Panel",
  color: "Warm Ivory",
  renderHex: null,
  finish: "Painted",
  woodSpecies: "Painted HDF",
  panelConstruction: "raised" as const,
  railWidth: null,
  stileWidth: null,
  bevelWidth: null,
  bevelDepth: null,
  insideEdgeProfile: null,
  finishSheen: "satin" as const,
  grainDirection: "none" as const,
};

const STATE = new URLSearchParams(window.location.search).get("state") ?? "saved";

/**
 * Stands in for the server procedure at the network layer.
 *
 * The real component, the real tRPC hook and the real request all run; only the
 * provider answer is faked, because this machine has no provider key and the
 * production API is not being called from a capture. Every response is the same
 * shape `aiDoorDescription.describeWithAi` returns.
 */
function installStubbedProcedure(state: string) {
  const answerFor = () => {
    if (state === "failed") {
      return { status: "error", model: "gpt", code: "rate-limited", message: "GPT is busy right now. Try Generate again in a moment." };
    }
    if (state === "not-connected") {
      return { status: "not-connected", model: "gpt", message: "GPT isn't connected yet. Add OPENAI_API_KEY on the API server." };
    }
    if (state === "empty") {
      return { status: "ok", model: "gpt", description: "   ", providerModel: "gpt-4.1-mini" };
    }
    return { status: "ok", model: "gpt", description: MOCK_DESCRIPTION, providerModel: "gpt-4.1-mini" };
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (!url.includes("aiDoorDescription.describeWithAi")) return originalFetch(input, init);

    // The "waiting" capture is the in-flight state, so the answer never lands.
    if (state === "waiting") {
      return new Promise<Response>(() => undefined);
    }

    // tRPC's batch shape: an array of per-call results, superjson-wrapped, which
    // is exactly what the real server returns through the same transformer.
    const payload = JSON.stringify([
      { result: { data: { json: answerFor(), meta: undefined } } },
    ]);
    return new Response(payload, { status: 200, headers: { "content-type": "application/json" } });
  };
}

installStubbedProcedure(STATE);

/** A capture banner, so no screenshot can be mistaken for a live model call. */
function Banner({ state }: { state: string }) {
  const label = state === "door"
    ? "3D Designer build — description from a MOCKED AI answer (no provider key on this machine)"
    : `Edit Door Style — MOCKED AI answer (no provider key on this machine) · state: ${state}`;
  return (
    <div
      style={{
        font: "600 12px/1.4 system-ui, sans-serif",
        background: "#1f2937",
        color: "#fff",
        padding: "6px 10px",
        letterSpacing: 0.2,
      }}
    >
      {label}
    </div>
  );
}

/**
 * The editor panel with a stub procedure, driving the real component so the
 * field, the indicator and the handoff are the shipped code.
 */
function EditorCapture({ state }: { state: string }) {
  const [doorField, setDoorField] = useState("Haven Harbor style, rails look 2-3/4 in, mitered corners.");
  const [autoRan, setAutoRan] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Press "Compare descriptions" and then the column's Generate, so the capture
  // shows the result rather than an empty panel.
  useEffect(() => {
    if (autoRan) return;
    const root = container.current;
    if (!root) return;
    const clickByTestId = (id: string) => {
      const el = root.querySelector(`[data-testid="${id}"]`) as HTMLElement | null;
      el?.click();
      return Boolean(el);
    };
    const timer = window.setTimeout(() => {
      if (!clickByTestId("ai-door-compare-start")) return;
      window.setTimeout(() => {
        clickByTestId("ai-door-generate-gpt");
        setAutoRan(true);
      }, 60);
    }, 60);
    return () => window.clearTimeout(timer);
  }, [autoRan]);

  return (
    <div style={{ width: 1100, padding: 16, background: "#fff" }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ font: "600 13px/1.3 system-ui, sans-serif", color: "#111827" }}>
          Profile Description
        </div>
        <div style={{ font: "400 11px/1.4 system-ui, sans-serif", color: "#6b7280", marginTop: 2 }}>
          Long-form educational description shown on the public Door Styles page.
        </div>
        <textarea
          readOnly
          data-testid="door-description-field"
          value={doorField}
          rows={9}
          style={{
            width: "100%",
            marginTop: 6,
            padding: 8,
            font: "400 12px/1.5 ui-monospace, monospace",
            border: "1px solid #d1d5db",
            borderRadius: 6,
            background: "#fafafa",
            resize: "vertical",
          }}
        />
      </div>
      <div ref={container}>
        <AiDoorDescriptionCompare
          style={STYLE}
          sampleUrl={null}
          instructions={doorField}
          onDescription={({ description }) => {
            const next = description.trim();
            if (!next) return false;
            setDoorField(next);
            return true;
          }}
        />
      </div>
    </div>
  );
}

/** The door the Designer builds from the parsed description. */
function DoorCapture() {
  const host = useRef<HTMLDivElement>(null);
  const [facts, setFacts] = useState<Record<string, string>>({});

  const parsed = useMemo(() => parseAiDoorDescription("gpt", MOCK_DESCRIPTION), []);
  const profile = useMemo(
    () => designerCatalogDoorProfile({ ...STYLE, profileDescription: MOCK_DESCRIPTION } as never),
    [],
  );
  const plan = useMemo(
    () => designerFacePlan({ ...STYLE, profileDescription: MOCK_DESCRIPTION } as never, "base") as CabinetFacePlan | null,
    [],
  );
  const color = useMemo(
    () => resolveDoorColor({ ...STYLE, profileDescription: MOCK_DESCRIPTION } as never),
    [],
  );

  useEffect(() => {
    const pane = host.current;
    if (!pane) return;
    const size = 900;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(1);
    renderer.setSize(size, size, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = RESTORED_DOOR_LIGHTS.exposure;
    pane.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(RESTORED_DOOR_LIGHTS.background);
    scene.environmentIntensity = RESTORED_DOOR_LIGHTS.environment;
    scene.add(new THREE.HemisphereLight(
      RESTORED_DOOR_LIGHTS.hemisphere.sky,
      RESTORED_DOOR_LIGHTS.hemisphere.ground,
      RESTORED_DOOR_LIGHTS.hemisphere.intensity,
    ));
    const key = new THREE.DirectionalLight(RESTORED_DOOR_LIGHTS.key.color, RESTORED_DOOR_LIGHTS.key.intensity);
    key.position.set(0.6, 1.5, 2.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(RESTORED_DOOR_LIGHTS.fill.color, RESTORED_DOOR_LIGHTS.fill.intensity);
    fill.position.set(-1.0, 0.4, 2.0);
    scene.add(fill);

    const camera = new THREE.PerspectiveCamera(30, 1, 0.05, 100);
    const root = new THREE.Group();
    addCabinet(
      root,
      {
        placementUid: "ai-described-base",
        masterCode: "B24",
        description: '24" Two Door Base Cabinet',
        placementType: "base",
        width: 24,
        depth: 24,
        height: 34.5,
        numberOfDoors: 2,
        numberOfDrawers: 0,
        category: "Base",
        subCategory: "Standard Base",
      } as never,
      "back",
      { back: 0 },
      144,
      120,
      color.appliedHex,
      "#eeeeee",
      profile as never,
      { x: 0, z: 0, rotation: 0 },
      plan?.doorUrl ?? null,
      undefined,
      {
        selectedToeKick: true,
        drawerSampleUrl: plan?.drawerUrl ?? null,
        faceSourceKind: plan?.sourceKind,
        faceCrop: plan?.dlcCrop ?? null,
      },
    );
    scene.add(root);

    const bounds = new THREE.Box3().setFromObject(root);
    const centre = new THREE.Vector3();
    bounds.getCenter(centre);
    camera.position.set(centre.x, centre.y, bounds.max.z + 3.1);
    camera.lookAt(centre.x, centre.y, centre.z);
    renderer.render(scene, camera);

    const geometry = aiDoorPreviewGeometry(parsed.params);
    setFacts({
      "Style family": String(parsed.params.family),
      "Panel type": String(parsed.params.panelConstruction),
      "Rail / stile": `${parsed.params.railIn ?? "default"} in / ${parsed.params.stileIn ?? "default"} in`,
      "Bevel width": `${parsed.params.bevelWidthIn ?? "default"} in`,
      "Inside edge": String(parsed.params.insideEdgeProfile),
      "Corner joint": String(parsed.params.cornerJoint),
      Finish: parsed.params.painted ? "painted (solid, no grain)" : "stained",
      "Grain direction": String(parsed.params.grainDirection),
      Colour: `${parsed.params.colorText} → ${color.appliedHex} (${color.appliedSource})`,
      // The description parser does not map material yet (it is asked for so a
      // person can rebuild the door). Shown as the raw line, not as applied.
      "Material line": "painted MDF (asked for; the parser does not map this yet)",
      "Species on the style": String(STYLE.woodSpecies),
      "Blueprint drawn": String(parsed.params.entryId),
      "Face plan": String(plan?.sourceKind ?? "none"),
      "Geometry used": `${geometry.opening.width.toFixed(1)} × ${geometry.opening.height.toFixed(1)} opening, raised centre ${geometry.raisedCenter ? "yes" : "no"}`,
    });

    return () => {
      renderer.dispose();
      pane.replaceChildren();
    };
  }, [parsed, profile, plan, color]);

  return (
    <div style={{ display: "flex", gap: 18, padding: 16, background: "#fff", width: 1420 }}>
      <div ref={host} data-testid="designer-door-canvas" style={{ width: 900, height: 900 }} />
      <div style={{ width: 460, font: "400 12px/1.6 system-ui, sans-serif" }}>
        <div style={{ font: "600 14px/1.3 system-ui, sans-serif", marginBottom: 8 }}>
          What the Designer read from the description
        </div>
        <table data-testid="designer-facts" style={{ borderCollapse: "collapse", width: "100%" }}>
          <tbody>
            {Object.entries(facts).map(([k, v]) => (
              <tr key={k}>
                <td style={{ borderTop: "1px solid #e5e7eb", padding: "5px 8px 5px 0", color: "#6b7280", whiteSpace: "nowrap", verticalAlign: "top" }}>
                  {k}
                </td>
                <td style={{ borderTop: "1px solid #e5e7eb", padding: "5px 0", color: "#111827", fontFamily: "ui-monospace, monospace" }}>
                  {v}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ marginTop: 12, color: "#6b7280" }}>
          Rendered through the shipped <code>addCabinet</code> mesh builder, fed the shipped
          <code> designerFacePlan</code> and <code>designerCatalogDoorProfile</code> for this style and
          description.
        </p>
      </div>
    </div>
  );
}

/**
 * A local tRPC client so the real panel can mount and call its mutation.
 *
 * The request itself goes to `/api/trpc` and is answered by
 * `installStubbedProcedure` below, so the hook, the request shape and the
 * response reader are all the shipped code. The app's `AppRouter` type lives in
 * the backend repository, so the created hooks object is cast here the same way
 * `fabricationSheetHarness.tsx` does it.
 */
type HarnessTrpc = {
  Provider: React.ComponentType<{ client: unknown; queryClient: QueryClient; children: React.ReactNode }>;
  createClient: (options: { links: unknown[] }) => unknown;
};
const harnessQueryClient = new QueryClient();
const trpcLoose = createTRPCReact<AnyRouter>() as unknown as HarnessTrpc;
const harnessClient = trpcLoose.createClient({
  links: [httpBatchLink({ url: "/api/trpc", transformer: superjson })],
});

function App() {
  return (
    <trpcLoose.Provider client={harnessClient} queryClient={harnessQueryClient}>
      <QueryClientProvider client={harnessQueryClient}>
        <Banner state={STATE} />
        {STATE === "door" ? <DoorCapture /> : <EditorCapture state={STATE} />}
      </QueryClientProvider>
    </trpcLoose.Provider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
