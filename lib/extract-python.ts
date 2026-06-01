import type { ApiSymbol, SourceFile } from "./types";

function clamp(s: string, max = 1200): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

/**
 * Accumulate a Python def/class signature across multiple lines, stopping
 * when brackets balance and the line ends with ":" or ": ...".
 * Returns the signature text (trailing ":" and "..." removed) and the last
 * line index consumed.
 */
function collectSignature(
  lines: string[],
  start: number,
): { sig: string; end: number } {
  const parts: string[] = [];
  let depth = 0;
  for (let i = start; i < Math.min(start + 30, lines.length); i++) {
    const stripped = lines[i].trim();
    parts.push(stripped);
    for (const ch of stripped) {
      if (ch === "(" || ch === "[" || ch === "{") depth++;
      else if (ch === ")" || ch === "]" || ch === "}") depth--;
    }
    const noComment = stripped.split("#")[0].trimEnd();
    if (
      depth <= 0 &&
      (noComment.endsWith(":") || noComment.endsWith(": ..."))
    ) {
      const sig = parts
        .join(" ")
        .replace(/\s*:\s*\.\.\.\s*$/, "")
        .replace(/\s*:\s*$/, "")
        .trim();
      return { sig, end: i };
    }
  }
  return {
    sig: parts.join(" ").replace(/\s*:\s*$/, "").trim(),
    end: start,
  };
}

/** Return the first non-empty line of the triple-quoted docstring after a def/class. */
function firstDocstring(lines: string[], afterLine: number): string | undefined {
  for (let i = afterLine + 1; i < Math.min(afterLine + 8, lines.length); i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (t.startsWith('"""') || t.startsWith("'''")) {
      const q = t.slice(0, 3);
      const body = t.slice(3);
      const closeIdx = body.indexOf(q);
      const text = (closeIdx >= 0 ? body.slice(0, closeIdx) : body).trim();
      return text || undefined;
    }
    break;
  }
  return undefined;
}

/**
 * True if the def/class at `lineIdx` is preceded by a `# deprecated` comment
 * or its first docstring line mentions deprecation.
 */
function isPythonDeprecated(
  lines: string[],
  lineIdx: number,
  doc: string | undefined,
): boolean {
  if (lineIdx > 0) {
    const prev = lines[lineIdx - 1].trim().toLowerCase();
    if (prev.startsWith("# deprecated") || prev.startsWith("# @deprecated"))
      return true;
  }
  if (doc) {
    const lower = doc.toLowerCase();
    if (
      lower.startsWith("deprecated") ||
      lower.includes(".. deprecated::") ||
      lower.includes("deprecationwarning")
    )
      return true;
  }
  return false;
}

/** Public names: not single-underscore-prefixed. Dunders (__x__) are included. */
function isPublicName(name: string): boolean {
  if (name.startsWith("__") && name.endsWith("__")) return true;
  return !name.startsWith("_");
}

/** Extract the public API symbols from a single Python (or .pyi stub) source file. */
export function extractFromPythonFile(file: SourceFile): ApiSymbol[] {
  const lines = file.content.split("\n");
  const symbols: ApiSymbol[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Top-level function / async function (no leading whitespace).
    const fnMatch = line.match(/^(async\s+def|def)\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (fnMatch) {
      const name = fnMatch[2];
      if (isPublicName(name)) {
        const { sig, end } = collectSignature(lines, i);
        const doc = firstDocstring(lines, end);
        symbols.push({
          kind: "function",
          name,
          signature: sig,
          doc,
          deprecated: isPythonDeprecated(lines, i, doc) || undefined,
          file: file.path,
          line: i + 1,
        });
        i = end + 1;
        continue;
      }
    }

    // Top-level class.
    const clsMatch = line.match(/^class\s+([A-Za-z_][A-Za-z0-9_]*)/);
    if (clsMatch) {
      const name = clsMatch[1];
      const { sig: classSig, end: classEnd } = collectSignature(lines, i);
      const doc = firstDocstring(lines, classEnd);

      // Collect public methods — auto-detect the body indentation level.
      const methods: string[] = [];
      let classIndent: string | null = null;
      let j = classEnd + 1;
      while (j < lines.length) {
        const ml = lines[j];
        if (ml.length > 0 && !/^\s/.test(ml)) break; // back to top-level
        const mMatch = ml.match(
          /^([ \t]+)(async\s+def|def)\s+([A-Za-z_][A-Za-z0-9_]*)/,
        );
        if (mMatch) {
          const indent = mMatch[1];
          if (classIndent === null) classIndent = indent;
          if (indent === classIndent && isPublicName(mMatch[3])) {
            const { sig: mSig, end: mEnd } = collectSignature(lines, j);
            methods.push("  " + mSig);
            j = mEnd + 1;
            continue;
          }
        }
        j++;
      }

      const body = methods.length ? `:\n${methods.join("\n")}` : "";
      symbols.push({
        kind: "class",
        name,
        signature: clamp(classSig + body),
        doc,
        deprecated: isPythonDeprecated(lines, i, doc) || undefined,
        file: file.path,
        line: i + 1,
      });
      i = j;
      continue;
    }

    // Top-level typed constant: name: Type [= value]
    const constMatch = line.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*:\s*([^=\n#]+?)(?:\s*=.*)?$/,
    );
    if (constMatch && isPublicName(constMatch[1])) {
      const [, cname, rawType] = constMatch;
      const ctype = rawType.trim();
      if (ctype) {
        symbols.push({
          kind: "const",
          name: cname,
          signature: `${cname}: ${ctype}`,
          file: file.path,
          line: i + 1,
        });
      }
    }

    i++;
  }

  return symbols;
}

export interface PythonExtractOptions {
  maxSymbols?: number;
}

/** Extract and combine the public API surface from a list of Python source files. */
export function extractPythonSurface(
  files: SourceFile[],
  options: PythonExtractOptions = {},
): ApiSymbol[] {
  const maxSymbols = options.maxSymbols ?? 400;
  const all: ApiSymbol[] = [];
  for (const file of files) {
    try {
      all.push(...extractFromPythonFile(file));
    } catch {
      // A single unparseable file shouldn't sink the whole analysis.
    }
  }
  return all.slice(0, maxSymbols);
}
