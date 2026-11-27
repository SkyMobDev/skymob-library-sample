---
name: skymob-base-module
description: >
  Write a base module for a SkyMob module library: a ModuleDefinition whose
  schema, bindParams and materialize cut pieces, position them, join and
  edgeband them, report diagnostics and, for a host such as a cabinet, offer a
  slot to child modules. Use when adding or changing a module that builds its
  own pieces. To combine existing modules instead, use skymob-composite.
argument-hint: <module-name>
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# SkyMob base module

A base module implements `ModuleDefinition<TSchema>` itself:

- `schema`: the params a user, or a parent module, sets.
- `bindParams(userParams, context)`: the user's values become a full set of resolved params, plus
  diagnostics.
- `materialize(params, buildContext)`: resolved params become pieces with positions, edgeband,
  machining work, slots for child modules, and diagnostics.

The argument is the module id, in kebab-case (`fixed-shelf`).

## Where the API is

- `node_modules/@skymobdev/sdk/dist/authoring.d.ts` declares every name library code may use, with
  doc comments. Look up each name and its signature there before using it:
  `grep -n "createJoinBuilderFromParams" node_modules/@skymobdev/sdk/dist/authoring.d.ts`.
  Builders such as `JoinBuilder` are declared but not exported; read their methods with
  `grep -n -A20 "declare interface JoinBuilder"`.
- `node_modules/@skymobdev/sdk/dist/testing.d.ts` is the testing kit.
- Library code imports only `@skymobdev/sdk/authoring` and `three`. Tests also import
  `@skymobdev/sdk/testing`, `@skymobdev/cad-mock` and `vitest`.

## 1. Settle these first

Ask the user, as a bullet list, whatever the request leaves open:

- **Child or top-level.** A child fills a space a host gives it (`buildContext.supportingContext`):
  its size comes from `volume.bounds`, it adds its pieces to the host's assembly and attaches to
  the host's support surfaces. A top-level module sizes itself from its own params and owns its
  assembly.
- **Pieces**: each one, its board, and which exist only for some param values.
- **Slots**: does it host child modules (a cabinet does, a shelf does not)?
- **Joins**: which edges join to what; fixed (`JoinSystemApplicationMode.Fixed`) or moveable
  (`JoinSystemApplicationMode.Moveable`, for adjustable shelves).
- **Materials**: one board or edgeband param per material a user picks separately.
- **Refusals**: the configurations it cannot build, and the param that fixes each.
- **Shapes and machining**: non-rectangular pieces, grooves, holes, hardware.

A module that only arranges existing modules is a composite (skymob-composite). The standard
catalog's modules are reachable at run time (section 11), not importable.

## 2. Files

| file | change |
|---|---|
| `src/modules/<name>.ts` | the module (section 3) |
| `src/main.ts` | `new <Name>Module(context)` in the `modules` array of `libMain` |
| `src/i18n/en.ts`, `pt.ts` | module, params, enum options, piece labels, diagnostic messages (section 12) |
| `test/<name>.spec.ts` | tests (section 13) |

`src/info.ts` exports `LIBRARY_ID` and `makeModuleRef(moduleId)`, which returns
`{ libraryId: LIBRARY_ID, moduleId }`; every module's `ref` comes from it. `libMain` derives the
module list and `getDefinition` from the `modules` array, so that one line registers the module:

```ts
const modules: ModuleDefinition[] = [new FixedShelfModule(context), new OpenBoxModule(context)]
```

A build that produces nothing returns `failedMat` from `@skymobdev/sdk/authoring`:

```ts
failedMat(moduleRef, instanceUid, code, diagnostics, params?, { severity?, causes? }?)
```

With a `code`, it adds that diagnostic (an `error` unless `severity` says otherwise; `"bug"` for a
fault in your code) and returns an error box in place of the module, so it stays selectable in
the scene. `causes` names the settings that would let it build (section 6).

With `undefined` as the code, the module is empty on purpose for these settings (a shelf with no
sections): it returns an empty module whose root has `empty: true`, and adds no diagnostic. A
module that builds only empty space, such as an open cell, sets `empty: true` on its own root.

## 3. A complete child module

A shelf fixed at a height in its host's opening, joined to the host's side panels. With no host
it still builds, positioned in the opening's own frame. Its translations are in section 12.

