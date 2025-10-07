import { stdin, stdout } from "node:process"
import fs from "node:fs"
import { program } from "commander"
import { ConvertToOpenAISchema } from "src"

program.option("-n, --name <string>", "Name of the prompt")
program.parse()
const opts = program.opts()

const inputSchema = JSON.parse(fs.readFileSync(stdin.fd, "utf-8"))

// stdout.write(JSON.stringify(ArgumentAnalysisResponseSchema, null, 4))
stdout.write(
    JSON.stringify(ConvertToOpenAISchema(inputSchema, opts.name), null, 4)
)
