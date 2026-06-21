import { describe, expect, it } from "vitest";
import { extractJavaSurface } from "../lib/extract-java";
import type { SourceFile } from "../lib/types";

function makeFile(path: string, content: string): SourceFile {
  return {
    path,
    url: `https://github.com/example/repo/blob/main/${path}`,
    content,
    size: content.length,
  };
}

describe("extractJavaSurface", () => {
  it("extracts a public class", () => {
    const symbols = extractJavaSurface([
      makeFile(
        "src/Client.java",
        `public class HttpClient {\n  private String url;\n}\n`,
      ),
    ]);
    expect(symbols).toHaveLength(1);
    expect(symbols[0].name).toBe("HttpClient");
    expect(symbols[0].kind).toBe("class");
    expect(symbols[0].file).toBe("src/Client.java");
    expect(symbols[0].line).toBe(1);
  });

  it("extracts a public interface", () => {
    const symbols = extractJavaSurface([
      makeFile("src/Api.java", `public interface ApiService {\n  void call();\n}\n`),
    ]);
    expect(symbols[0].kind).toBe("interface");
    expect(symbols[0].name).toBe("ApiService");
  });

  it("extracts a public enum", () => {
    const symbols = extractJavaSurface([
      makeFile("src/Status.java", `public enum Status {\n  OK, ERROR\n}\n`),
    ]);
    expect(symbols[0].kind).toBe("enum");
    expect(symbols[0].name).toBe("Status");
  });

  it("extracts public methods, skips private and protected", () => {
    const symbols = extractJavaSurface([
      makeFile(
        "src/Service.java",
        `public class Service {
    public String get(String url) { return ""; }
    private void internal() {}
    protected void hook() {}
    void packageMethod() {}
}\n`,
      ),
    ]);
    const names = symbols.map((s) => s.name);
    expect(names).toContain("Service");
    expect(names).toContain("get");
    expect(names).not.toContain("internal");
    expect(names).not.toContain("hook");
    expect(names).not.toContain("packageMethod");
  });

  it("detects @Deprecated annotation on method", () => {
    const symbols = extractJavaSurface([
      makeFile(
        "src/Client.java",
        `public class Client {
    @Deprecated
    public void oldMethod() {}
    public void newMethod() {}
}\n`,
      ),
    ]);
    const old = symbols.find((s) => s.name === "oldMethod");
    const newer = symbols.find((s) => s.name === "newMethod");
    expect(old?.deprecated).toBe(true);
    expect(newer?.deprecated).toBeFalsy();
  });

  it("detects @Deprecated on a class", () => {
    const symbols = extractJavaSurface([
      makeFile(
        "src/Legacy.java",
        `@Deprecated\npublic class LegacyClient {}\n`,
      ),
    ]);
    expect(symbols[0].deprecated).toBe(true);
  });

  it("extracts public static final constants (ALL_CAPS only)", () => {
    const symbols = extractJavaSurface([
      makeFile(
        "src/Constants.java",
        `public class Constants {
    public static final int MAX_SIZE = 100;
    public static final String DEFAULT_URL = "https://example.com";
    private static final int INTERNAL = 42;
    public static final int notAllCaps = 1;
}\n`,
      ),
    ]);
    const names = symbols.map((s) => s.name);
    expect(names).toContain("MAX_SIZE");
    expect(names).toContain("DEFAULT_URL");
    expect(names).not.toContain("INTERNAL");
    expect(names).not.toContain("notAllCaps");
  });

  it("extracts Javadoc comments", () => {
    const symbols = extractJavaSurface([
      makeFile(
        "src/Api.java",
        `/**
 * Makes an HTTP request to the given endpoint.
 */
public class ApiClient {}\n`,
      ),
    ]);
    expect(symbols[0].doc).toContain("Makes an HTTP request");
  });

  it("handles generic return types in methods", () => {
    const symbols = extractJavaSurface([
      makeFile(
        "src/Repo.java",
        `public class Repository {
    public List<String> findAll() { return null; }
    public Map<String, Integer> getMap() { return null; }
}\n`,
      ),
    ]);
    const names = symbols.map((s) => s.name);
    expect(names).toContain("findAll");
    expect(names).toContain("getMap");
  });

  it("handles static methods", () => {
    const symbols = extractJavaSurface([
      makeFile(
        "src/Factory.java",
        `public class Factory {
    public static Factory create() { return new Factory(); }
}\n`,
      ),
    ]);
    expect(symbols.map((s) => s.name)).toContain("create");
  });

  it("handles inline annotation before public", () => {
    const symbols = extractJavaSurface([
      makeFile(
        "src/Service.java",
        `public class Service {
    @Override public String toString() { return ""; }
}\n`,
      ),
    ]);
    expect(symbols.map((s) => s.name)).toContain("toString");
  });

  it("does not extract package-private class as a top-level symbol", () => {
    const symbols = extractJavaSurface([
      makeFile("src/Helper.java", `class InternalHelper {\n  public void help() {}\n}\n`),
    ]);
    expect(symbols.map((s) => s.name)).not.toContain("InternalHelper");
  });

  it("caps at MAX_SYMBOLS", () => {
    const methods = Array.from(
      { length: 250 },
      (_, i) => `    public void method${i}() {}`,
    ).join("\n");
    const content = `public class Big {\n${methods}\n}\n`;
    const symbols = extractJavaSurface([makeFile("src/Big.java", content)]);
    expect(symbols.length).toBeLessThanOrEqual(200);
  });

  it("returns empty array for empty input", () => {
    expect(extractJavaSurface([])).toEqual([]);
  });

  it("handles multi-file input", () => {
    const files = [
      makeFile("src/A.java", `public class A {}\n`),
      makeFile("src/B.java", `public interface B {}\n`),
    ];
    const symbols = extractJavaSurface(files);
    const names = symbols.map((s) => s.name);
    expect(names).toContain("A");
    expect(names).toContain("B");
  });
});