```ts
import {
  atMost, type BasicPiece, coerceConfig, createDiagnostic, createEdgebandApplicationBuilder,
  createJoinBuilderFromParams, defineSchema, type Diagnostic, expandParams, failedMat,
  type GroupNode, type InferResolvedParams, initSurfaceProjection, isBoxSupportingContext,
  isValidDimension,
  JoinSystemApplicationMode, makeBoardParam, makeEdgeApplicationParam, makeEdgebandParam,
  makeGrainParam, makeJoinSystemParams, minDimension, type ModuleDefinition,
  type ModuleLibraryContext, paramPathFor, PieceFace, type PieceNode, resolveDefaultedParams,
  resolveJoinSystemParams,
} from "@skymobdev/sdk/authoring"
import { Vector2, Vector3 } from "three"
import { diagCode, i18nKey } from "../i18n"
import { makeModuleRef } from "../info"

const GrainOptions = ["LeftRight", "FrontBack"] as const

const fixedShelfSchema = (libContext: ModuleLibraryContext) =>
  defineSchema({
    elevation: {
      type: "number", label: "Elevation (mm)", i18nKey: i18nKey("fixed-shelf.param.elevation"),
      default: 300, min: 0, max: 3000, unit: "mm", level: "user",
    },
    setback: {
      type: "number", label: "Setback (mm)", i18nKey: i18nKey("fixed-shelf.param.setback"),
      default: 0, min: 0, max: 200, unit: "mm", level: "advanced",
    },
    board: makeBoardParam("Board", i18nKey("fixed-shelf.param.board")),
    edges: makeEdgebandParam("Edgeband", i18nKey("fixed-shelf.param.edges")),
    edgeApplication: makeEdgeApplicationParam(
      "Edge Application", i18nKey("fixed-shelf.param.edgeApplication")
    ),
    grainDirection: makeGrainParam(
      GrainOptions, "Grain Direction", i18nKey("fixed-shelf.param.grainDirection"),
      "user", "board", "LeftRight", libContext.repository
    ),
    ...makeJoinSystemParams(libContext.joinSystems, JoinSystemApplicationMode.Fixed, "advanced"),
  })

type FixedShelfSchema = ReturnType<typeof fixedShelfSchema>
type ModuleDef = ModuleDefinition<FixedShelfSchema>
const at = paramPathFor<FixedShelfSchema>()

export class FixedShelfModule implements ModuleDef {
  readonly ref = makeModuleRef("fixed-shelf")
  readonly name = "Fixed Shelf"
  readonly tags = ["shelf", "interior"]
  readonly version = "1.0.0"
  readonly schema: FixedShelfSchema
  readonly libContext: ModuleLibraryContext

  constructor(libContext: ModuleLibraryContext) {
    this.schema = fixedShelfSchema(libContext)
    this.libContext = libContext
  }

  bindParams: ModuleDef["bindParams"] = (userParams, context) => {
    const diagnostics: Diagnostic[] = []
    const expanded = expandParams(this.schema, userParams, context, diagnostics)
    const { joinSystems } = this.libContext
    const resolved: InferResolvedParams<FixedShelfSchema> = {
      ...resolveDefaultedParams(this.schema, expanded),
      ...resolveJoinSystemParams(joinSystems, expanded, "dowel", context, diagnostics),
    }
    coerceConfig(this.schema, resolved, diagnostics)
    return { resolved, diagnostics }
  }

  materialize: ModuleDef["materialize"] = (params, buildContext) => {
    const { instanceUid, supportingContext } = buildContext
    const diagnostics: Diagnostic[] = []

    // 1. The space to fill.
    if (!isBoxSupportingContext(supportingContext)) {
      return failedMat(this.ref, instanceUid, diagCode("fixed-shelf.no_box_volume"), diagnostics)
    }
    const { x: width, y: height, z: depth } = supportingContext.volume.bounds
    if (!isValidDimension("width", width) || !isValidDimension("depth", depth)) {
      const size = { width: Math.round(width), depth: Math.round(depth) }
      return failedMat(this.ref, instanceUid, diagCode("fixed-shelf.opening_too_small"), diagnostics, size)
    }

    // 2. Materials.
    const board = this.libContext.repository.resolveBoard(params.board)
    const edge = this.libContext.repository.resolveEdge(params.edges)
    const t = board.thickness

    // 3. Checks that need the opening. Each names the param that would fix it.
    const { elevation, setback } = params
    if (elevation + t > height) {
      const max = Math.floor(height - t)
      return failedMat(
        this.ref, instanceUid, diagCode("fixed-shelf.elevation_too_high"), diagnostics,
        { elevation, height: Math.round(height), max },
        { causes: [{ param: at.elevation(), feasible: atMost(max) }] }
      )
    }
    if (!isValidDimension("depth", depth - setback)) {
      return failedMat(
        this.ref, instanceUid, diagCode("fixed-shelf.setback_too_deep"), diagnostics,
        { setback, depth: Math.round(depth) },
        { causes: [{ param: at.setback(), feasible: atMost(depth - minDimension("depth")) }] }
      )
    }

    // 4. Pieces: width along X, height from front to back, thickness = the board.
    const shelf: BasicPiece = {
      uid: `${instanceUid}-shelf`,
      width,
      height: depth - setback,
      thickness: t,
      grain: board.grain > 0 ? (params.grainDirection === "LeftRight" ? 1 : 2) : 0,
    }

    // 5. Position. In a host, put the shelf's front-bottom-left corner on the left
    // side's inner face; with no host, fix it in the opening's own frame.
    const assembly = supportingContext.assembly.scoped(instanceUid)
    const leftSide = supportingContext.structure.get("left-side")?.surface
    const rightSide = supportingContext.structure.get("right-side")?.surface
    assembly.add(shelf, "Y+")
    if (leftSide) {
      assembly.join(
        leftSide, new Vector2(setback, elevation),
        initSurfaceProjection(shelf, PieceFace.West), new Vector2(0, 0)
      )
    } else {
      assembly.fixed(new Vector3(0, elevation + t / 2, -setback / 2))
    }

    // 6. Joins to the host's sides. The covering face must be exactly as wide as
    // the shelf's end and at least as tall; "down" uses its lowest t mm.
    const joinBuilder = createJoinBuilderFromParams(this.libContext.joinSystems, params, diagnostics)
    const strip = { left: setback, bottom: elevation }
    if (joinBuilder && leftSide) {
      joinBuilder.add(shelf, PieceFace.West, leftSide.restrict(strip), "down")
    }
    if (joinBuilder && rightSide) {
      joinBuilder.add(shelf, PieceFace.East, rightSide.restrict(strip), "down")
    }

    // 7. Solve positions, once.
    const { piecePositions, inconsistentScopes } = assembly.build(diagnostics)
    if (inconsistentScopes.has(instanceUid)) {
      diagnostics.push(createDiagnostic("bug", diagCode("fixed-shelf.assembly_inconsistent")))
    }

    // 8. Edgeband. On a "Y+" piece South is the front edge and North the back.
    const edgeApplications = createEdgebandApplicationBuilder()
      .addPiece(shelf, [
        { face: PieceFace.South, enablingMode: "Visible" },
        { face: PieceFace.North, enablingMode: "Uncovered" },
        { face: [PieceFace.East, PieceFace.West], enablingMode: "AllSides" },
      ])
      .build(params.edgeApplication, edge)

    // 9. Nodes and result.
    const work = (joinBuilder?.build(diagnostics) ?? []).map((join) => join.workNode)
    const shelfNode: PieceNode = {
      id: `${shelf.uid}-node`, type: "piece", piece: shelf, material: board,
      edges: edgeApplications.flatMap((application) => application.treatments),
      transform: piecePositions[shelf.uid],
      role: i18nKey("piece.fixed-shelf"),
    }
    const group: GroupNode = { id: `${instanceUid}-group`, type: "group", children: [shelfNode] }
    return {
      root: { type: "module", id: `${instanceUid}-fixed-shelf`, moduleRef: this.ref, group, work },
      work,
      slots: {},
      diagnostics,
    }
  }
}
```

