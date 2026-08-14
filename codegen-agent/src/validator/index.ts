import type { Plan, ValidationResult, RepairSummaryEntry } from "../planner/types.js";
import { buildRepairPrompt } from "../prompts/repair.js";
import { extractFileContents } from "../generator/index.js";
import type { ReadFileTool } from "../tools/readFile.js";
import type { WriteFileTool } from "../tools/writeFile.js";
import type { CallLLMTool } from "../tools/callLLM.js";
import type { RunShellTool } from "../tools/runShell.js";

export interface ValidatorDeps {
  runShell: RunShellTool;
  readFile: ReadFileTool;
  writeFile: WriteFileTool;
  callLLM: CallLLMTool;
}

export interface ValidationOutcome {
  typecheck: ValidationResult;
  test: ValidationResult;
  repairSummary: RepairSummaryEntry[];
}

const MAX_REPAIR_ATTEMPTS = 3;
const VALIDATION_TASK_ID = "validation";

/** Best-effort: pulls `.ts`/`.tsx` paths out of tsc/vitest output (data-model.md: "best-effort"). */
function parseFailingFiles(output: string): string[] {
  const files = new Set<string>();
  for (const match of output.matchAll(/([A-Za-z0-9_.\-/]+\.tsx?)/g)) {
    const path = match[1]!.replace(/^\.\//, "");
    if (!path.includes("node_modules")) files.add(path);
  }
  return Array.from(files);
}

async function runCheck(
  runShell: RunShellTool,
  command: "typecheck" | "test"
): Promise<ValidationResult> {
  const { output } = await runShell(VALIDATION_TASK_ID, command);
  const rawOutput = `${output.stdout}\n${output.stderr}`;
  const passed = output.exitCode === 0;
  return {
    command,
    passed,
    rawOutput,
    failingFiles: passed ? [] : parseFailingFiles(rawOutput),
  };
}

function errorOutputForFile(
  file: string,
  typecheck: ValidationResult,
  test: ValidationResult
): string {
  const relevant = [typecheck, test]
    .filter((r) => !r.passed)
    .map((r) => r.rawOutput.split("\n").filter((line) => line.includes(file)).join("\n"))
    .filter((s) => s.length > 0);
  if (relevant.length > 0) return relevant.join("\n\n");
  // Fall back to the raw combined output (truncated) if we couldn't isolate
  // lines mentioning this file — still gives the repair call something to work with.
  return `${typecheck.rawOutput}\n${test.rawOutput}`.slice(0, 4000);
}

/**
 * Runs typecheck + test (FR-009), then repairs whichever tasks own a
 * currently-failing file, re-validating after each repair round, bounded
 * at MAX_REPAIR_ATTEMPTS rounds per task (FR-010) — which also bounds each
 * individual file to at most MAX_REPAIR_ATTEMPTS attempts, satisfying
 * FR-010's per-file wording even for a multi-file task. Sets every task's
 * final `completed`/`failed` status (FR-011, FR-017).
 */
export async function validateAndRepair(
  deps: ValidatorDeps,
  plan: Plan
): Promise<ValidationOutcome> {
  let typecheck = await runCheck(deps.runShell, "typecheck");
  let test = await runCheck(deps.runShell, "test");
  const repairSummary: RepairSummaryEntry[] = [];

  for (const task of plan.tasks) {
    let failingFiles = new Set([...typecheck.failingFiles, ...test.failingFiles]);
    let relevantFiles = task.targetFiles.filter((f) => failingFiles.has(f));

    if (relevantFiles.length === 0) {
      task.status = "completed";
      continue;
    }

    let attempts = 0;
    let resolved = false;
    while (task.repairAttempts < MAX_REPAIR_ATTEMPTS && !resolved) {
      task.repairAttempts++;
      attempts++;

      for (const file of relevantFiles) {
        let currentContents = "";
        try {
          currentContents = (await deps.readFile(task.id, file)).output.contents;
        } catch {
          // File was never written (e.g. planner referenced it but generation
          // skipped it) — repair from empty, the model will create it.
        }
        const prompt = buildRepairPrompt({
          taskDescription: task.description,
          targetFile: file,
          currentContents,
          errorOutput: errorOutputForFile(file, typecheck, test),
        });
        const { output } = await deps.callLLM(
          task.id,
          prompt,
          errorOutputForFile(file, typecheck, test)
        );
        await deps.writeFile(task.id, file, extractFileContents(output.text));
      }

      typecheck = await runCheck(deps.runShell, "typecheck");
      test = await runCheck(deps.runShell, "test");
      failingFiles = new Set([...typecheck.failingFiles, ...test.failingFiles]);
      relevantFiles = relevantFiles.filter((f) => failingFiles.has(f));
      resolved = relevantFiles.length === 0;
    }

    task.status = resolved ? "completed" : "failed";
    repairSummary.push({ taskId: task.id, attempts, resolved });
  }

  return { typecheck, test, repairSummary };
}
