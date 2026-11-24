import {
  runCompleteness,
  runConsistency,
  runSecurityLiveness,
  runTestability,
  runUnambiguity,
} from "./inquisitors.js";
import type {
  ChalicePatch,
  CovenantDocument,
  CovenantSolver,
  PatchApplicationResult,
  SolveOptions,
  VerificationReport,
} from "./model.js";
import { validateCovenantDocument } from "./parser.js";
import { applyVerifiedChalicePatch, attachResolutions } from "./repairs.js";

async function verifyCovenantRaw(
  document: CovenantDocument,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<VerificationReport> {
  const validation = validateCovenantDocument(document);
  if (validation.status === "INVALID") {
    throw new TypeError(`Invalid COVENANT document: ${validation.diagnostics.map((item) => item.code).join(", ")}`);
  }
  const [testability, consistency, completeness, unambiguity, securityLiveness] = await Promise.all([
    runTestability(document, solver, options),
    runConsistency(document, solver, options),
    runCompleteness(document, solver, options),
    runUnambiguity(document, solver, options),
    runSecurityLiveness(document, solver, options),
  ]);
  const verdicts = [
    testability.verdict,
    consistency.verdict,
    completeness.verdict,
    unambiguity.verdict,
    securityLiveness.verdict,
  ] as const;
  return {
    documentId: document.source.id,
    revision: document.source.revision,
    verdicts,
    telemetry: [
      ...testability.telemetry,
      ...consistency.telemetry,
      ...completeness.telemetry,
      ...unambiguity.telemetry,
      ...securityLiveness.telemetry,
    ],
    certifiable: verdicts.every((verdict) => verdict.status === "PASS"),
  };
}

export async function verifyCovenant(
  document: CovenantDocument,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<VerificationReport> {
  const report = await verifyCovenantRaw(document, solver, options);
  return attachResolutions(document, report, solver, verifyCovenantRaw, options);
}

export async function applyChalicePatch(
  document: CovenantDocument,
  patch: ChalicePatch,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<PatchApplicationResult> {
  return applyVerifiedChalicePatch(document, patch, solver, verifyCovenantRaw, options);
}