The schema is a function of `libContext`, which carries the join systems, hardware, board
repository and global rules. `bindParams` and `materialize` are arrow-function properties, so
`this` is the instance. An unset board or edgeband param resolves to a missing material (a 16 mm
board drawn as a checkerboard), and the module still builds.

## 4. Schema

| kind | written as | resolves to |
|---|---|---|
| number | `{ type: "number", label, i18nKey, default, min?, max?, unit?, level? }` | `number` |
| boolean | `{ type: "boolean", label, i18nKey, default }` | `boolean` |
| string | `{ type: "string", label, i18nKey, default }` | `string` |
| enum | `defineEnumParam({ label, i18nKey, options: [...] as const, default })` | one option |
| board | `makeBoardParam(label, i18nKey, { min?, max? }?)`, a thickness range | board ref |
| edgeband | `makeEdgebandParam(label, i18nKey)` | edgeband ref |
| edge application | `makeEdgeApplicationParam(label, i18nKey)`, default `"Visible"` | `"AllSides"` … `"None"` |
| grain | `makeGrainParam(options, label, i18nKey, level, boardKey, default, repository)` | one option; shown only when the board has grain |
| join system | `...makeJoinSystemParams(joinSystems, mode, level)` | `joinSystem` and `joinSystemParams` |
| hardware | `...makeHardwareCascadeParam(category, label, i18nKeyPrefix, selectorKey, libContext, level?)` | selector and params; resolve with `resolveHardwareCascadeParam` |
| nested | `{ type: "nested", label, i18nKey, schema: defineSchema({...}) }` | an object |
| array | `{ type: "array", label, i18nKey, element: <param>, minLength?, maxLength? }` | an array |

- `level`: `"user"` always shown, `"advanced"` and `"expert"` shown in those modes, `"internal"`
  never shown (set by a parent module or a composite).
- `aiContext` on any param: what it controls and how to set it, for an AI editing the design.
- `conditionalDisplay` hides a param unless another one matches:
  `conditionalDisplay: { otherParamKey: "mode", whenMatched: (value) => value === "milled" }`.
- A range the global rules can override (`libContext.rules`, supplied by `rulesMain` exports):
  `...libContext.rules.getParamValue<RangeRule>("fixed-shelf.elevation", undefined)` inside the
  param spreads the rule's `min`/`max` over yours when one is set.
- A child that should also preview at a sensible size without a host can take internal
  `standalone`, `standaloneWidth`, … params and use them instead of `volume.bounds` when
  `standalone` is true; a composite then excludes them and sets `standalone: false`.

## 5. bindParams

