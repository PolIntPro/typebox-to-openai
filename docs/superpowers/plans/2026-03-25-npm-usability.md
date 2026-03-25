# NPM Usability Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `typebox-to-openai` more usable as a public npm package by adding JSDoc, expanding test coverage, enforcing brain-style naming, and adding fail-fast errors for unsupported schema types.

**Architecture:** Single source file (`src/index.ts`) with colocated tests in `src/__tests__/`. All validation logic lives in the existing `moveDefsToRoot` recursive traversal. New checks are inserted into its control flow. No new files are created in `src/`.

**Tech Stack:** TypeScript, TypeBox, vitest, ESLint, Prettier

**Spec:** `docs/superpowers/specs/2026-03-25-npm-usability-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/index.ts` | Modify | Type renames, exports, JSDoc, unsupported type errors, `allOf` flattening, `$defs` collision detection |
| `src/__tests__/index.test.ts` | Create (move from `tests/index.test.ts`) | All unit tests |
| `src/__tests__/openai.integration.test.ts` | Create (move from `tests/openai.integration.test.ts`) | Integration tests |
| `tests/` | Delete | Replaced by `src/__tests__/` |
| `tsconfig.json` | Modify | Exclude `src/__tests__` from compilation |
| `package.json` | Modify | Version bump, keywords |
| `CLAUDE.md` | Modify | Updated paths, OpenAI reference |
| `README.md` | Modify | Supported/unsupported types, renamed types |

---

### Task 1: Move tests to `src/__tests__/` and update config

**Files:**
- Create: `src/__tests__/index.test.ts` (moved from `tests/index.test.ts`)
- Create: `src/__tests__/openai.integration.test.ts` (moved from `tests/openai.integration.test.ts`)
- Delete: `tests/index.test.ts`, `tests/openai.integration.test.ts`, `tests/` directory
- Modify: `tsconfig.json`

- [ ] **Step 1: Create `src/__tests__/` directory and move test files**

```bash
mkdir -p src/__tests__
git mv tests/index.test.ts src/__tests__/index.test.ts
git mv tests/openai.integration.test.ts src/__tests__/openai.integration.test.ts
```

- [ ] **Step 2: Update import in `src/__tests__/index.test.ts`**

Change line 3:
```typescript
// Before:
import { ConvertToOpenAISchema } from "../"
// After:
import { ConvertToOpenAISchema } from "../index"
```

- [ ] **Step 3: Update import in `src/__tests__/openai.integration.test.ts`**

Change line 4:
```typescript
// Before:
import { ConvertToOpenAISchema } from "../"
// After:
import { ConvertToOpenAISchema } from "../index"
```

- [ ] **Step 4: Update `tsconfig.json` exclude array**

Change line 23:
```json
// Before:
"exclude": ["node_modules", "tests", "scripts"]
// After:
"exclude": ["node_modules", "src/__tests__", "scripts"]
```

- [ ] **Step 5: Run tests to verify nothing broke**

```bash
pnpm test
```

Expected: all 12 unit tests pass (vitest resolves TypeScript imports directly, no build needed), integration tests skip (no API key).

- [ ] **Step 6: Delete the empty `tests/` directory if it still exists**

```bash
rmdir tests 2>/dev/null || true
```

- [ ] **Step 7: Commit**

```bash
git add src/__tests__/ tsconfig.json && git commit -m "Move tests to src/__tests__/ and update tsconfig"
```

---

### Task 2: Type renames and exports (brain-style compliance)

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Write failing test — import renamed types**

Add to the top of `src/__tests__/index.test.ts`, update the import:

```typescript
// Before:
import { ConvertToOpenAISchema } from "../index"
// After:
import type { TPromptSchema, TLogger, TConvertOptions } from "../index"
import { ConvertToOpenAISchema } from "../index"
```

Add a new test at the end of the `describe` block:

```typescript
test("Exported types are importable", () => {
    const options: TConvertOptions = {
        debug: true,
    }
    const logger: TLogger = {
        debug: () => undefined,
    }
    const optionsWithLogger: TConvertOptions = { logger }
    const result: TPromptSchema = ConvertToOpenAISchema(
        SimpleSchema,
        "SimpleSchema",
        options
    )
    expect(result.name).toBe("SimpleSchema")
    expect(result.strict).toBe(true)

    // Use optionsWithLogger to avoid unused variable lint error
    expect(optionsWithLogger.logger).toBeDefined()
})
```

