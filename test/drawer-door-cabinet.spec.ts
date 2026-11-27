import { mockRepository } from "@skymobdev/cad-mock"
import { BOARD_MATERIAL_SLOT, makeBoardParam } from "@skymobdev/sdk/authoring"
import {
  createModuleTestbed,
  flattenPieceNodes,
  loadStandardCatalog,
  type TestMaterialization,
} from "@skymobdev/sdk/testing"
import { describe, expect, it } from "vitest"
import { libMain, makeModuleRef } from "../src"
import stdlibBuild from "./fixtures/stdlib-drawer-door-cabinet.json"

const standard = loadStandardCatalog()
const testbed = createModuleTestbed({
  repository: mockRepository,
  hardware: standard.hardwareMain ? [standard.hardwareMain] : [],
  joins: standard.joinMain ? [standard.joinMain] : [],
  rules: standard.rulesMain ? [standard.rulesMain] : [],
  libraries: [...(standard.libMain ? [standard.libMain] : []), libMain],
})
const CABINET = makeModuleRef("drawer-door-cabinet")

const board = (id: string) => ({ isRef: true, refKind: "board", id })
const edge = (id: string) => ({ isRef: true, refKind: "edge", id })
const materials = {
  structuralMaterial: { board: board("oak-25"), edges: edge("white-edge") },
  frontMaterial: { board: board("walnut-18"), edges: edge("white-edge") },
}

/** The parameter sets `fixtures/stdlib-drawer-door-cabinet.json` was recorded with. */
const CASES: Record<keyof typeof stdlibBuild, Record<string, unknown>> = {
  defaults: {},
  sized: { width: 600, height: 900, depth: 550 },
  materials,
  sizedMaterials: { width: 800, height: 1200, depth: 450, ...materials },
}

const round = (_key: string, value: unknown) =>
  typeof value === "number" ? Math.round(value * 1000) / 1000 : value

/** Each piece's id, role, size, material, edges and placement, plus the diagnostic codes. */
const describeBuild = ({ mat, diagnostics }: TestMaterialization) =>
  JSON.parse(
    JSON.stringify(
      {
        pieces: flattenPieceNodes(mat.root).map((p) => ({
          id: p.id,
          role: p.role,
          piece: p.piece,
          material: p.material.id,
          edges: p.edges,
          transform: p.transform,
        })),
        diagnostics: diagnostics.map((d) => `${d.severity}:${d.code}`).sort(),
      },
      round
    )
  )

describe("drawer-door-cabinet", () => {
  it("builds what the standard catalog's model built, for each recorded parameter set", () => {
    for (const [name, params] of Object.entries(CASES)) {
      const built = describeBuild(testbed.materialize(CABINET, params))
      expect(built, name).toEqual(stdlibBuild[name as keyof typeof stdlibBuild])
    }
  })

  it("takes the active board preset when its material groups are unset", () => {
    const oak = board("oak-25")
    const presets = [
      {
        id: "oak",
        name: "Oak everywhere",
        category: "material",
        parameters: new Map([
          [BOARD_MATERIAL_SLOT, { param: makeBoardParam("Board", "preset.board"), value: oak }],
        ]),
      },
    ] as NonNullable<Parameters<typeof testbed.materialize>[2]>["presets"]
    const { mat } = testbed.materialize(CABINET, {}, { presets })
    const materials = flattenPieceNodes(mat.root).map((p) => p.material.id)
    expect(materials).toEqual(Array(13).fill("oak-25"))
  })
})
