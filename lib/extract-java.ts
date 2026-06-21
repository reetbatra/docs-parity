import type { ApiSymbol, SourceFile } from "./types";

function clamp(s: string, max = 1200): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

const MAX_SYMBOLS = 200;

// Top-level public type declarations (no indentation in the compilation unit)
const TOP_RE =
  /^public\s+(?:(?:abstract|final|sealed|non-sealed|strictfp)\s+)*(?:class|interface|enum|record|@interface)\s+(\w+)/;

// Public member methods inside a class (1–12 spaces/tabs of indentation).
// Handles modifiers, inline annotations (@Override public ...), and generic
// return types. The lazy [\w$.<>[\],\s]*? lets the engine find the shortest
// return-type span that leaves a valid "name(" tail.
const METHOD_RE =
  /^([ \t]{1,12})(?:@\w+(?:\([^)]*\))?\s+)*public\s+(?:(?:static|abstract|final|synchronized|default|native|strictfp)\s+)*\S[\w$.<>[\],\s]*?\s+(\w+)\s*\(/;

// Public static final constants (ALL_CAPS by convention)
const CONST_RE =
  /^[ \t]{1,12}public\s+static\s+final\s+\S+\s+([A-Z_][A-Z0-9_]*)\b/;

function isDeprecated(lines: string[], lineIdx: number): boolean {
  for (let i = lineIdx - 1; i >= Math.max(0, lineIdx - 8); i--) {
    const t = lines[i].trim();
    if (t === "@Deprecated" || t.startsWith("@Deprecated(")) return true;
    if (
      t &&
      !t.startsWith("@") &&
      !t.startsWith("*") &&
      !t.startsWith("//") &&
      !t.startsWith("/*")
    )
      break;
  }
  return false;
}

function collectJavadoc(
  lines: string[],
  lineIdx: number,
): string | undefined {
  let i = lineIdx - 1;
  while (i >= 0 && /^\s*@/.test(lines[i])) i--;
  if (i < 0 || !lines[i].trim().endsWith("*/")) return undefined;
  const docLines: string[] = [];
  while (i >= 0) {
    const raw = lines[i]
      .trim()
      .replace(/^\/\*+!?/, "")
      .replace(/\*+\/$/, "")
      .replace(/^\*+\s?/, "")
      .trim();
    if (raw) docLines.unshift(raw);
    if (lines[i].trim().startsWith("/**")) break;
    i--;
  }
  return docLines.join(" ").trim() || undefined;
}

function collectSignature(
  lines: string[],
  start: number,
): { sig: string; end: number } {
  const parts: string[] = [lines[start].trimEnd()];
  let depth = 0;
  for (const ch of lines[start]) {
    if (ch === "(" || ch === "<") depth++;
    else if (ch === ")" || ch === ">") depth--;
  }
  for (
    let i = start + 1;
    depth > 0 && i < Math.min(start + 15, lines.length);
    i++
  ) {
    const t = lines[i].trim();
    parts.push(t);
    for (const ch of t) {
      if (ch === "(" || ch === "<") depth++;
      else if (ch === ")" || ch === ">") depth--;
    }
    if (depth <= 0) {
      const sig = parts
        .join(" ")
        .replace(/\s*\{[^}]*$/, "")
        .replace(/;$/, "")
        .trim();
      return { sig, end: i };
    }
  }
  return {
    sig: parts[0]
      .replace(/\s*\{.*$/, "")
      .replace(/;$/, "")
      .trim(),
    end: start,
  };
}

export function extractJavaSurface(files: SourceFile[]): ApiSymbol[] {
  const symbols: ApiSymbol[] = [];

  for (const file of files) {
    if (symbols.length >= MAX_SYMBOLS) break;
    const lines = file.content.split("\n");

    for (let i = 0; i < lines.length && symbols.length < MAX_SYMBOLS; i++) {
      const line = lines[i];

      // Top-level type declaration
      const topMatch = TOP_RE.exec(line);
      if (topMatch) {
        const name = topMatch[1];
        const kind: ApiSymbol["kind"] = /\binterface\b/.test(line)
          ? "interface"
          : /\benum\b/.test(line)
            ? "enum"
            : "class";
        const { sig, end } = collectSignature(lines, i);
        const doc = collectJavadoc(lines, i);
        const deprecated = isDeprecated(lines, i);
        symbols.push({
          kind,
          name,
          signature: clamp(sig),
          doc,
          deprecated,
          file: file.path,
          line: i + 1,
        });
        i = end;
        continue;
      }

      // Public methods
      const methodMatch = METHOD_RE.exec(line);
      if (methodMatch) {
        const name = methodMatch[2];
        if (
          !name ||
          /^(if|for|while|switch|catch|return|throw|new)$/.test(name)
        )
          continue;
        const { sig, end } = collectSignature(lines, i);
        const doc = collectJavadoc(lines, i);
        const deprecated = isDeprecated(lines, i);
        symbols.push({
          kind: "function",
          name,
          signature: clamp(sig),
          doc,
          deprecated,
          file: file.path,
          line: i + 1,
        });
        i = end;
        continue;
      }

      // Public static final constants
      const constMatch = CONST_RE.exec(line);
      if (constMatch) {
        const name = constMatch[1];
        const doc = collectJavadoc(lines, i);
        const deprecated = isDeprecated(lines, i);
        symbols.push({
          kind: "const",
          name,
          signature: clamp(line.trim().replace(/\s*=.*$/, "").trim()),
          doc,
          deprecated,
          file: file.path,
          line: i + 1,
        });
      }
    }
  }

  return symbols;
}
