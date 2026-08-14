import { mkdir, appendFile } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { GenerationStep, GenerationStepId } from "@/planner/types.js";

/** `<out>/.codegen-agent/` — where plan.md, log.jsonl, and report.md all live. */
export function runArtifactsDir(outDir: string): string {
  return join(outDir, ".codegen-agent");
}

export function logPath(outDir: string): string {
  return join(runArtifactsDir(outDir), "log.jsonl");
}

/**
 * Appends one Generation Step per call to <out>/.codegen-agent/log.jsonl
 * (FR-007, Clarifications: "a single structured log file per run"). JSON
 * Lines so a crash mid-run doesn't corrupt already-written entries.
 */
export class RunLog {
  private initialized = false;

  constructor(private readonly outDir: string) {}

  private async ensureDir(): Promise<void> {
    if (this.initialized) return;
    await mkdir(runArtifactsDir(this.outDir), { recursive: true });
    this.initialized = true;
  }

  async append(
    step: Omit<GenerationStep, "id" | "timestamp">
  ): Promise<GenerationStepId> {
    await this.ensureDir();
    const record: GenerationStep = {
      ...step,
      id: randomUUID(),
      timestamp: new Date().toISOString(),
    };
    await appendFile(logPath(this.outDir), JSON.stringify(record) + "\n", "utf8");
    return record.id;
  }
}
