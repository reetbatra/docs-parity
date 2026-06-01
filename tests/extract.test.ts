import { describe, it, expect } from "vitest";
import {
  extractApiSurface,
  extractFromFile,
  renderApiSurface,
} from "../lib/extract";
import type { SourceFile } from "../lib/types";

const SAMPLE = `
export interface Options {
  timeout?: number;
  retries: number;
}

export type Handler = (req: Request) => Promise<Response>;

export enum Level {
  Low,
  Medium,
  High,
}

/** Create a new client for the API. */
export function createClient(options: Options): Client {
  return new Client(options);
}

export const VERSION = "1.0.0";

export const make = async (a: number, b: string): Promise<boolean> => true;

export class Client {
  private secret = 42;
  #internal = 1;
  constructor(opts: Options) {}
  connect(url: string): Promise<void> {
    return Promise.resolve();
  }
  protected helper(): void {}
  get name(): string {
    return "x";
  }
}

export { foo } from "./foo";
export default createClient;
`;

function file(content: string, path = "src/index.ts"): SourceFile {
  return { path, content, url: `https://x/${path}`, size: content.length };
}

describe("extractFromFile", () => {
  const symbols = extractFromFile(file(SAMPLE));
  const byName = (name: string) => symbols.find((s) => s.name === name);

  it("extracts an exported function with its signature and JSDoc", () => {
    const fn = byName("createClient");
    expect(fn?.kind).toBe("function");
    expect(fn?.signature).toContain("function createClient(options: Options): Client");
    expect(fn?.doc).toMatch(/Create a new client/);
  });

  it("extracts an exported interface, type alias, and enum", () => {
    expect(byName("Options")?.kind).toBe("interface");
    expect(byName("Handler")?.kind).toBe("type");
    const level = byName("Level");
    expect(level?.kind).toBe("enum");
    expect(level?.signature).toContain("Low, Medium, High");
  });

  it("extracts exported consts including arrow functions", () => {
    expect(byName("VERSION")?.kind).toBe("const");
    const make = byName("make");
    expect(make?.kind).toBe("const");
    expect(make?.signature).toContain("(a: number, b: string)");
  });

  it("extracts class public members but not private/protected ones", () => {
    const cls = byName("Client");
    expect(cls?.kind).toBe("class");
    expect(cls?.signature).toContain("constructor(opts: Options)");
    expect(cls?.signature).toContain("connect(url: string)");
    expect(cls?.signature).toContain("get name(): string");
    // Private and protected members are excluded from the public surface.
    expect(cls?.signature).not.toContain("secret");
    expect(cls?.signature).not.toContain("#internal");
    expect(cls?.signature).not.toContain("helper");
  });

  it("captures re-exports and default exports", () => {
    expect(symbols.some((s) => s.kind === "reexport" && s.name === "foo")).toBe(
      true,
    );
    expect(symbols.some((s) => s.kind === "default")).toBe(true);
  });

  it("records line numbers", () => {
    expect(byName("createClient")?.line).toBeGreaterThan(0);
  });
});

describe("extractApiSurface + renderApiSurface", () => {
  it("renders a compact, grouped surface across files", () => {
    const symbols = extractApiSurface([file(SAMPLE)]);
    const rendered = renderApiSurface(symbols, [file(SAMPLE)]);
    expect(rendered).toContain("// FILE: src/index.ts");
    expect(rendered).toContain("createClient");
    expect(rendered).not.toContain("secret");
  });

  it("falls back to raw source when nothing structured is found", () => {
    const raw = file("const notExported = 1;\nconsole.log('hi');");
    const symbols = extractApiSurface([raw]);
    const rendered = renderApiSurface(symbols, [raw]);
    expect(rendered).toContain("// FILE: src/index.ts");
  });

  it("does not throw on unparseable / weird input", () => {
    const broken = file("export function (((", "src/broken.ts");
    expect(() => extractApiSurface([broken])).not.toThrow();
  });
});
