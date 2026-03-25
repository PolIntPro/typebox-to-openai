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
    index.test.ts   — unchanged
```

## Module contents

### `types.ts`

Exports all types — both internal (`TObjectWithDefs`, `TAnyOf`) and public API
(`TPromptSchema`, `TLogger`, `TConvertOptions`). Single source of truth for
types so guards and utils import from one place.

### `guards.ts`

Exports all 8 type guards: `IsAnyOf`, `IsObject`, `IsDefsObject`, `IsArray`,
`IsRef`, `IsAllOf`, `IsOneOf`, `IsNot`.

Imports: types from `./types.js`.

### `utils.ts`

Exports: `createLogger`, `formatPath`, `shouldRewriteRef`,
`mergeTypeWithNull`, `withClearedId`, `removeDefs`.

Imports: types from `./types.js`, `IsDefsObject` from `./guards.js`
(needed by `removeDefs`).

### `index.ts`

Keeps `moveDefsToRoot` (core recursive transform) and `ConvertToOpenAISchema`
(public entry point).

Imports from `./types.js`, `./guards.js`, `./utils.js`.

Re-exports public types (`TPromptSchema`, `TLogger`, `TConvertOptions`) so
consumers' imports continue to work unchanged.

## Constraints

- All test files unchanged — they import from `../index`
- `package.json` exports unchanged — still points to `dist/index.js`
- No behavioral changes — pure file reorganization
- All relative imports use `.js` extensions per ESM requirements