1. `expandParams(schema, userParams, context, diagnostics)` applies presets and formulas.
2. `resolveDefaultedParams(schema, expanded)` fills every param that has a `default`, and board,
   edgeband and hardware params. It skips nested and array params, and `tsc` reports a nested key
   you forget to add:
   ```ts
   frame: resolveDefaultedParams(this.schema.frame.schema, expanded.frame ?? {}),
   heights: expanded.heights ?? [300],
   ```
3. `resolveJoinSystemParams(joinSystems, expanded, defaultKind, context, diagnostics)` resolves the
   join pair; `defaultKind` applies while the user has not chosen. The standard catalog's fixed
   kinds are `dowel`, `minifix`, `vb` and `dfix`.
4. `coerceConfig(schema, resolved, diagnostics)` clamps numbers to `min`/`max` and replaces invalid
   enum values, with warnings (`param.clamped_min`, `param.clamped_max`, `param.enum_invalid`).
5. Checks that the params alone decide (one param against another) go here. Checks that need the
   host's space or the board's thickness go in `materialize`.

## 6. Diagnostics

`createDiagnostic(severity, code, params?, { causes?, details? })`.

| severity | meaning |
|---|---|
| `info` | a fact; nothing to do |
| `warning` | a value was adjusted (clamped, substituted) and the module still built |
| `error` | this configuration cannot be built as asked; the user must change something |
| `bug` | the module built something wrong for a valid configuration; `check` fails on it |

- The code is a key of the library's message table (section 12); `{name}` in the message reads
  `params.name`. Without a message the designer shows the bare code. `diagCode("…")` makes a
  missing message a type error.
- `causes` name the settings that would clear it: `{ param: at.elevation(), feasible: atMost(552) }`.
  `paramPathFor<XSchema>()` writes the paths (`at.frame.top()` reaches into nested params).
  Several causes are alternatives: changing any one of them clears it. `feasible` takes
  `between(min, max)`, `atLeast(min)`, `atMost(max)` or `discrete([...])`.
- An error or warning names its causes unless nothing in this module would clear it, as when the
  host gives no box-shaped space.
- When pieces still make sense, build them and report. Join systems do this: a board too thin for
  the dowel gives `dowel.covering_too_thin` and the pieces still build. When nothing sensible can
  be built, return `failedMat(...)`.
- `skymob-lib check` requires every build to have pieces, or a root flagged `empty: true`. Under
  fuzzing, a build with neither passes only if it reports an `error`.

## 7. materialize rules

- `const diagnostics: Diagnostic[] = []` first, passed to every call that takes it.
- Piece uids are `${instanceUid}-<name>`. A host can hold several instances of the module in one
  assembly, and uids made without `instanceUid` collide.
- A piece that exists only sometimes is `BasicPiece | undefined`, guarded at every use. Create it
  only when `isValidDimension` holds for each of its sizes: `check` fails a piece below
  `minDimension` (`degenerate-geometry`).
- A child adds to `supportingContext.assembly.scoped(instanceUid)` and checks
  `inconsistentScopes.has(instanceUid)`; a sibling's bad geometry in the shared assembly then
  stays the sibling's. A top-level module uses `createPieceAssemblyBuilder()` and `isConsistent`.
- Each piece gets `fixed(position)` right after its `add()`, or a `join()` / `joinAtOrigins()`
  constraint (which may come later). Call `build(diagnostics)` once, after every piece is added.
- `fixed()` places the piece's centre in the assembly's frame. Inside a host that frame is the
  host's, so a child positions against the host's support surfaces and uses `fixed()` only when
  the host provides none.
- Return `{ root, work, slots, diagnostics }`; `root.work` and `work` hold the same list.
- A module is a pure function of its params and build context: no clocks, randomness or state
  kept between calls.

## 8. Geometry

Room axes: X runs left to right, Y up, Z toward the viewer (the front is +Z). Sizes are mm.

A piece's own frame: X = `width` (West face at −X, East at +X), Y = `thickness` (Top at +Y,
Bottom at −Y), Z = `height` (South at +Z, North at −Z). `grain` is 0 (none), 1 (along width) or 2
(along height).

`assembly.add(piece, normal, twist?)` turns the piece so its Top face points along `normal` (a
`CommonNormals` string or a `Vector3`); `twist` is radians about that normal. With no twist:

| normal | Top face points | West → East runs | South edge is at | typical piece |
|---|---|---|---|---|
| `"Y+"` | up | left → right | front | bottom panel, shelf |
| `"Y-"` | down | right → left | front | top panel |
| `"X+"` | right | top → bottom | front | left side |
| `"X-"` | left | bottom → top | front | right side |
| `"Z+"` | front | left → right | bottom | back panel |
| `"Z-"` | back | left → right | top | a panel facing into the module from the front |

A surface projection is a 2D frame (U, V) on one face. `initSurfaceProjection(piece, face)`:

| face | U | V | origin |
|---|---|---|---|
| Top, Bottom | West → East (`width`) | South → North (`height`) | West-South corner |
| North, South | West → East (`width`) | Bottom → Top (`thickness`) | West-Bottom corner |
| East, West | South → North (`height`) | Bottom → Top (`thickness`) | South-Bottom corner |

