import { createCliRenderer } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { useEffect, useState } from "react"

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
const SPINNER_INTERVAL_MS = 80

type AppBundle = {
	readonly RegistryProvider: (typeof import("@effect/atom-react"))["RegistryProvider"]
	readonly App: (typeof import("./App"))["App"]
}

function StartupLogo({ hint }: { readonly hint: string }) {
	const [frame, setFrame] = useState(0)

	useEffect(() => {
		const interval = setInterval(() => setFrame((current) => current + 1), SPINNER_INTERVAL_MS)
		return () => clearInterval(interval)
	}, [])

	return (
		<box flexDirection="column" alignItems="center" justifyContent="center" flexGrow={1}>
			<ascii-font font="grid" text="Spotify" />
			<text>{`${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]!} ${hint}`}</text>
		</box>
	)
}

function Bootstrap() {
	const [appBundle, setAppBundle] = useState<AppBundle | null>(null)
	const [bootHint, setBootHint] = useState("starting")

	useEffect(() => {
		let cancelled = false
		const timer = setTimeout(() => {
			setBootHint("loading app")
			void Promise.all([import("@effect/atom-react"), import("./App")]).then(
				([atomReact, app]) => {
					if (cancelled) return
					setAppBundle({
						RegistryProvider: atomReact.RegistryProvider,
						App: app.App,
					})
				},
				(error: unknown) => {
					if (cancelled) return
					setBootHint(error instanceof Error ? error.message : String(error))
				},
			)
		}, 0)

		return () => {
			cancelled = true
			clearTimeout(timer)
		}
	}, [])

	if (appBundle) {
		const { RegistryProvider, App } = appBundle
		return (
			<RegistryProvider>
				<App />
			</RegistryProvider>
		)
	}

	return <StartupLogo hint={bootHint} />
}

const renderer = await createCliRenderer({
	screenMode: "alternate-screen",
})
createRoot(renderer).render(<Bootstrap />)
