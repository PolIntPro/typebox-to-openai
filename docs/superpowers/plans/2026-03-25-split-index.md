# Split `src/index.ts` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split `src/index.ts` into `types.ts`, `guards.ts`, `utils.ts`, and a slimmed-down `index.ts` for readability and future extensibility.

**Architecture:** Extract types, type guards, and utility functions into dedicated modules. `index.ts` keeps the core recursive transform (`moveDefsToRoot`) and public entry point (`ConvertToOpenAISchema`), re-exporting public types. Dependency graph is a clean DAG: `types` <- `guards` <- `utils` <- `index`.

**Tech Stack:** TypeScript, ESM with `.js` extensions, vitest

**Spec:** `docs/superpowers/specs/2026-03-25-split-index-design.md`

---

## File Structure

```
src/
  types.ts    — CREATE — type aliases and interfaces (internal + public)
  guards.ts   — CREATE — 8 type guard functions
  utils.ts    — CREATE — 6 pure helper functions
  index.ts    — MODIFY — keep moveDefsToRoot + ConvertToOpenAISchema, add imports + re-exports
```

No test files are modified. Both `src/__tests__/index.test.ts` and `src/__tests__/openai.integration.test.ts` import from `../index` and the public API surface is preserved.

---

### Task 1: Create `src/types.ts`

**Files:**

- Create: `src/types.ts`

- [ ] **Step 1: Create `src/types.ts` with all type definitions**

```typescript
import type { TSchema } from "typebox/type"

export type TObjectWithDefs = TSchema & {
    $defs: Record<string, TSchema>
}

export type TAnyOf = {
    anyOf: TSchema[]
}

/**
 * The wrapper object that OpenAI's structured output API expects.
 * Pass this to the `text.format` or `response_format` parameter
 * when calling the OpenAI API.
 */
export interface TPromptSchema {
    name: string
    strict: true
    schema: TSchema
}

/**
 * Custom logger interface for controlling diagnostic output.
 * All methods are optional — any omitted method is silently ignored.
 */
export type TLogger = {
    debug?: (...args: unknown[]) => void
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
}

/**
 * Options for {@link ConvertToOpenAISchema}.
 *
 * @property logger - Custom logger object. Takes precedence over `debug`.
 * @property debug - When `true`, logs diagnostics to the console.
 */
export type TConvertOptions = {
    logger?: TLogger
    debug?: boolean
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm build`
Expected: PASS (new file compiles, existing code still works since `index.ts` hasn't changed yet)

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "Extract type definitions into src/types.ts"
```

---

### Task 2: Create `src/guards.ts`

**Files:**

- Create: `src/guards.ts`

- [ ] **Step 1: Create `src/guards.ts` with all 8 type guards**

```typescript
import type { TArray, TObject, TRef, TSchema } from "typebox/type"
import type { TAnyOf, TObjectWithDefs } from "./types.js"

export function IsAnyOf(schema: TSchema): schema is TAnyOf {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "anyOf" in schema &&
        Array.isArray((schema as TAnyOf).anyOf)
    )
}

export function IsObject(schema: TSchema): schema is TObject {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "type" in schema &&
        (schema["type"] === "object" ||
            (Array.isArray(schema["type"]) &&
                schema["type"].includes("object")))
    )
}

export function IsDefsObject(schema: TSchema): schema is TObjectWithDefs {
    return typeof schema === "object" && schema !== null && "$defs" in schema
}

export function IsArray(schema: TSchema): schema is TArray<TSchema> {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "type" in schema &&
        (schema["type"] === "array" ||
            (Array.isArray(schema["type"]) && schema["type"].includes("array")))
    )
}

export function IsRef(schema: TSchema): schema is TRef {
    return typeof schema === "object" && schema !== null && "$ref" in schema
}

export function IsAllOf(
    schema: TSchema
): schema is TSchema & { allOf: TSchema[] } {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "allOf" in schema &&
        Array.isArray((schema as Record<string, unknown>).allOf)
    )
}

export function IsOneOf(
    schema: TSchema
): schema is TSchema & { oneOf: TSchema[] } {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "oneOf" in schema &&
        Array.isArray((schema as Record<string, unknown>).oneOf)
    )
}

