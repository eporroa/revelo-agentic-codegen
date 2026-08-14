import type { ProgressReporter } from "@/ui/progress.js";

/**
 * The default ProgressReporter — every method is a no-op. planner/,
 * generator/, and validator/'s existing unit tests use this implicitly by
 * simply not passing `progress`, so none of them need to change.
 */
export const noopProgressReporter: ProgressReporter = {
  phaseStart(): void {},
  phaseEnd(): void {},
  taskStart(): void {},
  taskEnd(): void {},
  repairAttempt(): void {},
};
