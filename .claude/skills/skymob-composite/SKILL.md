---
name: skymob-composite
description: >
  Build a composite module in a SkyMob module library: a new module made by combining existing
  modules (your own or the standard catalog's) with composeModules or composeMultiSlot, plus its
  translations, registration and spec. Use when the module is an arrangement of modules, such as a
  cabinet split into sections or a door with shelves behind it, rather than new pieces.
argument-hint: <module-name>
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# Composite modules

A composite is a `ModuleDefinition` assembled from other modules. A parent module provides a slot
(a volume inside it, such as a cabinet's interior) and a child module is built inside that slot.
The composite's schema is the parent's params plus one nested group per child.

You produce `src/modules/<module-id>.ts` (a `build…(libContext)` function), its registration in
`src/main.ts`, entries in `src/i18n/en.ts` and `src/i18n/pt.ts`, and `test/<module-id>.spec.ts`.
The `skymob-library` skill covers the layout, sandbox and build loop; `skymob-base-module` covers
modules built from pieces.

## The API

Look every name up in `node_modules/@skymobdev/sdk/dist/authoring.d.ts` (library code) or
`node_modules/@skymobdev/sdk/dist/testing.d.ts` (specs) before using it, for example
`grep -n "composeMultiSlot" node_modules/@skymobdev/sdk/dist/authoring.d.ts`.

| name | what it is |
|---|---|
| `composeModules(parent, child)` | one child built in one parent slot |
| `composeMultiSlot(config)` | a parent, a slot provider that splits one parent slot into N cells, one child per cell |
| `bridgePartialModule` | an empty parent whose `child` slot is whatever slot the partial is placed in |
| `completeModule(partial, i18nKey, info)` | turns a composition into a `ModuleDefinition` with `ref`, `name`, `version`, `tags` |
| `mapParams`, `mapParamsNested`, `defaultConfigMerge` | merges that route config-group values into a child's params |
| `chainMerge(...merges)` | one merge that runs several in order, such as a flat and a nested `mapParams` on one child |
| `fillAllSlots(config, numSlots)` | slot children for cells `0…numSlots-1`, all the same module, keyed `<childKeyPrefix><index>` |
| `ConfigGroupDef`, `PartialModuleDefinition` | types of a config group and of a composition before `completeModule` |
| `ParamSchemaOverrides`, `SharedConfigRef`, `OverrideGate`, `SlotChildConfig`, `MergeSpec` | types of `overrides`, an entry of `sharedConfigRefs`, an `overrideGate`, a slot child, and a merge: a function, a strategy name or a snippet |

Library code imports only from `@skymobdev/sdk/authoring` and `three`.

## 1. Ask first

Before writing code, settle these with the user, as bullets in one round:

- module id and display name; the id must differ from every standard-catalog module id;
- the parent (outer shell), usually the standard catalog's `cabinet-box`;
- the cells: how many, split direction, which module fills each, which stay empty;
- sub-assemblies inside a cell (a door with shelves behind it), each its own `composeModules` chain;
- values the composite fixes (hidden), values it only defaults (seeded), and values the user sets
  once for several children (config groups);
- whether a cell's position depends on a setting (drawers left or right).

Build bottom-up: sub-assemblies first, the outer composite last. A sub-assembly used by two
composites goes in a shared factory taking `libContext`, such as `src/modules/partials.ts`.

## 2. Find the modules

**Your modules** live in `src/modules/`; instantiate them with `new MyModule(libContext)` and read
their `schema` for param keys.

**Standard-catalog modules** (library id `stdlib`, loadable id `standard-catalog`) load before your
library because `package.json` lists `"standard-catalog"` in `skymob.dependencies`. Their source
does not ship, so your library resolves them at run time. Reach each one through its typed
dependency in `@skymobdev/standard-catalog-types` (section 4). Learn their slots, defaults and usage
notes with this throwaway spec, `test/stdlib-discovery.spec.ts`. The workbench's module list holds
your library's own modules only. The spec prints every module id and, for the ids in `SHOW`, the
slots the module makes with default params and each param with its type, level, default and
`aiContext` (usage notes written for an AI):

```ts
import { mockRepository } from "@skymobdev/cad-mock"
import { createModuleTestbed, loadStandardCatalog } from "@skymobdev/sdk/testing"
import { it } from "vitest"

const standard = loadStandardCatalog()
const testbed = createModuleTestbed({
  repository: mockRepository,
  hardware: standard.hardwareMain ? [standard.hardwareMain] : [],
  joins: standard.joinMain ? [standard.joinMain] : [],
  rules: standard.rulesMain ? [standard.rulesMain] : [],
  libraries: standard.libMain ? [standard.libMain] : [],
})

const SHOW = ["cabinet-box", "divider"]

// One line per param (key, type, level, default or item count), then its aiContext.
const printSchema = (schema: Record<string, any>, indent: string): void => {
  for (const [key, def] of Object.entries(schema)) {
    const value =
      def.type === "array" ? `${def.minLength ?? 0}..${def.maxLength ?? "n"} items` : JSON.stringify(def.default) ?? ""
    const options = def.options ? ` ${JSON.stringify(def.options)}` : ""
    console.log(`${indent}${key}: ${def.type} [${def.level ?? "user"}] ${value}${options}`)
    if (def.aiContext) console.log(`${indent}    ${def.aiContext}`)
    if (def.type === "nested") printSchema(def.schema, indent + "  ")
    if (def.type === "array" && def.element?.type === "nested") printSchema(def.element.schema, indent + "  ")
  }
}

it("prints the standard catalog", () => {
  for (const { ref, tags } of testbed.resolver.moduleIndex) {
    console.log(`${ref.libraryId}:${ref.moduleId}  ${tags.join(",")}`)
  }
  for (const moduleId of SHOW) {
    const ref = { libraryId: "stdlib", moduleId }
    const slots = Object.keys(testbed.materialize(ref, {}).mat.slots)
    console.log(`\n== ${moduleId}  slots: ${slots.join(", ") || "(none)"}`)
    printSchema(testbed.resolveDefinition(ref).schema, "  ")
  }
})
```

Run it alone; `--reporter=verbose` makes vitest print console output from a passing test:

```bash
npx vitest run test/stdlib-discovery.spec.ts --reporter=verbose
```

Output (trimmed):

```
stdlib:cabinet-box  cabinet,standalone
stdlib:divider  divider,layout,partition
...
== cabinet-box  slots: child
  width: number [user] 600
      Outer width of the carcass in mm, side face to side face (100 to 3000, default 600). ...
...
== divider  slots: section-0, section-1
  direction: enum [user] "horizontal" ["horizontal","vertical"]
      horizontal (default): ... slot 0 is the BOTTOM. vertical: ... slot 0 is the LEFT.
  sections: array [user] 2..10 items
      One entry per section along the split ... section i is slot i for its content. ...
```

Read the `aiContext` lines before choosing values: they give each array's meaning and order (drawer
heights and shelf sections run bottom up; N shelf sections make N−1 shelves). Delete the spec when
you are done. The modules composites use most, as this SDK's standard catalog reports them:

| module id | slots | params a composite usually excludes and replaces |
|---|---|---|
| `cabinet-box` | `child` (the interior) | none; it is the outer parent |
| `divider` | `section-0` … `section-(n−1)`, one per `sections` entry | `standalone`, `standaloneDimensions`, `openAreaKey`; `direction` when the composite fixes it |
| `pivot-door` | `child` (the space behind the door) | `standalone`, `standaloneWidth`, `standaloneHeight`, `openAreaKey` |
| `shelves` | none | `standalone`, `standaloneDimensions`, `openAreaKey` |
| `drawer-group` | none | `openAreaKey` |

`standalone*` params size a module that has no host; in a composite the slot supplies the size.
`openAreaKey` names the opening a front covers (`front-open-area` by default). Exclude these so they
leave the composite's schema and the fuzzer cannot change them.

## 3. Choose the composition

- **`composeModules(parent, child)`**: one child in one parent slot (`parentSlot`, usually
  `"child"`). The result can be the parent of another `composeModules` call, or a cell's child.
- **`composeMultiSlot({ parent, slotProvider, configGroups, slotChildren })`**: the slot provider
  (usually `divider`) is built in the parent's `parentSlot` and makes `numSlots` cells named
  `<slotPrefix>-<i>` (`slotPrefix` defaults to `section`). Each slot child picks a cell by
  `slotIndex`.
- **`bridgePartialModule` as `parent`**: a `composeMultiSlot` partial with no outer shell, for a
  split inside another composite's cell (drawers under an open space, in one column).

Cell rules:

- One child per cell. Two children on the same index give an `error` `duplicate-slot-index`; the
  first keeps the cell.
- `slotIndex` is a number or `(resolved) => number`, called with the composite's resolved params
  (config groups included). A result that is not a non-negative integer gives `slot-index-invalid`
  and the child is skipped.
- `module: null` leaves a cell empty and adds nothing to the schema (it still needs `paramBase`).
- The divider makes one cell per `sections` entry, two by default. For other counts seed `sections`
  with `numSlots` entries; pin the count with
  `paramPropertyOverrides: { sections: { minLength: n, maxLength: n } }`. A missing cell gives
  `missing-provider-slot`; an extra one stays empty.
- A horizontal divider numbers cells bottom up, a vertical one left to right.
- Slots the parent or a child leaves unconsumed stay on the composite, so it can be a parent in turn.

## 4. Typed standard-catalog modules

Add `@skymobdev/standard-catalog-types` to `devDependencies`. It exports one constant per catalog
module, a `ModuleDependency` typed by the module's schema: `CABINET_BOX`, `CABINET_EXTRUSION`,
`DIVIDER`, `DRAWER`, `DRAWER_GROUP`, `FRAMED_GLASS_DOOR`, `HANGER`, `INTERIOR_SPACE`, `MASK`,
`PANEL`, `PIVOT_DOOR`, `SHAPED_SHELVES`, `SHELVES`, `SLIDING_DOORS`, `WARDROBE_INNER_DRAWERS` and
`EXTRUSION_FRONT_DOORS_ADAPTER`. The package holds no catalog code: the constants name the modules,
and the host's catalog supplies them at run time.

```ts
import { CABINET_BOX, PIVOT_DOOR } from "@skymobdev/standard-catalog-types"

const pivotDoor = PIVOT_DOOR.resolve(libContext) // ModuleDefinition<PivotDoorSchema>
```

- `resolve` throws when the host has not loaded the module, and the throw stops the designer
  loading libraries, naming the module: list `"standard-catalog"` in `skymob.dependencies` so the
  catalog loads before yours. `skymob-lib check` reports it as your library failing to load.
- `excluded`, `replacements`, `seed` and `paramPropertyOverrides` are checked against the module's
  real params, and `composeModules` checks a `childKey` against the parent's real keys: a typo
  fails to compile.
- Compose a catalog module as it resolves, with no cast: your own modules and the catalog's are
  typed the same way.
- A join system param (`joinSystem`) takes a `JoinSystemKind`: the catalog's from
  `JOIN_SYSTEMS` (`joinSystem: JOIN_SYSTEMS.DFIX`), a library's own from the constant it makes
  with `joinSystemKind` (`skymob-library`). A plain string fails to compile, so a misspelled kind
  does too. `"None"` is a plain string.
- A cascade over loaded systems (`joinSystemParams`, `pullHandleParams`, `hingeModelParams`, …)
  types the catalog's options and takes any other key, since the host loads other libraries' join
  systems and hardware beside the catalog's.
- The catalog's composites (`cabinet-with-pivot-doors`, …) have no constant. Resolve one with
  `libContext.resolver.resolveModule({ libraryId: "stdlib", moduleId })`, whose schema is open:
  its keys go unchecked.

## 5. Route parameters

Parent, slot provider and each child take `overrides`. `excluded` and `replacements` are required;
write `excluded: [], replacements: {}` when you only need `seed`.

| field | effect |
|---|---|
| `excluded` | removes these keys from the composite's schema |
| `replacements` | fixed values for excluded keys; they win over everything |
| `seed` | starting values the user can change; each is also the param's default in the composite's schema, so the config panel shows it; nested params take nested objects |
| `paramPropertyOverrides` | per key: `level`, `label`, `i18nKey`, `aiContext`, `default`, `min`, `max`, `minLength`, `maxLength`; a `default` wins over the seed for that key, in the panel and when the module builds |

The user's values merge over the seed key by key, inside nested params too: a user value for one
key of a seeded nested param keeps the seed's other keys. A `seed` or `paramPropertyOverrides` key
the part's schema lacks reports the `bug` `override-unknown-key`, which fails `check`.

Priority, lowest first: config-group merges (parent only), `seed` (with each
`paramPropertyOverrides` `default` over it), the user's values, config-group merges (provider and
children; they fill only keys still unset), `replacements`. Levels are
`user`, `advanced`, `expert` and `internal` (hidden); move a child's param to `advanced` when a
config group sets it.

