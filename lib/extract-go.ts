import type { ApiSymbol, SourceFile } from "./types";

function clamp(s: string, max = 1200): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function isExported(name: string): boolean {
  return name.length > 0 && name.charCodeAt(0) >= 65 && name.charCodeAt(0) <= 90;
}

/** Collect contiguous `//` doc-comment lines immediately above lineIdx. */
function goDocComment(lines: string[], lineIdx: number): string | undefined {
  const docs: string[] = [];
  for (let i = lineIdx - 1; i >= Math.max(0, lineIdx - 50); i--) {
    const t = lines[i].trim();
    if (t.startsWith("//")) {
      docs.unshift(t.replace(/^\/\/\s?/, ""));
    } else {
      break;
    }
  }
  return docs.find((l) => l.length > 0);
}

/**
 * True if the contiguous doc-comment block above lineIdx contains a
 * `// Deprecated:` line — the canonical Go deprecation convention.
 */
function isGoDeprecated(lines: string[], lineIdx: number): boolean {
  for (let i = lineIdx - 1; i >= Math.max(0, lineIdx - 50); i--) {
    const t = lines[i].trim();
    if (t.startsWith("//")) {
      if (t.includes("Deprecated:")) return true;
    } else {
      break;
    }
  }
  return false;
}

/**
 * Collect a Go function signature across multiple lines, stopping once all
 * bracket pairs are balanced and we've seen the opening `{` (which is
 * stripped from the result) or reached end-of-input.
 */
