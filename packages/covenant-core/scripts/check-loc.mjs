import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const scanRoot = resolve(process.argv[2] ?? packageRoot);
const sourceRoot = join(scanRoot, "src");
const limit = 1_200;

function isCountedFile(filePath) {
  const relativePath = relative(sourceRoot, filePath);
  const segments = relativePath.split(sep);
  const extension = extname(filePath);
  const isGenerated = segments[0] === "generated";
  return (
    (extension === ".ts" || extension === ".tsx") &&
    !isGenerated &&
    !filePath.endsWith(".d.ts") &&
    !/\.test\.[cm]?tsx?$/u.test(filePath)
  );
}

function collectFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath));
    } else if (entry.isFile() && isCountedFile(entryPath)) {
      files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function inspectSource(filePath) {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    false,
    filePath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    sourceFile.languageVariant,
    source,
  );
  const lines = new Set();

  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    const start = scanner.getTokenPos();
    const end = Math.max(start, scanner.getTextPos() - 1);
    const firstLine = sourceFile.getLineAndCharacterOfPosition(start).line;
    const lastLine = sourceFile.getLineAndCharacterOfPosition(end).line;
    for (let line = firstLine; line <= lastLine; line += 1) {
      lines.add(line);
    }
  }

  const explicitAnyLocations = [];
  function visit(node) {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      explicitAnyLocations.push(`${relative(scanRoot, filePath)}:${position.line + 1}:${position.character + 1}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return { explicitAnyLocations, lineCount: lines.size };
}

if (!statSync(sourceRoot).isDirectory()) {
  throw new Error(`Source directory not found: ${sourceRoot}`);
}

const files = collectFiles(sourceRoot);
const inspections = files.map(inspectSource);
const count = inspections.reduce((total, inspection) => total + inspection.lineCount, 0);
const explicitAnyLocations = inspections.flatMap((inspection) => inspection.explicitAnyLocations);
console.log(`COVENANT Core production LOC: ${count}/${limit - 1}`);
if (explicitAnyLocations.length > 0) {
  console.error(`Explicit any is prohibited:\n${explicitAnyLocations.join("\n")}`);
  process.exitCode = 1;
}
if (count >= limit) {
  console.error(`Production TypeScript must remain below ${limit} counted lines.`);
  process.exitCode = 1;
}
