import { describe, expect, test } from "bun:test"

describe("repo gates", () => {
	test("all commit-readiness scripts exist", async () => {
		const pkg = await Bun.file(new URL("../package.json", import.meta.url)).json()
		for (const script of ["format", "format:check", "typecheck", "lint", "test"]) {
			expect(typeof pkg.scripts[script]).toBe("string")
		}
	})
})