Each method returns a new projection: `restrict(margins, enableOutOfBounds?)` (`left`/`right` trim
U, `bottom`/`top` trim V), `size()`, `swapAxes()`, `setOrigin(i)` (1 = bottom-right, 2 =
top-right, 3 = top-left become the new origin; 0 changes nothing).

A host's support surfaces, `supportingContext.structure.get(kind)?.surface`, all describe the
space the child fills:

| kind | face | U | V | size |
|---|---|---|---|---|
| `left-side`, `right-side` | the sides' inner faces | front → back | bottom → top | depth × height |
| `bottom-side`, `top-side` | the inner faces of bottom and top | left → right | front → back | width × depth |

The left and right frames mirror each other, so one `(u, v)` is the same spot on both sides.
`*-edge` kinds are front edges, `*-external` kinds outer faces; `back-side` and `front-side`
exist when the host provides them.

With no host (`skymob-lib check`, the testbed, the workbench, a module placed on its own in the
designer), a module receives a free context: a box volume whose size depends on the caller (about
3.2 × 3.7 × 0.9 m in the testbed), an empty `structure` and one `front-open-area`. Fix pieces in a
frame of your choosing; the standard catalog's cabinet centres X and Z and puts Y = 0 at its
underside.

## 9. Joins

```ts
const joinBuilder = createJoinBuilderFromParams(this.libContext.joinSystems, params, diagnostics)
joinBuilder?.add(piece, PieceFace.West, coveringSurface, "down")
const work = (joinBuilder?.build(diagnostics) ?? []).map((join) => join.workNode)
```

- The builder is `undefined` when the user chose `"None"`.
- `piece` and its edge face (North, South, East or West) are the covered element: the edge that
  butts against `coveringSurface`. The covering surface is a host's support surface, or
  `initSurfaceProjection` / `getCanonicalProjection` on one of your own pieces.
- The covering surface's U size must equal the edge's U size, and its V size must be at least
  the edge's thickness. Restrict it along U to the edge's length. On a mismatch `build` reports
  the `bug` `module.unable_to_place_pieces`, with `pieceUid`, `face`, `coveredSize` and
  `coveringSize` in `details`.
- `"down"` joins on the covering face's lowest strip (V from 0). `"up"` joins on its highest
  strip, with that strip's frame turned (origin top-left, V downward), which matches a piece added
  upside down, like a top panel added `"Y-"`.
- The covering face's U and V must run the same way as the edge face's. A size mismatch is
  reported; a reversed direction is not, and the holes come out mirrored. Read both frames off
  the tables in section 8, and check the result in a test or the workbench.
- Join systems report their own problems, such as `dowel.covering_too_thin`. When the join pair
  is not at the top of your schema, pass its path as the last argument (`basePath`) of
  `resolveJoinSystemParams` and `createJoinBuilderFromParams`.
- For an edge of a shaped piece, build the covered element yourself and call
  `joinBuilder.addJoin(covered, coveringSurface, extremety)`; grep `makeShapedEdgeCovered` and
  `restrictJoinCovered`.

## 10. Edgeband, shapes, machining

**Edgeband.** `createEdgebandApplicationBuilder().addPiece(pieces, targets).build(mode, material)`.
A target `{ face, enablingMode }` is banded when the user's `edgeApplication` is at least as
broad as its `enablingMode`: `"AllSides"` bands every target, `"Uncovered"` the `Uncovered`,
`PotentiallyVisible` and `Visible` ones, `"PotentiallyVisible"` the last two, `"Visible"` only
`Visible` targets, `"None"` nothing. A shelf takes front `Visible`, back `Uncovered`, ends
`AllSides`. Use one builder per edgeband material and pick a piece's treatments with
`applications.filter((a) => a.piece === piece)`. `build` takes an optional profile: `"flat"`,
`"rounded"`, `"chamfered"` or `"bullnose"`.

**Piece nodes.** `{ id, type: "piece", piece, material, edges, transform, role }`. `role` is the
i18n key of a part label (`piece.<name>`), used on cut lists and labels.

**Shaped pieces.** `piece.shape = { outline, holes? }`, each a `Path2D`
(`{ closed: true, segments }`) of `lineSeg(x, y)` and `arcSeg(x, y, radius, clockwise)`. The
coordinates are centred on the piece in its Top face's plane: x from −width/2 (West) to +width/2,
y from −height/2 (North) to +height/2 (South). A closed path starts at its last segment's end.
`width` and `height` stay the bounding box.

**Machining.** Push work nodes into `work`:
`createWorkNode({ type: "dado", pieceId, face, offset, thickness, depth })`,
`createWorkNode({ type: "hole", pieceId, face, position: new Vector2(u, v), diameter, depth })`,
and `createHardwareInsertNode(surface, point, { id }, insertionDepth?)` for a hardware model.
Positions are in the face's own frame (`initSurfaceProjection(piece, face)`); convert from a
restricted projection with `surface.inverse(point).point`. Field meanings: grep `DadoOperation`
and `HoleOperation`.

## 11. Hosting child modules; using the standard catalog

