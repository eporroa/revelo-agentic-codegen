# Contract: CLI Invocation

The external interface `codegen-agent` exposes to a developer (FR-001–FR-003, FR-015).

## Invocation

```bash
codegen-agent --spec <path> --boilerplate <path> --out <path> [--force]
```

| Flag | Required | Description |
|---|---|---|
| `--spec <path>` | yes | Path to the natural-language spec text file |
| `--boilerplate <path>` | yes | Path to the pre-built boilerplate project to copy from |
| `--out <path>` | yes | Destination for the generated app (copy of boilerplate + generated code) |
| `--force` | no | Allows writing into a non-empty `--out` (default: refuse, per FR-003) |

Missing a required flag → the CLI exits non-zero with `commander`'s standard usage/help error
before doing anything else (no partial run, no artifacts written).

## Preconditions checked before PLAN starts

1. `--spec` exists and is readable.
2. `--boilerplate` exists and contains a `package.json` with `typecheck` and `test` scripts
   (Assumptions: the CLI relies on the boilerplate defining these, per FR-009).
3. `--out` either does not exist, or is empty, or `--force` was passed.

Any failed precondition → exit code `1`, a one-line human-readable error on stderr, nothing
written to `--out`.

## Postconditions on success

- `--out` contains a full copy of `--boilerplate` plus the generated/modified files.
- `--out/.codegen-agent/plan.md`, `log.jsonl`, and `report.md` all exist.
- Process exit code `0` (FR-015) — only when validation has zero unresolved failures.

## Postconditions on partial success (residual validation failures)

- Same artifacts as above, but `report.md` names every unresolved failure and its repair-attempt
  count (FR-011, FR-012).
- Process exit code `1` (FR-015) — the CLI never reports a run with residual failures as a clean
  success via exit code, even though `--out` still contains everything it managed to generate.

## Postconditions on internal crash (unexpected error, not a validation failure)

- Whatever was written up to that point remains on disk (no rollback — partial output plus the
  Run Log up to the crash point is more useful for debugging than deleting it).
- Exit code `1` and the raw error printed to stderr.
