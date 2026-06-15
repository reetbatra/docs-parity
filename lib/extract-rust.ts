import type { ApiSymbol, SourceFile } from "./types";

function clamp(s: string, max = 1200): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Collect a Rust item signature (the `pub ... {` or `pub ...;` part) across
 * multiple lines, stopping once parentheses are balanced and the line ends
 * with `{` or `;`. Returns the cleaned signature and the last line consumed.
 */
function collectSignature(
  lines: string[],
  start: number,
): { sig: string; end: number } {
  const parts: string[] = [];
  let parenDepth = 0;

  for (let i = start; i < Math.min(start + 20, lines.length); i++) {
    const stripped = lines[i].trim().replace(/\/\/.*$/, "").trimEnd();
    parts.push(stripped);

    for (const ch of stripped) {
      if (ch === "(") parenDepth++;
      else if (ch === ")") parenDepth--;
    }

    if (parenDepth <= 0) {
      if (stripped.endsWith("{") || stripped.endsWith(";")) {
        const sig = parts
          .join(" ")
          .replace(/\s*\{$/, "")
          .replace(/\s*;$/, "")
          .replace(/\s+/g, " ")
          .trim();
        return { sig, end: i };
      }
    }
  }

  return {
    sig: parts.join(" ").replace(/\s+/g, " ").trim(),
    end: start,
  };
}

/** Return the first non-empty `///` doc comment line above `lineIdx`. */
function firstDocComment(lines: string[], lineIdx: number): string | undefined {
  const docs: string[] = [];
  for (let i = lineIdx - 1; i >= Math.max(0, lineIdx - 30); i--) {
    const t = lines[i].trim();
    if (t.startsWith("///")) {
      docs.unshift(t.replace(/^\/\/\/\s?/, ""));
    } else if (t.startsWith("#[") || t.startsWith("#![")) {
      // attributes between doc comment and item — skip
      continue;
    } else {
      break;
    }
  }
  return docs.find((l) => l.length > 0);
}

/**
 * True if there's a `#[deprecated` attribute in the contiguous block of
 * attributes/doc-comments immediately above the item at `lineIdx`.
 */
function isRustDeprecated(lines: string[], lineIdx: number): boolean {
  for (let i = lineIdx - 1; i >= Math.max(0, lineIdx - 30); i--) {
    const t = lines[i].trim();
    if (t.startsWith("#[deprecated")) return true;
    if (t.startsWith("#[") || t.startsWith("///") || t === "") continue;
    break;
  }
  return false;
}

/** Extract public API symbols from a single Rust source file. */
export function extractFromRustFile(file: SourceFile): ApiSymbol[] {
  const lines = file.content.split("\n");
  const symbols: ApiSymbol[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Only consider top-level items (no leading whitespace).
    if (/^\s/.test(line)) {
      i++;
      continue;
    }

    // pub fn / pub async fn
    const fnMatch = line.match(
      /^pub(?:\([^)]*\))?\s+(?:async\s+)?fn\s+([A-Za-z_][A-Za-z0-9_]*)/,
    );
    if (fnMatch) {
      const name = fnMatch[1];
      const { sig, end } = collectSignature(lines, i);
      symbols.push({
        kind: "function",
        name,
        signature: clamp(sig),
        doc: firstDocComment(lines, i),
        deprecated: isRustDeprecated(lines, i) || undefined,
        file: file.path,
        line: i + 1,
      });
      i = end + 1;
      continue;
    }

    // pub struct
    const structMatch = line.match(
      /^pub(?:\([^)]*\))?\s+struct\s+([A-Za-z_][A-Za-z0-9_]*)/,
    );
    if (structMatch) {
      const name = structMatch[1];
      const { sig, end } = collectSignature(lines, i);
      symbols.push({
        kind: "class",
        name,
        signature: clamp(sig),
        doc: firstDocComment(lines, i),
        deprecated: isRustDeprecated(lines, i) || undefined,
        file: file.path,
        line: i + 1,
      });
      i = end + 1;
      continue;
    }

    // pub enum
    const enumMatch = line.match(
      /^pub(?:\([^)]*\))?\s+enum\s+([A-Za-z_][A-Za-z0-9_]*)/,
    );
    if (enumMatch) {
      const name = enumMatch[1];
      const { sig, end } = collectSignature(lines, i);
      symbols.push({
        kind: "enum",
        name,
        signature: clamp(sig),
        doc: firstDocComment(lines, i),
        deprecated: isRustDeprecated(lines, i) || undefined,
        file: file.path,
        line: i + 1,
      });
      i = end + 1;
      continue;
    }

    // pub trait
    const traitMatch = line.match(
      /^pub(?:\([^)]*\))?\s+trait\s+([A-Za-z_][A-Za-z0-9_]*)/,
    );
    if (traitMatch) {
      const name = traitMatch[1];
      const { sig, end } = collectSignature(lines, i);
      symbols.push({
        kind: "interface",
        name,
        signature: clamp(sig),
        doc: firstDocComment(lines, i),
        deprecated: isRustDeprecated(lines, i) || undefined,
        file: file.path,
        line: i + 1,
      });
      i = end + 1;
      continue;
    }

    // pub type Name = ...;
    const typeMatch = line.match(
      /^pub(?:\([^)]*\))?\s+type\s+([A-Za-z_][A-Za-z0-9_]*)/,
    );
    if (typeMatch) {
      const name = typeMatch[1];
      const { sig, end } = collectSignature(lines, i);
      symbols.push({
        kind: "type",
        name,
        signature: clamp(sig),
        doc: firstDocComment(lines, i),
        file: file.path,
        line: i + 1,
      });
      i = end + 1;
      continue;
    }

    // pub const / pub static
    const constMatch = line.match(
      /^pub(?:\([^)]*\))?\s+(?:const|static)\s+([A-Za-z_][A-Za-z0-9_]*)/,
    );
    if (constMatch) {
      const name = constMatch[1];
      const { sig, end } = collectSignature(lines, i);
      symbols.push({
        kind: "const",
        name,
        signature: clamp(sig),
        doc: firstDocComment(lines, i),
        deprecated: isRustDeprecated(lines, i) || undefined,
        file: file.path,
        line: i + 1,
      });
      i = end + 1;
      continue;
    }

    i++;
  }

  return symbols;
}

export interface RustExtractOptions {
  maxSymbols?: number;
}

/** Extract and combine the public API surface from a list of Rust source files. */
export function extractRustSurface(
  files: SourceFile[],
  options: RustExtractOptions = {},
): ApiSymbol[] {
  const maxSymbols = options.maxSymbols ?? 400;
  const all: ApiSymbol[] = [];
  for (const file of files) {
    try {
      all.push(...extractFromRustFile(file));
    } catch {
      // A single unparseable file shouldn't sink the whole analysis.
    }
  }
  return all.slice(0, maxSymbols);
}
