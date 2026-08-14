# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repository is currently empty except for scaffolding — there is no application source code,
package manifest, or build tooling yet. Do not assume a stack or invent build/lint/test commands
until they actually exist; check for a manifest file (`package.json`, etc.) first.

## What this project is

`codegen-agent` is an **agentic code-generation CLI tool**: it takes a natural-language product
spec and autonomously generates a React + TypeScript app, written into the sibling boilerplate
project at `../code-boilerplate` (React 19, Vite, Apollo Client, MUI, MSW, Vitest — that
project's own README describes the reference "Car Inventory Manager" app it should produce).

The explicit point of this project is to **not** be a single-shot "prompt and pray" wrapper
around one LLM call. Every design and implementation decision here is governed by
`.specify/memory/constitution.md`, which is the source of truth and supersedes default
engineering instincts. Its non-negotiable principles, summarized:

1. **Explicit task decomposition** — every run produces a visible, ordered, dependency-aware
   task list before any code generation starts.
2. **Discrete, inspectable tool calls** — file writes, shell commands, and LLM calls are each
   logged as separate actions with inputs/outputs, never buried in one giant completion.
3. **Bounded context per step** — no LLM call receives the entire spec plus entire generated
   codebase; context is scoped to what that step needs.
4. **Mandatory self-validation loop** — typecheck/tests (or a secondary LLM review) run after
   generation, with failures fed back into at most 3 bounded repair iterations.
5. **Reproducibility over cleverness** — a plain function-calling loop or lightweight state
   machine is preferred; a heavyweight agent framework must earn its complexity.
6. **No hardcoding to the sample spec** — the agent must also work against a modified spec
   (renamed fields, added filters, etc.), proving it isn't memorizing the reference app.
7. **Cost and token transparency** — every run logs approximate tokens used and estimated cost
   per LLM call.
8. **Small, narrated commits** — the agent's own development proceeds in focused commits that
   map to the task list, not one large commit.

Read the full constitution before doing non-trivial work in this repo; treat any deviation from
it as something to call out explicitly, not something to do silently.

## Tech constraints

- Node.js + TypeScript.
- LLM provider is pluggable behind a common interface — Anthropic Claude is primary, but
  swapping to Gemini must not require rewriting the agent loop. No OpenAI support (constitution
  1.1.0).
- No database, backend, auth, or CI. Output is a static generated React + TS app only.

## Spec-Driven Development (spec-kit)

This repo also uses GitHub's [spec-kit](https://github.com/github/spec-kit) for spec-driven
feature work, integrated as the `.claude/skills/speckit-*` skills plus the `.specify/` framework
directory (templates, memory, helper scripts). In short: features are specified, clarified,
planned, broken into tasks, and implemented through a sequence of `speckit-*` skills, each
feature living in its own numbered `specs/NNN-short-name/` directory with a matching branch.
See `docs/SPECKIT.md` for the full workflow and `.specify/memory/constitution.md` for this
project's ratified principles. Spec-kit itself is installed/updated independently — see its
repo linked above for installation instructions.
