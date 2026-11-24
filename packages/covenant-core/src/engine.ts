import {
  runCompleteness,
  runConsistency,
  runSecurityLiveness,
  runTestability,
  runUnambiguity,
} from "./inquisitors.js";
import type { CovenantDocument, CovenantSolver, SolveOptions, VerificationReport } from "./model.js";
import { validateCovenantDocument } from "./parser.js";

export async function verifyCovenant(
  document: CovenantDocument,
  solver: CovenantSolver,
  options?: SolveOptions,
): Promise<VerificationReport> {
  const validation = validateCovenantDocument(document);
  if (validation.status === "INVALID") {
    throw new TypeError(`Invalid COVENANT document: ${validation.diagnostics.map((item) => item.code).join(", ")}`);
  }
  const testability = await runTestability(document, solver, options);
  const consistency = await runConsistency(document, solver, options);
  const completeness = await runCompleteness(document, solver, options);
  const unambiguity = await runUnambiguity(document, solver, options);
  const securityLiveness = await runSecurityLiveness(document, solver, options);
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
