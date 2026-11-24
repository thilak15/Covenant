import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { builtinModules } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const forbiddenBrowserCode = /(?:z3-solver|NodeZ3Solver|SharedArrayBuffer|\.wasm)/u;
const nodeBuiltins = new Set(builtinModules.map((name) => name.replace(/^node:/u, "")));
const temporaryDirectories: string[] = [];

function nodeBuiltinReferences(source: string): readonly string[] {
  const references: string[] = [];
  const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)["']([^"']+)["']/gu;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[1];
    if (specifier !== undefined && (specifier.startsWith("node:") || nodeBuiltins.has(specifier))) {
      references.push(specifier);
    }
  }
  return references;
}

function record(value: unknown): Record<string, unknown> {
  expect(value).toBeTypeOf("object");
  expect(value).not.toBeNull();
  return value as Record<string, unknown>;
}

function packageManifest(): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(join(repositoryRoot, "packages/covenant-core/package.json"), "utf8"));
  return record(parsed);
}

function textFiles(directory: string): readonly string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...textFiles(absolute));
    else if (entry.isFile()) files.push(absolute);
  }
  return files;
}

function sourceText(directory: string): string {
  return textFiles(directory)
    .filter((file) => /\.[cm]?[jt]sx?$/u.test(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

function bundleText(directory: string): string {
  return textFiles(directory)
    .filter((file) => /\.(?:css|html|js|json|map|txt)$/u.test(file))
    .map((file) => readFileSync(file, "utf8"))
    .join("\n");
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("the browser and Node solver boundary", () => {
  it("publishes NodeZ3Solver only through the conditional Node subpath", () => {
    const manifest = packageManifest();
    const exportsMap = record(manifest.exports);
    const rootExport = record(exportsMap["."]);
    const nodeExport = record(exportsMap["./node"]);
    const dependencies = record(manifest.dependencies);
    const devDependencies = record(manifest.devDependencies);

    expect(rootExport).toEqual({
      types: "./dist/index.d.ts",
      import: "./dist/index.js",
    });
    expect(nodeExport).toEqual({
      types: "./dist/node/index.d.ts",
      node: "./dist/node/index.js",
    });
    expect(dependencies["z3-solver"]).toEqual(expect.any(String));
    expect(devDependencies["z3-solver"]).toBeUndefined();

    const rootSource = readFileSync(join(repositoryRoot, "packages/covenant-core/src/index.ts"), "utf8");
    expect(rootSource).not.toMatch(forbiddenBrowserCode);
    expect(nodeBuiltinReferences(rootSource)).toEqual([]);
    expect(rootSource).not.toMatch(/(?:\.\/node|@covenant\/core\/node)/u);
  });

  it("keeps application source and production browser bundles free from Node and Z3 code", () => {
    for (const application of ["app-1-spec-inquisitor", "app-2-clause-exorcist"]) {
      const source = sourceText(join(repositoryRoot, application, "src"));
      expect(source).not.toMatch(/@covenant\/core\/node/u);
      expect(source).not.toMatch(forbiddenBrowserCode);
      expect(nodeBuiltinReferences(source)).toEqual([]);
    }

    execFileSync(process.execPath, [
      join(repositoryRoot, "node_modules/typescript/bin/tsc"),
      "-p",
      join(repositoryRoot, "packages/covenant-core/tsconfig.build.json"),
    ]);
    const viteCli = join(repositoryRoot, "app-1-spec-inquisitor/node_modules/vite/bin/vite.js");
    const outputDirectories: string[] = [];
    const fixtureOutput = mkdtempSync(join(tmpdir(), "covenant-browser-fixture-"));
    temporaryDirectories.push(fixtureOutput);
    outputDirectories.push(fixtureOutput);
    execFileSync(process.execPath, [
      viteCli,
      "build",
      "--config",
      join(repositoryRoot, "packages/covenant-core/test/fixtures/browser-vite.config.ts"),
      "--outDir",
      fixtureOutput,
      "--emptyOutDir",
      "--logLevel",
      "silent",
    ]);

    for (const application of ["app-1-spec-inquisitor", "app-2-clause-exorcist"]) {
      const applicationOutput = mkdtempSync(join(tmpdir(), `${application}-bundle-`));
      temporaryDirectories.push(applicationOutput);
      outputDirectories.push(applicationOutput);
      execFileSync(process.execPath, [
        viteCli,
        "build",
        join(repositoryRoot, application),
        "--outDir",
        applicationOutput,
        "--emptyOutDir",
        "--logLevel",
        "silent",
      ]);
    }

    const artifacts = outputDirectories.flatMap(textFiles);
    expect(artifacts.map((file) => file.slice(file.lastIndexOf("/") + 1))).not.toContainEqual(
      expect.stringMatching(/(?:z3|node-z3|\.wasm$)/iu),
    );
    const output = outputDirectories.map(bundleText).join("\n");
    expect(output).toContain("browserRootExports");
    expect(output).not.toMatch(forbiddenBrowserCode);
    expect(nodeBuiltinReferences(output)).toEqual([]);
  });
});
