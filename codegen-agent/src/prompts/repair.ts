/**
 * Structured repair prompt: original task context + the failing file's
 * current contents + the exact error output + an instruction to return a
 * corrected full file (plan.md's Prompt design conventions).
 */
export interface RepairPromptInput {
  taskDescription: string;
  targetFile: string;
  currentContents: string;
  errorOutput: string;
}

export function buildRepairPrompt(input: RepairPromptInput): string {
  return `You are the repair stage of an autonomous code-generation agent. The file below was
generated for this task and failed validation. Fix it.

Task: ${input.taskDescription}
Target file: ${input.targetFile}

Current contents of ${input.targetFile}:
--- ${input.targetFile} ---
${input.currentContents}

Exact validation error output:
--- error output ---
${input.errorOutput}

Return ONLY the complete, corrected contents of ${input.targetFile} — no markdown code
fences, no explanation, no surrounding prose. The response body IS the file.`;
}