**Config groups** are nested params the composite adds at its top level:
`configGroups: { key: { paramBase, schema } }`. A parent, provider or child reads one through
`sharedConfigRefs: [{ configKey, merge }]`:

- `defaultConfigMerge` (when `merge` is omitted) copies every group key under the same name;
- `mapParams({ groupKey: "childKey" | ["a", "b"] })` copies under other names, one to many;
- `mapParamsNested("nestedParam", { … })` copies into a nested param of the child, such as
  `bodyConstruction` of `drawer-group` or a `composeModules` child group;
- a merge is any `(shared, childParams) => childParams`; `chainMerge(a, b)` runs `a`, then `b` on
  its result.

A merge receives the group's resolved values, defaults included, and sets a key only when the
child's params lack it (a seeded key counts as set), so a group's default replaces the child's.
A board, edgeband or hardware param the user leaves unset in a group decides nothing: each part
it routes to fills that param from the designer's presets, as it would on its own. A value
picked in the group, a hardware "None" included, reaches the parts.

**Override gates** let one child opt out of a group value. `overrideGate` on a shared ref adds a
boolean toggle to the child; while it is off, each gated param takes the group's value under the
same key, whatever the user set:

```ts
sharedConfigRefs: [{
  configKey: "interior", // its schema has a number param `frontIndent`
  overrideGate: {
    toggleKey: "ownIndent",
    toggleParamBase: { label: "Own front indent", i18nKey: i18nKey("tall-unit.right.ownIndent") },
    gatedParams: ["frontIndent"],
  },
}],
```

