import { CWE_CONTROL_IDS, type CweControl, type CweControlId } from "./model.js";

const TITLES: readonly string[] = [
  "Improper Input Validation",
  "Improper Limitation of a Pathname to a Restricted Directory ('Path Traversal')",
  "Relative Path Traversal",
  "Improper Link Resolution Before File Access ('Link Following')",
  "External Control of File Name or Path",
  "Improper Neutralization of Special Elements in Output Used by a Downstream Component ('Injection')",
  "Improper Neutralization of Special Elements used in a Command ('Command Injection')",
  "Improper Neutralization of Special Elements used in an OS Command ('OS Command Injection')",
  "Improper Neutralization of Input During Web Page Generation ('Cross-site Scripting')",
  "Improper Neutralization of Special Elements used in an SQL Command ('SQL Injection')",
  "Improper Control of Generation of Code ('Code Injection')",
  "Improper Neutralization of CRLF Sequences in HTTP Headers ('HTTP Request/Response Splitting')",
  "Improper Encoding or Escaping of Output",
  "Improper Output Neutralization for Logs",
  "Improper Restriction of Operations within the Bounds of a Memory Buffer",
  "Buffer Copy without Checking Size of Input ('Classic Buffer Overflow')",
  "Out-of-bounds Read",
  "Improper Validation of Array Index",
  "Use of Externally-Controlled Format String",
  "Integer Overflow or Wraparound",
  "Exposure of Sensitive Information to an Unauthorized Actor",
  "Observable Discrepancy",
  "Observable Timing Discrepancy",
  "Generation of Error Message Containing Sensitive Information",
  "Improper Privilege Management",
  "Incorrect Default Permissions",
  "Improper Access Control",
  "Improper Authorization",
  "Improper Authentication",
  "Authentication Bypass Using an Alternate Path or Channel",
  "Authentication Bypass by Spoofing",
  "Authentication Bypass by Capture-replay",
  "Improper Certificate Validation",
  "Missing Authentication for Critical Function",
  "Improper Restriction of Excessive Authentication Attempts",
  "Missing Encryption of Sensitive Data",
  "Cleartext Storage of Sensitive Information",
  "Cleartext Transmission of Sensitive Information",
  "Inadequate Encryption Strength",
  "Use of a Broken or Risky Cryptographic Algorithm",
  "Use of Insufficiently Random Values",
  "Insufficient Verification of Data Authenticity",
  "Origin Validation Error",
  "Cross-Site Request Forgery (CSRF)",
  "Concurrent Execution using Shared Resource with Improper Synchronization ('Race Condition')",
  "Session Fixation",
  "Uncontrolled Resource Consumption",
  "Unrestricted Upload of File with Dangerous Type",
  "Deserialization of Untrusted Data",
  "Insufficiently Protected Credentials",
  "Insertion of Sensitive Information into Log File",
  "URL Redirection to Untrusted Site ('Open Redirect')",
  "Improper Restriction of XML External Entity Reference",
  "Incorrect Permission Assignment for Critical Resource",
  "Use of Hard-coded Credentials",
  "Missing Authorization",
  "Incorrect Authorization",
  "Server-Side Request Forgery (SSRF)",
  "Insecure Storage of Sensitive Information",
  "Improper Neutralization of Special Elements in Data Query Logic",
];

export function securityControlVariableNames(id: CweControlId): {
  readonly applies: string;
  readonly required: string;
} {
  const stem = id.replace("-", "_");
  return { applies: `${stem}_APPLIES`, required: `${stem}_REQUIRED` };
}

export const cweControls: readonly CweControl[] = CWE_CONTROL_IDS.map((id, index) => {
  const names = securityControlVariableNames(id);
  const title = TITLES[index];
  if (title === undefined) throw new Error(`Missing title for ${id}`);
  return {
    id,
    title,
    appliesWhen: { kind: "BOOLEAN", variable: names.applies, equals: true },
    requiredObligation: { kind: "BOOLEAN", variable: names.required, equals: true },
    evidenceMessage: `${id} ${title} requires a formally declared protection for each applicable governed operation.`,
    repairStrategyIds: [`${id}:add-obligation`, `${id}:restrict-applicability`],
  };
});
