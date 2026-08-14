import type { GenerationStepId } from "../planner/types.js";

/** Every discrete tool call returns its own output plus the log line it produced. */
export interface ToolResult<TOutput> {
  output: TOutput;
  loggedAs: GenerationStepId;
}