function collectFuncSignature(
  lines: string[],
  start: number,
): { sig: string; end: number } {
  const parts: string[] = [];
  let depth = 0;
  let seenOpen = false;

  for (let i = start; i < Math.min(start + 30, lines.length); i++) {
    const stripped = lines[i].trimEnd();
    parts.push(stripped.trim());

    for (const ch of stripped) {
      if (ch === "(" || ch === "[" || ch === "{") {
        if (ch === "(") seenOpen = true;
        depth++;
      } else if (ch === ")" || ch === "]" || ch === "}") {
        depth--;
      }
    }

    if (seenOpen && depth <= 0) {
      const sig = parts
        .join(" ")
        .replace(/\s*\{.*$/, "")
        .replace(/\s+/g, " ")
        .trim();
      return { sig, end: i };
    }
  }

  return {
    sig: parts.join(" ").replace(/\s*\{.*$/, "").replace(/\s+/g, " ").trim(),
    end: start,
  };
}

/** Extract public API symbols from a single Go source file. */
export function extractFromGoFile(file: SourceFile): ApiSymbol[] {
  const lines = file.content.split("\n");
  const symbols: ApiSymbol[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip indented lines — we only care about package-level declarations.
    if (/^\s/.test(line)) {
      i++;
      continue;
    }

    // Method: func (recv *ReceiverType) MethodName[...](
    const methodMatch = line.match(
      /^func\s+\(\w+\s+\*?([A-Za-z][A-Za-z0-9]*)[^)]*\)\s+([A-Za-z][A-Za-z0-9]*)\s*[(\[]/,
    );
    if (methodMatch) {
      const receiver = methodMatch[1];
      const method = methodMatch[2];
      if (isExported(receiver) && isExported(method)) {
        const { sig, end } = collectFuncSignature(lines, i);
        symbols.push({
          kind: "function",
          name: `${receiver}.${method}`,
          signature: clamp(sig),
          doc: goDocComment(lines, i),
          deprecated: isGoDeprecated(lines, i) || undefined,
          file: file.path,
          line: i + 1,
        });
        i = end + 1;
        continue;
      }
      i++;
      continue;
    }

    // Top-level exported function: func ExportedName[...](
    const funcMatch = line.match(/^func\s+([A-Z][A-Za-z0-9]*)\s*[(\[]/);
    if (funcMatch) {
      const name = funcMatch[1];
      const { sig, end } = collectFuncSignature(lines, i);
      symbols.push({
        kind: "function",
        name,
        signature: clamp(sig),
        doc: goDocComment(lines, i),
        deprecated: isGoDeprecated(lines, i) || undefined,
        file: file.path,
        line: i + 1,
      });
      i = end + 1;
      continue;
    }

    // type Name struct / type Name interface / type Name = Alias / type Name OtherType
    const typeMatch = line.match(
      /^type\s+([A-Za-z][A-Za-z0-9]*)\s+(struct|interface|=?\s*\S)/,
    );
    if (typeMatch && isExported(typeMatch[1])) {
      const name = typeMatch[1];
      const rest = typeMatch[2].trimStart();
      const kind = rest.startsWith("struct")
        ? "class"
        : rest.startsWith("interface")
          ? "interface"
          : "type";
      symbols.push({
        kind,
        name,
        signature: clamp(line.replace(/\s*\{.*$/, "").trim()),
        doc: goDocComment(lines, i),
        deprecated: isGoDeprecated(lines, i) || undefined,
        file: file.path,
        line: i + 1,
      });
      i++;
      continue;
    }

    // Parenthesised type block: type (\n  Name ...\n)
    const typeBlockMatch = line.match(/^type\s*\(/);
    if (typeBlockMatch) {
      i++;
      while (i < lines.length) {
        const bline = lines[i].trim();
        if (bline === ")") {
          i++;
          break;
        }
        const btm = bline.match(
          /^([A-Za-z][A-Za-z0-9]*)\s+(struct|interface|=?\s*\S)/,
        );
        if (btm && isExported(btm[1])) {
          const name = btm[1];
          const rest = btm[2].trimStart();
          const kind = rest.startsWith("struct")
            ? "class"
            : rest.startsWith("interface")
              ? "interface"
              : "type";
          symbols.push({
            kind,
            name,
            signature: clamp(bline.replace(/\s*\{.*$/, "").trim()),
            doc: goDocComment(lines, i),
            deprecated: isGoDeprecated(lines, i) || undefined,
            file: file.path,
            line: i + 1,
          });
        }
        i++;
      }
      continue;
    }

    // Parenthesised const/var block: const ( or var (
    const cvBlockMatch = line.match(/^(const|var)\s*\(/);
    if (cvBlockMatch) {
      i++;
      while (i < lines.length) {
        const bline = lines[i].trim();
        if (bline === ")") {
          i++;
          break;
        }
        // Skip blank lines and comment-only lines inside the block.
        if (!bline || bline.startsWith("//")) {
          i++;
          continue;
        }
        const nameMatch = bline.match(/^([A-Za-z][A-Za-z0-9]*)\b/);
        if (nameMatch && isExported(nameMatch[1])) {
          symbols.push({
            kind: "const",
            name: nameMatch[1],
            signature: clamp(bline.replace(/\s*\/\/.*$/, "").trim()),
            doc: goDocComment(lines, i),
            deprecated: isGoDeprecated(lines, i) || undefined,
            file: file.path,
            line: i + 1,
          });
        }
        i++;
      }
      continue;
    }

    // Single-line const/var: const Name = ... / var Name Type
    const singleCvMatch = line.match(/^(const|var)\s+([A-Za-z][A-Za-z0-9]*)\b/);
    if (singleCvMatch && isExported(singleCvMatch[2])) {
      symbols.push({
        kind: "const",
        name: singleCvMatch[2],
        signature: clamp(line.trim()),
        doc: goDocComment(lines, i),
        deprecated: isGoDeprecated(lines, i) || undefined,
        file: file.path,
        line: i + 1,
      });
      i++;
      continue;
    }

    i++;
  }

  return symbols;
}

export interface GoExtractOptions {
  maxSymbols?: number;
}

/** Extract and combine the public API surface from a list of Go source files. */
export function extractGoSurface(
  files: SourceFile[],
  options: GoExtractOptions = {},
): ApiSymbol[] {
  const maxSymbols = options.maxSymbols ?? 400;
  const all: ApiSymbol[] = [];
  for (const file of files) {
    try {
      all.push(...extractFromGoFile(file));
    } catch {
      // A single unparseable file shouldn't sink the whole analysis.
    }
  }
  return all.slice(0, maxSymbols);
}
