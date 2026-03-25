# Split `src/index.ts` into focused modules

**Date:** 2026-03-25
**Status:** Approved

## Goal

Break up `src/index.ts` (450 lines) into smaller files for readability and to
prepare for future extensibility (adding more JSON Schema keyword support).

## Approach

Split by responsibility into 3 new modules, keeping `index.ts` as the core
transform + public API + re-exports.

## File structure

```
src/
  types.ts          — type aliases and interfaces
  guards.ts         — Is* type guard functions
  utils.ts          — pure helper functions
  index.ts          — moveDefsToRoot + ConvertToOpenAISchema + re-exports
  __tests__/
    index.test.ts                — unchanged
    openai.integration.test.ts   — unchanged
```

## Module contents

### `types.ts`

Exports all types — both internal (`TObjectWithDefs`, `TAnyOf`) and public API
(`TPromptSchema`, `TLogger`, `TConvertOptions`). Single source of truth for
types so guards and utils import from one place.

The anonymous intersection types used in guard return types (`TSchema & { allOf: ... }`,
etc.) remain inline — they are tightly coupled to their guards and don't benefit
from named aliases yet.

### `guards.ts`

Exports all 8 type guards: `IsAnyOf`, `IsObject`, `IsDefsObject`, `IsArray`,
`IsRef`, `IsAllOf`, `IsOneOf`, `IsNot`.

Each module imports its needed `typebox/type` types directly (e.g., `TSchema`,
`TObject`, etc.) rather than re-exporting them through `types.ts`.

### `utils.ts`

Exports: `createLogger`, `formatPath`, `shouldRewriteRef`,
`mergeTypeWithNull`, `withClearedId`, `removeDefs`.

Imports: types from `./types.js`, `IsDefsObject` from `./guards.js`
(needed by `removeDefs`).

### `index.ts`

Keeps `moveDefsToRoot` (core recursive transform) and `ConvertToOpenAISchema`
(public entry point).

Imports from `./types.js`, `./guards.js`, `./utils.js`.

`ConvertToOpenAISchema` is a direct export. Public types are re-exported using
`export type { ... }` syntax (required by `verbatimModuleSyntax` in tsconfig):

```typescript
export type { TPromptSchema, TLogger, TConvertOptions } from "./types.js"
```

Internal types (`TObjectWithDefs`, `TAnyOf`) are NOT re-exported from `index.ts`
to avoid widening the public API surface.

## Constraints

- All test files unchanged — they import from `../index`
- `package.json` exports unchanged — still points to `dist/index.js`
- No behavioral changes — pure file reorganization
- All relative imports use `.js` extensions per ESM requirements
