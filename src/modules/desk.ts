import {
  atLeast,
  atMost,
  type BasicPiece,
  type BoardMaterial,
  coerceConfig,
  createDiagnostic,
  createEdgebandApplicationBuilder,
  createJoinBuilderFromParams,
  createPieceAssemblyBuilder,
  defineEnumParam,
  defineSchema,
  type Diagnostic,
  type DiagnosticCause,
  type EdgeTreatment,
  expandParams,
  failedMat,
  getCanonicalProjection,
  type GroupNode,
  type InferResolvedParams,
  isValidDimension,
  JoinSystemApplicationMode,
  makeBoardParam,
  makeEdgeApplicationParam,
  makeEdgebandParam,
  makeGrainParam,
  makeJoinSystemParams,
  minDimension,
  type ModuleDefinition,
  type ModuleLibraryContext,
  paramPathFor,
  PieceFace,
  type PieceNode,
  resolveDefaultedParams,
  resolveJoinSystemParams,
} from "@skymobdev/sdk/authoring"
import { Vector3 } from "three"
import { diagCode, i18nKey } from "../i18n"
import { makeModuleRef } from "../info"

const Constructions = ["TopOverSides", "TopBetweenSides"] as const
const TopGrainOptions = ["LeftRight", "FrontBack"] as const

const deskSchema = (libContext: ModuleLibraryContext) =>
  defineSchema({
    width: {
      type: "number",
      label: "Width (mm)",
      i18nKey: i18nKey("desk.param.width"),
      default: 1200,
      min: 100,
      max: 3000,
      unit: "mm",
      level: "user",
    },
    height: {
      type: "number",
      label: "Height (mm)",
      i18nKey: i18nKey("desk.param.height"),
      default: 750,
      min: 100,
      max: 3500,
      unit: "mm",
      level: "user",
    },
    depth: {
      type: "number",
      label: "Depth (mm)",
      i18nKey: i18nKey("desk.param.depth"),
      default: 600,
      min: 100,
      max: 800,
      unit: "mm",
      level: "user",
    },
    construction: defineEnumParam({
      label: "Construction",
      i18nKey: i18nKey("desk.param.construction"),
      options: Constructions,
      default: "TopOverSides",
      level: "user",
      aiContext:
        "TopOverSides: the top spans the full width and rests on the sides, which stop under it. " +
        "TopBetweenSides: the sides run the full height and the top fits between them.",
    }),
    beamHeight: {
      type: "number",
      label: "Beam Height (mm)",
      i18nKey: i18nKey("desk.param.beamHeight"),
      default: 300,
      min: minDimension("height"),
      unit: "mm",
      level: "user",
      aiContext:
        "Height of the support beam, the vertical panel between the sides right under the top.",
    },
    beamSetback: {
      type: "number",
      label: "Beam Setback (mm)",
      i18nKey: i18nKey("desk.param.beamSetback"),
      default: 0,
      min: 0,
      unit: "mm",
      level: "user",
      aiContext:
        "Distance from the back of the desk to the back face of the support beam; 0 is flush.",
    },
    topBoard: makeBoardParam("Top Board", i18nKey("desk.param.topBoard")),
    topEdges: makeEdgebandParam("Top Edgeband", i18nKey("desk.param.topEdges")),
    topGrainDirection: makeGrainParam(
      TopGrainOptions,
      "Top Grain Direction",
      i18nKey("desk.param.topGrainDirection"),
      "user",
      "topBoard",
      "LeftRight",
      libContext.repository
    ),
    structureBoard: makeBoardParam("Structure Board", i18nKey("desk.param.structureBoard")),
    structureEdges: makeEdgebandParam("Structure Edgeband", i18nKey("desk.param.structureEdges")),
    edgeApplication: makeEdgeApplicationParam(
      "Edge Application",
      i18nKey("desk.param.edgeApplication")
    ),
    ...makeJoinSystemParams(libContext.joinSystems, JoinSystemApplicationMode.Fixed, "advanced"),
  })

