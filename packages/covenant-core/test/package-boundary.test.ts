import { execFileSync } from "node:child_process";
import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const temporaryDirectories: string[] = [];

function readJson(relativePath: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(readFileSync(join(repositoryRoot, relativePath), "utf8"));
  expect(parsed).toBeTypeOf("object");
  expect(parsed).not.toBeNull();
  return parsed as Record<string, unknown>;
}

function readRecord(value: unknown): Record<string, unknown> {
  expect(value).toBeTypeOf("object");
  expect(value).not.toBeNull();
  return value as Record<string, unknown>;
}

function readEffectiveCompilerOptions(relativePath: string): ts.CompilerOptions {
  const configPath = join(repositoryRoot, relativePath);
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  expect(loaded.error).toBeUndefined();
  const parsed = ts.parseJsonConfigFileContent(loaded.config, ts.sys, dirname(configPath), {}, configPath);
  expect(parsed.errors).toEqual([]);
  return parsed.options;
}

function explicitAnyLocations(relativePath: string): string[] {
  const source = readFileSync(join(repositoryRoot, relativePath), "utf8");
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true);
  const locations: string[] = [];
  function visit(node: ts.Node): void {
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      locations.push(`${relativePath}:${line + 1}:${character + 1}`);
    }
    ts.forEachChild(node, visit);
  }
  visit(sourceFile);
  return locations;
}

function findTypeScriptFiles(relativeRoot: string): string[] {
  const absoluteRoot = join(repositoryRoot, relativeRoot);
  const files: string[] = [];
  for (const entry of readdirSync(absoluteRoot, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules") {
      continue;
    }
    const relativePath = join(relativeRoot, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTypeScriptFiles(relativePath));
    } else if (/\.[cm]?tsx?$/u.test(entry.name)) {
      files.push(relativePath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function readBundle(directory: string): string {
  const contents: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      contents.push(readBundle(entryPath));
    } else if (entry.isFile()) {
      contents.push(readFileSync(entryPath, "utf8"));
    }
  }
  return contents.join("\n");
}

function writeFixture(relativePath: string, contents: string): void {
  const fixtureRoot = temporaryDirectories.at(-1);
  if (fixtureRoot === undefined) {
    throw new Error("LOC fixture root was not created");
  }
  const target = join(fixtureRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, contents);
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { force: true, recursive: true });
  }
});

