import * as Atom from "effect/unstable/reactivity/Atom"
import { DemoService } from "./DemoService"

export const spotifyRuntime = Atom.runtime(DemoService.layerNoDeps)
