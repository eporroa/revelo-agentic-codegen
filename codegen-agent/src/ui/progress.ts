/**
 * The seam that lets planner/, generator/, and validator/ report live status
 * without depending on @clack/prompts directly, or changing their existing
 * unit tests. See specs/002-cli-dx-ux-polish/contracts/progress-reporter.md.
 */

export type Phase = "plan" | "generate" | "validate" | "report";

export interface ProgressReporter {
  phaseStart(phase: Phase): void;
  phaseEnd(phase: Phase, ok: boolean): void;
  taskStart(taskId: string, description: string): void;
  taskEnd(taskId: string, status: "completed" | "failed"): void;
  repairAttempt(taskId: string, file: string, attempt: number, max: number): void;
}