- [ ] **Step 2: Type-check to verify it fails**

```bash
pnpx tsc --noEmit --project tsconfig.json --files src/__tests__/index.test.ts src/index.ts
```

Expected: FAIL — type errors because `TPromptSchema`, `TLogger`, `TConvertOptions` are not exported from `../index`. Note: `pnpm test` (vitest) would pass because it uses esbuild which erases type annotations without type-checking.

- [ ] **Step 3: Rename and export types in `src/index.ts`**

Rename `Logger` to `TLogger` (lines 17-22):

```typescript
// Before:
type Logger = {
// After:
export type TLogger = {
```

Rename `ConvertOptions` to `TConvertOptions` (lines 24-27):

```typescript
// Before:
type ConvertOptions = {
    logger?: Logger
// After:
export type TConvertOptions = {
    logger?: TLogger
```

Export `TPromptSchema` (line 11):

```typescript
// Before:
interface TPromptSchema {
// After:
export interface TPromptSchema {
```

Update the internal references — `createLogger` parameter type (line 67):

```typescript
// Before:
function createLogger(options?: ConvertOptions): Required<Logger> {
// After:
function createLogger(options?: TConvertOptions): Required<TLogger> {
```

Update `ConvertToOpenAISchema` parameter type (line ~300):

```typescript
// Before:
    options?: ConvertOptions
// After:
    options?: TConvertOptions
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test
```

Expected: all tests pass including the new type import test.

- [ ] **Step 5: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts && git commit -m "Rename Logger/ConvertOptions to TLogger/TConvertOptions and export all types"
```

---

### Task 3: Add JSDoc documentation

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Add JSDoc to `TPromptSchema`**

```typescript
/**
 * The wrapper object that OpenAI's structured output API expects.
 * Pass this to the `text.format` or `response_format` parameter
 * when calling the OpenAI API.
 */
