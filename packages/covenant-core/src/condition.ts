import type {
  CompiledRule,
  Condition,
  NormalizedCondition,
  NumericBound,
  Rule,
  RuleScope,
  ScopeFacet,
  VariableDeclaration,
} from "./model.js";
import { isCanonicalRational } from "./rational.js";

const TRUE: NormalizedCondition = { kind: "TRUE" };
const FALSE: NormalizedCondition = { kind: "FALSE" };

export function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

/** Flattens one Boolean level, drops identities, and short-circuits on the absorbing element. */
function combine(kind: "ALL" | "ANY", parts: readonly NormalizedCondition[]): NormalizedCondition {
  const [identity, absorbing] = kind === "ALL" ? [TRUE, FALSE] : [FALSE, TRUE];
  const flat: NormalizedCondition[] = [];
  for (const part of parts) {
    if (part.kind === absorbing.kind) return absorbing;
    if (part.kind === kind) flat.push(...part.conditions);
    else if (part.kind !== identity.kind) flat.push(part);
  }
  const [first, ...rest] = flat;
  if (first === undefined) return identity;
  return rest.length === 0 ? first : { kind, conditions: [first, ...rest] };
}

function normalizeBound(bound: NumericBound, negate: boolean): NormalizedCondition {
  const { variable, domain, lower, upper } = bound;
  const atom = (value: NumericBound): NormalizedCondition => ({ kind: "ATOM", atom: { kind: "NUMERIC", bound: value } });
  if (lower === undefined && upper === undefined) return negate ? FALSE : TRUE;
  if (!negate) return atom(bound);
  const complements: NormalizedCondition[] = [];
  if (lower !== undefined) complements.push(atom({ variable, domain, upper: { value: lower.value, inclusive: !lower.inclusive } }));
  if (upper !== undefined) complements.push(atom({ variable, domain, lower: { value: upper.value, inclusive: !upper.inclusive } }));
  return combine("ANY", complements);
}

/** Removes `NOT`, flattens Boolean composition, and keeps source-stable atom order. */
export function normalizeCondition(condition: Condition, negate = false): NormalizedCondition {
  switch (condition.kind) {
    case "TRUE":
      return negate ? FALSE : TRUE;
    case "FALSE":
      return negate ? TRUE : FALSE;
    case "BOOLEAN":
      return { kind: "ATOM", atom: { ...condition, equals: condition.equals !== negate } };
    case "ENUM":
      return { kind: "ATOM", atom: { ...condition, operator: (condition.operator === "EQ") !== negate ? "EQ" : "NEQ" } };
    case "NUMERIC":
      return normalizeBound(condition.bound, negate);
    case "NOT":
      return normalizeCondition(condition.condition, !negate);
    case "ALL":
    case "ANY": {
      const kind = (condition.kind === "ALL") !== negate ? "ALL" : "ANY";
      return combine(kind, condition.conditions.map((child) => normalizeCondition(child, negate)));
    }
  }
}

function conjoin(parts: readonly Condition[]): Condition {
  const [first, second, ...rest] = parts;
  if (first === undefined) return { kind: "TRUE" };
  return second === undefined ? first : { kind: "ALL", conditions: [first, second, ...rest] };
}

function facetCondition({ variable, values }: ScopeFacet): Condition {
  const [first, second, ...rest] = values.map((value): Condition => ({ kind: "ENUM", variable, operator: "EQ", value }));
  if (first === undefined) return { kind: "FALSE" };
  return second === undefined ? first : { kind: "ANY", conditions: [first, second, ...rest] };
}

/** Compiles a scope into the same `Condition` language used by activations. */
export function compileScope(scope: RuleScope): Condition {
  const facets = [...scope.actors, ...scope.resources, ...scope.actions].map(facetCondition);
  return conjoin(scope.context.kind === "TRUE" ? facets : [...facets, scope.context]);
}

export function compileRule(rule: Rule): CompiledRule {
  const consequence = normalizeCondition(rule.consequence);
  const { modality } = rule;
  return {
    id: rule.id,
    source: rule.source,
    applicability: normalizeCondition(conjoin([compileScope(rule.scope), rule.activation])),
    hardConsequence: modality === "MAY" ? null : modality === "MUST" ? consequence : normalizeCondition(rule.consequence, true),
    permission: modality === "MAY" ? consequence : null,
    triggeredConsequence: { ruleId: rule.id, modality, consequence: rule.consequence },
  };
}

/** Returns the first diagnostic code for an invalid external condition, or `null` when valid. */
export function validateCondition(input: unknown, variables: ReadonlyMap<string, VariableDeclaration>): string | null {
  const node = asRecord(input);
  const kind = node?.["kind"];
  if (node === null || typeof kind !== "string") return "INVALID_CONDITION";
  if (kind === "TRUE" || kind === "FALSE") return null;
  if (kind === "NOT") return validateCondition(node["condition"], variables);
  if (kind === "ALL" || kind === "ANY") {
    const children = node["conditions"];
    if (!Array.isArray(children) || children.length === 0) return "INVALID_CONDITION";
    for (const child of children) {
      const failure = validateCondition(child, variables);
      if (failure !== null) return failure;
    }
    return null;
  }
  if (kind !== "BOOLEAN" && kind !== "ENUM" && kind !== "NUMERIC") return "INVALID_CONDITION";
  const target = kind === "NUMERIC" ? asRecord(node["bound"]) : node;
  const name = target?.["variable"];
  if (target === null || typeof name !== "string") return "INVALID_CONDITION";
  const declaration = variables.get(name);
  if (declaration === undefined) return "UNDECLARED_VARIABLE";
  if (declaration.kind !== kind) return "VARIABLE_KIND_MISMATCH";
  if (kind === "BOOLEAN") return typeof node["equals"] === "boolean" ? null : "INVALID_CONDITION";
  if (declaration.kind === "ENUM") {
    const value = node["value"];
    if (typeof value !== "string" || (node["operator"] !== "EQ" && node["operator"] !== "NEQ")) return "INVALID_CONDITION";
    return declaration.values.includes(value) ? null : "INVALID_ENUM_VALUE";
  }
  if (declaration.kind !== "NUMERIC" || target["domain"] !== declaration.domain) return "VARIABLE_KIND_MISMATCH";
  return validateEndpoints(target);
}

/** Checks optional `lower` and `upper` endpoints of a numeric bound or declared range. */
export function validateEndpoints(range: Record<string, unknown>): string | null {
  for (const side of ["lower", "upper"]) {
    const endpoint = range[side];
    if (endpoint === undefined) continue;
    const record = asRecord(endpoint);
    if (record === null || typeof record["inclusive"] !== "boolean") return "INVALID_CONDITION";
    if (!isCanonicalRational(record["value"])) return "INVALID_RATIONAL";
  }
  return null;
}