type DeskSchema = ReturnType<typeof deskSchema>
type ModuleDef = ModuleDefinition<DeskSchema>
const at = paramPathFor<DeskSchema>()

/**
 * A desk: a top, a left and a right side, and a support beam, a vertical panel between the sides
 * right under the top, set back from the back by `beamSetback`. The top either rests on the sides
 * or fits between them (`construction`). The top has its own board and edgeband; the sides and the
 * beam share the structure's. Frame: X and Z centred, Y = 0 at the floor, the front at +Z.
 */
export class DeskModule implements ModuleDef {
  readonly ref = makeModuleRef("desk")
  readonly name = "Desk"
  readonly description = "A desk: a top on two sides, braced by a support beam under the top."
  readonly aiContext =
    "A free-standing desk sized by width, height and depth. The top rests on the sides or fits " +
    "between them (construction); a support beam of beamHeight sits under the top, beamSetback " +
    "from the back. topBoard/topEdges dress the top, structureBoard/structureEdges the sides and " +
    "the beam."
  readonly tags = ["desk", "table", "standalone"]
  readonly version = "1.0.0"
  readonly schema: DeskSchema
  readonly libContext: ModuleLibraryContext

  constructor(libContext: ModuleLibraryContext) {
    this.schema = deskSchema(libContext)
    this.libContext = libContext
  }

  bindParams: ModuleDef["bindParams"] = (userParams, context) => {
    const diagnostics: Diagnostic[] = []
    const expanded = expandParams(this.schema, userParams, context, diagnostics)
    const resolved: InferResolvedParams<DeskSchema> = {
      ...resolveDefaultedParams(this.schema, expanded),
      ...resolveJoinSystemParams(
        this.libContext.joinSystems,
        expanded,
        "dowel",
        context,
        diagnostics
      ),
    }
    coerceConfig(this.schema, resolved, diagnostics)
    return { resolved, diagnostics }
  }

