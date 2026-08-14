import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { RunLog } from "./runLog.js";
import type { ToolResult } from "./types.js";

const execFileAsync = promisify(execFile);

export type ShellCommand = "install" | "typecheck" | "test";

export type RunShellTool = (
  taskId: string,
  command: ShellCommand
) => Promise<ToolResult<{ exitCode: number; stdout: string; stderr: string }>>;

/**
 * `command` is restricted to the three named boilerplate npm scripts — no
 * arbitrary shell string is ever accepted from spec text or LLM output
 * (contracts/tools.md's runShell contract: this closes off command
 * injection from untrusted input).
 */
function argsFor(command: ShellCommand): string[] {
  switch (command) {
    case "install":
      return ["install"];
    case "typecheck":
      return ["run", "typecheck"];
    case "test":
      return ["run", "test"];
  }
}

export function createRunShell(outDir: string, log: RunLog): RunShellTool {
  return async (taskId, command) => {
    const args = argsFor(command);
    let output: { exitCode: number; stdout: string; stderr: string };
    try {
      const { stdout, stderr } = await execFileAsync("npm", args, {
        cwd: outDir,
        maxBuffer: 20 * 1024 * 1024,
      });
      output = { exitCode: 0, stdout, stderr };
    } catch (err) {
      const e = err as NodeJS.ErrnoException & {
        code?: number;
        stdout?: string;
        stderr?: string;
      };
      output = {
        exitCode: typeof e.code === "number" ? e.code : 1,
        stdout: e.stdout ?? "",
        stderr: e.stderr ?? String(e.message ?? e),
      };
    }
    const loggedAs = await log.append({
      taskId,
      tool: "runShell",
      input: { command },
      output,
    });
    return { output, loggedAs };
  };
}
