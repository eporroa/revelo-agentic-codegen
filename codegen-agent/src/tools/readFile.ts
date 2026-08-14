import { readFile as fsReadFile } from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import type { RunLog } from "./runLog.js";
import type { ToolResult } from "./types.js";

export type ReadFileTool = (
  taskId: string,
  path: string
) => Promise<ToolResult<{ contents: string }>>;

export function createReadFile(outDir: string, log: RunLog): ReadFileTool {
  return async (taskId, path) => {
    const resolved = isAbsolute(path) ? path : join(outDir, path);
    const contents = await fsReadFile(resolved, "utf8");
    const output = { contents };
    const loggedAs = await log.append({
      taskId,
      tool: "readFile",
      input: { path },
      output,
    });
    return { output, loggedAs };
  };
}
