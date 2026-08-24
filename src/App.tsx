import { useAtomValue } from "@effect/atom-react"
import { TextAttributes } from "@opentui/core"
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult"
import { greetingAtom } from "./ui/app/atoms"

export function App() {
	const greeting = useAtomValue(greetingAtom)

	if (AsyncResult.isInitial(greeting)) {
		return (
			<box alignItems="center" justifyContent="center" flexGrow={1}>
				<text>Connecting services…</text>
			</box>
		)
	}

	if (AsyncResult.isFailure(greeting)) {
		return (
			<box alignItems="center" justifyContent="center" flexGrow={1}>
				<text attributes={TextAttributes.BOLD}>Services failed to start</text>
			</box>
		)
	}

	return (
		<box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
			<ascii-font font="grid" text="Spotify" />
			<text>{greeting.value}</text>
		</box>
	)
}
