import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateAll } from "@/generator/index.js";
import { validateAndRepair } from "@/validator/index.js";
import { RunLog } from "@/tools/runLog.js";
import { createWriteFile } from "@/tools/writeFile.js";
import { createReadFile } from "@/tools/readFile.js";
import { createRunShell } from "@/tools/runShell.js";
import type { CallLLMTool } from "@/tools/callLLM.js";
import type { ProgressReporter } from "@/ui/progress.js";
import type { Plan, Task } from "@/planner/types.js";

const tempDirs: string[] = [];
async function makeOutDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codegen-agent-progress-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

function spyReporter(): ProgressReporter & {
  calls: { method: string; args: unknown[] }[];
} {
  const calls: { method: string; args: unknown[] }[] = [];
  const record =
    (method: string) =>
    (...args: unknown[]) =>
      calls.push({ method, args });
  return {
    calls,
    phaseStart: record("phaseStart"),
    phaseEnd: record("phaseEnd"),
    taskStart: record("taskStart"),
    taskEnd: record("taskEnd"),
    repairAttempt: record("repairAttempt"),
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "T1",
    description: "Widget task",
    dependsOn: [],
    targetFiles: ["src/Widget.ts"],
    status: "pending",
    repairAttempts: 0,
    apiRetries: 0,
    ...overrides,
  };
}

describe("generateAll progress reporting", () => {
  it("reports taskStart/taskEnd for every task, in order", async () => {
    const outDir = await makeOutDir();
    const log = new RunLog(outDir);
    const readFile = createReadFile(outDir, log);
    const writeFile = createWriteFile(outDir, log);
    const callLLM: CallLLMTool = vi.fn(async () => ({
      output: { text: "export const x = 1;", usage: { inputTokens: 1, outputTokens: 1 } },
      loggedAs: "x",
    }));
    const progress = spyReporter();

    const t1 = makeTask({ id: "T1", targetFiles: ["src/a.ts"] });
    const t2 = makeTask({ id: "T2", targetFiles: ["src/b.ts"] });
    const plan: Plan = { tasks: [t1, t2], createdAt: new Date().toISOString(), specPath: "s" };

    await generateAll({ readFile, writeFile, callLLM, progress }, plan);

    expect(progress.calls.map((c) => `${c.method}(${c.args[0]})`)).toEqual([
      "taskStart(T1)",
      "taskEnd(T1)",
      "taskStart(T2)",
      "taskEnd(T2)",
    ]);
  });
});

describe("validateAndRepair progress reporting", () => {
  it("reports a repairAttempt for each round spent on a failing task", async () => {
    const outDir = await makeOutDir();
    await fsWriteFile(
      join(outDir, "package.json"),
      JSON.stringify({
        name: "stub",
        private: true,
        scripts: {
          typecheck: 'node -e "process.exit(0)"',
          test: "node -e \"console.error('FAIL src/Widget.ts'); process.exit(1)\"",
        },
      })
    );
    const log = new RunLog(outDir);
    const readFile = createReadFile(outDir, log);
    const writeFile = createWriteFile(outDir, log);
    const runShell = createRunShell(outDir, log);
    const callLLM: CallLLMTool = vi.fn(async () => ({
      output: { text: "still broken", usage: { inputTokens: 1, outputTokens: 1 } },
      loggedAs: "x",
    }));
    const progress = spyReporter();

    const task = makeTask({ targetFiles: ["src/Widget.ts"] });
    const plan: Plan = { tasks: [task], createdAt: new Date().toISOString(), specPath: "s" };

    await validateAndRepair({ runShell, readFile, writeFile, callLLM, progress }, plan);

    const repairCalls = progress.calls.filter((c) => c.method === "repairAttempt");
    expect(repairCalls).toHaveLength(3); // bounded max, one per round
    expect(repairCalls.map((c) => c.args)).toEqual([
      ["T1", "src/Widget.ts", 1, 3],
      ["T1", "src/Widget.ts", 2, 3],
      ["T1", "src/Widget.ts", 3, 3],
    ]);
  });
});