Gate only params whose group key equals the child's param name.

## 6. Keys

The composite's top-level keys are the parent's params (minus `excluded`), the provider's
`childKey`, the config-group keys and the slot-child keys.

- `composeMultiSlot` throws at load time on a repeated key
  (`composeMultiSlot: key collision detected for "width". …`); `libMain` fails and the library
  does not load.
- `composeModules` checks `childKey` at compile time against the parent's known keys only; at
  runtime a `childKey` equal to a parent param replaces that param.
- With a standard-catalog parent, compare your keys with its schema (`cabinet-box` has `width`,
  `edges`, `joinSystem` …) and name children after their role (`divider`, `drawers`, `door`).

## 7. Example: `drawer-and-door-unit`

A standard-catalog cabinet split by a vertical divider: drawers in one cell, a door with shelves in
the other, a setting that swaps the sides, and one carcass material routed to the cabinet, the
divider, the drawer bodies and the shelves. `src/modules/drawer-and-door-unit.ts`:

```ts
import {
  completeModule, composeModules, composeMultiSlot, defineEnumParam, makeBoardParam, makeEdgebandParam,
  mapParams, mapParamsNested, type ModuleDefinition, type ModuleLibraryContext,
} from "@skymobdev/sdk/authoring"
import { CABINET_BOX, DIVIDER, DRAWER_GROUP, PIVOT_DOOR, SHELVES } from "@skymobdev/standard-catalog-types"
import { i18nKey } from "../i18n"
import { makeModuleRef } from "../info"

const DRAWER_SIDES = ["left", "right"] as const

/** One proportional entry per section: `count` equal sections. */
const equalSections = (count: number) =>
  Array.from({ length: count }, () => ({ mode: "proportional" as const, value: 1 }))

/** Drawers beside a door with shelves, in a standard-catalog cabinet. */
export const buildDrawerAndDoorUnit = (libContext: ModuleLibraryContext): ModuleDefinition[] => {
  const cabinetBox = CABINET_BOX.resolve(libContext)
  const divider = DIVIDER.resolve(libContext)
  const drawerGroup = DRAWER_GROUP.resolve(libContext)
  const pivotDoor = PIVOT_DOOR.resolve(libContext)
  const shelves = SHELVES.resolve(libContext)

  // Single-child chain: the shelves fill the space behind the door.
  const doorWithShelves = composeModules(
    {
      module: pivotDoor,
      overrides: {
        excluded: ["standalone", "standaloneWidth", "standaloneHeight", "openAreaKey"],
        replacements: { standalone: false, openAreaKey: "front-open-area" },
      },
    },
    {
      module: shelves,
      childKey: "shelves",
      parentSlot: "child",
      paramBase: { label: "Shelves", i18nKey: i18nKey("drawer-and-door-unit.door.shelves") },
      overrides: {
        excluded: ["standalone", "standaloneDimensions", "openAreaKey"],
        replacements: { standalone: false, openAreaKey: "front-open-area" },
        seed: { sections: equalSections(3) },
      },
    }
  )

  const unit = composeMultiSlot({
    parent: {
      module: cabinetBox,
      sharedConfigRefs: [
        {
          configKey: "carcass",
          merge: mapParams({ board: ["structureBoard", "backSideBoard"], edges: "edges" }),
        },
      ],
      overrides: {
        excluded: [],
        replacements: {},
        seed: { width: 900, height: 720 },
        paramPropertyOverrides: { structureBoard: { level: "advanced" }, backSideBoard: { level: "advanced" } },
      },
    },
    slotProvider: {
      module: divider,
      childKey: "divider",
      paramBase: { label: "Division", i18nKey: i18nKey("drawer-and-door-unit.divider") },
      parentSlot: "child",
      numSlots: 2,
      sharedConfigRefs: [
        { configKey: "carcass", merge: mapParams({ board: "board", edges: "edges" }) },
      ],
      overrides: {
        excluded: ["standalone", "standaloneDimensions", "openAreaKey", "direction"],
        replacements: { standalone: false, openAreaKey: "front-open-area", direction: "vertical" },
        paramPropertyOverrides: { sections: { minLength: 2, maxLength: 2 }, board: { level: "advanced" } },
      },
    },
    configGroups: {
      layout: {
        paramBase: { label: "Layout", i18nKey: i18nKey("drawer-and-door-unit.layout") },
        schema: {
          drawerSide: defineEnumParam({
            options: DRAWER_SIDES,
            default: "left",
            label: "Drawer side",
            i18nKey: i18nKey("drawer-and-door-unit.layout.drawerSide"),
          }),
        },
      },
      carcass: {
        paramBase: { label: "Carcass material", i18nKey: i18nKey("drawer-and-door-unit.carcass") },
        schema: {
          board: makeBoardParam("Board", i18nKey("drawer-and-door-unit.carcass.board")),
          edges: makeEdgebandParam("Edgeband", i18nKey("drawer-and-door-unit.carcass.edges")),
        },
      },
    },
    slotChildren: {
      drawers: {
        // Vertical divider: section-0 is the left section.
        slotIndex: (resolved) => (resolved.layout.drawerSide === "left" ? 0 : 1),
        module: drawerGroup,
        paramBase: { label: "Drawers", i18nKey: i18nKey("drawer-and-door-unit.drawers") },
        sharedConfigRefs: [
          {
            configKey: "carcass",
            merge: mapParamsNested("bodyConstruction", {
              board: ["sidesBoard", "bottomBoard"],
              edges: "sidesEdges",
            }),
          },
        ],
        overrides: {
          excluded: ["openAreaKey"],
          replacements: { openAreaKey: "front-open-area" },
          seed: { drawerHeights: equalSections(3) },
        },
      },
      door: {
        slotIndex: (resolved) => (resolved.layout.drawerSide === "left" ? 1 : 0),
        module: doorWithShelves,
        paramBase: { label: "Door", i18nKey: i18nKey("drawer-and-door-unit.door") },
        sharedConfigRefs: [
          { configKey: "carcass", merge: mapParamsNested("shelves", { board: "board", edges: "edges" }) },
        ],
      },
    },
  })

  return [
    completeModule(unit, i18nKey("module.drawer-and-door-unit"), {
      name: "Drawer and Door Unit",
      version: "1.0.0",
      ref: makeModuleRef("drawer-and-door-unit"),
      tags: [...new Set([...cabinetBox.tags, ...drawerGroup.tags, ...pivotDoor.tags])],
    }),
  ]
}
```

