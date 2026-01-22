import type { TSchema } from "typebox/type"
interface TPromptSchema {
    name: string
    strict: true
    schema: TSchema
}
type Logger = {
    debug?: (...args: unknown[]) => void
    info?: (...args: unknown[]) => void
    warn?: (...args: unknown[]) => void
    error?: (...args: unknown[]) => void
}
type ConvertOptions = {
    logger?: Logger
    debug?: boolean
}
export declare function ConvertToOpenAISchema(
    inputSchema: TSchema,
    schemaName: string,
    options?: ConvertOptions
): TPromptSchema
export {}
//# sourceMappingURL=index.d.ts.map
