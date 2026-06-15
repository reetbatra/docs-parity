import { describe, it, expect } from "vitest";
import { extractFromGoFile, extractGoSurface } from "../lib/extract-go";
import type { SourceFile } from "../lib/types";

function makeFile(content: string, path = "api.go"): SourceFile {
  return { path, url: "", content, size: content.length };
}

describe("extractFromGoFile", () => {
  it("extracts an exported function with doc comment", () => {
    const f = makeFile(
      "// Greet returns a greeting string.\nfunc Greet(name string) string {\n\treturn \"Hello, \" + name\n}\n",
    );
    const [sym] = extractFromGoFile(f);
    expect(sym.kind).toBe("function");
    expect(sym.name).toBe("Greet");
    expect(sym.signature).toBe("func Greet(name string) string");
    expect(sym.doc).toBe("Greet returns a greeting string.");
    expect(sym.line).toBe(2);
  });

  it("ignores unexported functions", () => {
    const f = makeFile("func helper() {}\nfunc Exported() {}\n");
    const syms = extractFromGoFile(f);
    expect(syms).toHaveLength(1);
    expect(syms[0].name).toBe("Exported");
  });

  it("extracts a struct as kind:class", () => {
    const f = makeFile("// Client is the API client.\ntype Client struct {\n\tbaseURL string\n}\n");
    const [sym] = extractFromGoFile(f);
    expect(sym.kind).toBe("class");
    expect(sym.name).toBe("Client");
    expect(sym.doc).toBe("Client is the API client.");
  });

  it("extracts an interface as kind:interface", () => {
    const f = makeFile("type Store interface {\n\tGet(key string) (string, error)\n}\n");
    const [sym] = extractFromGoFile(f);
    expect(sym.kind).toBe("interface");
    expect(sym.name).toBe("Store");
  });

  it("extracts a type alias as kind:type", () => {
    const f = makeFile("// Handler is a request handler func.\ntype Handler = func(w http.ResponseWriter, r *http.Request)\n");
    const [sym] = extractFromGoFile(f);
    expect(sym.kind).toBe("type");
    expect(sym.name).toBe("Handler");
  });

  it("extracts a method and names it Receiver.Method", () => {
    const f = makeFile(
      "func (c *Client) Fetch(url string) ([]byte, error) {\n\treturn nil, nil\n}\n",
    );
    const [sym] = extractFromGoFile(f);
    expect(sym.kind).toBe("function");
    expect(sym.name).toBe("Client.Fetch");
    expect(sym.signature).toContain("func (c *Client) Fetch");
  });

  it("ignores methods on unexported receiver types", () => {
    const f = makeFile("func (s *server) handle() {}\n");
    expect(extractFromGoFile(f)).toHaveLength(0);
  });

  it("ignores unexported methods on exported types", () => {
    const f = makeFile("func (c *Client) internal() {}\n");
    expect(extractFromGoFile(f)).toHaveLength(0);
  });

  it("extracts a single-line const", () => {
    const f = makeFile("const MaxRetries = 3\n");
    const [sym] = extractFromGoFile(f);
    expect(sym.kind).toBe("const");
    expect(sym.name).toBe("MaxRetries");
  });

  it("extracts exported names from a const block, skips unexported", () => {
    const f = makeFile(
      "const (\n\tMaxRetries = 3\n\tDefaultTimeout = 30\n\tinternalSec = 1\n)\n",
    );
    const syms = extractFromGoFile(f);
    expect(syms.map((s) => s.name)).toEqual(["MaxRetries", "DefaultTimeout"]);
  });

  it("extracts exported var", () => {
    const f = makeFile("var ErrNotFound = errors.New(\"not found\")\n");
    const [sym] = extractFromGoFile(f);
    expect(sym.kind).toBe("const");
    expect(sym.name).toBe("ErrNotFound");
  });

  it("detects Deprecated: in doc comment", () => {
    const f = makeFile(
      "// OldFetch fetches data.\n// Deprecated: Use Fetch instead.\nfunc OldFetch() {}\n",
    );
    const [sym] = extractFromGoFile(f);
    expect(sym.deprecated).toBe(true);
    expect(sym.name).toBe("OldFetch");
  });

  it("does not mark non-deprecated functions", () => {
    const f = makeFile("// Fetch is the main fetch function.\nfunc Fetch() {}\n");
    const [sym] = extractFromGoFile(f);
    expect(sym.deprecated).toBeUndefined();
  });

  it("handles multi-line function signature", () => {
    const f = makeFile(
      "func NewClient(\n\tbaseURL string,\n\ttoken string,\n) *Client {\n\treturn nil\n}\n",
    );
    const [sym] = extractFromGoFile(f);
    expect(sym.name).toBe("NewClient");
    expect(sym.signature).toContain("NewClient");
    expect(sym.signature).toContain("*Client");
    expect(sym.signature).not.toContain("{");
  });

  it("extracts types from a parenthesised type block", () => {
    const f = makeFile(
      "type (\n\tFoo struct{}\n\tBar interface{}\n\tbaz struct{}\n)\n",
    );
    const syms = extractFromGoFile(f);
    expect(syms.map((s) => s.name)).toEqual(["Foo", "Bar"]);
    expect(syms[0].kind).toBe("class");
    expect(syms[1].kind).toBe("interface");
  });

  it("skips indented (non-top-level) declarations", () => {
    const f = makeFile(
      "func Outer() {\n\tfunc Inner() {} // not valid Go but extractor should skip\n\tvar localVar = 1\n}\n",
    );
    const syms = extractFromGoFile(f);
    expect(syms.map((s) => s.name)).toEqual(["Outer"]);
  });
});

describe("extractGoSurface", () => {
  it("combines symbols across multiple files", () => {
    const files = [
      makeFile("func Foo() {}\n", "foo.go"),
      makeFile("func Bar() {}\n", "bar.go"),
    ];
    const syms = extractGoSurface(files);
    expect(syms.map((s) => s.name)).toEqual(["Foo", "Bar"]);
  });

  it("respects maxSymbols", () => {
    const content = Array.from(
      { length: 10 },
      (_, i) => `func Fn${i}() {}\n`,
    ).join("");
    const syms = extractGoSurface([makeFile(content)], { maxSymbols: 3 });
    expect(syms).toHaveLength(3);
  });

  it("survives an unparseable file", () => {
    const files = [
      makeFile("func Good() {}\n", "good.go"),
      { path: "bad.go", url: "", content: null as unknown as string, size: 0 },
    ];
    expect(() => extractGoSurface(files)).not.toThrow();
    const syms = extractGoSurface(files);
    expect(syms[0].name).toBe("Good");
  });
});
