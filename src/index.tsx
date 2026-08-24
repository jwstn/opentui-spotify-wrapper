import { createCliRenderer, TextAttributes } from "@opentui/core"
import { createRoot } from "@opentui/react"
import { Button } from "./components/ui/button"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./components/ui/dialog"
import { Textarea } from "./components/ui/textarea"
import { Checkbox } from "./components/ui/checkbox"

function App() {
	return (
		<box alignItems="center" justifyContent="center" flexGrow={1}>
			<box justifyContent="center" alignItems="flex-end">
				<ascii-font font="grid" text="OpenTUI" />
				<input placeholder="foobar" />
				<text attributes={TextAttributes.UNDERLINE}>What will you build?</text>
				<text>Button</text>
				<Button label="foobar" />
				<text>Textarea</text>
				<Textarea
					initialValue="Release notes"
					placeholder="Describe this release…"
					onSubmit={() => {
						console.log("foobar")
					}}
				/>
				<text>Checkbox</text>
				<Checkbox label="Enable notifications" defaultChecked onCheckedChange={(checked) => console.log({ checked })} />
				<text>Dialog</text>
				<Dialog>
					<DialogTrigger>
						<text content="Open settings" />
					</DialogTrigger>
					<DialogContent>
						<DialogTitle content="Settings" />
						<DialogDescription content="Change this project's options." />
						<DialogClose>
							<text content="Close" />
						</DialogClose>
					</DialogContent>
				</Dialog>
			</box>
		</box>
	)
}

const renderer = await createCliRenderer()
createRoot(renderer).render(<App />)
