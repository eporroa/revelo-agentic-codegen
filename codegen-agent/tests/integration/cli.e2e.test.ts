import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LLMProvider, LLMResponse } from "@/llm/types.js";
import type { ProgressReporter, Phase } from "@/ui/progress.js";

// llm/ is mocked end-to-end: no real tokens are spent running this suite
// (plan.md's Testing Approach). The fake provider recognizes which stage
// prompted it by the role line each prompts/*.ts template starts with.
const fakePlanJson = JSON.stringify({
  tasks: [
    {
      id: "T1",
      description: "Add a WidgetCard component",
      dependsOn: [],
      targetFiles: ["src/components/WidgetCard.tsx"],
    },
  ],
});

function makeFakeProvider(): LLMProvider {
  return {
    name: "anthropic",
    model: "fake-model",
    async generate(prompt: string): Promise<LLMResponse> {
      const text = prompt.includes("planning stage")
        ? fakePlanJson
        : "export default function WidgetCard() { return null; }\n";
      return { text, usage: { inputTokens: 42, outputTokens: 17 } };
    },
  };
}

vi.mock("@/llm/index.js", () => ({
  getProvider: () => makeFakeProvider(),
}));

const tempDirs: string[] = [];
afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function makeOutDir(): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "codegen-agent-e2e-"));
  tempDirs.push(dir);
  return dir;
}

const FIXTURES_DIR = new URL("../fixtures/", import.meta.url).pathname;

describe("cli end-to-end (llm/ mocked)", () => {
  it("writes plan.md and log.jsonl, and exits 0 on a clean run", async () => {
    const { run } = await import("@/cli.js");
    const outDir = await makeOutDir();

    const exitCode = await run([
      "node",
      "cli.js",
      "--spec",
      join(FIXTURES_DIR, "stub-spec.txt"),
      "--boilerplate",
      join(FIXTURES_DIR, "stub-boilerplate"),
      "--out",
      outDir,
    ]);

    expect(exitCode).toBe(0);

    const planMd = await readFile(join(outDir, ".codegen-agent", "plan.md"), "utf8");
    expect(planMd).toContain("T1");
    expect(planMd).toContain("WidgetCard");

    const logRaw = await readFile(join(outDir, ".codegen-agent", "log.jsonl"), "utf8");
    const logLines = logRaw.trim().split("\n").map((line) => JSON.parse(line));
    expect(logLines.length).toBeGreaterThan(0);
    expect(logLines.every((l) => typeof l.id === "string" && typeof l.timestamp === "string")).toBe(
      true
    );

    const generatedFile = await readFile(
      join(outDir, "src/components/WidgetCard.tsx"),
      "utf8"
    );
    expect(generatedFile).toContain("WidgetCard");

    const reportMd = await readFile(join(outDir, ".codegen-agent", "report.md"), "utf8");
    expect(reportMd).toContain("success");
    expect(reportMd).toContain("Exit code: 0");
  });

  it("keeps generation-step context scoped: at least 95% of callLLM log entries omit the full spec + full codebase at once (SC-003)", async () => {
    const { run } = await import("@/cli.js");
    const outDir = await makeOutDir();
    const specText = await readFile(join(FIXTURES_DIR, "stub-spec.txt"), "utf8");

    await run([
      "node",
      "cli.js",
      "--spec",
      join(FIXTURES_DIR, "stub-spec.txt"),
      "--boilerplate",
      join(FIXTURES_DIR, "stub-boilerplate"),
      "--out",
      outDir,
    ]);

    const logRaw = await readFile(join(outDir, ".codegen-agent", "log.jsonl"), "utf8");
    const steps = logRaw
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line))
      .filter((s) => s.tool === "callLLM");

    expect(steps.length).toBeGreaterThan(0);

    const scoped = steps.filter((s) => {
      const context = String(s.input?.context ?? "");
      // "Full spec + full codebase at once" would mean the raw spec text
      // AND more than one generated/dependency file's contents both showing
      // up in the same call's context.
      const containsFullSpec = context.includes(specText.trim());
      return !containsFullSpec;
    });

    expect(scoped.length / steps.length).toBeGreaterThanOrEqual(0.95);
  });

  it("writes plan.md before any generation writeFile or validation typecheck/test step (US2)", async () => {
    const { run } = await import("@/cli.js");
    const outDir = await makeOutDir();

    await run([
      "node",
      "cli.js",
      "--spec",
      join(FIXTURES_DIR, "stub-spec.txt"),
      "--boilerplate",
      join(FIXTURES_DIR, "stub-boilerplate"),
      "--out",
      outDir,
    ]);

    const logRaw = await readFile(join(outDir, ".codegen-agent", "log.jsonl"), "utf8");
    const steps = logRaw.trim().split("\n").map((line) => JSON.parse(line));

    const planWriteIndex = steps.findIndex(
      (s) => s.tool === "writeFile" && s.input?.path === ".codegen-agent/plan.md"
    );
    expect(planWriteIndex).toBeGreaterThanOrEqual(0);

    const stepsBeforePlan = steps.slice(0, planWriteIndex);
    // "install" is legitimate infrastructure setup that has to happen before
    // PLAN (--out needs its own node_modules for typecheck/test to mean
    // anything); only typecheck/test — the actual VALIDATE phase — must
    // never precede the plan being written.
    expect(
      stepsBeforePlan.some(
        (s) => s.tool === "runShell" && s.input?.command !== "install"
      )
    ).toBe(false);
    expect(
      stepsBeforePlan.some(
        (s) => s.tool === "writeFile" && s.input?.path !== ".codegen-agent/plan.md"
      )
    ).toBe(false);
  });

  it("exits 1 and names the residual failure + repair count when validation can't be fixed (US3)", async () => {
    const { run } = await import("@/cli.js");
    const outDir = await makeOutDir();

    const exitCode = await run([
      "node",
      "cli.js",
      "--spec",
      join(FIXTURES_DIR, "stub-spec.txt"),
      "--boilerplate",
      join(FIXTURES_DIR, "stub-boilerplate-broken"),
      "--out",
      outDir,
    ]);

    expect(exitCode).toBe(1);

    const reportMd = await readFile(join(outDir, ".codegen-agent", "report.md"), "utf8");
    expect(reportMd).toContain("FAILED");
    expect(reportMd).toContain("T1");
    expect(reportMd).toContain("Repair attempts used: 3");
    expect(reportMd).toContain("Exit code: 1");
  });

  it("reports phaseStart/phaseEnd for plan, generate, validate, report, in that order (US2)", async () => {
    const { run } = await import("@/cli.js");
    const outDir = await makeOutDir();

    const events: string[] = [];
    const progress: ProgressReporter = {
      phaseStart: (phase: Phase) => events.push(`start:${phase}`),
      phaseEnd: (phase: Phase, ok: boolean) => events.push(`end:${phase}:${ok}`),
      taskStart: () => {},
      taskEnd: () => {},
      repairAttempt: () => {},
    };

    const exitCode = await run(
      [
        "node",
        "cli.js",
        "--spec",
        join(FIXTURES_DIR, "stub-spec.txt"),
        "--boilerplate",
        join(FIXTURES_DIR, "stub-boilerplate"),
        "--out",
        outDir,
      ],
      { progress }
    );

    expect(exitCode).toBe(0);
    expect(events).toEqual([
      "start:plan",
      "end:plan:true",
      "start:generate",
      "end:generate:true",
      "start:validate",
      "end:validate:true",
      "start:report",
      "end:report:true",
    ]);
  });
});