`completeModule`'s `i18nKey` argument is not read at runtime (the designer looks a module's label up
as `module.<moduleId>`); pass it so tsc checks that the entry exists. `info` and every `paramBase`
also accept `aiContext`: text for an AI editing the module.

A split inside a cell, with an empty cell, to use as a slot child of an outer composite:

```ts
const drawersUnderOpenSpace = composeMultiSlot({
  parent: { module: bridgePartialModule },
  slotProvider: {
    module: divider,
    childKey: "split",
    paramBase: { label: "Split", i18nKey: i18nKey("tall-unit.split") },
    parentSlot: "child",
    numSlots: 2,
    overrides: {
      excluded: ["standalone", "standaloneDimensions", "openAreaKey", "direction"],
      replacements: { standalone: false, openAreaKey: "front-open-area", direction: "horizontal" },
    },
  },
  slotChildren: {
    drawers: {
      slotIndex: 0, // horizontal divider: section-0 is the bottom
      module: drawerGroup,
      paramBase: { label: "Drawers", i18nKey: i18nKey("tall-unit.drawers") },
      overrides: { excluded: ["openAreaKey"], replacements: { openAreaKey: "front-open-area" } },
    },
    open: { slotIndex: 1, module: null, paramBase: { label: "Open space", i18nKey: i18nKey("tall-unit.open") } },
  },
})
```

