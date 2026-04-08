import type { TSchema } from "typebox/type"

/** A JSON Schema object node that contains a `$defs` block. */
export type TObjectWithDefs = TSchema & {
    $defs: Record<string, TSchema>
}

/** A schema node whose value is a union expressed via `anyOf`. */
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
