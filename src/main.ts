import {
  LIBRARY_CONTRACT,
  type ModuleDefinition,
  type ModuleLibraryExporter,
  toModuleInfo,
} from "@skymobdev/sdk/authoring"
import { i18nResources } from "./i18n"
import { LIBRARY_ID, STDLIB_ID } from "./info"
import { DeskModule } from "./modules/desk"
import { buildDrawerDoorCabinet } from "./modules/drawer-door-cabinet"

/**
 * The loader calls this once the standard catalog has loaded: `package.json` lists it as a
 * dependency, so its modules resolve through `context.resolver`.
 */
export const libMain: ModuleLibraryExporter = (context) => {
  const modules: ModuleDefinition[] = [...buildDrawerDoorCabinet(context), new DeskModule(context)]

  return {
    id: LIBRARY_ID,
    name: "Sample Library",
    version: "0.1.0",
    contract: LIBRARY_CONTRACT,
    dependencies: [STDLIB_ID],
    modules: modules.map(toModuleInfo),
    resources: i18nResources,
    getDefinition: (moduleId: string) => modules.find((m) => m.ref.moduleId === moduleId),
  }
}