## 8. Register

Build composites inside `libMain`, from its `context`, whose resolver reaches the standard
catalog's modules. In `src/main.ts`, spread the result into the module list that `libMain` already
returns and serves from `getDefinition`:

```ts
import { buildDrawerAndDoorUnit } from "./modules/drawer-and-door-unit"
// in libMain:
const modules: ModuleDefinition[] = [
  new MyShelfModule(context), // the modules already there
  ...buildDrawerAndDoorUnit(context),
]
```

## 9. Translations

Add an entry to `src/i18n/en.ts` and `src/i18n/pt.ts` for every key you pass to `i18nKey(...)`:
`module.<module-id>` (`TranslatedItemType.Module`: `label`, `description`, `tags`), and as
`TranslatedItemType.Parameter` (`label`, `description`) each `paramBase` key of the provider, the
config groups and the children, each `composeModules` child group, each config-group param (with
`options` labels for an enum), each gate toggle, and any `i18nKey` set through
`paramPropertyOverrides`.

```ts
"drawer-and-door-unit.layout.drawerSide": {
  type: TranslatedItemType.Parameter,
  label: "Drawer side",
  description: "The side of the cabinet that holds the drawers.",
  options: { left: "Left", right: "Right" },
},
```

- Prefix every key with the module id. Translations are looked up by key across all loaded
  libraries and your library's text wins over the standard catalog's, so reusing one of its keys
  relabels its modules everywhere.
