import { Effect } from "effect"
import { DemoService } from "../../services/DemoService"
import { spotifyRuntime } from "../../services/runtime"

export const greetingAtom = spotifyRuntime.atom(
	Effect.gen(function* () {
		const demo = yield* DemoService
		return yield* demo.greeting("opentui")
	}),
)
