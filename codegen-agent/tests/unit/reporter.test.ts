import { describe, it, expect } from "vitest";
import { buildReport, renderReportMarkdown } from "@/reporter/index.js";
import type { Plan, Task, ValidationResult } from "@/planner/types.js";
import type { ValidationOutcome } from "@/validator/index.js";

function task(overrides: Partial<Task>): Task {
  return {
    id: "T1",
    description: "desc",
    dependsOn: [],
    targetFiles: ["src/x.ts"],
    status: "completed",
    repairAttempts: 0,
    apiRetries: 0,
    ...overrides,
  };
}

function validationResult(overrides: Partial<ValidationResult>): ValidationResult {
  return {
    command: "test",
    passed: true,
    rawOutput: "",
    failingFiles: [],
    ...overrides,
  };
}

describe("reporter.buildReport", () => {
  it("aggregates a fully successful run", () => {
    const plan: Plan = {
      tasks: [
        task({ id: "T1", targetFiles: ["src/a.ts"], status: "completed" }),
        task({ id: "T2", targetFiles: ["src/b.ts"], status: "completed" }),
      ],
      createdAt: new Date().toISOString(),
      specPath: "spec.txt",
    };
    const validation: ValidationOutcome = {
      typecheck: validationResult({ command: "typecheck", passed: true }),
      test: validationResult({ command: "test", passed: true }),
      repairSummary: [],
    };

    const report = buildReport({
      plan,
      validation,
      tokenUsage: [
        { provider: "anthropic", model: "claude-sonnet-4-5", inputTokens: 100, outputTokens: 50 },
      ],
      estimatedCostUsd: 0.0012,
    });

    expect(report.tasksCompleted.map((t) => t.id)).toEqual(["T1", "T2"]);
    expect(report.tasksFailed).toEqual([]);
    expect(report.filesWritten).toEqual(["src/a.ts", "src/b.ts"]);
    expect(report.tokenUsage[0]?.inputTokens).toBe(100);
    expect(report.estimatedCostUsd).toBeCloseTo(0.0012, 6);
    expect(report.exitCode).toBe(0);
  });

  it("reports exit code 1 and lists failed tasks when a task has an unresolved failure", () => {
    const plan: Plan = {
      tasks: [
        task({ id: "T1", targetFiles: ["src/a.ts"], status: "completed" }),
        task({ id: "T2", targetFiles: ["src/b.ts"], status: "failed", repairAttempts: 3 }),
      ],
      createdAt: new Date().toISOString(),
      specPath: "spec.txt",
    };
    const validation: ValidationOutcome = {
      typecheck: validationResult({ command: "typecheck", passed: true }),
      test: validationResult({
        command: "test",
        passed: false,
        rawOutput: "FAIL src/b.ts: assertion failed",
        failingFiles: ["src/b.ts"],
      }),
      repairSummary: [{ taskId: "T2", attempts: 3, resolved: false }],
    };

    const report = buildReport({
      plan,
      validation,
      tokenUsage: [],
      estimatedCostUsd: 0,
    });

    expect(report.tasksCompleted.map((t) => t.id)).toEqual(["T1"]);
    expect(report.tasksFailed.map((t) => t.id)).toEqual(["T2"]);
    expect(report.exitCode).toBe(1);
    expect(report.repairSummary).toEqual([{ taskId: "T2", attempts: 3, resolved: false }]);

    const md = renderReportMarkdown(report);
    expect(md).toContain("FAILED");
    expect(md).toContain("T2");
    expect(md).toContain("Repair attempts used: 3");
  });
});
