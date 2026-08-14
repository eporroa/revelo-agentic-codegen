import { mkdir, writeFile as fsWriteFile } from "node:fs/promises";
import { dirname, join, isAbsolute } from "node:path";
import type { RunLog } from "./runLog.js";
import type { ToolResult } from "./types.js";

export type WriteFileTool = (
  taskId: string,
  path: string,
  contents: string
) => Promise<ToolResult<{ bytesWritten: number }>>;

/**
 * `path` is repo-relative to `outDir` (the generated app root) unless
 * already absolute. Creates parent directories as needed.
 */
export function createWriteFile(outDir: string, log: RunLog): WriteFileTool {
  return async (taskId, path, contents) => {
    const resolved = isAbsolute(path) ? path : join(outDir, path);
    await mkdir(dirname(resolved), { recursive: true });
    await fsWriteFile(resolved, contents, "utf8");
    const output = { bytesWritten: Buffer.byteLength(contents, "utf8") };
    const loggedAs = await log.append({
      taskId,
      tool: "writeFile",
      input: { path, contents },
      output,
    });
    return { output, loggedAs };
  };
}
