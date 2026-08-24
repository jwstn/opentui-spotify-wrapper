import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import * as Atom from "effect/unstable/reactivity/Atom"
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry"
import { DemoService } from "../src/services/DemoService"
import { greetingAtom } from "../src/ui/app/atoms"

const nodeKeys = (registry: AtomRegistry.AtomRegistry) => new Set(registry.getNodes().keys())
const hasNode = (registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<any>) => nodeKeys(registry).has(atom)
const flushTasks = (tasks: Array<() => void>) => tasks.splice(0).forEach((task) => task())

describe("runtime", () => {
	test("demo service greeting flows through an atom into the registry", async () => {
		const registry = AtomRegistry.make()
		const result = await Effect.runPromise(AtomRegistry.getResult(registry, greetingAtom))
		expect(result).toContain("from an Effect service")
	})

	test("layer builds lazily and exactly once per registry", async () => {
		let builds = 0
		const countingLayer = Layer.effect(
			DemoService,
			Effect.sync(() => {
				builds++
				return DemoService.of({
					greeting: (name) => Effect.succeed(`Hello ${name}, from a counted build`),
				})
			}),
		)
		const runtime = Atom.runtime(countingLayer)
		const atomA = runtime.atom(
			Effect.gen(function* () {
				const demo = yield* DemoService
				return yield* demo.greeting("A")
			}),
		)
		const atomB = runtime.atom(
			Effect.gen(function* () {
				const demo = yield* DemoService
				return yield* demo.greeting("B")
			}),
		)

		const registry = AtomRegistry.make()
		expect(builds).toBe(0)

		const [a, b] = await Promise.all([Effect.runPromise(AtomRegistry.getResult(registry, atomA)), Effect.runPromise(AtomRegistry.getResult(registry, atomB))])
		expect(a).toContain("A")
		expect(b).toContain("B")
		expect(builds).toBe(1)

		const otherRegistry = AtomRegistry.make()
		await Effect.runPromise(AtomRegistry.getResult(otherRegistry, atomA))
		expect(builds).toBe(2)
	})

	test("mount refcounts: node survives until last unmount", async () => {
		const tasks: Array<() => void> = []
		const registry = AtomRegistry.make({
			scheduleTask: (task) => {
				tasks.push(task)
				return () => tasks.splice(tasks.indexOf(task), 1)
			},
		})
		const counter = Atom.make(0)

		const unmountFirst = registry.mount(counter)
		const unmountSecond = registry.mount(counter)
		expect(hasNode(registry, counter)).toBe(true)

		unmountFirst()
		flushTasks(tasks)
		expect(hasNode(registry, counter)).toBe(true)
		expect(registry.get(counter)).toBe(0)

		unmountSecond()
		flushTasks(tasks)
		expect(hasNode(registry, counter)).toBe(false)
	})

	test("unmounted runtime atom remounts cleanly in a fresh mount", async () => {
		const registry = AtomRegistry.make()
		const unmount = registry.mount(greetingAtom)
		unmount()

		const result = await Effect.runPromise(AtomRegistry.getResult(registry, greetingAtom))
		expect(result).toContain("from an Effect service")
	})
})
