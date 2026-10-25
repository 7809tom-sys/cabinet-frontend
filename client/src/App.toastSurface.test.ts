import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");

describe("application toast surface", () => {
  it("mounts the imported Sonner toaster beside the application routes", () => {
    expect(source).toContain('import { Toaster } from "@/components/ui/sonner";');
    expect(source).toContain("<ChatWidget />\n      <Toaster />");
  });
});
