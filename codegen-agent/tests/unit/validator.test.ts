import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm, writeFile as fsWriteFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateAndRepair } from "@/validator/index.js";
import { RunLog } from "@/tools/runLog.js";
import { createWriteFile } from "@/tools/writeFile.js";
import { createReadFile } from "@/tools/readFile.js";
import { createRunShell } from "@/tools/runShell.js";
import type { CallLLMTool } from "@/tools/callLLM.js";
import type { Plan, Task } from "@/planner/types.js";

const tempDirs: string[] = [];

async function makeOutDir(testScript: string, typecheckScript = "node -e \"process.exit(0)\""): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codegen-agent-validator-"));
  tempDirs.push(dir);
  await fsWriteFile(
    join(dir, "package.json"),
    JSON.stringify({
      name: "stub",
      private: true,
      scripts: { typecheck: typecheckScript, test: testScript },
    })
  );
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

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

function makePlan(tasks: Task[]): Plan {
  return { tasks, createdAt: new Date().toISOString(), specPath: "spec.txt" };
}

describe("validator repair loop", () => {
  it("resolves within budget once the repaired file satisfies the check", async () => {
    // Fails until src/Widget.ts contains "FIXED". Prints the failing path on
    // failure, the way tsc/vitest do, so validator can attribute it to a task.
    const testScript =
      "node -e \"const fs=require('fs'); let c=''; try{c=fs.readFileSync('src/Widget.ts','utf8')}catch{}; if(!c.includes('FIXED')){console.error('FAIL src/Widget.ts'); process.exit(1)}\"";
    const outDir = await makeOutDir(testScript);
    const log = new RunLog(outDir);
    const readFile = createReadFile(outDir, log);
    const writeFile = createWriteFile(outDir, log);
    const runShell = createRunShell(outDir, log);
    const callLLM: CallLLMTool = vi.fn(async () => ({
      output: { text: "export const widget = 'FIXED';", usage: { inputTokens: 1, outputTokens: 1 } },
      loggedAs: "x",
    }));

    const task = makeTask();
    const plan = makePlan([task]);

    const outcome = await validateAndRepair({ runShell, readFile, writeFile, callLLM }, plan);

    expect(task.status).toBe("completed");
    expect(task.repairAttempts).toBe(1);
    expect(outcome.repairSummary).toEqual([{ taskId: "T1", attempts: 1, resolved: true }]);
    expect(outcome.test.passed).toBe(true);
  });

  it("stops at max 3 attempts per file and reports the residual failure", async () => {
    // Never passes, no matter what's written — always reports the same failing path.
    const testScript = "node -e \"console.error('FAIL src/Widget.ts'); process.exit(1)\"";
    const outDir = await makeOutDir(testScript);
    const log = new RunLog(outDir);
    const readFile = createReadFile(outDir, log);
    const writeFile = createWriteFile(outDir, log);
    const runShell = createRunShell(outDir, log);
    const callLLM: CallLLMTool = vi.fn(async () => ({
      output: { text: "export const widget = 'still broken';", usage: { inputTokens: 1, outputTokens: 1 } },
      loggedAs: "x",
    }));

    const task = makeTask();
    const plan = makePlan([task]);

    const outcome = await validateAndRepair({ runShell, readFile, writeFile, callLLM }, plan);

    expect(task.status).toBe("failed");
    expect(task.repairAttempts).toBe(3); // bounded, not infinite
    expect(outcome.repairSummary).toEqual([{ taskId: "T1", attempts: 3, resolved: false }]);
    expect(outcome.test.passed).toBe(false);
    expect(outcome.test.failingFiles).toContain("src/Widget.ts");
  });

  it("marks a task completed without touching it when none of its files are failing", async () => {
    const outDir = await makeOutDir("node -e \"process.exit(0)\"");
    const log = new RunLog(outDir);
    const readFile = createReadFile(outDir, log);
    const writeFile = createWriteFile(outDir, log);
    const runShell = createRunShell(outDir, log);
    const callLLM: CallLLMTool = vi.fn();

    const task = makeTask();
    const plan = makePlan([task]);

    await validateAndRepair({ runShell, readFile, writeFile, callLLM }, plan);

    expect(task.status).toBe("completed");
    expect(task.repairAttempts).toBe(0);
    expect(callLLM).not.toHaveBeenCalled();
  });
});
