/**
 * Interactive input collection/confirmation for --spec/--boilerplate/--out
 * (User Story 1). See specs/002-cli-dx-ux-polish/contracts/input-collection.md.
 */

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
