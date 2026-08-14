/**
 * The seam that lets planner/, generator/, and validator/ report live status
 * without depending on @clack/prompts directly, or changing their existing
 * unit tests. See specs/002-cli-dx-ux-polish/contracts/progress-reporter.md.
 */
import { spinner, log } from "@clack/prompts";

export type Phase = "plan" | "generate" | "validate" | "report";

export interface ProgressReporter {
  phaseStart(phase: Phase): void;
  phaseEnd(phase: Phase, ok: boolean): void;
  taskStart(taskId: string, description: string): void;
  taskEnd(taskId: string, status: "completed" | "failed"): void;
  repairAttempt(taskId: string, file: string, attempt: number, max: number): void;
}

const PHASE_LABELS: Record<Phase, string> = {
  plan: "PLAN",
  generate: "GENERATE",
  validate: "VALIDATE",
  report: "REPORT",
};

/**
 * The real, terminal-facing implementation (User Story 2). Uses one spinner
 * instance for the currently active task — safe to reuse across tasks
 * because generator/index.ts processes them strictly sequentially
 * (contracts/progress-reporter.md's behavioral contract), so start/stop
 * never overlaps. Phase transitions and repair attempts are plain status
 * lines, not spinners, since neither has a spinner-shaped single
 * start/stop boundary of its own (a phase contains many tasks; a repair
 * attempt has no separate "end" event).
 */
export function createClackProgressReporter(): ProgressReporter {
  const taskSpinner = spinner();

  return {
    phaseStart(phase) {
      log.step(`${PHASE_LABELS[phase]} starting…`);
    },
    phaseEnd(phase, ok) {
      if (ok) {
        log.success(`${PHASE_LABELS[phase]} done`);
      } else {
        log.error(`${PHASE_LABELS[phase]} finished with unresolved issues`);
      }
    },
    taskStart(taskId, description) {
      taskSpinner.start(`${taskId}: ${description}`);
    },
    taskEnd(taskId, status) {
      const verdict = status === "completed" ? "done" : "FAILED";
      taskSpinner.stop(`${taskId} ${verdict}`, status === "completed" ? 0 : 1);
    },
    repairAttempt(taskId, file, attempt, max) {
      log.warn(`Repairing ${file} (task ${taskId}) — attempt ${attempt}/${max}`);
    },
  };
}
