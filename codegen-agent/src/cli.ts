#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { access, constants, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";

export interface CliOptions {
  spec: string;
  boilerplate: string;
  out: string;
  force: boolean;
}

export class PreconditionError extends Error {}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function isReadableFile(path: string): Promise<boolean> {
  try {
    await access(path, constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

async function boilerplateHasRequiredScripts(boilerplatePath: string): Promise<boolean> {
  const pkgPath = resolve(boilerplatePath, "package.json");
  if (!(await pathExists(pkgPath))) return false;
  try {
    const raw = await readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> };
    return Boolean(pkg.scripts?.["typecheck"] && pkg.scripts?.["test"]);
  } catch {
    return false;
  }
}

async function outIsEmptyOrAbsent(outPath: string): Promise<boolean> {
  if (!(await pathExists(outPath))) return true;
  const entries = await readdir(outPath);
  return entries.length === 0;
}

/**
 * Checked before PLAN starts (contracts/cli.md's Preconditions section). On
 * failure, throws PreconditionError — main() turns that into an exit(1)
 * with nothing written to --out.
 */
export async function validatePreconditions(options: CliOptions): Promise<void> {
  if (!(await isReadableFile(options.spec))) {
    throw new PreconditionError(`--spec path is not readable: ${options.spec}`);
  }
  if (!(await pathExists(options.boilerplate))) {
    throw new PreconditionError(`--boilerplate path does not exist: ${options.boilerplate}`);
  }
  if (!(await boilerplateHasRequiredScripts(options.boilerplate))) {
    throw new PreconditionError(
      `--boilerplate does not define "typecheck" and "test" npm scripts: ${options.boilerplate}`
    );
  }
  if (!options.force && !(await outIsEmptyOrAbsent(options.out))) {
    throw new PreconditionError(
      `--out already exists and is not empty: ${options.out} (use --force to overwrite)`
    );
  }
}

export function parseArgs(argv: string[]): CliOptions {
  const program = new Command();
  program
    .name("codegen-agent")
    .description(
      "Generates a React + TypeScript app from a natural-language spec into an existing boilerplate."
    )
    .requiredOption("--spec <path>", "path to the natural-language spec file")
    .requiredOption("--boilerplate <path>", "path to the pre-built boilerplate project")
    .requiredOption("--out <path>", "destination for the generated app")
    .option("--force", "allow writing into a non-empty --out", false);

  program.parse(argv);
  const opts = program.opts<{
    spec: string;
    boilerplate: string;
    out: string;
    force: boolean;
  }>();
  return {
    spec: resolve(opts.spec),
    boilerplate: resolve(opts.boilerplate),
    out: resolve(opts.out),
    force: opts.force,
  };
}

export async function run(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  await validatePreconditions(options);
  // T018+ continues here: boilerplate copy, then plan -> generate -> validate -> report.
  return 0;
}

const isMain =
  process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  run(process.argv).then(
    (exitCode) => process.exit(exitCode),
    (err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`codegen-agent: ${message}`);
      process.exit(1);
    }
  );
}
