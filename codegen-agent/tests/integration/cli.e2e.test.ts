import { describe, it, expect, vi, afterEach } from "vitest";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LLMProvider, LLMResponse } from "../../src/llm/types.js";

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

vi.mock("../../src/llm/index.js", () => ({
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
    const { run } = await import("../../src/cli.js");
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

    // NOTE: report.md is produced by reporter/index.ts (T034/T035, User
    // Story 3 — not yet implemented at the point US1's T022 lands). The
    // residual-failure report.md scenario is covered by T036 once it does.
  });

  it("keeps generation-step context scoped: at least 95% of callLLM log entries omit the full spec + full codebase at once (SC-003)", async () => {
    const { run } = await import("../../src/cli.js");
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
});
