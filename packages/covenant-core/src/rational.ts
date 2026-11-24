import type { CanonicalRational, SerializedRational } from "./model.js";

const LITERAL = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/u;
const MAX_EXPONENT = 1000;

function gcd(a: bigint, b: bigint): bigint {
  let [x, y] = [a < 0n ? -a : a, b];
  while (y !== 0n) [x, y] = [y, x % y];
  return x;
}

/** Reduces `numerator/denominator` to canonical form; the denominator must be nonzero. */
export function makeRational(numerator: bigint, denominator: bigint): CanonicalRational {
  if (denominator === 0n) throw new RangeError("Rational denominator must be nonzero");
  const sign = denominator < 0n ? -1n : 1n;
  const divisor = gcd(numerator, denominator * sign);
  return { numerator: (numerator * sign) / divisor, denominator: (denominator * sign) / divisor };
}

/** Parses a base-10 literal directly into a reduced rational, never passing through `number`. */
export function parseRational(literal: string): CanonicalRational | null {
  const match = LITERAL.exec(literal);
  if (match === null) return null;
  const [, sign = "", whole = "", fraction = "", exponentText = "0"] = match;
  const exponent = Number(exponentText);
  if (Math.abs(exponent) > MAX_EXPONENT) return null;
  let numerator = BigInt(whole + fraction);
  let denominator = 10n ** BigInt(fraction.length);
  if (exponent >= 0) numerator *= 10n ** BigInt(exponent);
  else denominator *= 10n ** BigInt(-exponent);
  return makeRational(sign === "-" ? -numerator : numerator, denominator);
}

export function isCanonicalRational(value: unknown): value is CanonicalRational {
  if (typeof value !== "object" || value === null) return false;
  const { numerator, denominator } = value as Record<string, unknown>;
  return (
    typeof numerator === "bigint" &&
    typeof denominator === "bigint" &&
    denominator > 0n &&
    gcd(numerator, denominator) === 1n
  );
}

export function compareRationals(a: CanonicalRational, b: CanonicalRational): -1 | 0 | 1 {
  const delta = a.numerator * b.denominator - b.numerator * a.denominator;
  return delta < 0n ? -1 : delta > 0n ? 1 : 0;
}

export function addRationals(a: CanonicalRational, b: CanonicalRational): CanonicalRational {
  return makeRational(a.numerator * b.denominator + b.numerator * a.denominator, a.denominator * b.denominator);
}

export function subtractRationals(a: CanonicalRational, b: CanonicalRational): CanonicalRational {
  return makeRational(a.numerator * b.denominator - b.numerator * a.denominator, a.denominator * b.denominator);
}

export function divideRational(value: CanonicalRational, divisor: bigint): CanonicalRational {
  if (divisor === 0n) throw new RangeError("Rational divisor must be nonzero");
  return makeRational(value.numerator, value.denominator * divisor);
}

export function floorRational(value: CanonicalRational): bigint {
  const quotient = value.numerator / value.denominator;
  return value.numerator < 0n && value.numerator % value.denominator !== 0n ? quotient - 1n : quotient;
}

export function ceilRational(value: CanonicalRational): bigint {
  const quotient = value.numerator / value.denominator;
  return value.numerator > 0n && value.numerator % value.denominator !== 0n ? quotient + 1n : quotient;
}

export function absoluteRational(value: CanonicalRational): CanonicalRational {
  return value.numerator < 0n ? { numerator: -value.numerator, denominator: value.denominator } : value;
}

export function serializeRational(value: CanonicalRational): SerializedRational {
  return { numerator: value.numerator.toString(10), denominator: value.denominator.toString(10) };
}

/** Stable JSON for any COVENANT value; every `bigint` becomes a base-10 string. */
export function stringifyCovenant(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => (typeof item === "bigint" ? item.toString(10) : item));
}

const INTEGER_TEXT = /^-?\d+$/u;

/** Inverse of `stringifyCovenant`: restores rational pairs and INTEGER scalar values to `bigint`. */
export function parseCovenantJson(json: string): unknown {
  return JSON.parse(json, (_key, item: unknown) => {
    if (typeof item !== "object" || item === null || Array.isArray(item)) return item;
    const { numerator, denominator, kind, value } = item as Record<string, unknown>;
    if (typeof numerator === "string" && typeof denominator === "string" && INTEGER_TEXT.test(numerator) && INTEGER_TEXT.test(denominator)) {
      return { numerator: BigInt(numerator), denominator: BigInt(denominator) };
    }
    return kind === "INTEGER" && typeof value === "string" && INTEGER_TEXT.test(value) ? { ...item, value: BigInt(value) } : item;
  });
}