export interface TPromptSchema {
```

- [ ] **Step 2: Add JSDoc to `TLogger`**

```typescript
/**
 * Custom logger interface for controlling diagnostic output.
 * All methods are optional — any omitted method is silently ignored.
 */
export type TLogger = {
```

- [ ] **Step 3: Add JSDoc to `TConvertOptions`**

```typescript
/**
 * Options for {@link ConvertToOpenAISchema}.
 *
 * @property logger - Custom logger object. Takes precedence over `debug`.
 * @property debug - When `true`, logs diagnostics to the console.
 */
export type TConvertOptions = {
```

- [ ] **Step 4: Add JSDoc to `ConvertToOpenAISchema`**

```typescript
/**
 * Convert a TypeBox schema into an OpenAI Structured Output-compatible
 * prompt schema.
 *
 * Transformations applied:
 * - **$defs lifting** — nested `$defs` are collected and moved to the root.
 * - **$ref normalization** — bare refs like `"Child"` are rewritten to `"#/$defs/Child"`.
 *   External, absolute, and JSON Pointer refs are left unchanged.
 * - **$id removal** — `$id` fields are stripped at all levels.
 * - **Nullable object merging** — `anyOf` with one object + one null branch becomes
 *   `{ type: ["object", "null"], ... }`.
 * - **Single-entry allOf flattening** — `{ allOf: [schema] }` is unwrapped to `schema`.
 * - **Immutability** — the input schema is never mutated.
 *
 * @param inputSchema - The TypeBox (or raw JSON Schema) schema to convert.
 * @param schemaName - The name for the prompt schema (used by OpenAI).
 * @param options - Optional logging configuration.
 * @returns A {@link TPromptSchema} ready to pass to the OpenAI API.
 *
 * @throws When the schema contains unsupported constructs:
 *   - Multi-entry `allOf` (intersections)
 *   - `oneOf` or `not`
 *   - Array types without `items`
 *   - Nodes missing `type`, `$ref`, `anyOf`, `const`, or `enum`
 *   - `anyOf` unions with only null branches
 *   - Duplicate `$defs` keys across nested schemas
 */
export function ConvertToOpenAISchema(
```

- [ ] **Step 5: Build to verify JSDoc doesn't break compilation**

```bash
pnpm build
```

Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts && git commit -m "Add JSDoc documentation to all exported symbols"
```

---

### Task 4: Unsupported type errors — non-object/boolean schemas

**Files:**
- Modify: `src/index.ts`
- Modify: `src/__tests__/index.test.ts`

- [ ] **Step 1: Write failing test for boolean schema**

Add to `src/__tests__/index.test.ts`:

```typescript
test("Throws on boolean schema value", () => {
    expect(() =>
        ConvertToOpenAISchema(true as unknown as TSchema, "BoolSchema")
    ).toThrow("Unsupported schema")
})
```

Where `TSchema` needs to be imported. Add to the import at the top:

```typescript
import type { TSchema } from "typebox/type"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpx vitest run -t "Throws on boolean schema value"
```

Expected: FAIL — currently returns `true` silently.

- [ ] **Step 3: Implement the check in `moveDefsToRoot`**

In `src/index.ts`, change the early return in `moveDefsToRoot` (around line 162):

```typescript
// Before:
if (typeof schema !== "object" || schema === null) {
    return schema
}

// After:
if (typeof schema !== "object" || schema === null) {
    const formattedPath = formatPath(path)
    logger.error("Unsupported schema: not an object", formattedPath)
    throw new Error(
        `Unsupported schema: expected an object node at ${formattedPath}`
    )
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpx vitest run -t "Throws on boolean schema value"
```

Expected: PASS.

- [ ] **Step 5: Run all tests to check for regressions**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts && git commit -m "Throw on non-object/boolean schema values"
```

---

### Task 5: Unsupported type errors — `allOf`, `oneOf`, `not`

**Files:**
- Modify: `src/index.ts`
- Modify: `src/__tests__/index.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/index.test.ts`:

```typescript
test("Throws on multi-entry allOf", () => {
    const schema = {
        allOf: [
            { type: "object", properties: { a: { type: "string" } }, required: ["a"], additionalProperties: false },
            { type: "object", properties: { b: { type: "number" } }, required: ["b"], additionalProperties: false },
        ],
    }
    expect(() => ConvertToOpenAISchema(schema, "AllOfSchema")).toThrow(
        'Unsupported schema type "allOf" at #'
    )
})

test("Flattens single-entry allOf", () => {
    const schema = {
        type: "object",
        properties: {
            child: { allOf: [{ $ref: "Foo" }] },
        },
        required: ["child"],
        additionalProperties: false,
    }
    const result = ConvertToOpenAISchema(schema, "SingleAllOf")
    expect((result.schema as Record<string, unknown>).properties).toEqual({
        child: { $ref: "#/$defs/Foo" },
    })
})

test("Flattens single-entry allOf with sibling keywords", () => {
    const schema = {
        type: "object",
        properties: {
            child: {
                allOf: [{ type: "object", properties: { id: { type: "string" } }, required: ["id"], additionalProperties: false }],
                description: "A child object",
            },
        },
        required: ["child"],
        additionalProperties: false,
    }
    const result = ConvertToOpenAISchema(schema, "AllOfSibling")
    const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
    expect(props.child.description).toBe("A child object")
    expect(props.child.type).toBe("object")
    expect(props.child.allOf).toBeUndefined()
})

test("Throws on oneOf nested in property", () => {
    const schema = {
        type: "object",
        properties: {
            value: {
                oneOf: [{ type: "string" }, { type: "number" }],
            },
        },
        required: ["value"],
        additionalProperties: false,
    }
    expect(() => ConvertToOpenAISchema(schema, "OneOfSchema")).toThrow(
        'Unsupported schema type "oneOf" at #/properties/value'
    )
})

test("Throws on not", () => {
    const schema = {
        type: "object",
        properties: {
            value: {
                not: { type: "string" },
            },
        },
        required: ["value"],
        additionalProperties: false,
    }
    expect(() => ConvertToOpenAISchema(schema, "NotSchema")).toThrow(
        'Unsupported schema type "not" at #/properties/value'
    )
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpx vitest run -t "Throws on multi-entry allOf"
pnpx vitest run -t "Flattens single-entry allOf"
pnpx vitest run -t "Throws on oneOf"
pnpx vitest run -t "Throws on not"
```

Expected: all FAIL.

- [ ] **Step 3: Add type guards for `allOf`, `oneOf`, `not`**

Add after the existing `IsRef` function in `src/index.ts`:

```typescript
function IsAllOf(schema: TSchema): schema is TSchema & { allOf: TSchema[] } {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "allOf" in schema &&
        Array.isArray((schema as Record<string, unknown>).allOf)
    )
}

function IsOneOf(schema: TSchema): schema is TSchema & { oneOf: TSchema[] } {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "oneOf" in schema &&
        Array.isArray((schema as Record<string, unknown>).oneOf)
    )
}

function IsNot(schema: TSchema): schema is TSchema & { not: TSchema } {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "not" in schema
    )
}
```

- [ ] **Step 4: Add `allOf`/`oneOf`/`not` handling in `moveDefsToRoot`**

Insert these checks after the `$defs` extraction block (after the `if (defs) { ... }` block) and **before** the existing `if (IsAnyOf(...))` check:

```typescript
if (IsAllOf(schemaWithoutDefs)) {
    if (schemaWithoutDefs.allOf.length === 1) {
        const { allOf: _allOf, ...siblings } = schemaWithoutDefs as Record<string, unknown>
        const unwrapped = {
            ...schemaWithoutDefs.allOf[0],
            ...siblings,
        } as TSchema
        return moveDefsToRoot(unwrapped, allDefs, logger, path)
    }
    const formattedPath = formatPath(path)
    logger.error("Unsupported schema type \"allOf\"", formattedPath)
    throw new Error(
        `Unsupported schema type "allOf" at ${formattedPath}`
    )
}

if (IsOneOf(schemaWithoutDefs)) {
    const formattedPath = formatPath(path)
    logger.error("Unsupported schema type \"oneOf\"", formattedPath)
    throw new Error(
        `Unsupported schema type "oneOf" at ${formattedPath}`
    )
}

if (IsNot(schemaWithoutDefs)) {
    const formattedPath = formatPath(path)
    logger.error("Unsupported schema type \"not\"", formattedPath)
    throw new Error(
        `Unsupported schema type "not" at ${formattedPath}`
    )
}
```

- [ ] **Step 5: Run all tests**

```bash
pnpm test
```

Expected: all tests pass including the 5 new ones.

- [ ] **Step 6: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts && git commit -m "Add allOf flattening and throw on oneOf/not/multi-entry allOf"
```

---

### Task 6: Unsupported type errors — array without `items`, unrecognized leaf nodes, `$defs` collision

**Files:**
- Modify: `src/index.ts`
- Modify: `src/__tests__/index.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `src/__tests__/index.test.ts`:

```typescript
test("Throws on array without items", () => {
    const schema = {
        type: "object",
        properties: {
            tags: { type: "array" },
        },
        required: ["tags"],
        additionalProperties: false,
    }
    expect(() => ConvertToOpenAISchema(schema, "NoItemsArray")).toThrow(
        'Unsupported schema: array type requires "items" at #/properties/tags'
    )
})

test("Throws on unrecognized leaf node", () => {
    const schema = {
        type: "object",
        properties: {
            mystery: { description: "no type here" },
        },
        required: ["mystery"],
        additionalProperties: false,
    }
    expect(() => ConvertToOpenAISchema(schema, "LeafSchema")).toThrow(
        'Unsupported schema: missing "type", "$ref", "anyOf", "const", or "enum" at #/properties/mystery'
    )
})

test("Throws on $defs key collision", () => {
    const schema = {
        type: "object",
        properties: {
            a: {
                type: "object",
                properties: {
                    id: { type: "string" },
                },
                required: ["id"],
                additionalProperties: false,
                $defs: {
                    Shared: {
                        type: "object",
                        properties: { x: { type: "string" } },
                        required: ["x"],
                        additionalProperties: false,
                    },
                },
            },
            b: {
                type: "object",
                properties: {
                    id: { type: "number" },
                },
                required: ["id"],
                additionalProperties: false,
                $defs: {
                    Shared: {
                        type: "object",
                        properties: { y: { type: "number" } },
                        required: ["y"],
                        additionalProperties: false,
                    },
                },
            },
        },
        required: ["a", "b"],
        additionalProperties: false,
    }
    expect(() => ConvertToOpenAISchema(schema, "CollisionSchema")).toThrow(
        'Duplicate $defs key "Shared"'
    )
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpx vitest run -t "Throws on array without items"
pnpx vitest run -t "Throws on unrecognized leaf node"
pnpx vitest run -t "Throws on \\$defs key collision"
```

Expected: all FAIL.

- [ ] **Step 3: Add array-without-items check**

In `src/index.ts`, inside the `if (IsArray(schemaWithoutDefs))` block, add a check before processing items:

```typescript
if (IsArray(schemaWithoutDefs)) {
    const items = schemaWithoutDefs.items
    if (items === undefined || items === null) {
        const formattedPath = formatPath(path)
        logger.error("Unsupported schema: array type requires \"items\"", formattedPath)
        throw new Error(
            `Unsupported schema: array type requires "items" at ${formattedPath}`
        )
    }
    // ... rest of existing items processing
```

- [ ] **Step 4: Add `$defs` collision check**

In `src/index.ts`, inside the `if (defs)` block where `$defs` entries are added to `allDefs`, add a collision check before the assignment:

```typescript
if (defs) {
    for (const [schemaId, defSchema] of Object.entries(defs)) {
        if (schemaId in allDefs) {
            const formattedPath = formatPath(path.concat(["$defs", schemaId]))
            logger.error(`Duplicate $defs key "${schemaId}"`, formattedPath)
            throw new Error(
                `Duplicate $defs key "${schemaId}" at ${formattedPath}`
            )
        }
        allDefs[schemaId] = moveDefsToRoot(
            defSchema,
            allDefs,
            logger,
            path.concat(["$defs", schemaId])
        )
    }
}
```

- [ ] **Step 5: Add unrecognized leaf node check**

In `src/index.ts`, change the fallthrough at the end of `moveDefsToRoot` (the final `return withClearedId(...)`) to only pass through nodes with `type`, `const`, or `enum`:

```typescript
// Before (final return in moveDefsToRoot):
return withClearedId(schemaWithoutDefs, {
    ...schemaWithoutDefs,
}) as TSchema

// After:
const hasType = "type" in schemaWithoutDefs
const hasConst = "const" in schemaWithoutDefs
const hasEnum = "enum" in schemaWithoutDefs
if (!hasType && !hasConst && !hasEnum) {
    const formattedPath = formatPath(path)
    logger.error(
        "Unsupported schema: missing \"type\", \"$ref\", \"anyOf\", \"const\", or \"enum\"",
        formattedPath
    )
    throw new Error(
        `Unsupported schema: missing "type", "$ref", "anyOf", "const", or "enum" at ${formattedPath}`
    )
}

return withClearedId(schemaWithoutDefs, {
    ...schemaWithoutDefs,
}) as TSchema
```

- [ ] **Step 6: Run all tests**

```bash
pnpm test
```

Expected: all tests pass. Watch for regressions — some existing tests may use schemas that hit the new leaf node check. If any existing test breaks, check whether the test schema is valid (has `type`). If it needs adjustment, fix the test schema to include a `type` field.

- [ ] **Step 7: Commit**

```bash
git add src/index.ts src/__tests__/index.test.ts && git commit -m "Throw on array without items, unrecognized leaf nodes, and $defs collisions"
```

---

### Task 7: Options/logging tests

**Files:**
- Modify: `src/__tests__/index.test.ts`

- [ ] **Step 1: Write options/logging tests**

Add to `src/__tests__/index.test.ts`:

```typescript
test("Works with no options", () => {
    expect(() =>
        ConvertToOpenAISchema(SimpleSchema, "SimpleSchema")
    ).not.toThrow()
})

test("Works with undefined options", () => {
    expect(() =>
        ConvertToOpenAISchema(SimpleSchema, "SimpleSchema", undefined)
    ).not.toThrow()
})

test("debug: true enables console logging without throwing", () => {
    expect(() =>
        ConvertToOpenAISchema(SimpleSchema, "SimpleSchema", { debug: true })
    ).not.toThrow()
})

test("Custom logger receives error calls on unsupported schema", () => {
    const errorCalls: unknown[][] = []
    const logger: TLogger = {
        error: (...args: unknown[]) => errorCalls.push(args),
    }
    const badSchema = {
        type: "object",
        properties: {
            value: { oneOf: [{ type: "string" }, { type: "number" }] },
        },
        required: ["value"],
        additionalProperties: false,
    }
    expect(() =>
        ConvertToOpenAISchema(badSchema, "BadSchema", { logger })
    ).toThrow()
    expect(errorCalls.length).toBeGreaterThan(0)
})

test("Custom logger is accepted without throwing", () => {
    const logger: TLogger = {
        debug: () => undefined,
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
    }
    expect(() =>
        ConvertToOpenAISchema(SimpleSchema, "SimpleSchema", { logger })
    ).not.toThrow()
})
```

Note: the `TLogger` import should already be present from Task 2. The first test verifies `logger.error` is called on error paths. The second verifies a full logger is accepted on success paths.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/index.test.ts && git commit -m "Add options and logging tests"
```

---

### Task 8: TypeBox passthrough type tests

**Files:**
- Modify: `src/__tests__/index.test.ts`

- [ ] **Step 1: Write passthrough tests**

Add to `src/__tests__/index.test.ts`:

```typescript
test("Type.Integer() passes through as {type: 'integer'}", () => {
    const schema = Type.Object(
        { count: Type.Integer() },
        { additionalProperties: false }
    )
    const result = ConvertToOpenAISchema(schema, "IntegerSchema")
    const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
    expect(props.count.type).toBe("integer")
})

test("Type.Literal() passes through as const value", () => {
    const schema = Type.Object(
        { status: Type.Literal("active") },
        { additionalProperties: false }
    )
    const result = ConvertToOpenAISchema(schema, "LiteralSchema")
    const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
    expect(props.status.const).toBe("active")
})

test("Union of Literals produces anyOf with const values", () => {
    const schema = Type.Object(
        {
            color: Type.Union([
                Type.Literal("red"),
                Type.Literal("green"),
                Type.Literal("blue"),
            ]),
        },
        { additionalProperties: false }
    )
    const result = ConvertToOpenAISchema(schema, "UnionLiteralSchema")
    const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
    // TypeBox Union of Literals produces anyOf with const values
    expect(props.color.anyOf).toBeDefined()
})

test("Type.Enum() passes through with enum array", () => {
    enum Color { Red = "red", Green = "green", Blue = "blue" }
    const schema = Type.Object(
        { color: Type.Enum(Color) },
        { additionalProperties: false }
    )
    const result = ConvertToOpenAISchema(schema, "EnumSchema")
    const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
    // TypeBox Type.Enum() produces anyOf with const values
    expect(props.color.anyOf).toBeDefined()
})

test("Type.Optional() omits property from required array", () => {
    const schema = Type.Object(
        {
            name: Type.String(),
            nickname: Type.Optional(Type.String()),
        },
        { additionalProperties: false }
    )
    const result = ConvertToOpenAISchema(schema, "OptionalSchema")
    const s = result.schema as Record<string, unknown>
    expect(s.required).toEqual(["name"])
    const props = s.properties as Record<string, Record<string, unknown>>
    expect(props.nickname).toBeDefined()
    expect(props.nickname.type).toBe("string")
})
```

- [ ] **Step 2: Run the new tests**

```bash
pnpx vitest run -t "Type.Integer"
pnpx vitest run -t "Type.Literal"
pnpx vitest run -t "Enum schema"
pnpx vitest run -t "Type.Optional"
```

Expected: PASS for all. These test existing passthrough behavior. If any fail, it means TypeBox produces a different output than expected — check with a quick `console.log(JSON.stringify(Type.Integer(), null, 2))` and adjust the assertion.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/index.test.ts && git commit -m "Add passthrough type tests for Integer, Literal, Enum, Optional"
```

---

### Task 9: Edge case tests

**Files:**
- Modify: `src/__tests__/index.test.ts`

- [ ] **Step 1: Write edge case tests**

Add to `src/__tests__/index.test.ts`:

```typescript
test("Lifts deeply nested $defs (3+ levels) to root and rewrites bare refs", () => {
    const schema = {
        type: "object",
        properties: {
            child: { $ref: "Level1" },
        },
        required: ["child"],
        additionalProperties: false,
        $defs: {
            Level1: {
                type: "object",
                properties: {
                    nested: { $ref: "Level2" },
                },
                required: ["nested"],
                additionalProperties: false,
                $defs: {
                    Level2: {
                        type: "object",
                        properties: {
                            deep: { $ref: "Level3" },
                        },
                        required: ["deep"],
                        additionalProperties: false,
                        $defs: {
                            Level3: {
                                type: "object",
                                properties: { value: { type: "string" } },
                                required: ["value"],
                                additionalProperties: false,
                            },
                        },
                    },
                },
            },
        },
    }
    const result = ConvertToOpenAISchema(schema, "DeepDefs")
    const s = result.schema as Record<string, Record<string, unknown>>
    // All $defs should be at root level
    expect(Object.keys(s.$defs)).toContain("Level1")
    expect(Object.keys(s.$defs)).toContain("Level2")
    expect(Object.keys(s.$defs)).toContain("Level3")
    // Nested schemas should not have their own $defs
    const level1 = s.$defs.Level1 as Record<string, unknown>
    expect(level1.$defs).toBeUndefined()
    // Bare refs should be rewritten to #/$defs/ format
    const props = s.properties as Record<string, Record<string, unknown>>
    expect(props.child.$ref).toBe("#/$defs/Level1")
})

test("Empty object Type.Object({}) works", () => {
    const schema = Type.Object({}, { additionalProperties: false })
    const result = ConvertToOpenAISchema(schema, "EmptyObject")
    const s = result.schema as Record<string, unknown>
    expect(s.type).toBe("object")
    expect(s.properties).toEqual({})
})

test("Removes $id at all nesting levels", () => {
    const schema = {
        $id: "Root",
        type: "object",
        properties: {
            child: {
                $id: "Child",
                type: "object",
                properties: {
                    value: { $id: "Value", type: "string" },
                },
                required: ["value"],
                additionalProperties: false,
            },
        },
        required: ["child"],
        additionalProperties: false,
    }
    const result = ConvertToOpenAISchema(schema, "IdRemoval")
    const s = result.schema as Record<string, unknown>
    expect(s.$id).toBeUndefined()
    const child = (s.properties as Record<string, Record<string, unknown>>).child
    expect(child.$id).toBeUndefined()
    const value = (child.properties as Record<string, Record<string, unknown>>).value
    expect(value.$id).toBeUndefined()
})

test("$ref with dots and underscores are rewritten", () => {
    const schema = {
        type: "object",
        properties: {
            dotRef: { $ref: "Foo.Bar" },
            underRef: { $ref: "Foo_Bar" },
        },
        required: ["dotRef", "underRef"],
        additionalProperties: false,
    }
    const result = ConvertToOpenAISchema(schema, "SpecialRefs")
    const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
    expect(props.dotRef.$ref).toBe("#/$defs/Foo.Bar")
    expect(props.underRef.$ref).toBe("#/$defs/Foo_Bar")
})

test("mergeTypeWithNull does not duplicate null in array type", () => {
    const schema = {
        type: "object",
        properties: {
            maybe: {
                anyOf: [
                    {
                        type: ["object", "null"],
                        properties: { id: { type: "string" } },
                        required: ["id"],
                        additionalProperties: false,
                    },
                    { type: "null" },
                ],
            },
        },
        required: ["maybe"],
        additionalProperties: false,
    }
    const result = ConvertToOpenAISchema(schema, "NullIdempotent")
    const props = (result.schema as Record<string, unknown>).properties as Record<string, Record<string, unknown>>
    const nullCount = (props.maybe.type as string[]).filter(
        (t) => t === "null"
    ).length
    expect(nullCount).toBe(1)
})

test("Schema description fields are preserved", () => {
    const schema = Type.Object(
        {
            name: Type.String({ description: "The user's name" }),
        },
        { additionalProperties: false, description: "A user object" }
    )
    const result = ConvertToOpenAISchema(schema, "DescSchema")
    const s = result.schema as Record<string, unknown>
    expect(s.description).toBe("A user object")
    const props = s.properties as Record<string, Record<string, unknown>>
    expect(props.name.description).toBe("The user's name")
})
```

- [ ] **Step 2: Run the new tests**

```bash
pnpm test
```

Expected: all pass. These test existing behavior plus the new `$defs` collision check from Task 6.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/index.test.ts && git commit -m "Add edge case tests for deep $defs, $id removal, special refs, null idempotency, descriptions"
```

---

### Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update Generic Instructions**

Replace the first two bullets in the Generic Instructions section:

```markdown
## Generic Instructions

- Git commit messages should not include any co-authoring content
- Integration tests hit the real OpenAI API and are skipped when `OPENAI_API_KEY` is not set. Also configurable: `OPENAI_BASE_URL`, `OPENAI_MODEL`
- When I report a bug, don't start by trying to fix it. Instead, start by writing a test that reproduces the bug. Then, use subagents to attempt fixes and prove them with a passing test.
- For OpenAI structured output details, fetch https://developers.openai.com/api/docs/guides/structured-outputs.md
```

(Removes the "build before testing" note since tests now import source directly.)

- [ ] **Step 2: Update Commands section**

Update the single-file test command path:

```markdown
- `pnpx vitest run src/__tests__/index.test.ts` — run a single test file
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md && git commit -m "Update CLAUDE.md for new test paths and add OpenAI structured outputs reference"
```

---

### Task 11: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Update the API section with renamed types**

In the Options table, update the logger type reference:

```markdown
| `logger` | `TLogger` (`{ debug?, info?, warn?, error? }`) | Custom logger object — each method is optional and receives `(...args: unknown[])` |
```

- [ ] **Step 2: Add "Supported Schema Types" section**

Add after the "Schema transformations" section:

```markdown
## Supported schema types

The following JSON Schema constructs are supported and compatible with OpenAI's strict mode:

| Construct | Example | Notes |
|-----------|---------|-------|
| `string` | `Type.String()` | Supports `format` (e.g., `"uuid"`) |
| `number` | `Type.Number()` | |
| `integer` | `Type.Integer()` | |
| `boolean` | `Type.Boolean()` | |
| `null` | `Type.Null()` | |
| `object` | `Type.Object(...)` | Must include `additionalProperties: false` for OpenAI strict mode |
| `array` | `Type.Array(...)` | Must include `items` |
| `anyOf` | `Type.Union([...])` | Nullable object unions are merged automatically |
| `$ref` / `$defs` | `Type.Ref(...)` / `Type.Cyclic(...)` | Bare refs rewritten to `#/$defs/...` |
| `const` | `Type.Literal(...)` | |
| `enum` | Via `anyOf` of literals | TypeBox emits `anyOf` with `const` entries |
| Single-entry `allOf` | Common in Pydantic output | Automatically flattened |
```

- [ ] **Step 3: Add "Unsupported Schema Types" section**

Add after "Supported schema types":

```markdown
## Unsupported schema types

The following constructs will cause `ConvertToOpenAISchema` to throw an error, since they are not supported by OpenAI's structured output strict mode:

| Construct | Error |
|-----------|-------|
| Multi-entry `allOf` | `Unsupported schema type "allOf"` |
| `oneOf` | `Unsupported schema type "oneOf"` |
| `not` | `Unsupported schema type "not"` |
| Array without `items` | `Unsupported schema: array type requires "items"` |
| Missing `type`/`$ref`/`anyOf`/`const`/`enum` | `Unsupported schema: missing "type", "$ref", ...` |
| Duplicate `$defs` keys | `Duplicate $defs key "..."` |
| `anyOf` with only null branches | `Unsupported anyOf union with only null branches` |
```

- [ ] **Step 4: Add single-entry `allOf` flattening to the transformations list**

Add a bullet to the "Schema transformations" section:

```markdown
- **Single-entry `allOf` flattening** — `{ allOf: [schema] }` is unwrapped to just `schema`, with any sibling keywords (e.g., `description`) merged onto the result. This is common in Pydantic-generated schemas.
```

- [ ] **Step 5: Update integration test file path**

In the Development section:

```markdown
The integration test suite (`src/__tests__/openai.integration.test.ts`) makes real API calls to OpenAI and is skipped by default.
```

- [ ] **Step 6: Commit**

```bash
git add README.md && git commit -m "Update README with supported/unsupported types, renamed types, and new paths"
```

---

### Task 12: Version bump and final verification

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version and add keywords**

In `package.json`, update version (line 3):

```json
"version": "2.0.0",
```

Update keywords (line 24-27):

```json
"keywords": [
    "typebox",
    "openai",
    "schema",
    "structured-output",
    "json-schema",
    "typebox-openai"
],
```

- [ ] **Step 2: Build and run full test suite**

```bash
pnpm build && pnpm test
```

Expected: build succeeds, all tests pass.

- [ ] **Step 3: Run lint and format**

```bash
pnpm lint && pnpm prettify
```

Expected: no lint errors. Prettier may reformat — if so, stage the changes.

- [ ] **Step 4: Verify dist/ output looks correct**

```bash
ls dist/
```

Expected: `index.js`, `index.d.ts`, `index.d.ts.map`. No test files in `dist/`.

- [ ] **Step 5: Verify exported types in declaration file**

```bash
grep "export" dist/index.d.ts
```

Expected: see `export interface TPromptSchema`, `export type TLogger`, `export type TConvertOptions`, `export declare function ConvertToOpenAISchema`.

- [ ] **Step 6: Commit**

```bash
git add package.json && git commit -m "Bump version to 2.0.0 and add keywords"
```

If Prettier changed any files:

```bash
git add -A && git commit -m "Format with Prettier"
```
