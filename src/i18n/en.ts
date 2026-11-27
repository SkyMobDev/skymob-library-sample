import { defineTranslations, TranslatedItemType } from "@skymobdev/sdk/authoring"
import { LIBRARY_ID } from "../info"

export const libraryEn = defineTranslations({
  [`library.${LIBRARY_ID}`]: {
    type: TranslatedItemType.Library,
    label: "Sample Library",
    description: "Sample cabinet modules, built on the standard catalog's modules.",
  },
  "module.drawer-door-cabinet": {
    type: TranslatedItemType.Module,
    label: "Drawer and Door Cabinet",
    description:
      "A cabinet box without a top panel, with regular back stretchers, divided horizontally into a drawer on the bottom and a pivot door on top.",
    tags: ["cabinet", "drawer", "door"],
  },
  "drawer-door-cabinet.divider": {
    type: TranslatedItemType.Parameter,
    label: "Divider",
    description: "Configuration for the horizontal divider that splits the cabinet.",
  },
  "drawer-door-cabinet.drawers": {
    type: TranslatedItemType.Parameter,
    label: "Drawers",
    description: "Configuration for the drawer section at the bottom.",
  },
  "drawer-door-cabinet.door": {
    type: TranslatedItemType.Parameter,
    label: "Door",
    description: "Configuration for the pivot door section at the top.",
  },
  "drawer-door-cabinet.topStile": {
    type: TranslatedItemType.Parameter,
    label: "Top Stile",
    description: "Configuration for the top stile frame on the door section.",
  },
  "drawer-door-cabinet.structuralMaterial": {
    type: TranslatedItemType.Parameter,
    label: "Structural Material",
    description: "Board and edgeband for structural parts (cabinet box, divider, drawer body).",
  },
  "drawer-door-cabinet.structuralMaterial.board": {
    type: TranslatedItemType.Parameter,
    label: "Board",
    description: "Board material for structural parts.",
  },
  "drawer-door-cabinet.structuralMaterial.edges": {
    type: TranslatedItemType.Parameter,
    label: "Edges",
    description: "Edgeband for structural parts.",
  },
  "drawer-door-cabinet.frontMaterial": {
    type: TranslatedItemType.Parameter,
    label: "Front Material",
    description: "Board and edgeband for front-facing parts (door panels, drawer fronts).",
  },
  "drawer-door-cabinet.frontMaterial.board": {
    type: TranslatedItemType.Parameter,
    label: "Board",
    description: "Board material for front-facing parts.",
  },
  "drawer-door-cabinet.frontMaterial.edges": {
    type: TranslatedItemType.Parameter,
    label: "Edges",
    description: "Edgeband for front-facing parts.",
  },
  "module.desk": {
    type: TranslatedItemType.Module,
    label: "Desk",
    description:
      "A desk with a top, two sides and a support beam under the top. The top rests on the sides or fits between them.",
    tags: ["desk", "table"],
  },
  "desk.param.width": {
    type: TranslatedItemType.Parameter,
    label: "Width (mm)",
    description: "Overall width of the desk, from the outside of one side to the other.",
  },
  "desk.param.height": {
    type: TranslatedItemType.Parameter,
    label: "Height (mm)",
    description: "Overall height of the desk, from the floor to the top's upper face.",
  },
  "desk.param.depth": {
    type: TranslatedItemType.Parameter,
    label: "Depth (mm)",
    description: "Overall depth of the desk, from front to back.",
  },
  "desk.param.construction": {
    type: TranslatedItemType.Parameter,
    label: "Construction",
    description: "How the top meets the sides.",
    options: {
      TopOverSides: {
        label: "Top over the sides",
        description: "The top spans the full width and rests on the sides.",
      },
      TopBetweenSides: {
        label: "Top between the sides",
        description: "The sides run the full height and the top fits between them.",
      },
    },
  },
  "desk.param.beamHeight": {
    type: TranslatedItemType.Parameter,
    label: "Beam Height (mm)",
    description: "Height of the support beam under the top.",
  },
  "desk.param.beamSetback": {
    type: TranslatedItemType.Parameter,
    label: "Beam Setback (mm)",
    description: "Distance from the back of the desk to the support beam; 0 puts it flush with the back.",
  },
  "desk.param.topBoard": {
    type: TranslatedItemType.Parameter,
    label: "Top Board",
    description: "Board for the top.",
  },
  "desk.param.topEdges": {
    type: TranslatedItemType.Parameter,
    label: "Top Edgeband",
    description: "Edgeband for the top's edges.",
  },
  "desk.param.topGrainDirection": {
    type: TranslatedItemType.Parameter,
    label: "Top Grain Direction",
    description: "Direction of the board's grain on the top.",
    options: { LeftRight: "Left–Right", FrontBack: "Front–Back" },
  },
  "desk.param.structureBoard": {
    type: TranslatedItemType.Parameter,
    label: "Structure Board",
    description: "Board for the sides and the support beam.",
  },
  "desk.param.structureEdges": {
    type: TranslatedItemType.Parameter,
    label: "Structure Edgeband",
    description: "Edgeband for the edges of the sides and the support beam.",
  },
  "desk.param.edgeApplication": {
    type: TranslatedItemType.Parameter,
    label: "Edge Application",
    description: "Rule for which edges receive edgeband.",
    options: {
      AllSides: { label: "Apply to all edges", description: "Every edge of every piece." },
      Uncovered: {
        label: "Apply to uncovered edges",
        description: "Every edge no other piece covers, including those on the floor.",
      },
      PotentiallyVisible: {
        label: "Apply to potentially visible edges",
        description: "Visible edges, plus the back edges and the beam's lower edge.",
      },
      Visible: {
        label: "Apply to visible edges",
        description: "The front edges, and the top's ends and the sides' upper edges where exposed.",
      },
      None: { label: "Do not apply edgeband", description: "No edges receive edgeband." },
    },
  },
  "piece.desk-top": { type: TranslatedItemType.PartLabel, label: "Desk Top" },
  "piece.desk-side": { type: TranslatedItemType.PartLabel, label: "Desk Side" },
  "piece.desk-beam": { type: TranslatedItemType.PartLabel, label: "Support Beam" },
})

/** Diagnostic messages, keyed by diagnostic code. `{name}` reads the diagnostic's `params.name`. */
export const libraryEnMessages = {
  "desk.too_narrow":
    "At {width} mm the desk leaves no room between its sides for the beam. Use at least {min} mm.",
  "desk.too_low": "At {height} mm the desk leaves no room under its top. Use at least {min} mm.",
  "desk.beam_too_tall":
    "A {beamHeight} mm beam does not fit under the top, which leaves {space} mm. Use at most {max} mm.",
  "desk.beam_setback_too_deep":
    "With a {beamSetback} mm setback the beam would stick out of the front of a {depth} mm deep desk. Use at most {max} mm.",
  "desk.assembly_inconsistent": "The desk's pieces could not be positioned consistently.",
} as const
