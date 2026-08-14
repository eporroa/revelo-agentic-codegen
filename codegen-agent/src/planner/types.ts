import { z } from "zod";

/**
 * Task lifecycle, per spec.md Clarifications (2026-08-14):
 * pending -> in_progress -> (completed | failed), no re-entering pending.
 */
export const TaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "completed",
  "failed",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

/**
 * One planned unit of work. `dependsOn`/`targetFiles` are produced by the
 * planner's LLM call and validated against this schema before being trusted
 * (research.md: "Structured plan/task output validation").
 */
export const TaskSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  dependsOn: z.array(z.string()).default([]),
  targetFiles: z.array(z.string()).min(1),
  status: TaskStatusSchema.default("pending"),
  repairAttempts: z.number().int().min(0).max(3).default(0),
  apiRetries: z.number().int().min(0).max(3).default(0),
});
export type Task = z.infer<typeof TaskSchema>;

/**
 * What the planner's LLM call must return, before we trust it: just the
 * bare list of tasks. Status/repairAttempts/apiRetries are filled with
 * their schema defaults at parse time since the LLM never proposes them.
 */
export const PlannedTaskSchema = TaskSchema.pick({
  id: true,
  description: true,
  dependsOn: true,
  targetFiles: true,
});
export type PlannedTask = z.infer<typeof PlannedTaskSchema>;

export const PlannerOutputSchema = z.object({
  tasks: z.array(PlannedTaskSchema),
});
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

/** The ordered collection of Tasks, persisted as plan.md before generation begins (FR-004). */
export const PlanSchema = z.object({
  tasks: z.array(TaskSchema),
  createdAt: z.string(),
  specPath: z.string(),
});
export type Plan = z.infer<typeof PlanSchema>;

/** One logged, executed action (FR-006/FR-007). One JSON line in log.jsonl. */
export const GenerationStepSchema = z.object({
  taskId: z.string(),
  tool: z.enum(["readFile", "writeFile", "runShell", "callLLM"]),
  input: z.unknown(),
  output: z.unknown(),
  timestamp: z.string(),
});
export type GenerationStep = z.infer<typeof GenerationStepSchema>;

/** Outcome of one typecheck/test run (FR-009). */
export interface ValidationResult {
  command: "typecheck" | "test";
  passed: boolean;
  rawOutput: string;
  failingFiles: string[];
}

/** Per-model token usage aggregated across a run (FR-012, SC-006). */
export interface TokenUsageEntry {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Per-file repair-attempt summary (FR-010/FR-011/FR-012). */
export interface RepairSummaryEntry {
  taskId: string;
  attempts: number;
  resolved: boolean;
}

/** The final summary artifact (FR-012), persisted as report.md. */
export interface RunReport {
  tasksCompleted: Task[];
  tasksFailed: Task[];
  filesWritten: string[];
  validation: { typecheck: ValidationResult; test: ValidationResult };
  repairSummary: RepairSummaryEntry[];
  tokenUsage: TokenUsageEntry[];
  estimatedCostUsd: number;
  exitCode: 0 | 1;
}

/**
 * Thrown by planner/index.ts when planning cannot produce a usable task
 * list (schema validation exhausted its retries, or the plan has zero
 * tasks). Callers MUST treat this as "never enter GENERATE" (FR-005).
 */
export class PlanningFailedError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "PlanningFailedError";
  }
}
