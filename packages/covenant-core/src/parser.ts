import { asRecord, validateCondition, validateEndpoints } from "./condition.js";
import type {
  Condition,
  CovenantDocument,
  DeonticModality,
  DocumentValidationResult,
  NonEmpty,
  ParseDiagnostic,
  ParseResult,
  PrimaryWorkflow,
  Rule,
  RuleScope,
  SourceDocument,
  SourceLocation,
  UnsatCore,
  UnsupportedConstruct,
  UnsupportedTheory,
  VariableDeclaration,
} from "./model.js";
import { parseRational } from "./rational.js";

type Variables = ReadonlyMap<string, VariableDeclaration>;
const MODALITIES: readonly unknown[] = ["MUST", "MUST_NOT", "MAY"];
const RESERVED: readonly string[] = ["AND", "OR", "NOT", "EXISTS", "FORALL", "true", "false"];
const THEORIES: readonly unknown[] = ["VARIABLE_ARITHMETIC", "NONLINEAR", "QUANTIFIER", "OTHER"];
const EARS = /^(?:([A-Za-z][\w.-]*):\s+)?(?:(?:(?:WHEN|WHILE|WHERE)\s+(.+?),?|IF\s+(.+?),?\s+THEN)\s+)?THE SYSTEM\s+(SHALL NOT|SHALL|MAY)\s+(.+?)\.?$/u;
const CLAUSE = /^Clause\s+([\w.-]+):\s+(?:IF\s+(.+?),?\s+THEN\s+)?([A-Za-z_]\w*)\s+(MUST NOT|MUST|MAY)\s+(.+?)\.?$/u;
const TOKEN = /\s*(?:("[^"]*")|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|(>=|<=|!=|[=<>()+\-*/])|([A-Za-z_]\w*))/uy;
const MODALITY_BY_WORD: Readonly<Record<string, DeonticModality>> = { SHALL: "MUST", "SHALL NOT": "MUST_NOT", MUST: "MUST", "MUST NOT": "MUST_NOT", MAY: "MAY" };

class ClauseError extends Error {
  constructor(readonly code: string, message: string, readonly theory: UnsupportedTheory | null = null) {
    super(message);
  }
}

function nonEmpty<T>(items: readonly T[]): NonEmpty<T> | null {
  const [first, ...rest] = items;
  return first === undefined ? null : [first, ...rest];
}

function rejected(source: SourceDocument | null, diagnostics: readonly ParseDiagnostic[]): ParseResult {
  return { status: "REJECTED", source, diagnostics: nonEmpty(diagnostics) ?? [{ code: "INVALID_INPUT", severity: "ERROR", message: "Invalid input", location: null }] };
}

function diagnostic(code: string, message: string, location: SourceLocation | null = null, severity: "ERROR" | "WARNING" = "ERROR"): ParseDiagnostic {
  return { code, severity, message, location };
}

/** Condition grammar: OR < AND < NOT < atom; atoms are facts, enum or numeric comparisons. */
function parseCondition(text: string, variables: Variables): Condition {
  const tokens: string[] = [];
  for (TOKEN.lastIndex = 0; TOKEN.lastIndex < text.trimEnd().length; ) {
    const from = TOKEN.lastIndex;
    const match = TOKEN.exec(text);
    if (match === null) throw new ClauseError("SYNTAX_ERROR", `Unrecognized text near "${text.slice(from).trim()}"`);
    const token = match[0].trim();
    const previous = tokens[tokens.length - 1];
    const binary = previous !== undefined && /^(?:[\w")]|-?\d)/u.test(previous) && !["AND", "OR", "NOT"].includes(previous);
    if (binary && /^-\d/u.test(token)) tokens.push("-", token.slice(1));
    else tokens.push(token);
  }
  if (tokens.some((token) => token === "EXISTS" || token === "FORALL")) throw new ClauseError("UNSUPPORTED_THEORY", "Quantifiers are unsupported", "QUANTIFIER");
  if (tokens.some((token) => token === "*" || token === "/")) throw new ClauseError("UNSUPPORTED_THEORY", "Nonlinear arithmetic is unsupported", "NONLINEAR");
  if (tokens.some((token) => token === "+" || token === "-")) throw new ClauseError("UNSUPPORTED_THEORY", "Arithmetic expressions are unsupported", "VARIABLE_ARITHMETIC");
  let index = 0;
  const peek = (): string | undefined => tokens[index];
  const take = (): string => {
    const token = tokens[index++];
    if (token === undefined) throw new ClauseError("SYNTAX_ERROR", "Unexpected end of condition");
    return token;
  };
  const list = (kind: "ALL" | "ANY", keyword: string, item: () => Condition): Condition => {
    const items = [item()];
    while (peek() === keyword) {
      take();
      items.push(item());
    }
    const [first, second, ...rest] = items;
    return first === undefined || second === undefined ? (first ?? { kind: "TRUE" }) : { kind, conditions: [first, second, ...rest] };
  };
  const atom = (): Condition => {
    const name = take();
    const declaration = variables.get(name);
    if (declaration === undefined) throw new ClauseError("UNDECLARED_VARIABLE", `Variable "${name}" is not declared`);
    const operator = peek();
    if (declaration.kind === "BOOLEAN") {
      if (operator !== "=" && operator !== "!=") return { kind: "BOOLEAN", variable: name, equals: true };
      take();
      const literal = take();
      if (literal !== "true" && literal !== "false") throw new ClauseError("SYNTAX_ERROR", `Expected true or false for "${name}"`);
      return { kind: "BOOLEAN", variable: name, equals: (literal === "true") === (operator === "=") };
    }
    if (operator === undefined) throw new ClauseError("SYNTAX_ERROR", `Expected a comparison after "${name}"`);
    take();
    const operand = take();
    if (declaration.kind === "ENUM") {
      if ((operator !== "=" && operator !== "!=") || !operand.startsWith('"')) throw new ClauseError("SYNTAX_ERROR", `Expected = or != with a quoted value for "${name}"`);
      const value = operand.slice(1, -1);
      if (!declaration.values.includes(value)) throw new ClauseError("INVALID_ENUM_VALUE", `"${value}" is not in the domain of "${name}"`);
      return { kind: "ENUM", variable: name, operator: operator === "=" ? "EQ" : "NEQ", value };
    }
    const second = variables.get(operand);
    if (second?.kind === "NUMERIC") throw new ClauseError("UNSUPPORTED_THEORY", "Variable-to-variable comparison is unsupported", "VARIABLE_ARITHMETIC");
    const value = parseRational(operand);
    if (value === null || !["=", "!=", ">", ">=", "<", "<="].includes(operator)) throw new ClauseError("SYNTAX_ERROR", `Expected a numeric comparison for "${name}"`);
    const { domain } = declaration;
    const lower = { value, inclusive: operator !== ">" };
    const upper = { value, inclusive: operator !== "<" };
    const bound: Condition = {
      kind: "NUMERIC",
      bound: operator.startsWith(">") ? { variable: name, domain, lower } : operator.startsWith("<") ? { variable: name, domain, upper } : { variable: name, domain, lower, upper },
    };
    return operator === "!=" ? { kind: "NOT", condition: bound } : bound;
  };
  const primary = (): Condition => {
    if (peek() !== "(") return atom();
    take();
    const inner = disjunction();
    if (take() !== ")") throw new ClauseError("SYNTAX_ERROR", "Expected )");
    return inner;
  };
  const negation = (): Condition => (peek() === "NOT" ? (take(), { kind: "NOT", condition: negation() }) : primary());
  const conjunction = (): Condition => list("ALL", "AND", negation);
  const disjunction = (): Condition => list("ANY", "OR", conjunction);
  const result = disjunction();
  if (index < tokens.length) throw new ClauseError("SYNTAX_ERROR", `Unexpected "${tokens[index]}"`);
  return result;
}

function positionAt(offset: number, line: number, column: number): SourceLocation["start"] {
  return { offset, line, column };
}

function parseClause(source: SourceDocument, variables: Variables, line: string, lineNumber: number, lineStart: number, ordinal: number) {
  const text = line.trim();
  const indent = line.length - line.trimStart().length;
  const start = positionAt(lineStart + indent, lineNumber, indent + 1);
  const end = positionAt(start.offset + text.length, lineNumber, indent + 1 + text.length);
  const locate = (clauseRef: string): SourceLocation => ({ documentId: source.id, clauseRef, start, end });
  const explicit = source.format === "EARS" ? /^([A-Za-z][\w.-]*):\s/u.exec(text)?.[1] : /^Clause\s+([\w.-]+):/u.exec(text)?.[1];
  const ref = source.format === "EARS" ? (explicit ?? `R${ordinal}`) : `C${explicit ?? ordinal}`;
  const empty: Pick<RuleScope, "actors" | "resources" | "actions"> = { actors: [], resources: [], actions: [] };
  try {
    if (source.format === "EARS") {
      const match = EARS.exec(text);
      if (match === null) throw new ClauseError("SYNTAX_ERROR", "Expected: [ID:] [WHEN <condition>,] THE SYSTEM SHALL|SHALL NOT|MAY <condition>");
      const [, , whenClause, ifClause, word = "", then = ""] = match;
      const when = whenClause ?? ifClause;
      const id = ref;
      const rule: Rule = {
        id, source: locate(id), scope: { ...empty, context: { kind: "TRUE" } },
        activation: when === undefined ? { kind: "TRUE" } : parseCondition(when, variables),
        modality: MODALITY_BY_WORD[word] ?? "MUST", consequence: parseCondition(then, variables),
      };
      return rule;
    }
    const match = CLAUSE.exec(text);
    if (match === null) throw new ClauseError("SYNTAX_ERROR", "Expected: Clause <ref>: [IF <condition> THEN] <Party> MUST|MUST NOT|MAY <condition>");
    const [, , when, actor = "", word = "", then = ""] = match;
    const id = ref;
    const party = variables.get("Party");
    if (party?.kind !== "ENUM") throw new ClauseError("UNDECLARED_VARIABLE", 'Clause actors require an enum variable "Party"');
    if (!party.values.includes(actor)) throw new ClauseError("INVALID_ENUM_VALUE", `"${actor}" is not a declared Party`);
    return {
      id, source: locate(id), scope: { ...empty, actors: [{ variable: "Party", values: [actor] }], context: { kind: "TRUE" } },
      activation: when === undefined ? { kind: "TRUE" } : parseCondition(when, variables),
      modality: MODALITY_BY_WORD[word] ?? "MUST", consequence: parseCondition(then, variables),
    } satisfies Rule;
  } catch (error) {
    if (!(error instanceof ClauseError)) throw error;
    return { error, location: locate(ref) };
  }
}

function variableCodes(raw: unknown): string[] {
  const names = new Set<string>();
  const codes: string[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    const variable = asRecord(item);
    const name = variable?.["name"];
    if (variable === null || typeof name !== "string" || name === "" || RESERVED.includes(name)) {
      codes.push("INVALID_VARIABLE");
      continue;
    }
    if (names.has(name)) codes.push("DUPLICATE_VARIABLE");
    names.add(name);
    const { kind, values, domain } = variable;
    if (kind === "ENUM") {
      if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) codes.push("INVALID_VARIABLE");
      else if (values.length === 0) codes.push("EMPTY_ENUM_DOMAIN");
      else if (new Set(values).size !== values.length) codes.push("INVALID_VARIABLE");
    } else if (kind === "NUMERIC") {
      const range = asRecord(variable["range"] ?? {});
      if ((domain !== "INTEGER" && domain !== "DECIMAL") || range === null || validateEndpoints(range) !== null) codes.push("INVALID_VARIABLE");
    } else if (kind !== "BOOLEAN") codes.push("INVALID_VARIABLE");
  }
  return codes;
}

function asLocation(value: unknown, length: number, documentId: string): SourceLocation | null {
  const location = asRecord(value);
  const start = asRecord(location?.["start"]);
  const end = asRecord(location?.["end"]);
  if (location === null || start === null || end === null) return null;
  const [from, to] = [start["offset"], end["offset"]];
  const integers = [start["line"], start["column"], end["line"], end["column"], from, to];
  if ([start["line"], start["column"], end["line"], end["column"]].some((item) => typeof item === "number" && item < 1)) return null;
  if (location["documentId"] !== documentId || typeof location["clauseRef"] !== "string") return null;
  if (!integers.every((item) => typeof item === "number" && Number.isInteger(item))) return null;
  if (typeof from !== "number" || typeof to !== "number" || from < 0 || from > to || to > length) return null;
  return value as SourceLocation;
}

export function validateCovenantDocument(input: unknown): DocumentValidationResult {
  const document = asRecord(input);
  const source = asRecord(document?.["source"]);
  const text = source?.["text"];
  const shape =
    document !== null && source !== null && typeof text === "string" && typeof source["id"] === "string" &&
    typeof source["revision"] === "string" && (source["format"] === "EARS" || source["format"] === "CLAUSE") &&
    ["variables", "rules", "primaryWorkflows", "unsupportedConstructs"].every((key) => Array.isArray(document[key]));
  if (!shape) return { status: "INVALID", diagnostics: [diagnostic("INVALID_DOCUMENT", "Input is not a COVENANT document")] };
  const diagnostics: ParseDiagnostic[] = [];
  const add = (code: string, message: string, location: SourceLocation | null = null): void => void diagnostics.push(diagnostic(code, message, location));
  const finish = (): DocumentValidationResult => {
    const failures = nonEmpty(diagnostics);
    return failures === null ? { status: "VALID", document: input as CovenantDocument, diagnostics: [] } : { status: "INVALID", diagnostics: failures };
  };
  const declared = document["variables"] as unknown[];
  for (const code of variableCodes(declared)) add(code, `Invalid variable declaration (${code})`);
  if (diagnostics.length > 0) return finish();
  const variables: Variables = new Map(declared.map((item) => [(item as VariableDeclaration).name, item as VariableDeclaration]));
  const check = (condition: unknown, label: string, location: SourceLocation | null): void => {
    const code = validateCondition(condition, variables);
    if (code !== null) add(code, `${label}: ${code}`, location);
  };
  const ids = new Set<string>();
  for (const item of document["rules"] as unknown[]) {
    const rule = asRecord(item);
    const id = rule?.["id"];
    if (rule === null || typeof id !== "string" || id === "" || !MODALITIES.includes(rule["modality"])) {
      add("INVALID_RULE", "Rule must have a string id and a valid modality");
      continue;
    }
    const location = asLocation(rule["source"], text.length, source["id"] as string);
    if (location === null) add("INVALID_SOURCE_SPAN", `Rule ${id} has an invalid source span`);
    if (ids.has(id)) add("DUPLICATE_RULE_ID", `Rule ID ${id} is declared more than once`, location);
    ids.add(id);
    const scope = asRecord(rule["scope"]);
    const facets = (["actors", "resources", "actions"] as const).flatMap((key) => (Array.isArray(scope?.[key]) ? (scope[key] as unknown[]) : null) ?? [null]);
    for (const facet of facets) {
      const record = asRecord(facet);
      const values = record?.["values"];
      if (record === null || !Array.isArray(values) || values.length === 0) add("INVALID_RULE", `Rule ${id} has an invalid scope facet`, location);
      else for (const value of values) check({ kind: "ENUM", variable: record["variable"], operator: "EQ", value }, `Rule ${id} scope`, location);
    }
    check(scope?.["context"], `Rule ${id} scope`, location);
    check(rule["activation"], `Rule ${id} activation`, location);
    check(rule["consequence"], `Rule ${id} consequence`, location);
  }
  for (const item of document["unsupportedConstructs"] as unknown[]) {
    const construct = asRecord(item);
    if (construct === null || !THEORIES.includes(construct["theory"]) || typeof construct["description"] !== "string") add("INVALID_UNSUPPORTED_CONSTRUCT", "Invalid unsupported construct");
    else if (asLocation(construct["source"], text.length, source["id"] as string) === null) add("INVALID_SOURCE_SPAN", "Unsupported construct has an invalid source span");
  }
  const workflowIds = new Set<unknown>();
  for (const item of document["primaryWorkflows"] as unknown[]) {
    const workflow = asRecord(item);
    if (workflowIds.has(workflow?.["id"])) add("INVALID_WORKFLOW", "Duplicate primary workflow id");
    workflowIds.add(workflow?.["id"]);
    const required = workflow?.["requiredConsequences"];
    if (workflow === null || typeof workflow["id"] !== "string" || typeof workflow["label"] !== "string" || !Array.isArray(required) || required.length === 0) {
      add("INVALID_WORKFLOW", "Invalid primary workflow");
      continue;
    }
    for (const condition of [workflow["entry"], ...required]) check(condition, "Primary workflow", null);
  }
  return finish();
}

/** Narrows external input to an `UnsatCore`: at least two unique rule IDs, or `null`. */
export function validateUnsatCore(input: unknown): UnsatCore | null {
  const core = asRecord(input);
  const ruleIds = core?.["ruleIds"];
  const consequences = core?.["incompatibleConsequences"];
  if (core === null || typeof core["queryId"] !== "string" || !Array.isArray(ruleIds) || !Array.isArray(consequences)) return null;
  if (ruleIds.length < 2 || ruleIds.some((id) => typeof id !== "string") || new Set(ruleIds).size !== ruleIds.length) return null;
  const valid = consequences.every((item) => {
    const entry = asRecord(item);
    return entry !== null && ruleIds.includes(entry["ruleId"]) && MODALITIES.includes(entry["modality"]) && asRecord(entry["consequence"]) !== null;
  });
  return valid ? (input as UnsatCore) : null;
}

/** Deterministic offline EARS and structured-clause parser; never touches a network or LLM. */
export function parseOffline(input: unknown): ParseResult {
  const request = asRecord(input);
  const source = asRecord(request?.["source"]);
  const { id, revision, format, text } = source ?? {};
  if (request === null || typeof id !== "string" || typeof revision !== "string" || typeof text !== "string" || (format !== "EARS" && format !== "CLAUSE") ||
    !Array.isArray(request["declaredVariables"]) || !Array.isArray(request["primaryWorkflows"])) {
    return rejected(null, [diagnostic("INVALID_INPUT", "Expected { source, declaredVariables, primaryWorkflows }")]);
  }
  const document: SourceDocument = { id, revision, format, text };
  const codes = variableCodes(request["declaredVariables"]);
  if (codes.length > 0) return rejected(document, codes.map((code) => diagnostic(code, `Invalid variable declaration (${code})`)));
  const declared = request["declaredVariables"] as readonly VariableDeclaration[];
  const variables: Variables = new Map(declared.map((variable) => [variable.name, variable]));
  const rules: Rule[] = [];
  const constructs: UnsupportedConstruct[] = [];
  const diagnostics: ParseDiagnostic[] = [];
  let offset = 0;
  let ordinal = 0;
  text.split("\n").forEach((line, index) => {
    const lineStart = offset;
    offset += line.length + 1;
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;
    const parsed = parseClause(document, variables, line, index + 1, lineStart, ++ordinal);
    if (!("error" in parsed)) {
      if (rules.some((rule) => rule.id === parsed.id)) diagnostics.push(diagnostic("DUPLICATE_RULE_ID", `Rule ID ${parsed.id} is declared more than once`, parsed.source));
      else rules.push(parsed);
    } else if (parsed.error.theory !== null) {
      constructs.push({ theory: parsed.error.theory, description: parsed.error.message, source: parsed.location });
      diagnostics.push(diagnostic("UNSUPPORTED_THEORY", parsed.error.message, parsed.location, "WARNING"));
    } else diagnostics.push(diagnostic(parsed.error.code, parsed.error.message, parsed.location));
  });
  const candidate: CovenantDocument = {
    source: document, variables: declared, rules,
    primaryWorkflows: request["primaryWorkflows"] as readonly PrimaryWorkflow[], unsupportedConstructs: constructs,
  };
  const validation = validateCovenantDocument(candidate);
  const failures = [...diagnostics.filter((item) => item.severity === "ERROR"), ...(validation.status === "INVALID" ? validation.diagnostics : [])];
  if (failures.length > 0) return rejected(document, failures);
  return { status: "PARSED", document: candidate, diagnostics };
}
