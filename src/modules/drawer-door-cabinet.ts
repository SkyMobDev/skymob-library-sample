import {
  completeModule,
  composeModules,
  composeMultiSlot,
  type ConfigGroupDef,
  defaultConfigMerge,
  defineSchema,
  makeBoardParam,
  makeEdgebandParam,
  mapParams,
  mapParamsNested,
  type ModuleDefinition,
  type ModuleLibraryContext,
} from "@skymobdev/sdk/authoring"
import {
  CABINET_BOX,
  DIVIDER,
  DRAWER_GROUP,
  JOIN_SYSTEMS,
  MASK,
  PIVOT_DOOR,
} from "@skymobdev/standard-catalog-types"
import { i18nKey } from "../i18n"
import { makeModuleRef } from "../info"

const structuralMaterialSchema = defineSchema({
  board: {
    ...makeBoardParam("Board", i18nKey("drawer-door-cabinet.structuralMaterial.board")),
    aiContext:
      "One board for every structural part of the model (carcass, divider, drawer box " +
      "sides and bottom, top stile), set in one place.",
  },
  edges: {
    ...makeEdgebandParam("Edges", i18nKey("drawer-door-cabinet.structuralMaterial.edges")),
    aiContext: "One edgeband for every structural part of the model, matching its board.",
  },
})

const frontMaterialSchema = defineSchema({
  board: {
    ...makeBoardParam("Board", i18nKey("drawer-door-cabinet.frontMaterial.board")),
    aiContext: "One board for the visible fronts of the model (door and drawer front).",
  },
  edges: {
    ...makeEdgebandParam("Edges", i18nKey("drawer-door-cabinet.frontMaterial.edges")),
    aiContext: "One edgeband for the visible fronts of the model, matching their board.",
  },
})

/** Board and edgeband for the cabinet box, the divider, the drawer body and the top stile. */
const structuralMaterialGroup: ConfigGroupDef<typeof structuralMaterialSchema> = {
  schema: structuralMaterialSchema,
  paramBase: {
    label: "Structural Material",
    i18nKey: i18nKey("drawer-door-cabinet.structuralMaterial"),
    aiContext:
      "Board and edgeband shared by all structural parts of the model; they fill the parts' " +
      "own board and edgeband params.",
  },
}

/** Board and edgeband for the door and the drawer front. */
const frontMaterialGroup: ConfigGroupDef<typeof frontMaterialSchema> = {
  schema: frontMaterialSchema,
  paramBase: {
    label: "Front Material",
    i18nKey: i18nKey("drawer-door-cabinet.frontMaterial"),
    aiContext:
      "Board and edgeband shared by the model's visible fronts; they fill the fronts' own " +
      "board and edgeband params.",
  },
}

/**
 * Drawer and Door Cabinet: a standard-catalog cabinet box with no top and back stretchers, split by a
 * horizontal divider into a 150 mm drawer section at the bottom and a pivot door with a 100 mm top
 * stile above.
 */
