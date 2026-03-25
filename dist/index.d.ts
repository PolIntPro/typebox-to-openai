import type { TSchema } from "typebox/type";
/**
 * The wrapper object that OpenAI's structured output API expects.
 * Pass this to the `text.format` or `response_format` parameter
 * when calling the OpenAI API.
 */
export interface TPromptSchema {
    name: string;
    strict: true;
    schema: TSchema;
}
/**
 * Custom logger interface for controlling diagnostic output.
 * All methods are optional — any omitted method is silently ignored.
 */
export type TLogger = {
    debug?: (...args: unknown[]) => void;
    info?: (...args: unknown[]) => void;
    warn?: (...args: unknown[]) => void;
    error?: (...args: unknown[]) => void;
};
/**
 * Options for {@link ConvertToOpenAISchema}.
 *
 * @property logger - Custom logger object. Takes precedence over `debug`.
 * @property debug - When `true`, logs diagnostics to the console.
 */
export type TConvertOptions = {
    logger?: TLogger;
    debug?: boolean;
};
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
export declare function ConvertToOpenAISchema(inputSchema: TSchema, schemaName: string, options?: TConvertOptions): TPromptSchema;
//# sourceMappingURL=index.d.ts.map