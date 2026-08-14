# Contract: Interactive Input Collection

The seam covering User Story 1 (FR-001–FR-006).

```ts
// src/ui/collectInputs.ts
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

/** Pure — no I/O, directly unit-testable. */
export function missingFields(flags: FlagInputs): Array<keyof FlagInputs>;

/** Pure — no I/O, directly unit-testable. */
export function shouldPromptInteractively(flags: FlagInputs, isTTY: boolean): boolean;

/**
 * The only function that actually calls @clack/prompts. Returns the
 * collected/confirmed values, or the string "cancelled" if the developer
 * backs out at any point (Ctrl+C, Esc, or an explicit decline at the final
 * confirm).
 */
export async function collectInputs(
  flags: FlagInputs,
  isTTY: boolean
): Promise<CollectedInputs | "cancelled">;
```

## Behavior

1. `missingFields(flags)` returns which of `spec`/`boilerplate`/`out` weren't supplied via flag
   — used both to decide which prompts to show and, combined with `isTTY`, to decide whether a
   non-interactive run can proceed at all.
2. `shouldPromptInteractively`:
   - Returns `false` when `isTTY` is `false` **and** `missingFields(flags).length === 0` — all
     required inputs are already present, so there's nothing to prompt for (FR-006).
   - Otherwise returns `true` when `isTTY` is `true` (interactive confirmation always runs when
     a terminal is attached, even if every flag was supplied — FR-003/FR-004).
   - When `isTTY` is `false` **and** fields are missing, `collectInputs` MUST fail fast with a
     clear error rather than attempt to prompt into a non-interactive stream (edge case from
     spec.md: "must not hang waiting for input it can never receive").
3. `collectInputs`, when it does run interactively:
   - For each field already in `flags`, shows a `text()` prompt pre-filled with that value as
     `initialValue` — editable, not accept-only (Clarifications: 2026-08-14).
   - For each field missing from `flags`, shows a blank `text()` prompt.
   - After all three are collected, shows one `confirm()` summarizing the resolved values.
   - If the developer cancels at any point (`isCancel()` true, or declines the final confirm),
     returns `"cancelled"` — `cli.ts` MUST then exit without writing to `--out` or making any
     LLM call (FR-005), identical in spirit to spec 001's precondition-failure contract.
4. `cli.ts` runs `collectInputs` **before** `validatePreconditions`/`copyBoilerplate` — the
   confirmed values then flow into spec 001's existing precondition checks unchanged; this
   feature only changes how those three values are obtained, not what's validated once they are.
