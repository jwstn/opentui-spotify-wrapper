import { Effect, Console } from "effect"

const program = Console.log("Hello, World!")

export const result = Effect.runSync(program) // => undefined
