# Upcoming

## Internal

<changes starting-hash="3c2d739" ending-hash="15dd0ab">
- Split `src/index.ts` into focused modules: `types.ts` (type aliases and interfaces), `guards.ts` (type guard functions), `utils.ts` (pure helpers). `index.ts` retains the core `moveDefsToRoot` transform and `ConvertToOpenAISchema` entry point.
- No public API changes — same exports, same behavior.
</changes>
