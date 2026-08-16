import { Console, Effect } from "effect"

const check = Effect.gen(function* () {
  yield* Console.log("Worker composition is ready; durable task claiming is not configured yet.")
})

if (process.argv.includes("--check")) {
  await Effect.runPromise(check)
} else {
  console.error("Use --check until the durable SQLite worker is implemented.")
  process.exitCode = 1
}