- Params inherited from standard-catalog modules keep their own keys and translations; add none.
- tsc rejects an `i18nKey(...)` key missing from `en.ts`. To have it reject a key missing from
  `pt.ts`, end the Portuguese collection with `}) satisfies Record<keyof typeof myLibEn, unknown>`,
  where `myLibEn` is the collection `en.ts` exports (imported with `import type`).

## 10. Spec

`test/drawer-and-door-unit.spec.ts`. `check` finds wrong wiring at the default params (section 11);
the spec asserts the composition codes are absent for every layout setting too:

```ts
import { mockRepository } from "@skymobdev/cad-mock"
import { BOARD_MATERIAL_SLOT, makeBoardParam } from "@skymobdev/sdk/authoring"
import { baseOracle, createModuleTestbed, fuzzModule, loadStandardCatalog } from "@skymobdev/sdk/testing"
import { describe, expect, it } from "vitest"
import { libMain } from "../src"
import { makeModuleRef } from "../src/info"

const standard = loadStandardCatalog()
const testbed = createModuleTestbed({
  repository: mockRepository,
  hardware: standard.hardwareMain ? [standard.hardwareMain] : [],
  joins: standard.joinMain ? [standard.joinMain] : [],
  rules: standard.rulesMain ? [standard.rulesMain] : [],
  libraries: [...(standard.libMain ? [standard.libMain] : []), libMain],
})
const ref = makeModuleRef("drawer-and-door-unit")
const [first, second] = mockRepository.searchBoards()
const boardRef = (id: string) => ({ isRef: true, refKind: "board", id }) as const

/** Codes the composition layer reports when a slot, slot index or merge is wired wrong. */
const WIRING_CODES = new Set([
  "missing-parent-slot", "missing-child-slot", "missing-provider-slot", "slot-index-out-of-range",
  "duplicate-slot-index", "slot-index-invalid", "merge-spec-invalid", "merge-failed",
  "materialize-threw",
])

describe("drawer-and-door-unit", () => {
  for (const drawerSide of ["left", "right"]) {
    it(`builds with the drawers on the ${drawerSide}`, () => {
      const result = testbed.materialize(ref, { layout: { drawerSide } })
      expect(baseOracle({ mat: result.mat, diagnostics: result.diagnostics })).toEqual([])
      expect(result.diagnostics.filter((d) => WIRING_CODES.has(d.code))).toEqual([])
    })
  }

  it("routes the carcass board to the cabinet, the drawer bodies and the shelves", () => {
    const board = boardRef(first.id)
    const { resolved } = testbed.materialize(ref, { carcass: { board } })
    expect(resolved).toMatchObject({
      structureBoard: board,
      drawers: { bodyConstruction: { sidesBoard: board, bottomBoard: board } },
      door: { shelves: { board } },
    })
  })

  it("leaves an unset carcass board to the material presets", () => {
    const board = boardRef(second.id)
    const parameters = new Map([[BOARD_MATERIAL_SLOT, { param: makeBoardParam("Board", "board"), value: board }]])
    const preset = { id: "test-materials", name: "Test materials", category: "materials", parameters }
    const { resolved } = testbed.materialize(ref, {}, { presets: [preset] })
    expect(resolved).toMatchObject({ structureBoard: board, drawers: { bodyConstruction: { sidesBoard: board } } })
  })

  it("survives fuzzing", () => {
    const run = fuzzModule(testbed, ref, { baseline: {}, seed: 1, numRuns: 100 })
    expect(run.counterexample).toBeUndefined()
  })
})
```

