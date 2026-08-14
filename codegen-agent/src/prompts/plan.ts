/**
 * The planner's prompt: spec text in, a JSON task graph out. This is the
 * only place the full spec text is ever passed to an LLM call — every
 * later call (generate/repair) only sees a scoped excerpt (FR-008).
 */
export function buildPlanPrompt(specText: string, priorIssue?: string): string {
  const retryNote = priorIssue
    ? `Your previous attempt was invalid: ${priorIssue}\nFix this and try again.\n\n`
    : "";

  return `You are the planning stage of an autonomous code-generation agent. You do not write \
any code yourself — you only decompose work into an ordered, dependency-aware task list for \
a later stage to execute.

The target is a React + TypeScript app generated into an EXISTING Vite boilerplate that \
already has Apollo Client, Material UI, and MSW configured. Only plan tasks for what the \
specification below actually asks for — do not invent tasks for boilerplate setup that \
already exists, and do not assume any feature the spec doesn't mention.

${retryNote}Specification:
"""
${specText}
"""

Respond with ONLY a JSON object of this exact shape (no prose, no markdown code fences):
{"tasks":[{"id":"T1","description":"...","dependsOn":[],"targetFiles":["src/..."]}]}

Rules:
- Every task needs a short unique "id", a one-sentence "description", a "dependsOn" array of
  other tasks' ids it needs completed first (empty array if none), and a "targetFiles" array
  with at least one concrete file path under "src/".
- "dependsOn" may only reference ids that also appear in this same task list.
- Order tasks so that, read top to bottom, each task's dependencies already appear earlier
  where possible — but "dependsOn" is the authoritative ordering, not list position.
- Prefer small, focused tasks (one hook, one component, one query file) over broad ones.`;
}
