import { mockRepository } from "@skymobdev/cad-mock"
import {
  initSurfaceProjection,
  type MaterializationResult,
  type PieceFace,
  type PieceNode,
  transform3DToMatrix,
} from "@skymobdev/sdk/authoring"
import {
  baseOracle,
  composeOracles,
  createModuleTestbed,
  deepCollisionOracle,
  flattenPieceNodes,
  fuzzModule,
  loadStandardCatalog,
  type Oracle,
} from "@skymobdev/sdk/testing"
import { Box3, Vector2, Vector3 } from "three"
import { describe, expect, it } from "vitest"
import { libMain, makeModuleRef } from "../src"

const standard = loadStandardCatalog()
const testbed = createModuleTestbed({
  repository: mockRepository,
  hardware: standard.hardwareMain ? [standard.hardwareMain] : [],
  joins: standard.joinMain ? [standard.joinMain] : [],
  rules: standard.rulesMain ? [standard.rulesMain] : [],
  libraries: [...(standard.libMain ? [standard.libMain] : []), libMain],
})
const DESK = makeModuleRef("desk")

const board = (id: string) => ({ isRef: true, refKind: "board", id })
/** A 25 mm top on 18 mm sides and beam. */
const materials = { topBoard: board("oak-25"), structureBoard: board("mdf-18") }

const PIECES = ["top", "left-side", "right-side", "beam"] as const
type PieceName = (typeof PIECES)[number]

const pieceNamed = (mat: MaterializationResult, name: PieceName): PieceNode => {
  const node = flattenPieceNodes(mat.root).find((n) => n.piece.uid.endsWith(`-${name}`))
  if (!node) throw new Error(`no ${name} piece`)
  return node
}

/** The piece's box in the desk's frame: X left to right, Y up from the floor, Z toward the front. */
const worldBox = ({ piece, transform }: PieceNode) => {
  const matrix = transform3DToMatrix(transform)
  const corners = [-1, 1].flatMap((x) =>
    [-1, 1].flatMap((y) =>
      [-1, 1].map((z) =>
        new Vector3((x * piece.width) / 2, (y * piece.thickness) / 2, (z * piece.height) / 2)
          .applyMatrix4(matrix)
      )
    )
  )
  const box = new Box3().setFromPoints(corners)
  return [...box.min.toArray(), ...box.max.toArray()].map((v) => Math.round(v * 1000) / 1000 + 0)
}

/** Each hole's entry point and drilling normal in the desk's frame, and the piece it is in. */
const placedHoles = (mat: MaterializationResult) => {
  const nodes = new Map(flattenPieceNodes(mat.root).map((n) => [n.piece.uid, n]))
  return mat.work.flatMap((work) => {
    if (work.type !== "hole") return []
    const node = nodes.get(work.pieceId)
    if (!node) throw new Error(`hole on unknown piece ${work.pieceId}`)
    const surface = initSurfaceProjection(node.piece, work.face as PieceFace)
    const matrix = transform3DToMatrix(node.transform)
    const entry = surface
      .toPiecePosition(new Vector2(work.position.x, work.position.y))
      .position.clone()
      .applyMatrix4(matrix)
    const normal = surface.normal().clone().transformDirection(matrix)
    const name = PIECES.find((p) => work.pieceId.endsWith(`-${p}`))
    return [{ group: work.matchingGroup, name, entry, normal }]
  })
}

/** What `skymob-lib check` accepts: no pieces is fine when an error says why. */
const declinesWithError: Oracle = (input) =>
  baseOracle(input).filter(
    (v) => v.kind !== "empty-tree" || !input.diagnostics.some((d) => d.severity === "error")
  )

const errorOf = (params: Record<string, unknown>) =>
  testbed.materialize(DESK, params).diagnostics.find((d) => d.severity === "error")