describe("the monorepo package boundary", () => {
  it("contains exactly the three prescribed workspaces and package names", () => {
    const workspaceSource = readFileSync(join(repositoryRoot, "pnpm-workspace.yaml"), "utf8");
    const workspacePaths = [...workspaceSource.matchAll(/^\s+-\s+["']?([^"'\s]+)["']?\s*$/gm)]
      .map((match) => match[1])
      .filter((path): path is string => path !== undefined);

    expect(workspacePaths).toEqual([
      "packages/covenant-core",
      "app-1-spec-inquisitor",
      "app-2-clause-exorcist",
    ]);
    expect(workspacePaths.map((path) => readJson(`${path}/package.json`).name)).toEqual([
      "@covenant/core",
      "@covenant/spec-inquisitor",
      "@covenant/clause-exorcist",
    ]);
  });

  it("makes every workspace inherit the effective strict TypeScript contract", () => {
    const rootOptions = readRecord(readJson("tsconfig.json").compilerOptions);
    expect(rootOptions).toMatchObject({
      exactOptionalPropertyTypes: true,
      noImplicitAny: true,
      noUncheckedIndexedAccess: true,
      strict: true,
      strictNullChecks: true,
    });

    const workspaceConfigs = [
      "packages/covenant-core/tsconfig.json",
      "app-1-spec-inquisitor/tsconfig.json",
      "app-2-clause-exorcist/tsconfig.json",
    ];
    expect(workspaceConfigs.map((path) => readJson(path).extends)).toEqual([
      "../../tsconfig.json",
      "../tsconfig.json",
      "../tsconfig.json",
    ]);
    for (const configPath of workspaceConfigs) {
      expect(readEffectiveCompilerOptions(configPath)).toMatchObject({
        exactOptionalPropertyTypes: true,
        noImplicitAny: true,
        noUncheckedIndexedAccess: true,
        strict: true,
        strictNullChecks: true,
      });
    }

    const typedFiles = [
      ...findTypeScriptFiles("packages/covenant-core"),
      ...findTypeScriptFiles("app-1-spec-inquisitor"),
      ...findTypeScriptFiles("app-2-clause-exorcist"),
    ];
    expect(typedFiles.flatMap(explicitAnyLocations)).toEqual([]);
  });

  it("keeps the public root entry browser-safe before a Node entry exists", async () => {
    const corePackage = readJson("packages/covenant-core/package.json");
    const exportsMap = readRecord(corePackage.exports);
    const rootExport = readRecord(exportsMap["."]);

    expect(corePackage.sideEffects).toBe(false);
    expect(rootExport).toMatchObject({
      import: "./dist/index.js",
      types: "./dist/index.d.ts",
    });
    expect(exportsMap["./node"]).toBeUndefined();

    const rootSource = readFileSync(join(repositoryRoot, "packages/covenant-core/src/index.ts"), "utf8");
    expect(rootSource).not.toMatch(/(?:node:|z3-solver|NodeZ3Solver|\.\/node)/u);
    await expect(import("../src/index.js")).resolves.toMatchObject({
      COVENANT_CORE_VERSION: "0.1.0",
    });

    for (const application of ["app-1-spec-inquisitor", "app-2-clause-exorcist"]) {
      const applicationPackage = readJson(`${application}/package.json`);
      const dependencies = readRecord(applicationPackage.dependencies);
      const source = readFileSync(join(repositoryRoot, application, "src/main.tsx"), "utf8");
      expect(dependencies["@covenant/core"]).toBe("workspace:*");
      expect(source).toMatch(/from ["']@covenant\/core["']/u);
    }

    execFileSync(process.execPath, [
      join(repositoryRoot, "node_modules/typescript/bin/tsc"),
      "-p",
      join(repositoryRoot, "packages/covenant-core/tsconfig.build.json"),
    ]);
    const browserFixture = mkdtempSync(
      join(repositoryRoot, "packages/covenant-core/test/browser-boundary-"),
    );
    temporaryDirectories.push(browserFixture);
    writeFixture("index.html", '<script type="module" src="/src/main.ts"></script>\n');
    writeFixture(
      "src/main.ts",
      'import * as covenantCore from "@covenant/core";\nglobalThis.covenantCore = covenantCore;\n',
    );
    const viteCli = join(repositoryRoot, "app-1-spec-inquisitor/node_modules/vite/bin/vite.js");
    execFileSync(process.execPath, [
      viteCli,
      "build",
      browserFixture,
      "--outDir",
      join(browserFixture, "dist"),
      "--emptyOutDir",
      "--logLevel",
      "silent",
    ]);

    const bundles = [readBundle(join(browserFixture, "dist"))];
    for (const application of ["app-1-spec-inquisitor", "app-2-clause-exorcist"]) {
      const output = join(browserFixture, `${application}-dist`);
      execFileSync(process.execPath, [
        viteCli,
        "build",
        join(repositoryRoot, application),
        "--outDir",
        output,
        "--emptyOutDir",
        "--logLevel",
        "silent",
      ]);
      bundles.push(readBundle(output));
    }
    expect(bundles.join("\n")).not.toMatch(
      /(?:node:(?:assert|buffer|child_process|crypto|fs|http|https|module|os|path|stream|url|util|worker_threads)|z3-solver|NodeZ3Solver|SharedArrayBuffer|\.wasm)/u,
    );
  });

  it("reports production TypeScript size without imposing a hard cap", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "covenant-loc-"));
    temporaryDirectories.push(fixtureRoot);
    const ignoredLines = "export type Ignored = string;\n".repeat(1_200);
    const countedLines = Array.from(
      { length: 1_199 },
      (_, index) => `export const line${index} = ${index};`,
    ).join("\n");

    writeFixture("src/tribunal-ui/panel.tsx", `${countedLines}\n`);
    writeFixture("src/generated/data.ts", ignoredLines);
    writeFixture("src/types.d.ts", ignoredLines);
    writeFixture("src/ignored.test.ts", ignoredLines);
    writeFixture("src/comments.ts", `${"// ignored\n".repeat(1_200)}\n`);

    const script = join(repositoryRoot, "packages/covenant-core/scripts/check-loc.mjs");
    expect(execFileSync(process.execPath, [script, fixtureRoot], { encoding: "utf8" })).toContain("production source lines: 1199");

    writeFixture("src/index.ts", "export const threshold = true;\n");
    expect(execFileSync(process.execPath, [script, fixtureRoot], { encoding: "utf8" })).toContain("production source lines: 1200");

    const nestedGeneratedRoot = mkdtempSync(join(tmpdir(), "covenant-loc-nested-generated-"));
    temporaryDirectories.push(nestedGeneratedRoot);
    writeFixture("src/internal/generated/escape.ts", ignoredLines);
    expect(execFileSync(process.execPath, [script, nestedGeneratedRoot], { encoding: "utf8" })).toContain("production source lines: 1200");

    const explicitAnyRoot = mkdtempSync(join(tmpdir(), "covenant-loc-explicit-any-"));
    temporaryDirectories.push(explicitAnyRoot);
    writeFixture("src/new-module.ts", "export const unsafe: any = true;\n");
    expect(() => execFileSync(process.execPath, [script, explicitAnyRoot])).toThrow(/explicit any/iu);
  });

  it("wires the production source check into package builds and root typechecking", () => {
    const rootScripts = readRecord(readJson("package.json").scripts);
    const coreScripts = readRecord(readJson("packages/covenant-core/package.json").scripts);

    expect(coreScripts.build).toContain("check:loc");
    expect(rootScripts.typecheck).toContain("check:loc");
  });
});
