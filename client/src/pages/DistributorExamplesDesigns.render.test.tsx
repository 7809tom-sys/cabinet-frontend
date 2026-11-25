import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { describe, expect, it } from "vitest";
import DistributorPreviewPage, { DistributorDesignerShell } from "./DistributorPreview";
import { EXAMPLE_KITCHENS, EXAMPLE_KITCHENS_COPY } from "@/lib/demoExampleKitchens";
import { MY_DESIGNS_COPY } from "./DistributorMyDesigns";

function render(path: string, el: JSX.Element, search = "") {
  return renderToStaticMarkup(<Router ssrPath={path} ssrSearch={search}>{el}</Router>);
}

describe("example kitchens and My designs pages", () => {
  it("front page shows the example kitchens section and line-card example links", () => {
    const html = render("/distributor-preview", <DistributorPreviewPage section="storefront" />);
    expect(html).toContain('id="example-kitchens"');
    for (const k of EXAMPLE_KITCHENS) expect(html).toContain(`/distributor-preview/examples/${k.id}`);
    expect(html.indexOf('id="easy-upload"')).toBeLessThan(html.indexOf('id="example-kitchens"'));
    expect(html.indexOf('id="example-kitchens"')).toBeLessThan(html.indexOf('id="everything-you-get"'));
    expect(html).toContain("Example:");
  });

  it("the index lists every example; a detail page shows items, badge and order action", () => {
    const index = render("/distributor-preview/examples", <DistributorPreviewPage section="examples" />);
    for (const k of EXAMPLE_KITCHENS) expect(index).toContain(k.name);
    const k = EXAMPLE_KITCHENS[0];
    const detail = render(`/distributor-preview/examples/${k.id}`, <DistributorPreviewPage section="examples" exampleId={k.id} />);
    expect(detail).toContain(EXAMPLE_KITCHENS_COPY.badge);
    expect(detail).toContain(EXAMPLE_KITCHENS_COPY.itemsUsed);
    expect(detail).toContain(EXAMPLE_KITCHENS_COPY.order);
    for (const item of k.items) expect(detail).toContain(`data-item-code="${item.code}"`);
  });

  it("detail prices follow the public pricing toggle", () => {
    const k = EXAMPLE_KITCHENS[1];
    const off = render(`/distributor-preview/examples/${k.id}`, <DistributorPreviewPage section="examples" exampleId={k.id} />);
    expect(off).not.toContain('data-testid="demo-price"');
    expect(off).not.toContain(EXAMPLE_KITCHENS_COPY.total);
    const on = render(`/distributor-preview/examples/${k.id}`, <DistributorPreviewPage section="examples" exampleId={k.id} />, "pricing=on");
    expect(on).toContain('data-testid="demo-price"');
    expect(on).toContain(EXAMPLE_KITCHENS_COPY.total);
  });

  it("My designs page and nav link render; empty state without saved designs", () => {
    const html = render("/distributor-preview/designs", <DistributorPreviewPage section="designs" />);
    expect(html).toContain(MY_DESIGNS_COPY.title);
    expect(html).toContain(MY_DESIGNS_COPY.empty);
    expect(html).toContain('href="/distributor-preview/designs"');
  });

  it("designer shell shows the Start from an example strip under the email form (Save design waits for the designer)", () => {
    const html = render("/distributor-preview/design", <DistributorDesignerShell><div>designer</div></DistributorDesignerShell>);
    expect(html).not.toContain('data-testid="designer-save"');
    expect(html).not.toContain('data-testid="designer-my-designs"');
    expect(html).toContain(EXAMPLE_KITCHENS_COPY.strip);
    expect(html).not.toContain(EXAMPLE_KITCHENS_COPY.stripNote.replace(/'/g, "&#x27;"));
    for (const k of EXAMPLE_KITCHENS) expect(html).toContain(`/distributor-preview/examples/${k.id}`);
  });
});