describe("desk", () => {
  it("builds a top, two sides and a beam with its default params", () => {
    const { mat, diagnostics } = testbed.materialize(DESK, {})
    expect(baseOracle({ mat, diagnostics })).toEqual([])
    expect(diagnostics).toEqual([])
    expect(flattenPieceNodes(mat.root).map((n) => n.role)).toEqual([
      "piece.desk-top",
      "piece.desk-side",
      "piece.desk-side",
      "piece.desk-beam",
    ])
  })

  // 1200 × 750 × 600, a 300 mm beam set 40 mm in from the back.
  it.each([
    {
      construction: "TopOverSides",
      boxes: {
        top: [-600, 725, -300, 600, 750, 300],
        "left-side": [-600, 0, -300, -582, 725, 300],
        "right-side": [582, 0, -300, 600, 725, 300],
        beam: [-582, 425, -260, 582, 725, -242],
      },
    },
    {
      construction: "TopBetweenSides",
      boxes: {
        top: [-582, 725, -300, 582, 750, 300],
        "left-side": [-600, 0, -300, -582, 750, 300],
        "right-side": [582, 0, -300, 600, 750, 300],
        beam: [-582, 425, -260, 582, 725, -242],
      },
    },
  ])("places every piece for $construction", ({ construction, boxes }) => {
    const { mat, diagnostics } = testbed.materialize(DESK, {
      ...materials, construction, beamSetback: 40,
    })
    expect(diagnostics).toEqual([])
    expect(Object.fromEntries(PIECES.map((name) => [name, worldBox(pieceNamed(mat, name))]))).toEqual(boxes)
  })

  // A mirrored covering frame puts one hole of a pair at the far end of the joint, or off the
  // centre of the board: each pair's entry points then no longer meet.
  it.each([
    ["dowel", "TopOverSides"],
    ["dowel", "TopBetweenSides"],
    ["minifix", "TopOverSides"],
    ["minifix", "TopBetweenSides"],
  ])("lines up every %s hole pair across the five joints (%s)", (joinSystem, construction) => {
    const { mat, diagnostics } = testbed.materialize(DESK, {
      ...materials, joinSystem, construction, beamSetback: 40,
    })
    expect(diagnostics).toEqual([])
    const groups = new Map<string | undefined, ReturnType<typeof placedHoles>>()
    for (const hole of placedHoles(mat)) {
      groups.set(hole.group, [...(groups.get(hole.group) ?? []), hole])
    }
    const joints = new Set<string>()
    for (const [group, holes] of groups) {
      const gaps = holes.flatMap((a) =>
        holes.filter((b) => a.normal.dot(b.normal) < -0.99).map((b) => a.entry.distanceTo(b.entry))
      )
      expect(gaps.length, `${group} has no opposed pair`).toBeGreaterThan(0)
      expect(Math.max(...gaps), `${group} pair apart`).toBeCloseTo(0, 6)
      joints.add([...new Set(holes.map((hole) => hole.name))].sort().join("+"))
    }
    expect([...joints].sort()).toEqual([
      "beam+left-side",
      "beam+right-side",
      "beam+top",
      "left-side+top",
      "right-side+top",
    ])
  })

  // Holes and cams go on the top's underside, the sides' inner faces and the beam's back.
  it.each(
    ["dowel", "minifix", "vb", "dfix"].flatMap((joinSystem) =>
      ["TopOverSides", "TopBetweenSides"].map((construction) => [joinSystem, construction])
    )
  )("drills no outer face with %s (%s)", (joinSystem, construction) => {
    const { mat } = testbed.materialize(DESK, { ...materials, joinSystem, construction })
    const holes = placedHoles(mat)
    expect(holes.length).toBeGreaterThan(0)
    const outward: Record<PieceName, Vector3> = {
      top: new Vector3(0, 1, 0),
      "left-side": new Vector3(-1, 0, 0),
      "right-side": new Vector3(1, 0, 0),
      beam: new Vector3(0, 0, 1),
    }
    const onOuterFaces = holes.filter(({ name, normal }) => name && normal.dot(outward[name]) > 0.99)
    expect(onOuterFaces).toEqual([])
  })

  it("refuses a beam taller than the space under the top, naming the beam and the height", () => {
    const error = errorOf({ ...materials, beamHeight: 800 })
    expect(error).toMatchObject({
      code: "desk.beam_too_tall",
      params: { beamHeight: 800, space: 725, max: 725 },
    })
    expect(error?.causes).toMatchObject([{ param: ["beamHeight"] }, { param: ["height"] }])
  })

  it("refuses a setback that pushes the beam out the front, naming the setback and the depth", () => {
    const error = errorOf({ ...materials, beamSetback: 590 })
    expect(error).toMatchObject({
      code: "desk.beam_setback_too_deep",
      params: { beamSetback: 590, depth: 600, max: 582 },
    })
    expect(error?.causes).toMatchObject([{ param: ["beamSetback"] }, { param: ["depth"] }])
  })

  it("offers a larger depth only when the depth range reaches it", () => {
    const error = errorOf({ ...materials, depth: 800, beamSetback: 790 })
    expect(error?.code).toBe("desk.beam_setback_too_deep")
    expect(error?.causes).toMatchObject([{ param: ["beamSetback"] }])
  })

  it("holds up under fuzzing, with no pieces running into each other", () => {
    const run = fuzzModule(testbed, DESK, {
      baseline: {},
      seed: 1,
      numRuns: 200,
      oracle: composeOracles(declinesWithError, deepCollisionOracle),
    })
    expect(run.violations ?? [], JSON.stringify(run.counterexample)).toEqual([])
  })
})
