import type { SyntaxNode } from "@lezer/common";
import { parser as cppParser } from "@lezer/cpp";
import { parser as pythonParser } from "@lezer/python";
import type { Issue, Lang } from "@/lib/lab/types";

export type TraceResult = {
  ok: boolean;
  issues: Issue[];
  summary: string;
};

const PY_BUILTINS = new Set(
  `False None True __name__ __debug__ abs aiter all anext any ascii bin bool breakpoint bytearray bytes callable chr classmethod compile complex delattr dict dir divmod enumerate eval exec filter float format frozenset getattr globals hasattr hash help hex id input int isinstance issubclass iter len list locals map max memoryview min next object oct open ord pow print property range repr reversed round set setattr slice sorted staticmethod str sum super tuple type vars zip ArithmeticError AssertionError AttributeError BaseException BlockingIOError BrokenPipeError BufferError BytesWarning ChildProcessError ConnectionAbortedError ConnectionError ConnectionRefusedError ConnectionResetError DeprecationWarning EOFError Ellipsis EnvironmentError Exception FileExistsError FileNotFoundError FloatingPointError FutureWarning GeneratorExit IOError ImportError ImportWarning IndentationError IndexError InterruptedError IsADirectoryError KeyError KeyboardInterrupt LookupError MemoryError ModuleNotFoundError NameError NotADirectoryError NotImplemented NotImplementedError OSError OverflowError PendingDeprecationWarning PermissionError ProcessLookupError RecursionError ReferenceError ResourceWarning RuntimeError RuntimeWarning StopAsyncIteration StopIteration SyntaxError SyntaxWarning SystemError SystemExit TabError TimeoutError TypeError UnboundLocalError UnicodeDecodeError UnicodeEncodeError UnicodeError UnicodeTranslateError UnicodeWarning UserWarning ValueError Warning ZeroDivisionError`.split(
    /\s+/,
  ),
);

type Scope = {
  parent: Scope | null;
  kind: "module" | "function" | "class" | "comp";
  locals: Set<string>;
  bound: Set<string>;
  star: boolean;
  globals: Set<string>;
};

