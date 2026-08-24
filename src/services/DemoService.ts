import { Context, Effect, Layer } from "effect"

export class DemoService extends Context.Service<
	DemoService,
	{
		readonly greeting: (name: string) => Effect.Effect<string>
	}
>()("opentui-spotify-wrapper/services/DemoService") {
	static readonly layerNoDeps = Layer.succeed(
		DemoService,
		DemoService.of({
			greeting: (name) => Effect.succeed(`Hello ${name}, from an Effect service`),
		}),
	)
}
