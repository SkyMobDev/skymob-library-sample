---
name: skymob-library
description: >
  Work on a SkyMob module library built with @skymobdev/sdk: where the API is,
  what the sandbox allows, and the build → check → test → workbench loop. Use
  at the start of any task in the library, when looking up an API, and to
  verify a change before calling it done.
allowed-tools: Read, Glob, Grep, Write, Edit, Bash
---

# SkyMob module library

The library is one JavaScript bundle, `dist/<id>.js`. The SkyMob designer loads it into an SES
sandbox and calls the entry points it exports:

| export | returns | required |
|---|---|---|
| `libMain` | the `ModuleLibrary`: its modules, translations and `getDefinition` | yes |
| `joinMain` | join systems | no |
| `hardwareMain` | hardware systems | no |
| `rulesMain` | global rules | no |

Each module is a `ModuleDefinition`: a parameter `schema`, `bindParams` (user params → resolved
params plus diagnostics) and `materialize` (resolved params → pieces, work and child slots).

A join system's `kind` is a constant the library exports, made once with `joinSystemKind` from
`@skymobdev/sdk/authoring`. The join system's definition and every seed that picks it use the
constant:

```ts
export const SNAP_JOIN = joinSystemKind("snap-join")
// joinMain: { kind: SNAP_JOIN, … }   a seed: { joinSystem: SNAP_JOIN }
```

To write a module, use the `skymob-base-module` skill. To combine modules, use `skymob-composite`.

## Project

```
package.json     "skymob": { "id": "my-library", "dependencies": ["standard-catalog"] }
src/index.ts     exports libMain and any other entry points
src/main.ts      libMain
src/info.ts      LIBRARY_ID and makeModuleRef
src/i18n/        translations, one file per language
src/modules/     one file per module
test/            vitest specs
```

- `skymob.id` is the loadable id: the bundle's file name, and the id other libraries list as a
  dependency. It uses lowercase letters, digits and dashes.
- `skymob.entry` overrides the entry module; it defaults to `src/index.ts`.
- `skymob.dependencies` lists the libraries loaded before this one. The SDK provides
  `standard-catalog`, whose library id is `stdlib`. Its join systems, hardware and rules reach
  `libMain` through its context. Its modules resolve through the typed dependencies of
  `@skymobdev/standard-catalog-types`: `PIVOT_DOOR.resolve(context)` returns the pivot door typed
  by its schema (`skymob-composite`, section 4).

## The API

- `node_modules/@skymobdev/sdk/dist/authoring.d.ts` is the API reference for library code, with doc
  comments. Search it for a name before using it:
  `grep -n "createPieceAssemblyBuilder" node_modules/@skymobdev/sdk/dist/authoring.d.ts`.
- `node_modules/@skymobdev/sdk/dist/testing.d.ts` is the testing kit.
- Library code imports only from `@skymobdev/sdk/authoring`, `@skymobdev/standard-catalog-types`
  and `three`.
- Tests also import `@skymobdev/sdk/testing`, `@skymobdev/cad-mock` and `vitest`.
- `@skymobdev/cad-mock` exports `mockRepository`, the sample catalog of boards, edgebands and
  hardware that the workbench and the tests materialize against.

## The sandbox

The bundle runs in an SES Compartment:

- `fetch`, `window`, `document`, `localStorage` and timers are undefined, and `require` returns
  nothing.
- `eval` and `new Function` are rejected.
- The bundle carries every dependency it imports. `skymob-lib build` bundles `three` and the
  authoring API, so the file you test is the file that ships.
- A module is a pure function of its params and its build context: the same input gives the same
  output on every call.
- The evaluator refuses source containing `<!--` or `-->`. `build` strips comments from SVGs
  imported with `?raw`; other strings must avoid those tokens.

## The library entry

`libMain` returns the library. A typical `src/main.ts`:

```ts
import {
  LIBRARY_CONTRACT,
  type ModuleDefinition,
  type ModuleLibraryExporter,
  toModuleInfo,
} from "@skymobdev/sdk/authoring"
import { i18nResources } from "./i18n"
import { LIBRARY_ID, STDLIB_ID } from "./info"
import { ShelfModule } from "./modules/shelf"

export const libMain: ModuleLibraryExporter = (context) => {
  const modules: ModuleDefinition[] = [new ShelfModule(context)]
  return {
    id: LIBRARY_ID,
    name: "My Library",
    version: "0.1.0",
    contract: LIBRARY_CONTRACT,
    dependencies: [STDLIB_ID],
    modules: modules.map(toModuleInfo),
    resources: i18nResources,
    getDefinition: (moduleId: string) => modules.find((m) => m.ref.moduleId === moduleId),
  }
}
```

