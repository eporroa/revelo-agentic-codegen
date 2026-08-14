import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPlan } from "../../src/planner/index.js";
import { PlanningFailedError } from "../../src/planner/types.js";
import { RunLog } from "../../src/tools/runLog.js";
import { createWriteFile } from "../../src/tools/writeFile.js";
import type { CallLLMTool } from "../../src/tools/callLLM.js";

const tempDirs: string[] = [];

async function makeOutDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codegen-agent-planner-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

function fakeCallLLM(text: string): CallLLMTool {
  return vi.fn(async () => ({
    output: { text, usage: { inputTokens: 10, outputTokens: 10 } },
    loggedAs: "step-1",
  }));
}

describe("planner", () => {
  it("produces an ordered, dependency-respecting task graph from a stub spec", async () => {
    const outDir = await makeOutDir();
    const writeFile = createWriteFile(outDir, new RunLog(outDir));
    // Deliberately out of dependency order in the raw LLM response, to prove
    // the planner reorders rather than trusting list position.
    const responseJson = JSON.stringify({
      tasks: [
        {
          id: "T2",
          description: "Build WidgetList using useWidgets",
          dependsOn: ["T1"],
          targetFiles: ["src/components/WidgetList.tsx"],
        },
        {
          id: "T1",
          description: "Define useWidgets hook",
          dependsOn: [],
          targetFiles: ["src/hooks/useWidgets.ts"],
        },
      ],
    });

    const plan = await createPlan({
      callLLM: fakeCallLLM(responseJson),
      writeFile,
      specText: "irrelevant — the LLM call is mocked",
      specPath: "spec.txt",
    });

    expect(plan.tasks.map((t) => t.id)).toEqual(["T1", "T2"]);
    expect(plan.tasks.every((t) => t.status === "pending")).toBe(true);
    expect(plan.tasks.every((t) => t.repairAttempts === 0 && t.apiRetries === 0)).toBe(true);
  });

  it("rejects a plan with a dangling dependency and re-prompts", async () => {
    const outDir = await makeOutDir();
    const writeFile = createWriteFile(outDir, new RunLog(outDir));
    const badResponse = JSON.stringify({
      tasks: [
        {
          id: "T1",
          description: "Depends on a task that does not exist",
          dependsOn: ["T99"],
          targetFiles: ["src/x.ts"],
        },
      ],
    });
    const goodResponse = JSON.stringify({
      tasks: [{ id: "T1", description: "Fixed", dependsOn: [], targetFiles: ["src/x.ts"] }],
    });

    const callLLM: CallLLMTool = vi
      .fn()
      .mockResolvedValueOnce({
        output: { text: badResponse, usage: { inputTokens: 1, outputTokens: 1 } },
        loggedAs: "a",
      })
      .mockResolvedValueOnce({
        output: { text: goodResponse, usage: { inputTokens: 1, outputTokens: 1 } },
        loggedAs: "b",
      });

    const plan = await createPlan({
      callLLM,
      writeFile,
      specText: "spec",
      specPath: "spec.txt",
    });

    expect(plan.tasks.map((t) => t.id)).toEqual(["T1"]);
    expect(callLLM).toHaveBeenCalledTimes(2);
  });

  it("throws PlanningFailedError after exhausting retries on persistently invalid output", async () => {
    const outDir = await makeOutDir();
    const writeFile = createWriteFile(outDir, new RunLog(outDir));
    const callLLM = fakeCallLLM("this is not JSON at all");

    await expect(
      createPlan({ callLLM, writeFile, specText: "spec", specPath: "spec.txt" })
    ).rejects.toThrow(PlanningFailedError);
    expect(callLLM).toHaveBeenCalledTimes(3);
  });
});
