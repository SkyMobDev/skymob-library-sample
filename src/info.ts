import type { ModuleRef } from "@skymobdev/sdk/authoring"

export const LIBRARY_ID = "library-sample"

/** The standard catalog's library id; `package.json` lists its loadable, `standard-catalog`. */
export const STDLIB_ID = "stdlib"

export const makeModuleRef = (moduleId: string): ModuleRef => ({
  libraryId: LIBRARY_ID,
  moduleId,
})