export function IsNot(schema: TSchema): schema is TSchema & { not: TSchema } {
    return typeof schema === "object" && schema !== null && "not" in schema
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/guards.ts
git commit -m "Extract type guards into src/guards.ts"
```

---

### Task 3: Create `src/utils.ts`

**Files:**

- Create: `src/utils.ts`

- [ ] **Step 1: Create `src/utils.ts` with all 6 utility functions**

```typescript
import type { TSchema } from "typebox/type"
import type { TConvertOptions, TLogger, TObjectWithDefs } from "./types.js"
import { IsDefsObject } from "./guards.js"

export function createLogger(options?: TConvertOptions): Required<TLogger> {
    if (options?.logger) {
        return {
            debug: options.logger.debug ?? (() => undefined),
            info: options.logger.info ?? (() => undefined),
            warn: options.logger.warn ?? (() => undefined),
            error: options.logger.error ?? (() => undefined),
        }
    }

    if (options?.debug) {
        return {
            debug: console.debug.bind(console),
            info: console.info.bind(console),
            warn: console.warn.bind(console),
            error: console.error.bind(console),
        }
    }

    return {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
    }
}

export function formatPath(path: string[]): string {
    return path.length === 0 ? "#" : `#/${path.join("/")}`
}

export function shouldRewriteRef(ref: string): boolean {
    if (ref.startsWith("#/")) {
        return false
    }
    if (
        ref.startsWith("http://") ||
        ref.startsWith("https://") ||
        ref.startsWith("file://") ||
        ref.startsWith("/")
    ) {
        return false
    }
    if (ref.includes("#") || ref.includes("/")) {
        return false
    }
    return /^[A-Za-z0-9_.-]+$/.test(ref)
}

export function mergeTypeWithNull(typeValue: unknown): unknown[] {
    if (Array.isArray(typeValue)) {
        return typeValue.includes("null") ? typeValue : [...typeValue, "null"]
    }
    if (typeof typeValue === "string") {
        return [typeValue, "null"]
    }
    return ["null"]
}

export function withClearedId(
    original: TSchema,
    next: Record<string, unknown>
): Record<string, unknown> {
    return typeof original === "object" &&
        original !== null &&
        "$id" in original
        ? { ...next, $id: undefined }
        : next
}

export function removeDefs(schema: TSchema): {
    schema: TSchema
    defs?: Record<string, TSchema>
} {
    if (!IsDefsObject(schema)) {
        return { schema }
    }

    const defs = schema.$defs
    const { $defs: _removed, ...schemaWithoutDefs } = schema as TObjectWithDefs
    return { schema: schemaWithoutDefs as TSchema, defs }
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/utils.ts
git commit -m "Extract utility functions into src/utils.ts"
```

---

### Task 4: Rewrite `src/index.ts` to import from new modules

**Files:**

- Modify: `src/index.ts` (full rewrite)

- [ ] **Step 1: Replace `src/index.ts` contents**

Replace the entire file with imports from the new modules, the `moveDefsToRoot` function, the `ConvertToOpenAISchema` function, and re-exports. The key changes:

1. Remove all type definitions, guards, and utility functions (now in their own modules)
2. Add imports from `./types.js`, `./guards.js`, `./utils.js`
3. Keep `moveDefsToRoot` and `ConvertToOpenAISchema` unchanged
4. Add `export type { TPromptSchema, TLogger, TConvertOptions } from "./types.js"` (using `export type` for `verbatimModuleSyntax` compliance)
5. Do NOT re-export `TObjectWithDefs` or `TAnyOf` (internal types)

The new `index.ts` should look like:

```typescript
import type { TSchema } from "typebox/type"
import type {
    TConvertOptions,
    TLogger,
    TObjectWithDefs,
    TPromptSchema,
} from "./types.js"
import {
    IsAllOf,
    IsAnyOf,
    IsArray,
    IsNot,
    IsObject,
    IsOneOf,
    IsRef,
} from "./guards.js"
import {
    createLogger,
    formatPath,
    mergeTypeWithNull,
    removeDefs,
    shouldRewriteRef,
    withClearedId,
} from "./utils.js"

export type { TPromptSchema, TLogger, TConvertOptions } from "./types.js"

// Copy moveDefsToRoot verbatim from current src/index.ts lines 187-391.
// Copy ConvertToOpenAISchema (with its JSDoc) verbatim from current src/index.ts lines 393-449.
// These functions are unchanged — only the surrounding imports/exports change.
```

- [ ] **Step 2: Verify build passes**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 3: Run all tests**

Run: `pnpm test`
Expected: All tests pass, no behavioral changes

- [ ] **Step 4: Run lint**

Run: `pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/index.ts
git commit -m "Rewrite index.ts to import from types, guards, and utils modules"
```

---

### Task 5: Final verification

- [ ] **Step 1: Clean build from scratch**

Run: `rm -rf dist && pnpm build`
Expected: PASS, `dist/` contains `index.js`, `index.d.ts`, `types.js`, `types.d.ts`, `guards.js`, `guards.d.ts`, `utils.js`, `utils.d.ts`

- [ ] **Step 2: Verify public API in generated declarations**

Run: `grep "export" dist/index.d.ts`
Expected: Only `TPromptSchema`, `TLogger`, `TConvertOptions`, and `ConvertToOpenAISchema` appear. No `TObjectWithDefs` or `TAnyOf`.

- [ ] **Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

- [ ] **Step 4: Run lint and prettier**

Run: `pnpm lint && pnpm prettify`
Expected: PASS
