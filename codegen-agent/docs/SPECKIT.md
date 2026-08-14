# Spec-Kit Workflow

This repository is wired for GitHub's [spec-kit](https://github.com/github/spec-kit), integrated
as Claude Code skills under `.claude/skills/speckit-*`. Framework state lives in `.specify/`
(templates, memory, and bash helper scripts under `.specify/scripts/bash/`).

Work is driven through slash commands/skills, run roughly in this order:

1. `speckit-constitution` — establish/update project principles in `.specify/memory/constitution.md`.
2. `speckit-specify` — create/update a feature spec from a natural-language description. This
   creates a new numbered feature directory under `specs/` (e.g. `specs/001-short-name/`) and a
   matching git branch, via `.specify/scripts/bash/create-new-feature.sh`.
3. `speckit-clarify` — ask up to 5 targeted questions to resolve ambiguity in the spec, encoding
   answers back into it.
4. `speckit-plan` — generate the implementation plan and design artifacts for the feature.
5. `speckit-tasks` — generate a dependency-ordered `tasks.md` for the feature.
6. `speckit-analyze` — non-destructive cross-check of `spec.md` / `plan.md` / `tasks.md` for
   consistency.
7. `speckit-checklist` — generate a custom requirements/quality checklist for the feature.
8. `speckit-implement` — execute `tasks.md` to actually build the feature.
9. `speckit-converge` — diff the codebase against spec/plan/tasks and append any unbuilt work as
   new tasks.
10. `speckit-taskstoissues` — convert `tasks.md` entries into GitHub issues.

Each feature lives in its own `specs/NNN-short-name/` directory containing its spec, plan, and
tasks, with a corresponding branch `NNN-short-name`. Feature numbering is sequential (see
`.specify/init-options.json`).

`.specify/scripts/bash/common.sh` is the shared helper (repo-root discovery via the nearest
`.specify/` directory, branch/feature resolution, JSON output helpers) sourced by the other
scripts in that directory; prefer reading/extending it over duplicating its logic in a new
script.

## Installation / upstream docs

Spec-kit itself (the `specify` CLI and skill templates) is installed and updated independently
of this repo — see the [spec-kit repository](https://github.com/github/spec-kit) for install
instructions and full documentation.
