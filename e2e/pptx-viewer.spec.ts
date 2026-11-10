import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { mockApi, mockSupabaseAuth } from "../client/src/testing/perTabApi";

test("clicking a deck renders it in the page and does not download", async ({ page }) => {
  const downloads: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  let popups = 0;
  page.on("popup", () => { popups += 1; });

  await page.goto("/dev/pptx-preview");
  await expect(page.getByText("Choose a deck to read it here.")).toBeVisible();
  await expect(page.getByTestId("pptx-slide-host")).toHaveCount(0);

  await page.getByRole("button", { name: "Cabinetdealz investor update" }).click();
  await expect(page.getByTestId("pptx-uploaded")).toHaveText("Uploaded Nov 10, 2026");
  await expect(page.getByTestId("pptx-slide-host")).toContainText("Private decks stay in this browser.", { timeout: 30_000 });
  await expect(page.locator(".pptx-preview-wrapper-pagination")).toHaveText("1/2");
  await expect(page.getByRole("button", { name: /Download/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Download/ })).toHaveCount(0);
  expect(downloads).toEqual([]);
  expect(popups).toBe(0);
  expect(page.context().pages()).toHaveLength(1);
  await page.screenshot({ path: "docs/proofs/pptx-browser-viewer.png", fullPage: true });

  await page.locator(".pptx-preview-wrapper-next").first().click();
  await expect(page.getByTestId("pptx-slide-host")).toContainText("November pipeline");
  expect(downloads).toEqual([]);

  await page.getByRole("button", { name: "Pitch notes PDF" }).click();
  await expect(page.getByTestId("pptx-slide-host").getByLabel("Page 1")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pptx-slide-host")).toContainText("Pitch notes stay on this page.");
  expect(downloads).toEqual([]);
  expect(popups).toBe(0);

  await page.getByRole("button", { name: "Pitch notes", exact: true }).click();
  await expect(page.getByTestId("pptx-slide-host")).toContainText("Pitch notes stay on this page.", { timeout: 30_000 });
  expect(downloads).toEqual([]);
  expect(popups).toBe(0);
  expect(page.context().pages()).toHaveLength(1);
});

const UPLOADED = "2026-11-10T18:00:00.000Z";

const LIBRARY_FILES = {
  11: {
    title: "Investor deck",
    filename: "investor-deck.pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    bytes: resolve("client/src/assets/cabinetdealz-pitch-sample.pptx"),
    createdAt: "2026-11-10T18:00:00.000Z",
    visibility: "affiliate",
    isPublished: true,
    expectedDate: "Uploaded Nov 10, 2026",
  },
  21: {
    title: "Pitch notes",
    filename: "pitch-notes.docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    bytes: resolve("client/src/assets/pitch-notes-sample.docx"),
    createdAt: "2026-11-09T18:00:00.000Z",
    visibility: "affiliate",
    isPublished: true,
    expectedDate: "Uploaded Nov 9, 2026",
  },
  22: {
    title: "Field brochure",
    filename: "field-brochure.pdf",
    mimeType: "application/pdf",
    bytes: resolve("client/src/assets/pitch-notes-sample.pdf"),
    createdAt: "2026-11-08T18:00:00.000Z",
    visibility: "internal",
    isPublished: false,
    expectedDate: "Uploaded Nov 8, 2026",
  },
} as const;

type LibraryId = keyof typeof LIBRARY_FILES;

function libraryRows() {
  return (Object.entries(LIBRARY_FILES) as [string, (typeof LIBRARY_FILES)[LibraryId]][]).map(([id, file]) => ({
    id: Number(id),
    title: file.title,
    description: null,
    category: "Sales",
    filename: file.filename,
    url: `/manus-storage/library-documents/${file.filename}`,
    mimeType: file.mimeType,
    sizeBytes: 4096,
    isPublished: file.isPublished,
    sortOrder: Number(id),
    visibility: file.visibility,
    documentRole: "literature",
    affiliateToggledAt: file.visibility === "affiliate" ? UPLOADED : null,
    affiliateToggledByName: file.visibility === "affiliate" ? "Tom" : null,
    createdAt: file.createdAt,
  }));
}

function jwtFor(accountId: string, email: string) {
  const b64 = (value: object) =>
    btoa(JSON.stringify(value)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({ sub: accountId, email, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }),
    "c2ln",
  ].join(".");
}

function adminSession() {
  const email = "7809tom@gmail.com";
  return {
    access_token: jwtFor("admin-tom", email),
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "test-refresh-token.admin-tom",
    user: {
      id: "supabase-admin-tom",
      aud: "authenticated",
      role: "authenticated",
      email,
      app_metadata: { provider: "email" },
      user_metadata: { name: "Tom (Admin)" },
      created_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

function trpcOk(json: unknown) {
  return { result: { data: { json } } };
}

function unwrapTrpcInput(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.every((key) => key === "json" || key === "meta") && "json" in record) return record.json;
  return value;
}

function batchInputs(body: unknown, count: number): unknown[] {
  const root = unwrapTrpcInput(body);
  if (Array.isArray(root)) return root.map((entry) => unwrapTrpcInput(entry));
  if (root && typeof root === "object") {
    const record = root as Record<string, unknown>;
    return Array.from({ length: count }, (_, index) => unwrapTrpcInput(record[String(index)]));
  }
  return Array.from({ length: count }, () => undefined);
}

const ADMIN_ME = {
  id: 7809,
  openId: "supabase-admin-tom",
  name: "Tom (Admin)",
  email: "7809tom@gmail.com",
  role: "admin" as const,
  companyName: null,
  pricingTier: "homeowner" as const,
  loginMethod: "email",
};

async function mockAdminLibrary(page: Page, calls: { path: string; input: unknown }[]) {
  await page.route("**/e2e-library/**", async (route) => {
    const id = Number(new URL(route.request().url()).pathname.split("/").pop());
    const file = LIBRARY_FILES[id as LibraryId];
    if (!file) {
      await route.fulfill({ status: 404, body: "missing" });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: file.mimeType,
      body: readFileSync(file.bytes),
    });
  });

  await page.route("**/api/trpc/**", async (route: Route) => {
    const url = new URL(route.request().url());
    const paths = decodeURIComponent(url.pathname).replace(/^\/api\/trpc\/?/, "").split(",").filter(Boolean);
    if (!paths.some((path) => path === "affiliateLiterature.adminList" || path === "affiliateResources.adminSignedFile")) {
      await route.fallback();
      return;
    }
    const inputs = batchInputs(route.request().postDataJSON(), paths.length);
    const results = paths.map((path, index) => {
      const input = inputs[index] ?? null;
      calls.push({ path, input });
      if (path === "auth.me") return trpcOk(ADMIN_ME);
      if (path === "affiliateLiterature.adminList") return trpcOk(libraryRows());
      if (path === "affiliateResources.adminSignedFile") {
        const id = input && typeof input === "object" ? Number((input as { id?: unknown }).id) : NaN;
        const file = LIBRARY_FILES[id as LibraryId];
        if (!file) {
          return {
            error: {
              json: {
                message: `No signed file for ${JSON.stringify(input)}`,
                code: -32004,
                data: { code: "NOT_FOUND", httpStatus: 404 },
              },
            },
          };
        }
        return trpcOk({
          url: `/e2e-library/${id}`,
          filename: file.filename,
          mimeType: file.mimeType,
        });
      }
      return trpcOk(null);
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(results.length === 1 ? results[0] : results),
    });
  });
}

test("admin affiliate library opens PowerPoint, Word, and PDF in the page", async ({ page }) => {
  test.setTimeout(180_000);
  const downloads: string[] = [];
  const calls: { path: string; input: unknown }[] = [];
  const navigated: string[] = [];
  page.on("download", (download) => downloads.push(download.suggestedFilename()));
  page.on("request", (request) => {
    if (request.url().includes("manus-storage")) navigated.push(request.url());
  });
  let popups = 0;
  page.on("popup", () => { popups += 1; });

  await mockSupabaseAuth(page);
  await mockApi(page);
  await mockAdminLibrary(page, calls);
  await page.addInitScript((session) => {
    window.sessionStorage.setItem("cabinetdealz.auth.session.v1", JSON.stringify(session));
  }, adminSession());

  await page.goto("/admin?tab=affiliate-literature");
  const library = page.getByTestId("affiliate-literature-admin");
  await expect(library).toBeVisible({ timeout: 90_000 });
  await expect(library.getByTestId("library-uploaded-11")).toHaveText("Uploaded Nov 10, 2026");
  await expect(library.getByTestId("library-uploaded-21")).toHaveText("Uploaded Nov 9, 2026");
  await expect(library.getByTestId("library-uploaded-22")).toHaveText("Uploaded Nov 8, 2026");
  await expect(library.locator("a")).toHaveCount(0);
  await expect(library.getByRole("button", { name: /Download/ })).toHaveCount(0);
  await expect(library.getByRole("link", { name: /Download/ })).toHaveCount(0);

  await page.getByRole("button", { name: "View Investor deck" }).click();
  await expect(page.getByTestId("pptx-slide-host")).toContainText("Private decks stay in this browser.", { timeout: 30_000 });
  await expect(page.getByTestId("pptx-uploaded")).toHaveText("Uploaded Nov 10, 2026");
  await expect(page.locator(".pptx-preview-wrapper-pagination")).toHaveText("1/2");
  await expect(page.getByRole("button", { name: /Download/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Download/ })).toHaveCount(0);
  await expect(page.getByTestId("pptx-deck-dialog").locator("a")).toHaveCount(0);
  expect(page.url()).toContain("/admin");
  expect(page.url()).toContain("tab=affiliate-literature");
  expect(popups).toBe(0);
  expect(downloads).toEqual([]);
  expect(page.context().pages()).toHaveLength(1);
  await page.screenshot({ path: "docs/proofs/admin-affiliate-library-viewer.png", fullPage: true });

  await page.locator(".pptx-preview-wrapper-next").first().click();
  await expect(page.getByTestId("pptx-slide-host")).toContainText("November pipeline");

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByTestId("pptx-deck-dialog")).toBeHidden();

  await page.getByRole("button", { name: "View Pitch notes" }).click();
  await expect(page.getByTestId("pptx-slide-host")).toContainText("Pitch notes stay on this page.", { timeout: 30_000 });
  await expect(page.getByTestId("pptx-uploaded")).toHaveText("Uploaded Nov 9, 2026");
  expect(popups).toBe(0);
  expect(downloads).toEqual([]);
  expect(page.context().pages()).toHaveLength(1);

  await page.getByRole("button", { name: "Close" }).click();
  await page.getByRole("button", { name: "View Field brochure" }).click();
  await expect(page.getByTestId("pptx-slide-host").getByLabel("Page 1")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("pptx-slide-host")).toContainText("Pitch notes stay on this page.");
  await expect(page.getByTestId("pptx-uploaded")).toHaveText("Uploaded Nov 8, 2026");

  expect(calls.filter((call) => call.path === "affiliateResources.adminSignedFile").map((call) => call.input)).toEqual([
    { id: 11 },
    { id: 21 },
    { id: 22 },
  ]);
  expect(navigated).toEqual([]);
  expect(popups).toBe(0);
  expect(downloads).toEqual([]);
  expect(page.context().pages()).toHaveLength(1);
  await expect(page.getByRole("button", { name: /Download/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /Download/ })).toHaveCount(0);
});