export const buildDrawerDoorCabinet = (libContext: ModuleLibraryContext): ModuleDefinition[] => {
  const cabinetBox = CABINET_BOX.resolve(libContext)
  const divider = DIVIDER.resolve(libContext)
  const drawerGroup = DRAWER_GROUP.resolve(libContext)
  const pivotDoor = PIVOT_DOOR.resolve(libContext)
  const mask = MASK.resolve(libContext)

  // The door with a mask that keeps only its top bar, 100 mm, above it.
  const doorWithTopStile = composeModules(
    {
      module: pivotDoor,
      overrides: {
        excluded: ["standalone", "standaloneHeight", "standaloneWidth", "openAreaKey"],
        replacements: { standalone: false, openAreaKey: "front-open-area" },
      },
    },
    {
      module: mask,
      paramBase: {
        label: "Top Stile",
        i18nKey: i18nKey("drawer-door-cabinet.topStile"),
        aiContext: "Fixed 100 mm strip (a mask with only its top bar) above the door.",
      },
      childKey: "topStile",
      parentSlot: "child",
      overrides: {
        excluded: ["standalone", "standaloneWidth", "standaloneHeight"],
        replacements: { standalone: false },
        seed: {
          frameWidths: { top: 100, bottom: 0, left: 0, right: 0 },
          joinSystem: JOIN_SYSTEMS.DFIX,
        },
      },
    }
  )

  const cabinet = composeMultiSlot({
    parent: {
      module: cabinetBox,
      overrides: {
        excluded: [],
        replacements: {},
        seed: {
          topSide: "None",
          backSide: "RegularStretchers",
          joinSystem: JOIN_SYSTEMS.DFIX,
        },
        paramPropertyOverrides: {
          structureBoard: { level: "advanced" },
          backSideBoard: { level: "advanced" },
          edges: { level: "advanced" },
        },
      },
      sharedConfigRefs: [
        {
          configKey: "structuralMaterial",
          merge: mapParams({
            board: ["structureBoard", "backSideBoard"],
            edges: "edges",
          }),
        },
      ],
    },
    slotProvider: {
      module: divider,
      childKey: "divider",
      paramBase: {
        label: "Divider",
        i18nKey: i18nKey("drawer-door-cabinet.divider"),
        aiContext:
          "Horizontal divider between the 150 mm drawer section at the bottom and the door " +
          "section above; the model fixes its sections.",
      },
      parentSlot: "child",
      numSlots: 2,
      overrides: {
        excluded: [
          "standalone",
          "standaloneDimensions",
          "openAreaKey",
          "direction",
          "sections",
          "joinSystem",
          "dividerMode",
          "dividerOwnership",
          "frontIndent",
          "backIndent",
        ],
        replacements: {
          standalone: false,
          openAreaKey: "front-open-area",
          direction: "horizontal",
          dividerMode: "physical",
          frontIndent: 0,
          backIndent: 0,
          sections: [
            { mode: "fixed", value: 150 },
            { mode: "proportional", value: 1 },
          ],
          joinSystem: JOIN_SYSTEMS.DFIX,
        },
        paramPropertyOverrides: {
          sections: { level: "internal" },
          board: { level: "advanced" },
          edges: { level: "advanced" },
        },
      },
      sharedConfigRefs: [
        {
          configKey: "structuralMaterial",
          merge: defaultConfigMerge,
        },
      ],
    },
    configGroups: {
      structuralMaterial: structuralMaterialGroup,
      frontMaterial: frontMaterialGroup,
    },
    slotChildren: {
      drawers: {
        slotIndex: 0,
        module: drawerGroup,
        paramBase: {
          label: "Drawers",
          i18nKey: i18nKey("drawer-door-cabinet.drawers"),
          aiContext:
            "The single drawer in the bottom section; its materials come from " +
            "structuralMaterial and frontMaterial.",
        },
        sharedConfigRefs: [
          {
            configKey: "structuralMaterial",
            merge: mapParamsNested("bodyConstruction", {
              board: ["sidesBoard", "bottomBoard"],
              edges: "sidesEdges",
            }),
          },
          {
            configKey: "frontMaterial",
            merge: mapParams({ board: "frontBoard", edges: "frontEdges" }),
          },
        ],
        overrides: {
          excluded: ["openAreaKey", "drawerHeights"],
          replacements: {
            openAreaKey: "front-open-area",
            drawerHeights: [{ mode: "proportional", value: 1 }],
          },
          seed: {
            bodyConstruction: { joinSystem: JOIN_SYSTEMS.DFIX },
          },
          paramPropertyOverrides: {
            drawerHeights: { level: "internal" },
            frontBoard: { level: "advanced" },
            frontEdges: { level: "advanced" },
            bodyConstruction: { level: "advanced" },
          },
        },
      },
      door: {
        slotIndex: 1,
        module: doorWithTopStile,
        paramBase: {
          label: "Door",
          i18nKey: i18nKey("drawer-door-cabinet.door"),
          aiContext:
            "The pivot door in the top section, under its top stile; its materials come from " +
            "frontMaterial and structuralMaterial.",
        },
        sharedConfigRefs: [
          { configKey: "frontMaterial", merge: defaultConfigMerge },
          {
            configKey: "structuralMaterial",
            merge: mapParamsNested("topStile", { board: "board", edges: "edges" }),
          },
        ],
        overrides: {
          excluded: [],
          replacements: {},
          paramPropertyOverrides: {
            board: { level: "advanced" },
            edges: { level: "advanced" },
            topStile: { level: "advanced" },
          },
        },
      },
    },
  })

  return [
    completeModule(cabinet, i18nKey("module.drawer-door-cabinet"), {
      name: "Drawer and Door Cabinet",
      aiContext:
        "A fixed cabinet model: a cabinet box with no top panel and back stretchers, split " +
        "horizontally into a 150 mm drawer section at the bottom and a pivot door with a 100 " +
        "mm top stile above. Materials are set once in structuralMaterial and frontMaterial. " +
        "Use it only when this exact model is asked for.",
      version: cabinetBox.version,
      ref: makeModuleRef("drawer-door-cabinet"),
      tags: [
        ...new Set([
          ...cabinetBox.tags,
          ...divider.tags,
          ...drawerGroup.tags,
          ...pivotDoor.tags,
          ...mask.tags,
        ]),
      ],
    }),
  ]
}
