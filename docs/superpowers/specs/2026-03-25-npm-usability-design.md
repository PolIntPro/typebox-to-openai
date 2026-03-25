# NPM Usability Improvements — Design Spec

## Goal

Make `typebox-to-openai` more usable as a public npm dependency by adding documentation, improving test coverage, enforcing code style standards, and explicitly handling unsupported schema types.

## 1. brain-style Compliance & Type Renames

Rename exported types to use `T`-prefixed PascalCase per brain-style TypeScript conventions:

- `Logger` → `TLogger`
- `ConvertOptions` → `TConvertOptions`

This is a **breaking change**. Bump version from `1.0.5` to `2.0.0` with no backward-compatibility aliases.

All other naming already complies (file names are kebab-case, functions are camelCase, schema objects are PascalCase, internal types already use `T` prefix).

## 2. JSDoc Documentation

Add JSDoc docstrings to all exported symbols in `src/index.ts`:

| Symbol | What to document |
|--------|-----------------|
| `TPromptSchema` | The `{ name, strict: true, schema }` wrapper object that OpenAI's structured output API expects |
| `TLogger` | Optional logger interface with `debug`, `info`, `warn`, `error` methods |
| `TConvertOptions` | Options object: `logger` (custom logger) and `debug` (enable console logging) |
| `ConvertToOpenAISchema()` | Parameters, return type, transformations performed ($defs lifting, $ref normalization, $id removal, nullable object merging), when it throws (unsupported types, null-only unions) |

Internal helper functions do **not** get JSDoc.

## 3. Test Restructure

Move tests from top-level `tests/` to colocated `src/__tests__/`:

- `tests/index.test.ts` → `src/__tests__/index.test.ts`
- `tests/openai.integration.test.ts` → `src/__tests__/openai.integration.test.ts`
- Delete the `tests/` directory
- Update imports to reference source directly (`"../index"` instead of `"../"` resolving to `dist/`)
- Update vitest/tsconfig config if needed
- Update CLAUDE.md to reflect new paths and remove "build before testing" note

## 4. Unsupported Type Errors

Add fail-fast validation in `moveDefsToRoot` traversal. When encountering an unsupported schema node, throw a descriptive error with:

- The unsupported type/structural indicator
- The JSON Pointer path (via existing `formatPath`)

### Supported types (handled or pass-through)

These are the JSON Schema constructs that OpenAI structured outputs support in strict mode:

- **Primitive types:** `string`, `number`, `integer`, `boolean`, `null`
- **Compound types:** `object` (with `properties`, `required`, `additionalProperties: false`), `array` (with `items`)
- **Unions:** `anyOf`
- **References:** `$ref`, `$defs`
- **Value constraints:** `enum`, `const`
- **Metadata:** `description`

### Unsupported types (should throw)

- `allOf` — intersections, not supported by OpenAI strict mode
- `oneOf` — not used by TypeBox, ambiguous with `anyOf`
- `not` — negation, not supported by OpenAI strict mode
- Leaf nodes with no recognizable structure (no `type`, no `$ref`, no `anyOf`, no `const`, no `enum`)

Error message format (consistent with existing null-only anyOf error):
```
Unsupported schema type "allOf" at #/properties/foo
```

## 5. Test Coverage Improvements

All new tests go in `src/__tests__/index.test.ts`.

### A. Options/logging tests

- `debug: true` enables console logging without throwing
- Custom `logger` object receives log calls
- No options / `undefined` options works silently

### B. Unsupported type error tests

- `allOf` at root → throws with path `#`
- `oneOf` nested in property → throws with correct deep path
- `not` → throws with path
- Leaf node with no `type`/`$ref`/`anyOf`/`const`/`enum` → throws
- Nested unsupported type → error includes correct JSON Pointer path

### C. TypeBox passthrough type tests

- `Type.Integer()` → produces `{type: "integer"}`, passes through correctly
- `Type.Literal("foo")` → produces `{const: "foo"}`, passes through
- `Type.Enum()` → produces `{enum: [...]}`, passes through
- `Type.Optional()` inside objects → omitted from `required`, verify behavior

### D. Edge case tests

- Deeply nested `$defs` (3+ levels) → all lifted to root
- Empty object `Type.Object({})` → works
- Array with no `items` → works
- `$id` removal verified at all nesting levels
- `$ref` with dots (`"Foo.Bar"`) and underscores (`"Foo_Bar"`) → rewritten correctly
- `mergeTypeWithNull` when type is already an array → no duplicate `"null"`
- `mergeTypeWithNull` when array already contains `"null"` → idempotent
- Schema with `description` fields → preserved through transformation

## 6. Documentation Updates

### CLAUDE.md

- Add reference: for OpenAI structured output details, fetch `https://developers.openai.com/api/docs/guides/structured-outputs.md`
- Update test file paths to `src/__tests__/`
- Remove "build before testing" note (tests now import source directly)

### README.md

- Add "Supported Schema Types" section listing what works
- Add "Unsupported Schema Types" section explaining what throws and why
- Update API reference for renamed types (`TLogger`, `TConvertOptions`)
- Note the 2.0.0 breaking change

### package.json

- Version: `2.0.0`
- Add keywords: `"structured-output"`, `"json-schema"`, `"typebox-openai"`