A top-level module that hosts children returns their space as a slot. From an open box (two
sides, bottom, top, open front and back) whose schema has `width`, `height`, `depth`, `board`,
`edges`, `edgeApplication` and the join pair; `W`, `H`, `D` are its size params and `t` its
board's thickness, and edgeband and piece nodes follow section 3:

```ts
    // A side added "X+" or "X-" has its width running up (Y).
    const grain = board.grain > 0 ? 1 : 0
    const left: BasicPiece = { uid: `${instanceUid}-left`, width: H, height: D, thickness: t, grain }
    const right: BasicPiece = { ...left, uid: `${instanceUid}-right` }
    const bottom: BasicPiece = {
      uid: `${instanceUid}-bottom`, width: W - 2 * t, height: D, thickness: t, grain,
    }
    const top: BasicPiece = { ...bottom, uid: `${instanceUid}-top` }

    // The module's own assembly. Frame: X and Z centred, Y = 0 at the underside.
    // Each inner face points into the box: that is what the support surfaces read.
    const assembly = createPieceAssemblyBuilder()
      .add(left, "X+").fixed(new Vector3(-(W - t) / 2, H / 2, 0))
      .add(right, "X-").fixed(new Vector3((W - t) / 2, H / 2, 0))
      .add(bottom, "Y+").fixed(new Vector3(0, t / 2, 0))
      .add(top, "Y-").fixed(new Vector3(0, H - t / 2, 0))
    const { piecePositions, isConsistent } = assembly.build(diagnostics)
    if (!isConsistent) {
      diagnostics.push(createDiagnostic("bug", diagCode("open-box.assembly_inconsistent")))
    }

    // Joins: "down" takes the strip at the foot of the covering face, "up" the strip
    // at its head. "Y-" turns the top over, so its East face is the one on the left.
    const joinBuilder = createJoinBuilderFromParams(this.libContext.joinSystems, params, diagnostics)
    const leftFace = getCanonicalProjection(left, "left-side").surface
    const rightFace = getCanonicalProjection(right, "right-side").surface
    joinBuilder
      ?.add(bottom, PieceFace.West, leftFace, "down")
      .add(bottom, PieceFace.East, rightFace, "down")
      .add(top, PieceFace.East, leftFace, "up")
      .add(top, PieceFace.West, rightFace, "up")
    const work = (joinBuilder?.build(diagnostics) ?? []).map((join) => join.workNode)

    // The slot: the interior, described by its four inner faces. The sides lose
    // the strips the bottom and top cover, so every face spans the child's volume.
    const structure = createSupportStructureBuilder()
      .add("left", left).add("right", right).add("bottom", bottom).add("top", top)
      .update(["left-side", "right-side"], (surface) => surface.restrict({ bottom: t, top: t }))
      .build()
    const front: OpenArea = {
      internal: { x: t, y: t, width: W - 2 * t, height: H - 2 * t },
      external: { x: 0, y: 0, width: W, height: H },
      supports: structure,
      normal: getNormal("Z-"),
    }
    const child = defineSupportingContext(
      {
        assembly,
        volume: { type: "box", bounds: new Vector3(W - 2 * t, H - 2 * t, D) },
        obstructions: [],
        structure,
        openAreas: new Map<KnownOpenArea, OpenArea>([["front-open-area", front]]),
      },
      diagnostics
    )
    // ... edgeband and piece nodes as in section 3, then:
    // return { root, work, slots: { child }, diagnostics }
```

- `createSupportStructureBuilder().add(role, piece)` adds `<role>-side`, `<role>-edge` and
  `<role>-external` for `left`, `right`, `top` and `bottom`; `.update(kinds, fn)` reshapes them;
  `.with(getCanonicalProjection(back, "back-side"))` adds another.
- `defineSupportingContext` reports a `bug` when a surface disagrees with the volume.
- The child shares the host's `assembly`. A composite names the slot key (`child`) as its
  `parentSlot`; the standard catalog's `cabinet-box` calls its interior slot `child` too.
- `OpenArea`: `internal` and `external` rects in the front plane, measured from the left and the
  bottom; `normal` points from the opening into the module; `supports` are what doors and drawers
  mount on.
- Several slots: split the space with `splitSupportingContext` or `multiSplitSupportingContext`.

The standard catalog (library id `stdlib`) exports no classes: your library resolves its modules
at run time. `@skymobdev/standard-catalog-types` (a devDependency) exports one typed dependency
per catalog module, so `PIVOT_DOOR.resolve(this.libContext)` returns the pivot door typed by its
schema, and throws when the catalog is not loaded (`skymob-composite`, section 4). To build one
inside your module: call its `bindParams(params, { presetContext: { presets: [] }, formulaBindings: {},
moduleResolver: this.libContext.resolver })`, then its `materialize(bound.resolved,
{ ...buildContext, instanceUid: `${instanceUid}-<name>`, supportingContext })` with a context you
prepared, and add its diagnostics, `work` and `root` to yours.

## 12. Translations

