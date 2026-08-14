import type { Plan, Task } from "../planner/types.js";
import { buildGeneratePrompt } from "../prompts/generate.js";
import type { ReadFileTool } from "../tools/readFile.js";
import type { WriteFileTool } from "../tools/writeFile.js";
import type { CallLLMTool } from "../tools/callLLM.js";
import type { ProgressReporter } from "@/ui/progress.js";

export interface GeneratorDeps {
  readFile: ReadFileTool;
  writeFile: WriteFileTool;
  callLLM: CallLLMTool;
  /** Optional — defaults to no live progress reporting when omitted. */
  progress?: ProgressReporter;
}

/** Strips accidental markdown code fences an LLM sometimes wraps a file in. */
export function extractFileContents(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[a-zA-Z0-9]*\s*\n([\s\S]*?)\n```$/);
  return fenced ? fenced[1]!.trim() + "\n" : trimmed + "\n";
}

/**
 * Reads the target files of every task this task depends on (FR-008:
 * scoped context, never the full codebase). Best-effort — a dependency
 * file that can't be read is skipped rather than failing the whole task,
 * since the LLM can still attempt the file with a smaller context.
 */
async function gatherDependencyContext(
  readFile: ReadFileTool,
  plan: Plan,
  task: Task
): Promise<Record<string, string>> {
  const contents: Record<string, string> = {};
  for (const depId of task.dependsOn) {
    const depTask = plan.tasks.find((t) => t.id === depId);
    if (!depTask) continue;
    for (const file of depTask.targetFiles) {
      try {
        const { output } = await readFile(task.id, file);
        contents[file] = output.contents;
      } catch {
        // Dependency not yet on disk or unreadable — proceed without it.
      }
    }
  }
  return contents;
}

/**
 * Generates every target file for one task. Leaves the task `in_progress`
 * — validator/index.ts owns the final completed/failed verdict once
 * typecheck/test (and any repairs) have run, per the Task state machine
 * (data-model.md): repair happens without a separate visible task state.
 *
 * `progress.taskEnd`'s status here reflects only whether *generation*
 * itself completed (the LLM call succeeded and the file was written) —
 * not whether the generated code later passes validation. That's a
 * different, later signal (validateAndRepair's repairAttempt/task.status),
 * reported separately once it's actually known.
 */
export async function generateTask(
  deps: GeneratorDeps,
  plan: Plan,
  task: Task
): Promise<void> {
  task.status = "in_progress";
  deps.progress?.taskStart(task.id, task.description);
  try {
    const dependencyFileContents = await gatherDependencyContext(deps.readFile, plan, task);

    for (const targetFile of task.targetFiles) {
      const prompt = buildGeneratePrompt({
        taskDescription: task.description,
        targetFile,
        dependencyFileContents,
      });
      const { output } = await deps.callLLM(
        task.id,
        prompt,
        JSON.stringify(dependencyFileContents)
      );
      await deps.writeFile(task.id, targetFile, extractFileContents(output.text));
    }
    deps.progress?.taskEnd(task.id, "completed");
  } catch (err) {
    deps.progress?.taskEnd(task.id, "failed");
    throw err;
  }
}

/** Walks the (already topologically sorted) task graph, one task at a time. */
export async function generateAll(deps: GeneratorDeps, plan: Plan): Promise<void> {
  for (const task of plan.tasks) {
    await generateTask(deps, plan, task);
  }
}
