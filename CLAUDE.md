# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Generic Instructions

- Git commit messages should not include any co-authoring content
- Tests import from `"../"` (resolves to `dist/`), so run `pnpm build` before running tests if source has changed
- Integration tests hit the real OpenAI API and are skipped when `OPENAI_API_KEY` is not set. Also configurable: `OPENAI_BASE_URL`, `OPENAI_MODEL`
- When I report a bug, don't start by trying to fix it. Instead, start by writing a test that reproduces the bug. Then, use subagents to attempt fixes and prove them with a passing test.

## Commands

- `pnpm build` — compile TypeScript (outputs to `dist/`)
- `pnpm lint` — ESLint with typescript-eslint
- `pnpm prettify` — Prettier
- `pnpm test` — run all tests (vitest)
- `pnpx vitest run tests/index.test.ts` — run a single test file
- `pnpx vitest run -t "test name"` — run a single test case

## Coding Conventions

- `kebab-case` for file names
- `TPascalCase` for type aliases and interfaces (e.g. `TPromptSchema`, `TObjectWithDefs`)
- `PascalCase` for TypeBox schema objects and class-like constructors (e.g. `SimpleSchema`, `ConvertToOpenAISchema`)
- `SCREAMING_SNAKE_CASE` only for hard-coded constants (e.g. `OPENAI_TIMEOUT_MS`), not for every `const`
- `camelCase` for variables, functions, methods, properties
- Prefix unused variables with `_` to satisfy the linter

## Documentation Sync

- `README.md` — update when: public API surface changes, exported function signatures change, install instructions change

## Project Terminology

- **prompt schema** — the `{ name, strict: true, schema }` wrapper object that OpenAI's structured output API expects
- **$defs lifting** — moving nested `$defs` blocks to the root-level `$defs` of the schema
- **bare ref** — a `$ref` value like `"Child"` (no path prefix) that TypeBox emits, which must be rewritten to `"#/$defs/Child"` for OpenAI compatibility