| key | `type` | used by |
|---|---|---|
| `library.<LIBRARY_ID>` | `Library` | the library |
| `module.<module-id>` | `Module` | label, description and tags of the module |
| `<module-id>.param.<param>` | `Parameter` | a param's `i18nKey`; nested: `<module-id>.param.<param>.<inner>` |
| `piece.<name>` | `PartLabel` | a piece node's `role` |
| `<module-id>.<code>` | (message text) | a diagnostic code |

Enum option labels go in the param's entry under `options`. The join params' keys come with the
standard catalog. A key your library shares with a dependency takes your text.

`src/i18n/en.ts`, the shelf's entries:

```ts
export const enItems = defineTranslations({
  // ...the library entry and other modules
  "module.fixed-shelf": {
    type: TranslatedItemType.Module,
    label: "Fixed Shelf",
    description: "One shelf joined to the side panels of its opening at a set height.",
    tags: ["shelf", "interior"],
  },
  // ...one entry per param, like this one
  "fixed-shelf.param.grainDirection": {
    type: TranslatedItemType.Parameter,
    label: "Grain Direction",
    description: "Direction of the board's grain on the shelf.",
    options: { LeftRight: "Left to right", FrontBack: "Front to back" },
  },
  "piece.fixed-shelf": { type: TranslatedItemType.PartLabel, label: "Shelf" },
})

/** Diagnostic messages, keyed by diagnostic code. `{name}` reads `params.name`. */
export const enMessages = {
  "fixed-shelf.no_box_volume": "The fixed shelf needs a rectangular opening.",
  "fixed-shelf.elevation_too_high":
    "At {elevation} mm the shelf would stick out of a {height} mm opening. Use at most {max} mm.",
  // ...one message per code the library raises
} as const
```

`src/i18n/pt.ts` has the same keys; `satisfies` makes a missing one a type error:

```ts
export const ptItems = defineTranslations({
  // ...every key of enItems, in Portuguese
} satisfies Record<keyof typeof enItems, unknown>)

export const ptMessages = {
  // ...every key of enMessages
} satisfies Record<keyof typeof enMessages, string>
```

`src/i18n/index.ts` exports `i18nKey = defineI18NKeyFunc(enItems)` and puts the messages in the
resources beside the items:

```ts
/** A diagnostic code; a code missing from `enMessages` is a type error. */
export const diagCode = defineI18NKeyFunc(enMessages)

export const i18nResources: LanguageResources = {
  items: defineLangCollection({ en: enItems, pt: ptItems }, "en"),
  text: defineLangCollection({ en: enMessages, pt: ptMessages }, "en"),
  images: {},
}
```

Write the `en.ts` entry before the `i18nKey("…")` that uses it.

## 13. Tests

`test/fixed-shelf.spec.ts`, testing the shelf alone, under fuzzing, and hosted in the open box:

```ts
import { mockRepository } from "@skymobdev/cad-mock"
import type { ModuleDefinition, ModuleRef } from "@skymobdev/sdk/authoring"
import {
  baseOracle, createModuleTestbed, declineWithErrorOracle, flattenPieceNodes, fuzzModule,
  loadStandardCatalog,
} from "@skymobdev/sdk/testing"
import { describe, expect, it } from "vitest"
import { libMain } from "../src"
import { LIBRARY_ID } from "../src/info"

const standard = loadStandardCatalog()
const testbed = createModuleTestbed({
  repository: mockRepository,
  hardware: standard.hardwareMain ? [standard.hardwareMain] : [],
  joins: standard.joinMain ? [standard.joinMain] : [],
  rules: standard.rulesMain ? [standard.rulesMain] : [],
  libraries: [...(standard.libMain ? [standard.libMain] : []), libMain],
})
const shelf: ModuleRef = { libraryId: LIBRARY_ID, moduleId: "fixed-shelf" }
const box: ModuleRef = { libraryId: LIBRARY_ID, moduleId: "open-box" }
type UserParams = Parameters<ModuleDefinition["bindParams"]>[0]

/** Builds the host, then the shelf in the host's `child` slot. */
const inHost = (host: ModuleRef, hostParams: Record<string, unknown>, shelfParams: UserParams) => {
  const hosted = testbed.materialize(host, hostParams)
  const definition = testbed.resolveDefinition(shelf)
  const context = { presetContext: { presets: [] }, formulaBindings: {}, moduleResolver: testbed.resolver }
  const bound = definition.bindParams(shelfParams, context)
  const supportingContext = hosted.mat.slots.child
  const mat = definition.materialize(bound.resolved, { instanceUid: "shelf", supportingContext })
  return { mat, diagnostics: [...bound.diagnostics, ...mat.diagnostics] }
}

describe("fixed-shelf", () => {
  it("builds with its default params", () => {
    const { mat, diagnostics } = testbed.materialize(shelf, {})
    expect(baseOracle({ mat, diagnostics })).toEqual([])
  })

  it("holds up under fuzzing", () => {
    // What `skymob-lib check` accepts under fuzzing: no pieces when the root is `empty`, or an
    // error says why.
    const run = fuzzModule(testbed, shelf, { baseline: {}, seed: 1, numRuns: 200, oracle: declineWithErrorOracle })
    expect(run.violations ?? [], JSON.stringify(run.counterexample)).toEqual([])
  })

  it("sits at its elevation, joined to the host's sides", () => {
    const oak = { id: "oak-18" }
    const { mat, diagnostics } = inHost(box, { board: oak }, { elevation: 300, board: oak })
    expect(diagnostics).toEqual([])
    const [piece] = flattenPieceNodes(mat.root)
    // The box's bottom is 18 mm thick, so the shelf's underside is at 318.
    expect(piece.transform?.position?.y).toBeCloseTo(18 + 300 + 9)
    expect(mat.work.length).toBeGreaterThan(0)
  })

  it("refuses an elevation above the opening and names the param", () => {
    const { diagnostics } = inHost(box, { height: 400 }, { elevation: 390 })
    const error = diagnostics.find((d) => d.severity === "error")
    expect(error?.code).toBe("fixed-shelf.elevation_too_high")
    expect(error?.causes?.[0]).toMatchObject({ param: ["elevation"] })
  })
})
```