- `contract: LIBRARY_CONTRACT` stamps the contract version the SDK builds. `check` fails a bundle
  stamped with another one.
- `modules` is the library's index: `toModuleInfo` copies each definition's name, tags,
  description, `aiContext`, icon and composition specs, which hosts read without resolving the
  definition.
- `resources` holds the library's translations. When this library and a dependency define the same
  key, this library's text wins.

## Diagnostics

A module reports problems as diagnostics from `bindParams` and `materialize`
(`createDiagnostic(severity, code, params, { causes })`):

| severity | meaning |
|---|---|
| `warning` | a value was adjusted, such as clamped to its range, and the module still built |
| `error` | the module could not build this configuration; the user must change something |
| `bug` | the module built something wrong for a valid configuration |

A module that builds nothing for a configuration must report an `error`. With no error, `check`
fails it.

## The loop

Run these after every change, in this order:

| step | command | passes when |
|---|---|---|
| 1 | `npx skymob-lib build` | `dist/<id>.js` and `dist/loadable.json` are written |
| 2 | `npx skymob-lib check` | it prints `Check passed.` |
| 3 | `npx vitest run` | every spec passes |
| 4 | `npx tsc --noEmit` | there is no output |
| 5 | `npx skymob-lib dev` | the module looks right in the workbench |

### Reading `check`

`check` loads `dist/<id>.js` in the sandbox the way the designer does. It materializes each module
with its default params, then fuzzes it with 25 generated configurations, some of them out of
range.

- `FAIL <library>:<module> with default params: …`: the module does not build cleanly as placed.
  Defaults must build pieces with finite, non-degenerate geometry and no `bug` diagnostic, or a
  root flagged `empty: true` for a module empty on purpose. A
  composite's defaults must also wire every slot, and no part or merge of it may throw under any
  configuration (`skymob-composite`, section 11).
- `FAIL <library>:<module> fuzz: … with {…}`: the object is the smallest configuration that breaks
  the module. Reproduce it in a spec (below), fix the module, and rerun `build` and `check`.
- `ok <library>:<module> (N of 25 fuzz configs declined with an error)`: N configurations built
  nothing and reported an error. That is allowed; check that N matches configurations the module
  really cannot build.
- `note: host-only globals appear in the source`: names such as `document` or `fetch` occur in the
  bundle, usually from `three`. Inside the sandbox they are undefined.
- `FAIL library "…" lists no modules`, or `FAIL module "…" names library "…"`: `libMain` returned
  no modules, or a module whose `ref.libraryId` differs from the library's `id`. A module resolves
  through the library its ref names, so build every ref with `makeModuleRef`.
- `the bundle does not load in the sandbox`: the bundle throws while loading under SES. Look for
  module-level code that touches a missing global or changes a built-in object, which the sandbox
  freezes.
- `the library threw while loading: …`: `libMain` or another entry point threw, so no module
  loaded. A key collision in `composeMultiSlot` ends up here.

### Reproducing a failure in a spec

```ts
import { mockRepository } from "@skymobdev/cad-mock"
import { baseOracle, createModuleTestbed, loadStandardCatalog } from "@skymobdev/sdk/testing"
import { expect, it } from "vitest"
import { libMain } from "../src"

const standard = loadStandardCatalog()
const testbed = createModuleTestbed({
  repository: mockRepository,
  hardware: standard.hardwareMain ? [standard.hardwareMain] : [],
  joins: standard.joinMain ? [standard.joinMain] : [],
  rules: standard.rulesMain ? [standard.rulesMain] : [],
  libraries: [...(standard.libMain ? [standard.libMain] : []), libMain],
})

// The object from check's FAIL line.
const reported: Record<string, unknown> = { depth: 0 }

it("shelf builds the configuration check reported", () => {
  const result = testbed.materialize({ libraryId: "my-library", moduleId: "shelf" }, reported)
  expect(baseOracle({ mat: result.mat, diagnostics: result.diagnostics })).toEqual([])
})
```

`testbed.materialize` runs `bindParams` and `materialize` in-process on the library's source, so a
breakpoint or `console.warn` inside the module works here. `fuzzModule(testbed, ref, { baseline: {},
seed: 1, numRuns: 200 })` runs a longer fuzz than `check`.

### The workbench

`npx skymob-lib dev` serves the workbench on http://localhost:5273. It shows:
- the module list, with this library's modules;
- the configuration panel;
- the 3D view;
- the Info, Variables and Dev Tools panels.

Saving a file under `src/` rebuilds the library in place, with no page reload, and the toolbar's
"Reloaded … ago" starts again from now. When `libMain` throws, the page shows the error, and
saving a fix loads the library again.