export function traceProgram(raw: string, language: Lang): TraceResult {
  const code = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const issues: Issue[] = [];
  if (!code.trim()) {
    issues.push({ line: 1, message: "There is no program to trace." });
    return finish(false, issues, language);
  }

  if (language === "python" && /^\s*#\s*include\b/m.test(code)) {
    issues.push({
      line: 1,
      message: "This looks like C or C++. Switch the language off Python.",
    });
  }
  if (
    (language === "c" || language === "cpp") &&
    /^\s*(def|import|from)\s+\w+/m.test(code) &&
    !/#\s*include\b/.test(code) &&
    !/\bmain\s*\(/.test(code)
  ) {
    issues.push({
      line: 1,
      message: "This looks like Python. Switch the language to Python.",
    });
  }

  if (language === "python") {
    issues.push(...pythonSurface(code));
    issues.push(...parserIssues(pythonParser, code));
    if (!issues.some((issue) => /syntax|string is not closed|print is a function|looks like/i.test(issue.message))) {
      issues.push(...pythonNames(code));
    }
  } else {
    const parsed = relaxBraceInit(code);
    issues.push(...parserIssues(cppParser, parsed));
    issues.push(...cSemantics(code, language));
  }

  const unique = dedupe(issues).slice(0, 8);
  return finish(unique.length === 0, unique, language);
}

function finish(ok: boolean, issues: Issue[], language: Lang): TraceResult {
  if (!ok) {
    const noun = issues.length === 1 ? "issue" : "issues";
    return {
      ok: false,
      issues,
      summary: `This ${label(language)} program would not run successfully. ${issues.length} ${noun} found.`,
    };
  }
  const summary =
    language === "python"
      ? "Syntax is valid and the names that were checked are defined. An interpreter would start this program."
      : "Syntax is valid, main is present, and the library calls that were checked have their headers. A compiler would accept this program to run.";
  return { ok: true, issues: [], summary };
}

function label(language: Lang): string {
  if (language === "cpp") return "C++";
  if (language === "c") return "C";
  return "Python";
}

function dedupe(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  const out: Issue[] = [];
  for (const issue of issues) {
    const key = `${issue.line}:${issue.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(issue);
  }
  return out;
}

function lineOf(code: string, pos: number): number {
  let line = 1;
  const end = Math.min(pos, code.length);
  for (let i = 0; i < end; i += 1) if (code[i] === "\n") line += 1;
  return line;
}

function snippet(code: string, line: number): string {
  const text = (code.split("\n")[line - 1] ?? "").trim();
  if (!text) return "";
  return text.length > 72 ? `${text.slice(0, 69)}...` : text;
}

function parserIssues(parser: { parse: (code: string) => { iterate: Function } }, code: string): Issue[] {
  const issues: Issue[] = [];
  try {
    parser.parse(code).iterate({
      enter(node: SyntaxNode) {
        if (!node.type.isError) return;
        const line = lineOf(code, node.from);
        const near = snippet(code, line);
        issues.push({
          line,
          message: near ? `Syntax error near "${near}".` : "Syntax error.",
        });
      },
    });
  } catch {
    issues.push({ line: 1, message: "Syntax error. The tracer could not read this program." });
  }
  return issues;
}

/** Direct-list-init after a template (`vector<int> v{1}`) confuses the C++ grammar. */
function relaxBraceInit(code: string): string {
  return code.replace(/>([ \t]*)([A-Za-z_]\w*)([ \t]*)\{/g, ">$1$2 = {");
}

function pythonSurface(code: string): Issue[] {
  const issues: Issue[] = [];
  const masked = maskPython(code, issues);
  const lines = masked.split("\n");
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    const match = /^[ \t]*print(?=[ \t#]|$)/.exec(line);
    if (!match) continue;
    const rest = line.slice(match[0].length).trim();
    if (!rest || rest.startsWith("#") || rest.startsWith("(")) continue;
    issues.push({
      line: i + 1,
      message: "print is a function in Python 3. Use print(...).",
    });
  }
  return issues;
}

function maskPython(code: string, issues: Issue[]): string {
  const chars = code.split("");
  const n = code.length;
  let i = 0;
  while (i < n) {
    const ch = code[i] ?? "";
    if (ch === "#") {
      while (i < n && code[i] !== "\n") {
        chars[i] = " ";
        i += 1;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      const start = i;
      const startLine = lineOf(code, i);
      const closed = readPyString(code, i);
      if (!closed.ok) {
        issues.push({ line: startLine, message: "String is not closed." });
      }
      const end = closed.ok ? closed.end : n;
      for (let k = start; k < end; k += 1) if (chars[k] !== "\n") chars[k] = "S";
      i = end;
      continue;
    }
    i += 1;
  }
  return chars.join("");
}

function stringFlags(code: string, quoteAt: number): { raw: boolean; format: boolean } {
  let k = quoteAt - 1;
  while (k >= 0 && /[a-zA-Z]/.test(code[k] ?? "")) k -= 1;
  const prefix = code.slice(k + 1, quoteAt).toLowerCase();
  if (!prefix || !/^[rubf]+$/.test(prefix)) return { raw: false, format: false };
  return { raw: prefix.includes("r"), format: prefix.includes("f") };
}

function readPyString(code: string, start: number): { ok: boolean; end: number } {
  const quote = code[start] ?? "";
  const triple = code.startsWith(quote.repeat(3), start);
  const flags = stringFlags(code, start);
  let i = start + (triple ? 3 : 1);
  const n = code.length;
  while (i < n) {
    const ch = code[i] ?? "";
    if (ch === "\\" && !flags.raw) {
      i += i + 1 < n ? 2 : 1;
      continue;
    }
    if (!triple && ch === "\n") return { ok: false, end: i };
    if (ch === quote) {
      if (!triple) return { ok: true, end: i + 1 };
      if (code.startsWith(quote.repeat(3), i)) return { ok: true, end: i + 3 };
    }
    if (flags.format && ch === "{") {
      if (code[i + 1] === "{") {
        i += 2;
        continue;
      }
      const expr = readFExpr(code, i + 1);
      if (!expr.ok) return { ok: false, end: expr.end };
      i = expr.end;
      continue;
    }
    if (flags.format && ch === "}" && code[i + 1] === "}") {
      i += 2;
      continue;
    }
    i += 1;
  }
  return { ok: false, end: n };
}

function readFExpr(code: string, start: number): { ok: boolean; end: number } {
  let depth = 1;
  let i = start;
  const n = code.length;
  while (i < n) {
    const ch = code[i] ?? "";
    if (ch === "'" || ch === '"') {
      const inner = readPyString(code, i);
      if (!inner.ok) return inner;
      i = inner.end;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      i += 1;
      if (depth === 0) return { ok: true, end: i };
      continue;
    }
    if (ch === "\n") return { ok: false, end: i };
    i += 1;
  }
  return { ok: false, end: n };
}

function pythonNames(code: string): Issue[] {
  const issues: Issue[] = [];
  let tree: SyntaxNode;
  try {
    tree = pythonParser.parse(code).topNode;
  } catch {
    return issues;
  }
  const scope = newScope(null, "module");
  for (const name of PY_BUILTINS) {
    scope.locals.add(name);
    scope.bound.add(name);
  }
  seedScope(tree, scope, code);
  walk(tree, scope, code, issues, new Set());
  return issues;
}

function newScope(parent: Scope | null, kind: Scope["kind"]): Scope {
  return {
    parent,
    kind,
    locals: new Set(),
    bound: new Set(),
    star: false,
    globals: new Set(),
  };
}

function kids(node: SyntaxNode): SyntaxNode[] {
  const out: SyntaxNode[] = [];
  let child = node.firstChild;
  while (child) {
    out.push(child);
    child = child.nextSibling;
  }
  return out;
}

function nodeText(node: SyntaxNode, code: string): string {
  return code.slice(node.from, node.to);
}

function isBound(scope: Scope | null, name: string): boolean {
  let current = scope;
  while (current) {
    if (current.star && !current.locals.has(name)) return true;
    if (current.locals.has(name)) return current.bound.has(name);
    current = current.parent;
  }
  return false;
}

function bind(scope: Scope, name: string) {
  if (!name || name === "*") return;
  if (scope.globals.has(name)) {
    let module = scope;
    while (module.parent) module = module.parent;
    module.locals.add(name);
    module.bound.add(name);
    return;
  }
  scope.locals.add(name);
  scope.bound.add(name);
}

function lexicalParent(scope: Scope): Scope {
  if (scope.kind === "class" && scope.parent) return scope.parent;
  return scope;
}

function seedScope(body: SyntaxNode, scope: Scope, code: string) {
  const globalNames = new Set<string>();
  collectGlobalsFixed(body, code, globalNames);
  for (const name of globalNames) scope.globals.add(name);
  const assigned = new Set<string>();
  const hoisted = new Set<string>();
  let star = false;
  collectBindings(body, code, assigned, hoisted, (value) => {
    star = value;
  });
  if (star) scope.star = true;
  for (const name of hoisted) {
    if (globalNames.has(name)) continue;
    scope.locals.add(name);
    scope.bound.add(name);
  }
  for (const name of assigned) {
    if (globalNames.has(name)) continue;
    scope.locals.add(name);
  }
}

function collectGlobalsFixed(node: SyntaxNode, code: string, into: Set<string>) {
  if (
    node.name === "FunctionDefinition" ||
    node.name === "ClassDefinition" ||
    node.name === "LambdaExpression" ||
    node.name === "ArrayComprehensionExpression" ||
    node.name === "ComprehensionExpression" ||
    node.name === "SetComprehensionExpression" ||
    node.name === "DictionaryComprehensionExpression"
  ) {
    return;
  }
  if (node.name === "ScopeStatement") {
    const keyword = node.firstChild;
    if (keyword && (keyword.name === "global" || keyword.name === "nonlocal")) {
      for (const child of kids(node)) {
        if (child.name === "VariableName") into.add(nodeText(child, code));
      }
    }
    return;
  }
  for (const child of kids(node)) collectGlobalsFixed(child, code, into);
}

function collectBindings(
  node: SyntaxNode,
  code: string,
  assigned: Set<string>,
  hoisted: Set<string>,
  onStar: (value: boolean) => void,
) {
  if (node.name === "FunctionDefinition" || node.name === "ClassDefinition") {
    const name = kids(node).find((child) => child.name === "VariableName");
    if (name) hoisted.add(nodeText(name, code));
    return;
  }
  if (node.name === "LambdaExpression") return;
  if (node.name === "ImportStatement") {
    const imported = importBindings(node, code);
    if (imported.star) onStar(true);
    for (const name of imported.names) hoisted.add(name);
    return;
  }
  if (
    node.name === "ArrayComprehensionExpression" ||
    node.name === "ComprehensionExpression" ||
    node.name === "SetComprehensionExpression" ||
    node.name === "DictionaryComprehensionExpression"
  ) {
    return;
  }
  if (node.name === "AssignStatement") {
    for (const name of assignmentNames(node, code)) assigned.add(name);
    const op = kids(node).findIndex((child) => child.name === "AssignOp");
    const value = op >= 0 ? kids(node).slice(op + 1) : [];
    // chained: value may contain another target before a later AssignOp — names already collected
    for (const child of value) {
      if (child.name === "AssignOp") continue;
      collectBindings(child, code, assigned, hoisted, onStar);
    }
    for (const child of kids(node)) {
      if (child.name === "TypeDef") collectBindings(child, code, assigned, hoisted, onStar);
    }
    return;
  }
  if (node.name === "UpdateStatement") {
    const target = node.firstChild;
    if (target?.name === "VariableName") assigned.add(nodeText(target, code));
    return;
  }
  if (node.name === "ForStatement") {
    for (const name of forTargetNames(node, code)) assigned.add(name);
    for (const child of kids(node)) collectBindings(child, code, assigned, hoisted, onStar);
    return;
  }
  if (node.name === "WithStatement" || node.name === "TryStatement") {
    for (const name of asNames(node, code)) assigned.add(name);
  }
  if (node.name === "CapturePattern") {
    const name = kids(node).find((child) => child.name === "VariableName");
    if (name) assigned.add(nodeText(name, code));
    return;
  }
  if (node.name === "KeywordPattern") {
    for (const child of kids(node)) {
      if (child.name !== "VariableName") collectBindings(child, code, assigned, hoisted, onStar);
    }
    return;
  }
  if (node.name === "ClassPattern") {
    let seen = false;
    for (const child of kids(node)) {
      if (child.name === "VariableName" && !seen) {
        seen = true;
        continue;
      }
      collectBindings(child, code, assigned, hoisted, onStar);
    }
    return;
  }
  for (const child of kids(node)) collectBindings(child, code, assigned, hoisted, onStar);
}

function assignmentNames(node: SyntaxNode, code: string): string[] {
  const names: string[] = [];
  const parts = kids(node);
  const ops = parts.map((child, index) => (child.name === "AssignOp" ? index : -1)).filter((index) => index >= 0);
  const targets = ops.length ? parts.slice(0, ops[ops.length - 1]) : parts;
  for (const target of targets) {
    if (target.name === "AssignOp" || target.name === "TypeDef") continue;
    gatherTargets(target, code, names);
  }
  return names;
}

function gatherTargets(node: SyntaxNode, code: string, into: string[]) {
  if (node.name === "VariableName") {
    into.push(nodeText(node, code));
    return;
  }
  if (node.name === "MemberExpression" || node.name === "SubscriptExpression" || node.name === "CallExpression") {
    return;
  }
  for (const child of kids(node)) gatherTargets(child, code, into);
}

function forTargetNames(node: SyntaxNode, code: string): string[] {
  const names: string[] = [];
  const parts = kids(node);
  const inAt = parts.findIndex((child) => child.name === "in");
  const targets = parts.slice(1, inAt === -1 ? undefined : inAt);
  for (const target of targets) gatherTargets(target, code, names);
  return names;
}

function asNames(node: SyntaxNode, code: string): string[] {
  const names: string[] = [];
  const parts = kids(node);
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i]?.name === "as" && parts[i + 1]?.name === "VariableName") {
      names.push(nodeText(parts[i + 1] as SyntaxNode, code));
    }
  }
  return names;
}

function importBindings(node: SyntaxNode, code: string): { names: string[]; star: boolean } {
  const parts = kids(node);
  const kind = parts[0]?.name;
  const names: string[] = [];
  if (kind === "import") {
    let pending: string | null = null;
    let alias = false;
    let dotted = false;
    const flush = () => {
      if (pending) names.push(pending);
      pending = null;
      dotted = false;
      alias = false;
    };
    for (const child of parts.slice(1)) {
      if (child.name === "VariableName") {
        if (alias) {
          pending = nodeText(child, code);
          alias = false;
          dotted = false;
        } else if (!dotted && pending == null) {
          pending = nodeText(child, code);
        } else {
          dotted = true;
        }
      } else if (child.name === "as") {
        alias = true;
        pending = null;
      } else if (child.name === ",") {
        flush();
      }
    }
    flush();
    return { names, star: false };
  }
  const importAt = parts.findIndex((child) => child.name === "import");
  let pending: string | null = null;
  let alias = false;
  let star = false;
  const flush = () => {
    if (pending) names.push(pending);
    pending = null;
    alias = false;
  };
  for (const child of parts.slice(importAt + 1)) {
    if (child.name === "*") {
      star = true;
      pending = null;
    } else if (child.name === "VariableName") {
      if (alias) {
        pending = nodeText(child, code);
        alias = false;
      } else {
        if (pending) names.push(pending);
        pending = nodeText(child, code);
      }
    } else if (child.name === "as") {
      pending = null;
      alias = true;
    } else if (child.name === ",") {
      flush();
    }
  }
  flush();
  return { names, star };
}

function walk(node: SyntaxNode, scope: Scope, code: string, issues: Issue[], reported: Set<string>) {
  switch (node.name) {
    case "FunctionDefinition": {
      openFunction(node, scope, code, issues, reported);
      return;
    }
    case "ClassDefinition": {
      const classScope = newScope(scope, "class");
      const body = kids(node).find((child) => child.name === "Body");
      if (body) {
        seedScope(body, classScope, code);
        walk(body, classScope, code, issues, reported);
      }
      return;
    }
    case "LambdaExpression": {
      const fnScope = newScope(scope, "function");
      const params = kids(node).find((child) => child.name === "ParamList");
      if (params) {
        for (const name of paramNames(params, code)) bind(fnScope, name);
      }
      for (const child of kids(node)) {
        if (child.name === "ParamList") continue;
        walk(child, fnScope, code, issues, reported);
      }
      return;
    }
    case "ImportStatement":
      return;
    case "AssignStatement": {
      const parts = kids(node);
      const ops = parts.map((child, index) => (child.name === "AssignOp" ? index : -1)).filter((index) => index >= 0);
      if (!ops.length) {
        for (const child of parts) if (child.name === "TypeDef") walk(child, scope, code, issues, reported);
        for (const name of assignmentNames(node, code)) bind(scope, name);
        return;
      }
      const last = ops[ops.length - 1] ?? 0;
      for (const child of parts.slice(last + 1)) walk(child, scope, code, issues, reported);
      for (const child of parts) if (child.name === "TypeDef") walk(child, scope, code, issues, reported);
      for (const name of assignmentNames(node, code)) bind(scope, name);
      return;
    }
    case "UpdateStatement": {
      for (const child of kids(node)) walk(child, scope, code, issues, reported);
      return;
    }
    case "ForStatement": {
      const parts = kids(node);
      const inAt = parts.findIndex((child) => child.name === "in");
      const body = parts.find((child) => child.name === "Body");
      for (const child of parts.slice(inAt + 1)) {
        if (child.name === "Body") continue;
        walk(child, scope, code, issues, reported);
      }
      for (const name of forTargetNames(node, code)) bind(scope, name);
      if (body) walk(body, scope, code, issues, reported);
      return;
    }
    case "WithStatement": {
      const parts = kids(node);
      for (const child of parts) {
        if (child.name === "as" || child.name === "Body" || child.name === "VariableName") continue;
        walk(child, scope, code, issues, reported);
      }
      for (const name of asNames(node, code)) bind(scope, name);
      const body = parts.find((child) => child.name === "Body");
      if (body) walk(body, scope, code, issues, reported);
      return;
    }
    case "TryStatement": {
      walkTry(node, scope, code, issues, reported);
      return;
    }
    case "ArrayComprehensionExpression":
    case "ComprehensionExpression":
    case "SetComprehensionExpression":
    case "DictionaryComprehensionExpression": {
      const comp = newScope(scope, "comp");
      for (const name of compTargets(node, code)) bind(comp, name);
      for (const child of kids(node)) walk(child, comp, code, issues, reported);
      return;
    }
    case "CapturePattern": {
      for (const child of kids(node)) if (child.name === "VariableName") bind(scope, nodeText(child, code));
      return;
    }
    case "KeywordPattern": {
      for (const child of kids(node)) {
        if (child.name !== "VariableName") walk(child, scope, code, issues, reported);
      }
      return;
    }
    case "ClassPattern": {
      let seen = false;
      for (const child of kids(node)) {
        if (child.name === "VariableName" && !seen) {
          seen = true;
          useName(child, scope, code, issues, reported);
          continue;
        }
        walk(child, scope, code, issues, reported);
      }
      return;
    }
    case "VariableName": {
      useName(node, scope, code, issues, reported);
      return;
    }
    case "MemberExpression": {
      const base = node.firstChild;
      if (base) walk(base, scope, code, issues, reported);
      return;
    }
    default: {
      for (const child of kids(node)) walk(child, scope, code, issues, reported);
    }
  }
}

function openFunction(
  node: SyntaxNode,
  scope: Scope,
  code: string,
  issues: Issue[],
  reported: Set<string>,
) {
  const fnScope = newScope(lexicalParent(scope), "function");
  const params = kids(node).find((child) => child.name === "ParamList");
  if (params) for (const name of paramNames(params, code)) bind(fnScope, name);
  const body = kids(node).find((child) => child.name === "Body");
  if (!body) return;
  const globalNames = new Set<string>();
  collectGlobalsFixed(body, code, globalNames);
  for (const name of globalNames) fnScope.globals.add(name);
  seedScope(body, fnScope, code);
  for (const name of globalNames) {
    fnScope.locals.delete(name);
    fnScope.bound.delete(name);
    fnScope.globals.add(name);
  }
  walk(body, fnScope, code, issues, reported);
}

function paramNames(node: SyntaxNode, code: string): string[] {
  const names: string[] = [];
  for (const child of kids(node)) {
    if (child.name === "VariableName") names.push(nodeText(child, code));
    else if (child.name === "ParamList" || child.name === "TupleExpression") {
      names.push(...paramNames(child, code));
    }
  }
  return names;
}

function compTargets(node: SyntaxNode, code: string): string[] {
  const names: string[] = [];
  const parts = kids(node);
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i]?.name !== "for") continue;
    for (let j = i + 1; j < parts.length && parts[j]?.name !== "in"; j += 1) {
      gatherTargets(parts[j] as SyntaxNode, code, names);
    }
  }
  return names;
}

function walkTry(node: SyntaxNode, scope: Scope, code: string, issues: Issue[], reported: Set<string>) {
  const parts = kids(node);
  let pendingAs: string | null = null;
  for (const child of parts) {
    if (child.name === "try" || child.name === "except" || child.name === "finally" || child.name === "else") {
      pendingAs = null;
      continue;
    }
    if (child.name === "as") {
      pendingAs = "";
      continue;
    }
    if (pendingAs === "" && child.name === "VariableName") {
      pendingAs = nodeText(child, code);
      continue;
    }
    if (child.name === "Body" && pendingAs) {
      bind(scope, pendingAs);
      walk(child, scope, code, issues, reported);
      scope.bound.delete(pendingAs);
      pendingAs = null;
      continue;
    }
    walk(child, scope, code, issues, reported);
  }
}

function useName(node: SyntaxNode, scope: Scope, code: string, issues: Issue[], reported: Set<string>) {
  const name = nodeText(node, code);
  if (!name || isBound(scope, name)) return;
  if (reported.has(name)) return;
  reported.add(name);
  issues.push({ line: lineOf(code, node.from), message: `Name '${name}' is not defined.` });
}

const C_HEADERS: Record<string, string[]> = {
  printf: ["stdio.h", "cstdio"],
  scanf: ["stdio.h", "cstdio"],
  puts: ["stdio.h", "cstdio"],
  fgets: ["stdio.h", "cstdio"],
  getchar: ["stdio.h", "cstdio"],
  putchar: ["stdio.h", "cstdio"],
  sprintf: ["stdio.h", "cstdio"],
  snprintf: ["stdio.h", "cstdio"],
  malloc: ["stdlib.h", "cstdlib"],
  calloc: ["stdlib.h", "cstdlib"],
  realloc: ["stdlib.h", "cstdlib"],
  free: ["stdlib.h", "cstdlib"],
  atoi: ["stdlib.h", "cstdlib"],
  qsort: ["stdlib.h", "cstdlib"],
  strlen: ["string.h", "cstring"],
  strcpy: ["string.h", "cstring"],
  strcmp: ["string.h", "cstring"],
  strcat: ["string.h", "cstring"],
  memcpy: ["string.h", "cstring"],
  memset: ["string.h", "cstring"],
  sqrt: ["math.h", "cmath"],
  pow: ["math.h", "cmath"],
  fabs: ["math.h", "cmath"],
  floor: ["math.h", "cmath"],
  ceil: ["math.h", "cmath"],
};

function cSemantics(code: string, language: Lang): Issue[] {
  const issues: Issue[] = [];
  const stripped = stripC(code);
  if (!/\bmain\s*\(/.test(stripped)) {
    issues.push({
      line: 1,
      message: "No main function. The file would not run as a program.",
    });
  }
  if (language === "c" && /\b(class|namespace|template|cout|cin|nullptr|wchar_t|public|private|protected)\b|std::|#\s*include\s*[<"]iostream/.test(stripped)) {
    issues.push({
      line: 1,
      message: "This uses C++. Choose C++ or it will not compile as C.",
    });
  }
  const includes = [...stripped.matchAll(/#\s*include\s*[<"]([^>"]+)[>"]/g)].map((match) => match[1] ?? "");
  const covered = new Set(includes);
  const bits = covered.has("bits/stdc++.h");
  if ((language === "cpp" || language === "c") && /\b(cout|cin|endl|cerr)\b/.test(stripped)) {
    if (!bits && !covered.has("iostream")) {
      const line = callLine(stripped, /\b(cout|cin|endl|cerr)\b/);
      issues.push({ line, message: "cout or cin needs #include <iostream>." });
    }
  }
  for (const [fn, headers] of Object.entries(C_HEADERS)) {
    const re = new RegExp(`\\b${fn}\\s*\\(`);
    if (!re.test(stripped)) continue;
    if (bits && language === "cpp") continue;
    if (headers.some((header) => covered.has(header))) continue;
    issues.push({
      line: callLine(stripped, re),
      message: `Call to ${fn} needs #include <${headers[0]}>.`,
    });
  }
  return issues;
}

function callLine(code: string, re: RegExp): number {
  const match = re.exec(code);
  if (!match || match.index == null) return 1;
  return lineOf(code, match.index);
}

function stripC(code: string): string {
  let out = "";
  let i = 0;
  while (i < code.length) {
    const ch = code[i] ?? "";
    const next = code[i + 1] ?? "";
    if (ch === "/" && next === "/") {
      while (i < code.length && code[i] !== "\n") {
        out += " ";
        i += 1;
      }
      continue;
    }
    if (ch === "/" && next === "*") {
      out += "  ";
      i += 2;
      while (i < code.length && !(code[i] === "*" && code[i + 1] === "/")) {
        out += code[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      if (i < code.length) {
        out += "  ";
        i += 2;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      const quote = ch;
      out += " ";
      i += 1;
      while (i < code.length) {
        if (code[i] === "\\") {
          out += code[i + 1] === "\n" ? " \n" : "  ";
          i += 2;
          continue;
        }
        if (code[i] === quote || code[i] === "\n") {
          out += code[i] === "\n" ? "\n" : " ";
          i += 1;
          break;
        }
        out += code[i] === "\n" ? "\n" : " ";
        i += 1;
      }
      continue;
    }
    out += ch;
    i += 1;
  }
  return out;
}

