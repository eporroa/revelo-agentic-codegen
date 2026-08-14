/**
 * Interactive input collection/confirmation for --spec/--boilerplate/--out
 * (User Story 1). See specs/002-cli-dx-ux-polish/contracts/input-collection.md.
 */
import { text, confirm, isCancel, cancel, intro, outro } from "@clack/prompts";

export interface FlagInputs {
  spec?: string;
  boilerplate?: string;
  out?: string;
}

export interface CollectedInputs {
  spec: string;
  boilerplate: string;
  out: string;
}

const REQUIRED_FIELDS = ["spec", "boilerplate", "out"] as const;
type RequiredField = (typeof REQUIRED_FIELDS)[number];

/** Pure — no I/O, directly unit-testable. */
export function missingFields(flags: FlagInputs): RequiredField[] {
  return REQUIRED_FIELDS.filter((field) => !flags[field]);
}

/**
 * Pure — no I/O, directly unit-testable.
 *
 * false only when there's no interactive terminal AND nothing is missing
 * (FR-006: never hang a scripted/CI invocation that already has everything
 * it needs). True in every other case — including "TTY, but every flag was
 * already supplied", since FR-003/FR-004 require a confirmation step even
 * then.
 */
export function shouldPromptInteractively(flags: FlagInputs, isTTY: boolean): boolean {
  if (!isTTY) {
    return missingFields(flags).length > 0;
  }
  return true;
}

const FIELD_PROMPTS: Record<
  RequiredField,
  { message: string; placeholder: string }
> = {
  spec: {
    message: "Path to the spec file (--spec)",
    placeholder: "./sample-spec.txt",
  },
  boilerplate: {
    message: "Path to the boilerplate project (--boilerplate)",
    placeholder: "../code-boilerplate",
  },
  out: {
    message: "Destination for the generated app (--out)",
    placeholder: "./generated-app",
  },
};

/**
 * The only function here that actually calls @clack/prompts. Pre-fills
 * every supplied flag as an editable default (Clarifications, 2026-08-14);
 * prompts blank for anything missing; ends with one confirmation. Returns
 * "cancelled" on Ctrl+C/Esc at any step, or a decline at the final confirm.
 *
 * When non-interactive with missing fields, fails fast instead of
 * attempting to prompt into a stream that can never answer (FR-006 and the
 * "must not hang" edge case) — collectInputs is never called that way from
 * cli.ts (see shouldPromptInteractively), but guards it directly too so
 * this function is safe to call on its own.
 */
export async function collectInputs(
  flags: FlagInputs,
  isTTY: boolean
): Promise<CollectedInputs | "cancelled"> {
  const missing = missingFields(flags);

  if (!isTTY) {
    if (missing.length > 0) {
      throw new Error(
        `Missing required flag(s): ${missing
          .map((f) => `--${f}`)
          .join(", ")}. No interactive terminal is attached to prompt for ` +
          "them (e.g. this looks like a scripted or CI invocation)."
      );
    }
    return { spec: flags.spec!, boilerplate: flags.boilerplate!, out: flags.out! };
  }

  intro("codegen-agent");

  const collected: Partial<CollectedInputs> = {};
  for (const field of REQUIRED_FIELDS) {
    const { message, placeholder } = FIELD_PROMPTS[field];
    const answer = await text({
      message,
      placeholder,
      initialValue: flags[field],
    });
    if (isCancel(answer)) {
      cancel("Cancelled — nothing was written.");
      return "cancelled";
    }
    collected[field] = answer;
  }

  const { spec, boilerplate, out } = collected as CollectedInputs;
  const proceed = await confirm({
    message: `Generate using:\n  --spec ${spec}\n  --boilerplate ${boilerplate}\n  --out ${out}\n\nProceed?`,
  });
  if (isCancel(proceed) || !proceed) {
    cancel("Cancelled — nothing was written.");
    return "cancelled";
  }

  outro("Starting…");
  return { spec, boilerplate, out };
}
