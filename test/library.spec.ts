import { mockRepository } from "@skymobdev/cad-mock"
import type { ModuleLibrary, ModuleLibraryContext } from "@skymobdev/sdk/authoring"
import { baseOracle, createModuleTestbed, loadStandardCatalog } from "@skymobdev/sdk/testing"
import { describe, expect, it } from "vitest"
import { libMain } from "../src"

const standard = loadStandardCatalog()
let library: ModuleLibrary | undefined

const testbed = createModuleTestbed({
  repository: mockRepository,
  hardware: standard.hardwareMain ? [standard.hardwareMain] : [],
  joins: standard.joinMain ? [standard.joinMain] : [],
  rules: standard.rulesMain ? [standard.rulesMain] : [],
  libraries: [
    ...(standard.libMain ? [standard.libMain] : []),
    (ctx: ModuleLibraryContext) => {
      library = libMain(ctx)
      return library
    },
  ],
})

const modules = testbed.resolver.moduleIndex.filter((m) => m.ref.libraryId === library?.id)

describe("library", () => {
  it("loads without errors", () => {
    expect(testbed.setupDiagnostics.filter((d) => d.severity === "error")).toEqual([])
    expect(modules.length).toBeGreaterThan(0)
  })

  for (const { ref } of modules) {
    it(`${ref.moduleId} materializes with its default params`, () => {
      const result = testbed.materialize(ref, {})
      expect(baseOracle({ mat: result.mat, diagnostics: result.diagnostics })).toEqual([])
    })
  }
})
