import type { Plan, RunReport, TokenUsageEntry } from "@/planner/types.js";
import type { ValidationOutcome } from "@/validator/index.js";
import type { WriteFileTool } from "@/tools/writeFile.js";

export interface ReporterDeps {
  writeFile: WriteFileTool;
}

export interface BuildReportInput {
  plan: Plan;
  validation: ValidationOutcome;
  tokenUsage: TokenUsageEntry[];
  estimatedCostUsd: number;
}

/**
 * Aggregates the finished Plan + Validation Results into the final Run
 * Report (FR-012, data-model.md's Run Report). Pure — no I/O — so it's
 * cheap to unit test independent of writeFile/runShell.
 */
export function buildReport(input: BuildReportInput): RunReport {
  const tasksCompleted = input.plan.tasks.filter((t) => t.status === "completed");
  const tasksFailed = input.plan.tasks.filter((t) => t.status === "failed");
  const filesWritten = Array.from(new Set(input.plan.tasks.flatMap((t) => t.targetFiles)));

  const exitCode: 0 | 1 =
    tasksFailed.length > 0 ||
    !input.validation.typecheck.passed ||
    !input.validation.test.passed
      ? 1
      : 0;

  return {
    tasksCompleted,
    tasksFailed,
    filesWritten,
    validation: { typecheck: input.validation.typecheck, test: input.validation.test },
    repairSummary: input.validation.repairSummary,
    tokenUsage: input.tokenUsage,
    estimatedCostUsd: input.estimatedCostUsd,
    exitCode,
  };
}

/** Best-effort: the validation output lines mentioning one of a failed task's files. */
function lastErrorForTask(report: RunReport, taskId: string): string {
  const task = report.tasksFailed.find((t) => t.id === taskId);
  if (!task) return "";
  const files = task.targetFiles;
  const lines = [report.validation.typecheck.rawOutput, report.validation.test.rawOutput]
    .join("\n")
    .split("\n")
    .filter((line) => files.some((f) => line.includes(f)));
  return lines.slice(-5).join("\n") || "(no specific error line found; see full validation output)";
}

/**
 * Renders the Run Report as Markdown, honest about residual failures
 * (FR-011): a failed task is never described as if it succeeded.
 */
export function renderReportMarkdown(report: RunReport): string {
  const lines: string[] = [
    "# codegen-agent Run Report",
    "",
    report.exitCode === 0
      ? "**Result: success** — typecheck and tests both passed, every task completed."
      : "**Result: FAILED** — one or more tasks have an unresolved failure. Do not treat this " +
        "run's output as production-ready without reviewing the failures below.",
    "",
    "## Tasks",
    "",
    `- Completed: ${report.tasksCompleted.length} (${report.tasksCompleted
      .map((t) => t.id)
      .join(", ") || "none"})`,
    `- Failed: ${report.tasksFailed.length} (${report.tasksFailed.map((t) => t.id).join(", ") || "none"})`,
    "",
  ];

  if (report.tasksFailed.length > 0) {
    lines.push("### Unresolved failures", "");
    for (const task of report.tasksFailed) {
      const summary = report.repairSummary.find((r) => r.taskId === task.id);
      lines.push(`#### ${task.id} — ${task.description}`);
      lines.push("");
      lines.push(`- Target files: ${task.targetFiles.join(", ")}`);
      lines.push(
        `- Repair attempts used: ${summary?.attempts ?? task.repairAttempts} (max 3)`
      );
      lines.push("- Last error:");
      lines.push("");
      lines.push("```");
      lines.push(lastErrorForTask(report, task.id));
      lines.push("```");
      lines.push("");
    }
  }

  lines.push(
    "## Files written",
    "",
    ...report.filesWritten.map((f) => `- \`${f}\``),
    "",
    "## Validation",
    "",
    `- typecheck: ${report.validation.typecheck.passed ? "passed" : "FAILED"}`,
    `- test: ${report.validation.test.passed ? "passed" : "FAILED"}`,
    "",
    "## Cost",
    "",
    ...report.tokenUsage.map(
      (u) =>
        `- ${u.provider}/${u.model}: ${u.inputTokens} input tokens, ${u.outputTokens} output tokens`
    ),
    `- Estimated cost: $${report.estimatedCostUsd.toFixed(4)} (approximate — see .env-configured model pricing)`,
    "",
    `Exit code: ${report.exitCode}`
  );

  return lines.join("\n");
}

export async function writeReport(deps: ReporterDeps, report: RunReport): Promise<void> {
  await deps.writeFile("reporting", ".codegen-agent/report.md", renderReportMarkdown(report));
}