The routing tests read `resolved`, the params the module was built with; add one per config group.

## 11. Verify

Run, in order, after every change:

| step | command | passes when |
|---|---|---|
| 1 | `npx skymob-lib build` | `dist/<id>.js` and `dist/loadable.json` are written |
| 2 | `npx skymob-lib check` | it prints `ok   <library>:<module-id>` and `Check passed.` |
| 3 | `npx vitest run` | every spec passes |
| 4 | `npx tsc --noEmit` | there is no output |
| 5 | `npx skymob-lib dev` | in the workbench each cell holds the right module and each setting moves what it should |

`check` loads the bundle in the SES sandbox, materializes every module with default params, then
fuzzes each with 25 configurations. For a composite:

- `FAIL <library>:<module-id> with default params: …`: the defaults build nothing or broken
  geometry; look for a cell too small for its child at the seeded sizes.
- `FAIL … with default params: missing-parent-slot at … {…}` (or `missing-child-slot`,
  `missing-provider-slot`, `slot-index-out-of-range`): a part names a slot that no other part
  provides; compare its `parentSlot` and `slotIndex` with the slots the parent and the slot
  provider build (`numSlots` of them, numbered from 0). Or the parent or the provider declined
  the default params: look for its own error in the same build.
- `FAIL … with default params: override-unknown-key`: a `seed` or `paramPropertyOverrides` names
  a key the part's schema lacks, often a misspelling; the diagnostic's `part`, `field` and `key`
  name it.
- `FAIL … materialize-threw at … {…}` (or `merge-failed`, `merge-spec-invalid`,
  `slot-index-invalid`, `duplicate-slot-index`), at the defaults or under fuzzing: a part or a
  merge threw, a merge names no strategy or its snippet does not compile, or a slot index is
  uncomputable or taken twice. `at` names the part; a merge error's parameters name the config
  group.
- `FAIL <library>:<module-id> fuzz: … with {…}`: the object is the smallest failing configuration,
  in the composite's param shape (`{"divider":{"sections":[…]}}` is the divider's group). Reproduce
  it with `testbed.materialize(ref, thatObject)` in the spec, fix, rerun from step 1.
- `ok   <library>:<module-id> (N of 25 fuzz configs declined with an error)`: N configurations
  built nothing and reported an `error`; allowed when those configurations are impossible.
- `FAIL the library threw while loading: composeMultiSlot: key collision detected for "…"`:
  `libMain` threw, so no module loaded (section 6).
- `FAIL loading reported error <code>`: a library reported an error while loading.

An `error` from a standard-catalog module under default params (a door with no hinge in the mock
catalog) may be that module's own: if `testbed.materialize({ libraryId: "stdlib", moduleId }, {})`
reports it too, the composite did not cause it.
