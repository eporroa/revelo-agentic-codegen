import {
  PlannerOutputSchema,
  PlanningFailedError,
  type Plan,
  type PlannedTask,
  type Task,
} from "./types.js";
import { buildPlanPrompt } from "../prompts/plan.js";
import type { CallLLMTool } from "../tools/callLLM.js";
import type { WriteFileTool } from "../tools/writeFile.js";

export interface PlannerDeps {
  callLLM: CallLLMTool;
  writeFile: WriteFileTool;
  specText: string;
  specPath: string;
}

const MAX_PLANNING_ATTEMPTS = 3;
const PLANNING_TASK_ID = "planning";

/** Strips accidental markdown code fences an LLM sometimes wraps JSON in. */
function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1]!.trim() : trimmed;
}

function tryParsePlannerOutput(
  text: string
): { success: true; tasks: PlannedTask[] } | { success: false; issue: string } {
  let json: unknown;
  try {
    json = JSON.parse(stripCodeFences(text));
  } catch (err) {
    return { success: false, issue: `Response was not valid JSON (${String(err)}).` };
  }
  const result = PlannerOutputSchema.safeParse(json);
  if (!result.success) {
    return { success: false, issue: result.error.message };
  }
  return { success: true, tasks: result.data.tasks };
}

/**
 * Validates dependsOn references and detects cycles. Returns an ordered
 * (topologically sorted) task list, or an issue string if the graph is
 * invalid — the caller re-prompts the planner with that issue on failure.
 */
function orderTasks(
  tasks: PlannedTask[]
): { success: true; ordered: PlannedTask[] } | { success: false; issue: string } {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  for (const task of tasks) {
    for (const dep of task.dependsOn) {
      if (!byId.has(dep)) {
        return {
          success: false,
          issue: `Task "${task.id}" depends on unknown task id "${dep}".`,
        };
      }
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();
  const ordered: PlannedTask[] = [];

  function visit(id: string): string | undefined {
    if (visited.has(id)) return undefined;
    if (visiting.has(id)) return `Cycle detected involving task "${id}".`;
    visiting.add(id);
    const task = byId.get(id)!;
    for (const dep of task.dependsOn) {
      const cycleIssue = visit(dep);
      if (cycleIssue) return cycleIssue;
    }
    visiting.delete(id);
    visited.add(id);
    ordered.push(task);
    return undefined;
  }

  for (const task of tasks) {
    const issue = visit(task.id);
    if (issue) return { success: false, issue };
  }

  return { success: true, ordered };
}

function materializeTasks(planned: PlannedTask[]): Task[] {
  return planned.map((t) => ({
    ...t,
    status: "pending",
    repairAttempts: 0,
    apiRetries: 0,
  }));
}

/**
 * Renders the Plan as human-readable Markdown (FR-004, Clarifications:
 * "Markdown or plain text, no JSON requirement"). This is a static,
 * pre-generation snapshot — it intentionally does NOT get rewritten as
 * tasks complete, matching US2's acceptance scenario ("still accurately
 * reflects what was planned, independent of the live run"); final task
 * outcomes belong in report.md instead (see reporter/index.ts).
 */
export function renderPlanMarkdown(plan: Plan): string {
  const byId = new Map(plan.tasks.map((t) => [t.id, t]));
  const lines: string[] = [
    "# codegen-agent Plan",
    "",
    `Generated ${plan.createdAt} from \`${plan.specPath}\`.`,
    "",
    `This run will execute ${plan.tasks.length} task${plan.tasks.length === 1 ? "" : "s"} in ` +
      "the order below. This file is written before any code is generated and is not " +
      "rewritten afterward — see report.md for what actually happened during the run.",
    "",
    "## Tasks (execution order)",
    "",
  ];
  plan.tasks.forEach((task, i) => {
    lines.push(`### ${i + 1}. ${task.id} — ${task.description}`);
    lines.push("");
    lines.push(
      task.dependsOn.length > 0
        ? `Runs after ${task.dependsOn
            .map((id) => `${id} (${byId.get(id)?.description ?? "unknown"})`)
            .join(", ")}.`
        : "No dependencies — can run first."
    );
    lines.push("");
    lines.push(
      task.targetFiles.length > 1
        ? `Writes: ${task.targetFiles.map((f) => `\`${f}\``).join(", ")}.`
        : `Writes: \`${task.targetFiles[0]}\`.`
    );
    lines.push("");
  });
  return lines.join("\n");
}

/**
 * spec text -> ordered Task[] via one scoped LLM call, zod-validated
 * (re-prompting on a schema mismatch or invalid dependency graph up to
 * MAX_PLANNING_ATTEMPTS times), persisted as plan.md. Throws
 * PlanningFailedError — never returns an empty/invalid Plan — so cli.ts
 * can refuse to enter GENERATE (FR-005).
 */
export async function createPlan(deps: PlannerDeps): Promise<Plan> {
  let issue: string | undefined;

  for (let attempt = 1; attempt <= MAX_PLANNING_ATTEMPTS; attempt++) {
    const prompt = buildPlanPrompt(deps.specText, issue);
    const { output } = await deps.callLLM(PLANNING_TASK_ID, prompt, "");
    const parsed = tryParsePlannerOutput(output.text);

    if (!parsed.success) {
      issue = parsed.issue;
      continue;
    }
    if (parsed.tasks.length === 0) {
      issue = "The plan contained zero tasks.";
      continue;
    }
    const ordered = orderTasks(parsed.tasks);
    if (!ordered.success) {
      issue = ordered.issue;
      continue;
    }

    const plan: Plan = {
      tasks: materializeTasks(ordered.ordered),
      createdAt: new Date().toISOString(),
      specPath: deps.specPath,
    };
    await deps.writeFile(
      PLANNING_TASK_ID,
      ".codegen-agent/plan.md",
      renderPlanMarkdown(plan)
    );
    return plan;
  }

  throw new PlanningFailedError(
    `Planning failed after ${MAX_PLANNING_ATTEMPTS} attempts: ${issue}`
  );
}
