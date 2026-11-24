import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  CertificationSeal,
  certificationSealVariants,
  type FiveInquisitorVerdicts,
  type VerificationReport,
} from "../../src/index.js";
import { setReducedMotion } from "../setup-react.js";

const passVerdicts: FiveInquisitorVerdicts = [
  { inquisitor: "TESTABILITY", status: "PASS", findings: [], unresolved: [] },
  { inquisitor: "CONSISTENCY", status: "PASS", findings: [], unresolved: [] },
  { inquisitor: "COMPLETENESS", status: "PASS", findings: [], unresolved: [] },
  { inquisitor: "UNAMBIGUITY", status: "PASS", findings: [], unresolved: [] },
  { inquisitor: "SECURITY_LIVENESS", status: "PASS", findings: [], unresolved: [] },
];

function report(verdicts: FiveInquisitorVerdicts, certifiable: boolean): VerificationReport {
  return {
    documentId: "certification-scroll",
    revision: "revision-certified-7",
    verdicts,
    telemetry: [],
    certifiable,
  };
}

describe("CertificationSeal", () => {
  it("stamps only a certifiable report with five PASS verdicts and exposes the revision as text", () => {
    render(<CertificationSeal report={report(passVerdicts, true)} />);

    const seal = screen.getByLabelText("Formally certified, revision revision-certified-7");
    expect(seal).toHaveTextContent("Formally certified");
    expect(seal).toHaveTextContent("Revision revision-certified-7");
    expect(seal).toHaveAttribute("data-motion", "full");
    expect(screen.queryByText(/Certification blocked/iu)).not.toBeInTheDocument();
  });

  it("omits the seal and names FAIL, UNKNOWN, invalid evidence, and inconsistent certifiable flags", () => {
    const blocked: FiveInquisitorVerdicts = [
      passVerdicts[0],
      { inquisitor: "CONSISTENCY", status: "UNKNOWN", findings: [], unresolved: ["INVALID_EVIDENCE"] },
      passVerdicts[2],
      passVerdicts[3],
      { inquisitor: "SECURITY_LIVENESS", status: "UNKNOWN", findings: [], unresolved: ["ADAPTER_FAILURE"] },
    ];
    const { rerender } = render(<CertificationSeal report={report(blocked, true)} />);

    expect(screen.queryByLabelText(/Formally certified/iu)).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Certification blocked");
    expect(screen.getByText(/Consistency: UNKNOWN.*INVALID_EVIDENCE/iu)).toBeVisible();
    expect(screen.getByText(/Security & Liveness: UNKNOWN.*ADAPTER_FAILURE/iu)).toBeVisible();

    const failed: FiveInquisitorVerdicts = [
      {
        inquisitor: "TESTABILITY",
        status: "FAIL",
        findings: [{
          id: "finding-vague",
          patternId: "VAGUE_LANGUAGE",
          title: "Untestable language",
          message: "The consequence is not measurable.",
          evidence: {
            kind: "TESTABILITY",
            source: {
              documentId: "certification-scroll",
              clauseRef: "R-01",
              start: { offset: 0, line: 1, column: 1 },
              end: { offset: 10, line: 1, column: 11 },
            },
            terms: ["appropriate"],
          },
          support: "CUSTOM",
          resolution: { kind: "manual", reason: "Define a measurable consequence." },
        }],
        unresolved: [],
      },
      passVerdicts[1],
      passVerdicts[2],
      passVerdicts[3],
      passVerdicts[4],
    ];
    rerender(<CertificationSeal report={report(failed, false)} />);
    expect(screen.getByText("Testability: FAIL")).toBeVisible();
    expect(screen.queryByLabelText(/Formally certified/iu)).not.toBeInTheDocument();

    rerender(<CertificationSeal report={report(passVerdicts, false)} />);
    expect(screen.queryByLabelText(/Formally certified/iu)).not.toBeInTheDocument();
    expect(screen.getByText(/report is not certifiable/iu)).toBeVisible();
  });

  it("uses the finite contact-and-settle sequence and a static reduced-motion state", () => {
    expect(certificationSealVariants(false)).toMatchObject({
      unsealed: { rotate: -7, scale: 1.35 },
      sealed: {
        rotate: [ -7, -2, 0 ],
        scale: [1.35, 0.96, 1],
        transition: { duration: 0.52 },
      },
    });
    expect(certificationSealVariants(true)).toEqual({
      unsealed: { opacity: 1, rotate: 0, scale: 1 },
      sealed: { opacity: 1, rotate: 0, scale: 1, transition: { duration: 0 } },
    });

    setReducedMotion(true);
    render(<CertificationSeal report={report(passVerdicts, true)} />);
    expect(screen.getByLabelText(/Formally certified/iu)).toHaveAttribute("data-motion", "reduced");
  });
});
