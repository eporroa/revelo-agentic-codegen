# Phase 0 Research: codegen-agent CLI DX/UX Polish

## Import path alias mechanism

- **Decision**: `tsconfig.json` gets `"baseUrl": "."` and `"paths": { "@/*": ["src/*"] }`, exactly
  as requested — but the *runtime resolution* mechanism is `tsc-alias` (a build-time rewrite),
  not the `tsconfig-paths` package, for the compiled-output path. Combined with `tsx` (already
  the `npm run dev` runner), which resolves `tsconfig.json` `paths` natively via its esbuild
  transform, no extra dependency is needed for the dev path at all.
- **Rationale**: This project is native ESM (`"type": "module"`, `module`/`moduleResolution`:
  `NodeNext`). `tsconfig-paths`'s runtime resolver (`tsconfig-paths/register`) patches
  `Module._resolveFilename`, which is a **CommonJS-only** hook — it does not affect ESM `import`
  resolution at all. Its ESM support is not something Node's own module resolution consumes
  natively, and wiring it in would mean requiring a `--import`/loader flag be present at
  *every* invocation of the compiled `bin` — including a future global install invoked as plain
  `codegen-agent`, where no such flag is set. `tsc --noEmit`/`tsc -p` also never rewrites
  `@/...` specifiers in emitted `.js` — it's a type-checker hint only — so without something
  rewriting them, `node dist/cli.js` would fail to resolve every aliased import at runtime.
  `tsc-alias` runs immediately after `tsc` and rewrites emitted imports to plain relative paths,
  so the compiled output needs zero runtime alias-resolution machinery at all — it's ordinary
  Node ESM by the time it ships. This satisfies FR-012 ("resolves correctly under both the dev
  runner and the compiled output run with plain node") more reliably than the literally-named
  package would for this specific module setup.
- **Alternatives considered**: (1) `tsconfig-paths` as literally requested — rejected per above,
  it doesn't function for ESM without a loader flag that can't be guaranteed present for a
  published `bin`. (2) Node's native `imports` field (package.json subpath imports, e.g.
  `"#src/*"`) — genuinely zero-dependency and Node-native in both dev and build, but mandates a
  `#`-prefixed specifier, not the `@/` syntax explicitly requested; rejected on that basis alone,
  not a technical one. (3) A bundler (esbuild/tsup) for the build step — would also solve
  alias-rewriting, but replaces the existing plain-`tsc` build with a bundling step, which is a
  bigger change than this feature's scope calls for.
- **Note for the user**: flagging this substitution explicitly rather than silently doing
  something other than what was named — if the `tsconfig-paths` package specifically (not just
  the `@/` alias behavior) matters for another reason, say so and this can be revisited.

## Interactive prompts + progress UI library

- **Decision**: `@clack/prompts`, used for both User Story 1 (input collection/confirmation)
  and User Story 2 (live phase/task progress) — one library covers both needs.
- **Rationale**: Purpose-built, small (no framework weight), and already covers every primitive
  needed: `text()` with `initialValue` for pre-filled/editable flag confirmation (FR-003),
  `confirm()` for the single explicit confirmation (FR-004), `isCancel()`/`cancel()` for clean
  cancellation (FR-005), and `spinner()`/`log.*` for phase and per-task status (FR-007–FR-009).
  Matches constitution principle V — it earns its inclusion by replacing what would otherwise be
  hand-rolled `readline` prompting and manual ANSI spinner code.
- **Alternatives considered**: `inquirer` — heavier, older API surface, no built-in spinner
  primitive as clean as clack's; `ora` + a separate prompt library — two dependencies to do what
  one does; hand-rolled `readline`/`process.stdout.write` — rejected per constitution principle V
  (the actual surface area needed is exactly the two things a small, well-audited library was
  built for).

## Non-interactive (no TTY) detection

- **Decision**: `process.stdin.isTTY` (Node built-in, no dependency) gates whether the
  interactive flow runs at all. When falsy and all three required flags are supplied, the CLI
  skips straight to confirmation-free execution (FR-006). When falsy and a required flag is
  *missing*, the CLI fails fast with a clear error rather than hanging — that combination can
  never succeed without input it has no way to collect.
- **Rationale**: Standard, dependency-free convention across CLI tooling (the same signal
  `@clack/prompts` itself and most Node prompt libraries use internally) — no need to invent a
  new flag for this.
- **Alternatives considered**: An explicit `--yes`/`--non-interactive` flag — rejected per
  spec.md's own Assumptions; TTY auto-detection already covers the real-world case (CI, pipes,
  scripted invocations) without adding CLI surface area.

## Testing the interactive/progress layer without a real terminal

- **Decision**: Split each behavior into a pure, directly-testable function plus a thin
  clack-calling shell. `collectInputs.ts` exposes `resolveMissingFields(flags): string[]` and
  `shouldPromptInteractively(flags, isTTY): boolean` as plain functions unit-tested directly;
  the actual `@clack/prompts` calls live in a thin wrapper not exercised by unit tests.
  `progress.ts` defines the `ProgressReporter` interface (contracts/progress-reporter.md); tests
  use a spy double, never the real clack-backed implementation.
- **Rationale**: Keeps `planner/`, `generator/`, `validator/`'s own existing unit tests exactly
  as they are today (no TTY, no stdin) while still giving the new UI logic real test coverage —
  and keeps the existing mocked-`llm/` integration suite passing unchanged, since it runs under
  Vitest where `process.stdin.isTTY` is already falsy, naturally exercising the non-interactive
  path (FR-006) without any test-only mocking of `@clack/prompts` itself.
- **Alternatives considered**: Mocking `@clack/prompts` wholesale in tests (e.g. `vi.mock`) —
  possible, but adds brittle coupling to clack's exact API surface for no benefit once the
  underlying decision logic is already covered directly.

## Documentation accuracy (FR-013)

- **Decision**: Correct `CLAUDE.md`'s Tech Constraints line ("swapping to OpenAI/Gemini") to
  match the constitution's already-amended (v1.1.0) wording ("Gemini" only). No other doc
  currently misstates provider support — `README.md` and the constitution already correctly
  scope this to Claude + Gemini as of the 001 feature's work.
- **Rationale**: `CLAUDE.md` was written before the constitution amendment and never revisited;
  this is a real, verifiable drift, not a hypothetical one — confirmed by a repo-wide search
  during `/speckit-specify` for this feature.
