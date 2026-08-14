#!/usr/bin/env node
import "dotenv/config";
import { Command } from "commander";
import { access, constants, cp, readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { RunLog } from "./tools/runLog.js";
import { createWriteFile } from "./tools/writeFile.js";
import { createReadFile } from "./tools/readFile.js";
import { createRunShell } from "./tools/runShell.js";
import { createCallLLM } from "./tools/callLLM.js";
import { getProvider } from "./llm/index.js";
import { createPlan } from "./planner/index.js";
import { PlanningFailedError } from "./planner/types.js";
import { generateAll } from "./generator/index.js";
import { validateAndRepair } from "./validator/index.js";
import { buildReport, writeReport } from "./reporter/index.js";
import { aggregateUsage, recordedCallsFromLog } from "./cost/index.js";

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

/**
 * Clones --boilerplate into --out (FR-002: never scaffold from scratch).
 * Preconditions have already confirmed --out is empty/absent or --force
 * was passed, so this may overwrite in the --force case.
 */
async function copyBoilerplate(options: CliOptions): Promise<void> {
  await cp(options.boilerplate, options.out, {
    recursive: true,
    filter: (src) => !src.split(/[/\\]/).includes("node_modules"),
  });
}

export async function run(argv: string[]): Promise<number> {
  const options = parseArgs(argv);
  await validatePreconditions(options);
  await copyBoilerplate(options);

  const specText = await readFile(options.spec, "utf8");

  const log = new RunLog(options.out);
  const writeFileTool = createWriteFile(options.out, log);
  const readFileTool = createReadFile(options.out, log);
  const runShellTool = createRunShell(options.out, log);
  const callLLMTool = createCallLLM(log, getProvider());

  // PLAN — never enter GENERATE on a failed/empty plan (FR-005).
  let plan;
  try {
    plan = await createPlan({
      callLLM: callLLMTool,
      writeFile: writeFileTool,
      specText,
      specPath: options.spec,
    });
  } catch (err) {
    if (err instanceof PlanningFailedError) {
      console.error(`codegen-agent: ${err.message}`);
      // FR-012 requires a report from every run, including one that never
      // reached GENERATE — record what planning spent before giving up.
      const recordedCalls = await recordedCallsFromLog(options.out);
      const { tokenUsage, estimatedCostUsd } = aggregateUsage(recordedCalls);
      await writeReport(
        { writeFile: writeFileTool },
        buildReport({
          plan: { tasks: [], createdAt: new Date().toISOString(), specPath: options.spec },
          validation: {
            typecheck: { command: "typecheck", passed: false, rawOutput: "", failingFiles: [] },
            test: {
              command: "test",
              passed: false,
              rawOutput: err.message,
              failingFiles: [],
            },
            repairSummary: [],
          },
          tokenUsage,
          estimatedCostUsd,
        })
      );
      return 1;
    }
    throw err;
  }

  // GENERATE
  await generateAll(
    { readFile: readFileTool, writeFile: writeFileTool, callLLM: callLLMTool },
    plan
  );

  // VALIDATE (+ bounded repair)
  const validation = await validateAndRepair(
    {
      runShell: runShellTool,
      readFile: readFileTool,
      writeFile: writeFileTool,
      callLLM: callLLMTool,
    },
    plan
  );

  // REPORT
  const recordedCalls = await recordedCallsFromLog(options.out);
  const { tokenUsage, estimatedCostUsd } = aggregateUsage(recordedCalls);
  const report = buildReport({ plan, validation, tokenUsage, estimatedCostUsd });
  await writeReport({ writeFile: writeFileTool }, report);

  return report.exitCode; // FR-015
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
