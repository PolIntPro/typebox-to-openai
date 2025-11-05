import type { TArray, TObject, TRef, TNull } from "typebox"
type TObjectWithDefs = TRef & {
    $defs: Record<string, TObject>
}
type TAnyObject = TObject | TRef | TObjectWithDefs | TArray | TRef | TNull
interface TPromptSchema {
    name: string
    strict: true
    schema: TAnyObject
}
export declare function ConvertToOpenAISchema(
    inputSchema: any,
    schemaName: string
): TPromptSchema
export {}
//# sourceMappingURL=index.d.ts.map
