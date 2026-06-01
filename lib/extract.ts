import * as ts from "typescript";
import type { ApiSymbol, SourceFile } from "./types";

/**
 * Extract the exported, public API surface from a set of source files using the
 * real TypeScript compiler AST — not regex. We capture exported functions,
 * classes (with their public method signatures), interfaces, type aliases,
 * enums, exported consts, re-exports, and default exports, along with the
 * first line of any JSDoc.
 */

function scriptKindFor(path: string): ts.ScriptKind {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.[cm]?js$/.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function hasExportModifier(node: ts.Node): boolean {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function hasDefaultModifier(node: ts.Node): boolean {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  return !!mods?.some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}

function isNonPublicMember(node: ts.ClassElement): boolean {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  const nonPublic = mods?.some(
    (m) =>
      m.kind === ts.SyntaxKind.PrivateKeyword ||
      m.kind === ts.SyntaxKind.ProtectedKeyword,
  );
  const name = (node as { name?: ts.Node }).name;
  const isHashPrivate =
    name !== undefined && ts.isPrivateIdentifier(name as ts.Node);
  return !!nonPublic || isHashPrivate;
}

function isDeprecatedJsDoc(node: ts.Node): boolean {
  const jsDoc = (node as { jsDoc?: ts.JSDoc[] }).jsDoc;
  if (!jsDoc) return false;
  return jsDoc.some((doc) =>
    doc.tags?.some(
      (tag) => tag.tagName.text.toLowerCase() === "deprecated",
    ),
  );
}

function firstJsDocLine(node: ts.Node): string | undefined {
  const jsDoc = (node as { jsDoc?: ts.JSDoc[] }).jsDoc;
  if (!jsDoc || jsDoc.length === 0) return undefined;
  const comment = jsDoc[0].comment;
  const text =
    typeof comment === "string"
      ? comment
      : comment
        ? comment.map((c) => c.text).join("")
        : "";
  const firstLine = text.split("\n")[0].trim();
  if (!firstLine) return undefined;
  return firstLine.length > 200 ? `${firstLine.slice(0, 197)}…` : firstLine;
}

function lineOf(node: ts.Node, sf: ts.SourceFile): number {
  return sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1;
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function functionSignature(
  node: ts.FunctionDeclaration | ts.MethodDeclaration,
  sf: ts.SourceFile,
  keyword: string,
): string {
  const mods = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
  const isAsync = mods?.some((m) => m.kind === ts.SyntaxKind.AsyncKeyword);
  const name = node.name ? node.name.getText(sf) : "anonymous";
  const typeParams = node.typeParameters
    ? `<${node.typeParameters.map((t) => compact(t.getText(sf))).join(", ")}>`
    : "";
  const params = node.parameters.map((p) => compact(p.getText(sf))).join(", ");
  const ret = node.type ? `: ${compact(node.type.getText(sf))}` : "";
  return `${isAsync ? "async " : ""}${keyword} ${name}${typeParams}(${params})${ret}`;
}

function classSignature(node: ts.ClassDeclaration, sf: ts.SourceFile): string {
  const name = node.name ? node.name.getText(sf) : "AnonymousClass";
  const typeParams = node.typeParameters
    ? `<${node.typeParameters.map((t) => compact(t.getText(sf))).join(", ")}>`
    : "";
  const heritage = node.heritageClauses
    ? " " + node.heritageClauses.map((h) => compact(h.getText(sf))).join(" ")
    : "";

  const members: string[] = [];
  for (const member of node.members) {
    if (isNonPublicMember(member)) continue;

    if (ts.isConstructorDeclaration(member)) {
      const params = member.parameters
        .map((p) => compact(p.getText(sf)))
        .join(", ");
      members.push(`  constructor(${params})`);
    } else if (ts.isMethodDeclaration(member)) {
      const sig = functionSignature(member, sf, "");
      members.push(`  ${sig.trim()}`);
    } else if (ts.isGetAccessor(member) || ts.isSetAccessor(member)) {
      const kw = ts.isGetAccessor(member) ? "get" : "set";
      const mname = member.name.getText(sf);
      const params = member.parameters
        .map((p) => compact(p.getText(sf)))
        .join(", ");
      const ret = member.type ? `: ${compact(member.type.getText(sf))}` : "";
      members.push(`  ${kw} ${mname}(${params})${ret}`);
    } else if (ts.isPropertyDeclaration(member) && member.name) {
      const pname = member.name.getText(sf);
      const ptype = member.type ? `: ${compact(member.type.getText(sf))}` : "";
      members.push(`  ${pname}${ptype}`);
    }
  }

  const body = members.length ? `{\n${members.join("\n")}\n}` : "{}";
  return `class ${name}${typeParams}${heritage} ${body}`;
}

function variableSignature(
  decl: ts.VariableDeclaration,
  sf: ts.SourceFile,
): string | undefined {
  if (!ts.isIdentifier(decl.name)) return undefined;
  const name = decl.name.getText(sf);

  if (decl.type) {
    return `const ${name}: ${compact(decl.type.getText(sf))}`;
  }

  const init = decl.initializer;
  if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
    const typeParams = init.typeParameters
      ? `<${init.typeParameters.map((t) => compact(t.getText(sf))).join(", ")}>`
      : "";
    const params = init.parameters
      .map((p) => compact(p.getText(sf)))
      .join(", ");
    const ret = init.type ? `: ${compact(init.type.getText(sf))}` : "";
    const isAsync = init.modifiers?.some(
      (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
    );
    return `const ${name}${typeParams} = ${
      isAsync ? "async " : ""
    }(${params})${ret} => …`;
  }

  return `const ${name}`;
}

function clampSignature(sig: string, max = 1200): string {
  if (sig.length <= max) return sig;
  return `${sig.slice(0, max)}\n  … (truncated)`;
}

/** Extract API symbols from a single source file. */
export function extractFromFile(file: SourceFile): ApiSymbol[] {
  const sf = ts.createSourceFile(
    file.path,
    file.content,
    ts.ScriptTarget.Latest,
    true,
    scriptKindFor(file.path),
  );

  const symbols: ApiSymbol[] = [];
  const push = (
    kind: ApiSymbol["kind"],
    name: string,
    signature: string,
    node: ts.Node,
  ) => {
    symbols.push({
      kind,
      name,
      signature: clampSignature(signature),
      doc: firstJsDocLine(node),
      deprecated: isDeprecatedJsDoc(node) || undefined,
      file: file.path,
      line: lineOf(node, sf),
    });
  };

  for (const stmt of sf.statements) {
    const exported = hasExportModifier(stmt);

    if (ts.isFunctionDeclaration(stmt) && exported && stmt.name) {
      const prefix = hasDefaultModifier(stmt) ? "export default " : "export ";
      push(
        "function",
        stmt.name.getText(sf),
        prefix + functionSignature(stmt, sf, "function"),
        stmt,
      );
    } else if (ts.isClassDeclaration(stmt) && exported && stmt.name) {
      const prefix = hasDefaultModifier(stmt) ? "export default " : "export ";
      push(
        "class",
        stmt.name.getText(sf),
        prefix + classSignature(stmt, sf),
        stmt,
      );
    } else if (ts.isInterfaceDeclaration(stmt) && exported) {
      push(
        "interface",
        stmt.name.getText(sf),
        `export ${compact(stmt.getText(sf))}`,
        stmt,
      );
    } else if (ts.isTypeAliasDeclaration(stmt) && exported) {
      push(
        "type",
        stmt.name.getText(sf),
        `export ${compact(stmt.getText(sf))}`,
        stmt,
      );
    } else if (ts.isEnumDeclaration(stmt) && exported) {
      const members = stmt.members.map((m) => m.name.getText(sf)).join(", ");
      push(
        "enum",
        stmt.name.getText(sf),
        `export enum ${stmt.name.getText(sf)} { ${members} }`,
        stmt,
      );
    } else if (ts.isVariableStatement(stmt) && exported) {
      for (const decl of stmt.declarationList.declarations) {
        const sig = variableSignature(decl, sf);
        if (sig && ts.isIdentifier(decl.name)) {
          push("const", decl.name.getText(sf), `export ${sig}`, stmt);
        }
      }
    } else if (ts.isExportDeclaration(stmt)) {
      const from = stmt.moduleSpecifier
        ? ` from ${stmt.moduleSpecifier.getText(sf)}`
        : "";
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          push(
            "reexport",
            el.name.getText(sf),
            `export { ${el.getText(sf)} }${from}`,
            stmt,
          );
        }
      } else {
        push("reexport", "*", `export *${from}`, stmt);
      }
    } else if (ts.isExportAssignment(stmt)) {
      const expr = compact(stmt.expression.getText(sf));
      push(
        "default",
        "default",
        `export default ${expr.length > 120 ? expr.slice(0, 117) + "…" : expr}`,
        stmt,
      );
    }
  }

  return symbols;
}

export interface ExtractOptions {
  maxSymbols?: number;
}

/** Extract and de-duplicate the API surface across all files. */
export function extractApiSurface(
  files: SourceFile[],
  options: ExtractOptions = {},
): ApiSymbol[] {
  const maxSymbols = options.maxSymbols ?? 400;
  const all: ApiSymbol[] = [];
  for (const file of files) {
    try {
      all.push(...extractFromFile(file));
    } catch {
      // A single unparseable file shouldn't sink the whole analysis.
    }
  }
  return all.slice(0, maxSymbols);
}

/** Render the API surface as compact text for the model prompt. */
export function renderApiSurface(
  symbols: ApiSymbol[],
  files: SourceFile[],
): string {
  if (symbols.length === 0) {
    return files
      .map((f) => `// FILE: ${f.path}\n${f.content.slice(0, 4000)}`)
      .join("\n\n");
  }

  const byFile = new Map<string, ApiSymbol[]>();
  for (const s of symbols) {
    const list = byFile.get(s.file) ?? [];
    list.push(s);
    byFile.set(s.file, list);
  }

  const blocks: string[] = [];
  for (const [file, list] of byFile) {
    const lines = [`// FILE: ${file}`];
    for (const s of list) {
      if (s.doc) lines.push(`/** ${s.doc} */`);
      lines.push(`${s.signature}  // L${s.line}`);
      lines.push("");
    }
    blocks.push(lines.join("\n"));
  }
  return blocks.join("\n");
}