- `testbed.materialize(ref, params)` runs your source in-process with a free context, so
  breakpoints and `console.warn` work.
- `inHost` places the module the way a composite does; with `{ libraryId: "stdlib", moduleId:
  "cabinet-box" }` as the host it tests the module in the standard cabinet.
- Assert positions against the host's known geometry. `summarizeMaterialization(mat)` with
  `digestToString` prints pieces, work, slots and diagnostics. Material ids come from
  `mockRepository` (`oak-18`, `mdf-18`, …).

## 14. Verify

Run these after every change, in order:

| step | command | passes when |
|---|---|---|
| 1 | `npx skymob-lib build` | it prints `Built …/dist/<id>.js` |
| 2 | `npx skymob-lib check` | an `ok` line per module, then `Check passed.` |
| 3 | `npx vitest run` | every spec passes |
| 4 | `npx tsc --noEmit` | no output |
| 5 | `npx skymob-lib dev` | the module looks right in the workbench |

`check` loads `dist/<id>.js` in the sandbox the designer uses, materializes each module with its
default params and no host, then fuzzes it with 25 configurations, some out of range. A `FAIL` line
names the module and what broke:

- `FAIL <lib>:<module> with default params: module produced no pieces`: the defaults were
  refused (`failedMat` with a code) or every piece was conditional. Defaults build pieces in the
  free context, or return a root flagged `empty: true` when the module is empty on purpose.
- `… piece <uid> has a <width|height|thickness> (<value>) below the <n>mm minimum`: a piece
  collapsed. Guard it with `isValidDimension`, or refuse the configuration with an `error`.
- `… piece <uid> has a non-finite transform component (NaN)`: a size or position came from
  `NaN` or a division by zero.
- `…: <code>` and nothing else: a `bug` diagnostic, such as `module.unable_to_place_pieces`.
- `… materialization omitted … but emitted no error/bug diagnostic`: a refused build reported
  only a warning, or nothing.
- `FAIL <lib>:<module> fuzz: <reason> with {…}`: the object is the smallest configuration that
  breaks the module. Reproduce it with `testbed.materialize(ref, {…})` in a spec, fix, rerun.
- `FAIL <lib>:<module> threw: <message>`: `bindParams` or `materialize` threw; report through
  diagnostics instead.
- `ok <lib>:<module> (N of 25 fuzz configs declined with an error)`: allowed, when N matches
  configurations the module really cannot build.
- `note: host-only globals appear in the source: …`: names such as `document`, usually from
  `three`. Information only.

In the workbench (`npx skymob-lib dev`, http://localhost:5273) pick the module, change its
params, and look at the pieces, edgeband and join hardware in the 3D view. The Dev Tools button
shows the diagnostic count and lists them with your messages; its Parametrization Level slider
reveals `advanced`, `expert` and `internal` params. Problems loading the library go to the
browser console. A child module appears in the free context there; to see it in a host, add a
composite (skymob-composite).

## 15. Pitfalls

| symptom | cause | fix |
|---|---|---|
| a child sits in the host's corner or outside it | `fixed()` with coordinates in the wrong frame | position against the host's support surfaces |
| `bug` `module.unable_to_place_pieces` | covering face and edge differ in size | restrict the covering face to the edge's length |
| holes mirrored, or on the wrong end | covering face runs the other way, or the wrong edge face of a turned piece | section 8 tables; `"up"` for upside-down pieces |
| duplicate piece uids in a host | uids made without `instanceUid` | `${instanceUid}-<name>` |
| assembly inconsistent | a piece with neither `fixed()` nor a join, or joins that disagree | one placement per piece |
| a diagnostic shows its bare code | no message for the code | add it to `enMessages`; use `diagCode` |
| type error on `i18nKey("…")` or in `pt.ts` | the key is missing from `en.ts` or `pt.ts` | add the entry |
| a nested param is missing in `resolved` | `resolveDefaultedParams` skips nested params | resolve it with the nested schema |
| the module is missing from the workbench | not in the `modules` array of `libMain` | add `new <Name>Module(context)` |