  materialize: ModuleDef["materialize"] = (params, buildContext) => {
    const { instanceUid } = buildContext
    const diagnostics: Diagnostic[] = []
    const { repository, joinSystems } = this.libContext

    // 1. Materials.
    const topBoard = repository.resolveBoard(params.topBoard)
    const structureBoard = repository.resolveBoard(params.structureBoard)
    const tT = topBoard.thickness
    const tS = structureBoard.thickness

    // 2. Checks that need the boards' thickness. Each names the params that would clear it; a
    // dimension is offered only when its range reaches the value.
    const { width: W, height: H, depth: D, beamHeight, beamSetback } = params
    const topOverSides = params.construction === "TopOverSides"
    const innerWidth = W - 2 * tS
    const underTop = H - tT
    if (!isValidDimension("width", innerWidth)) {
      const min = Math.ceil(2 * tS + minDimension("width"))
      return failedMat(
        this.ref,
        instanceUid,
        diagCode("desk.too_narrow"),
        diagnostics,
        { width: W, min },
        { causes: this.dimensionCauses("width", min) }
      )
    }
    if (!isValidDimension("height", underTop)) {
      const min = Math.ceil(tT + minDimension("height"))
      return failedMat(
        this.ref,
        instanceUid,
        diagCode("desk.too_low"),
        diagnostics,
        { height: H, min },
        { causes: this.dimensionCauses("height", min) }
      )
    }
    if (beamHeight > underTop) {
      const max = Math.floor(underTop)
      return failedMat(
        this.ref,
        instanceUid,
        diagCode("desk.beam_too_tall"),
        diagnostics,
        { beamHeight, space: Math.round(underTop), max },
        {
          causes: [
            { param: at.beamHeight(), feasible: atMost(max) },
            ...this.dimensionCauses("height", Math.ceil(beamHeight + tT)),
          ],
        }
      )
    }
    if (beamSetback + tS > D) {
      const max = Math.floor(D - tS)
      return failedMat(
        this.ref,
        instanceUid,
        diagCode("desk.beam_setback_too_deep"),
        diagnostics,
        { beamSetback, depth: D, max },
        {
          causes: [
            { param: at.beamSetback(), feasible: atMost(max) },
            ...this.dimensionCauses("depth", Math.ceil(beamSetback + tS)),
          ],
        }
      )
    }

    // 3. Pieces. The sides stand with their width running up; the beam lies with its width
    // running left to right.
    const sideHeight = topOverSides ? underTop : H
    const top: BasicPiece = {
      uid: `${instanceUid}-top`,
      width: topOverSides ? W : innerWidth,
      height: D,
      thickness: tT,
      grain: topBoard.grain > 0 ? (params.topGrainDirection === "LeftRight" ? 1 : 2) : 0,
    }
    const structureGrain = structureBoard.grain > 0 ? 1 : 0
    const leftSide: BasicPiece = {
      uid: `${instanceUid}-left-side`,
      width: sideHeight,
      height: D,
      thickness: tS,
      grain: structureGrain,
    }
    const rightSide: BasicPiece = { ...leftSide, uid: `${instanceUid}-right-side` }
    const beam: BasicPiece = {
      uid: `${instanceUid}-beam`,
      width: innerWidth,
      height: beamHeight,
      thickness: tS,
      grain: structureGrain,
    }

    // 4. Positions. The top is added "Y-" and the beam "Z-", so each one's Top face, where a join
    // system puts its cams, faces the inside of the desk: the top's underside, the beam's back.
    const beamFrontFromFront = D - beamSetback - tS
    const assembly = createPieceAssemblyBuilder()
      .add(leftSide, "X+")
      .fixed(new Vector3(-(W - tS) / 2, sideHeight / 2, 0))
      .add(rightSide, "X-")
      .fixed(new Vector3((W - tS) / 2, sideHeight / 2, 0))
      .add(top, "Y-")
      .fixed(new Vector3(0, H - tT / 2, 0))
      .add(beam, "Z-")
      .fixed(new Vector3(0, underTop - beamHeight / 2, D / 2 - beamFrontFromFront - tS / 2))
    const { piecePositions, isConsistent } = assembly.build(diagnostics)
    if (!isConsistent) {
      diagnostics.push(createDiagnostic("bug", diagCode("desk.assembly_inconsistent")))
    }

    // 5. Joins. The top's underside runs left to right (U) and front to back (V); each side's inner
    // face runs front to back (U) and bottom to top (V).
    const joinBuilder = createJoinBuilderFromParams(joinSystems, params, diagnostics)
    if (joinBuilder) {
      const underside = getCanonicalProjection(top, "top-side").surface
      const leftFace = getCanonicalProjection(leftSide, "left-side").surface
      const rightFace = getCanonicalProjection(rightSide, "right-side").surface
      if (topOverSides) {
        // A side's top edge runs front to back, its thickness from the outside in: on the
        // underside turned to run front to back, the left side takes the strip at the left end,
        // the right side the strip at the right end, read from right to left.
        joinBuilder
          .add(leftSide, PieceFace.West, underside.swapAxes(), "down")
          .add(rightSide, PieceFace.East, underside.swapAxes(), "up")
      } else {
        // The top's ends run front to back and its thickness from the underside up; "up" takes
        // the strip at the top of each side with its V turned downward. "Y-" puts the top's East
        // face on the left.
        joinBuilder
          .add(top, PieceFace.East, leftFace, "up")
          .add(top, PieceFace.West, rightFace, "up")
      }
      // The beam's ends run from its top edge down, and its thickness from front to back: each
      // side's face turned to that frame, cut to the beam's span and to its front face.
      const beamStrip = (sideFace: typeof leftFace) =>
        sideFace
          .swapAxes()
          .setOrigin(1)
          .restrict({
            left: sideHeight - underTop,
            right: underTop - beamHeight,
            bottom: beamFrontFromFront,
          })
      // The beam's top edge runs left to right, its thickness from front to back.
      const sideOverhang = topOverSides ? tS : 0
      joinBuilder
        .add(beam, PieceFace.West, beamStrip(leftFace), "down")
        .add(beam, PieceFace.East, beamStrip(rightFace), "down")
        .add(
          beam,
          PieceFace.South,
          underside.restrict({
            left: sideOverhang,
            right: sideOverhang,
            bottom: beamFrontFromFront,
          }),
          "down"
        )
    }
    const work = (joinBuilder?.build(diagnostics) ?? []).map((join) => join.workNode)

    // 6. Edgeband. "Y-" turns the top over: South is its front edge and East its left end. On the
    // left side ("X+") West is the top edge; on the right side ("X-") East is. On the beam ("Z-")
    // South is the top edge.
    const topApplications = createEdgebandApplicationBuilder()
      .addPiece(top, [
        { face: PieceFace.South, enablingMode: "Visible" },
        { face: PieceFace.North, enablingMode: "PotentiallyVisible" },
        {
          face: [PieceFace.East, PieceFace.West],
          enablingMode: topOverSides ? "Visible" : "AllSides",
        },
      ])
      .build(params.edgeApplication, repository.resolveEdge(params.topEdges))
    const sideTopEdge = topOverSides ? "AllSides" : "Visible"
    const structureApplications = createEdgebandApplicationBuilder()
      .addPiece(leftSide, [
        { face: PieceFace.South, enablingMode: "Visible" },
        { face: PieceFace.North, enablingMode: "PotentiallyVisible" },
        { face: PieceFace.West, enablingMode: sideTopEdge },
        { face: PieceFace.East, enablingMode: "Uncovered" },
      ])
      .addPiece(rightSide, [
        { face: PieceFace.South, enablingMode: "Visible" },
        { face: PieceFace.North, enablingMode: "PotentiallyVisible" },
        { face: PieceFace.East, enablingMode: sideTopEdge },
        { face: PieceFace.West, enablingMode: "Uncovered" },
      ])
      .addPiece(beam, [
        { face: PieceFace.North, enablingMode: "PotentiallyVisible" },
        { face: [PieceFace.South, PieceFace.East, PieceFace.West], enablingMode: "AllSides" },
      ])
      .build(params.edgeApplication, repository.resolveEdge(params.structureEdges))
    const edgesOf = (piece: BasicPiece): EdgeTreatment[] =>
      [...topApplications, ...structureApplications]
        .filter((application) => application.piece === piece)
        .flatMap((application) => application.treatments)

    // 7. Nodes and result.
    const node = (piece: BasicPiece, material: BoardMaterial, role: string): PieceNode => ({
      id: `${piece.uid}-node`,
      type: "piece",
      piece,
      material,
      edges: edgesOf(piece),
      transform: piecePositions[piece.uid],
      role,
    })
    const group: GroupNode = {
      id: `${instanceUid}-group`,
      type: "group",
      children: [
        node(top, topBoard, i18nKey("piece.desk-top")),
        node(leftSide, structureBoard, i18nKey("piece.desk-side")),
        node(rightSide, structureBoard, i18nKey("piece.desk-side")),
        node(beam, structureBoard, i18nKey("piece.desk-beam")),
      ],
    }
    return {
      root: { type: "module", id: `${instanceUid}-desk`, moduleRef: this.ref, group, work },
      work,
      slots: {},
      diagnostics,
    }
  }

  /** `{ param, feasible: atLeast(min) }` for a size param whose range reaches `min`; none otherwise. */
  private dimensionCauses = (
    param: "width" | "height" | "depth",
    min: number
  ): DiagnosticCause[] =>
    min <= this.schema[param].max ? [{ param: at[param](), feasible: atLeast(min) }] : []
}
