import { defineTranslations, TranslatedItemType } from "@skymobdev/sdk/authoring"
import { LIBRARY_ID } from "../info"
import type { libraryEnMessages } from "./en"

export const libraryPt = defineTranslations({
  [`library.${LIBRARY_ID}`]: {
    type: TranslatedItemType.Library,
    label: "Biblioteca de Exemplo",
    description: "Módulos de armário de exemplo, montados com os módulos do catálogo padrão.",
  },
  "module.drawer-door-cabinet": {
    type: TranslatedItemType.Module,
    label: "Armário com Gaveta e Porta",
    description:
      "Uma caixa de armário sem painel superior, com travessas traseiras regulares, dividida horizontalmente com uma gaveta na parte inferior e uma porta de giro na parte superior.",
    tags: ["armário", "gaveta", "porta"],
  },
  "drawer-door-cabinet.divider": {
    type: TranslatedItemType.Parameter,
    label: "Divisória",
    description: "Configuração da divisória horizontal que separa o armário.",
  },
  "drawer-door-cabinet.drawers": {
    type: TranslatedItemType.Parameter,
    label: "Gavetas",
    description: "Configuração da seção de gavetas na parte inferior.",
  },
  "drawer-door-cabinet.door": {
    type: TranslatedItemType.Parameter,
    label: "Porta",
    description: "Configuração da seção de porta de giro na parte superior.",
  },
  "drawer-door-cabinet.topStile": {
    type: TranslatedItemType.Parameter,
    label: "Travessa Superior",
    description: "Configuração da travessa superior na seção da porta.",
  },
  "drawer-door-cabinet.structuralMaterial": {
    type: TranslatedItemType.Parameter,
    label: "Material Estrutural",
    description:
      "Chapa e fita de borda das peças estruturais (caixa do armário, divisória, corpo da gaveta).",
  },
  "drawer-door-cabinet.structuralMaterial.board": {
    type: TranslatedItemType.Parameter,
    label: "Chapa",
    description: "Chapa das peças estruturais.",
  },
  "drawer-door-cabinet.structuralMaterial.edges": {
    type: TranslatedItemType.Parameter,
    label: "Fita de Borda",
    description: "Fita de borda das peças estruturais.",
  },
  "drawer-door-cabinet.frontMaterial": {
    type: TranslatedItemType.Parameter,
    label: "Material Frontal",
    description: "Chapa e fita de borda das peças frontais (portas, frentes de gaveta).",
  },
  "drawer-door-cabinet.frontMaterial.board": {
    type: TranslatedItemType.Parameter,
    label: "Chapa",
    description: "Chapa das peças frontais.",
  },
  "drawer-door-cabinet.frontMaterial.edges": {
    type: TranslatedItemType.Parameter,
    label: "Fita de Borda",
    description: "Fita de borda das peças frontais.",
  },
  "module.desk": {
    type: TranslatedItemType.Module,
    label: "Escrivaninha",
    description:
      "Uma escrivaninha com tampo, duas laterais e uma viga suporte sob o tampo. O tampo fica apoiado sobre as laterais ou encaixado entre elas.",
    tags: ["escrivaninha", "mesa"],
  },
  "desk.param.width": {
    type: TranslatedItemType.Parameter,
    label: "Largura (mm)",
    description: "Largura total da escrivaninha, de fora a fora das laterais.",
  },
  "desk.param.height": {
    type: TranslatedItemType.Parameter,
    label: "Altura (mm)",
    description: "Altura total da escrivaninha, do chão à face superior do tampo.",
  },
  "desk.param.depth": {
    type: TranslatedItemType.Parameter,
    label: "Profundidade (mm)",
    description: "Profundidade total da escrivaninha, da frente ao fundo.",
  },
  "desk.param.construction": {
    type: TranslatedItemType.Parameter,
    label: "Construção",
    description: "Como o tampo se une às laterais.",
    options: {
      TopOverSides: {
        label: "Tampo sobre as laterais",
        description: "O tampo ocupa a largura toda e fica apoiado sobre as laterais.",
      },
      TopBetweenSides: {
        label: "Tampo entre as laterais",
        description: "As laterais ocupam a altura toda e o tampo fica encaixado entre elas.",
      },
    },
  },
  "desk.param.beamHeight": {
    type: TranslatedItemType.Parameter,
    label: "Altura da Viga (mm)",
    description: "Altura da viga suporte sob o tampo.",
  },
  "desk.param.beamSetback": {
    type: TranslatedItemType.Parameter,
    label: "Recuo da Viga (mm)",
    description: "Distância do fundo da escrivaninha até a viga suporte; 0 deixa a viga rente ao fundo.",
  },
  "desk.param.topBoard": {
    type: TranslatedItemType.Parameter,
    label: "Chapa do Tampo",
    description: "Chapa do tampo.",
  },
  "desk.param.topEdges": {
    type: TranslatedItemType.Parameter,
    label: "Fita do Tampo",
    description: "Fita de borda das bordas do tampo.",
  },
  "desk.param.topGrainDirection": {
    type: TranslatedItemType.Parameter,
    label: "Direção do Veio do Tampo",
    description: "Direção do veio da chapa no tampo.",
    options: { LeftRight: "Esquerda–Direita", FrontBack: "Frente–Fundo" },
  },
  "desk.param.structureBoard": {
    type: TranslatedItemType.Parameter,
    label: "Chapa da Estrutura",
    description: "Chapa das laterais e da viga suporte.",
  },
  "desk.param.structureEdges": {
    type: TranslatedItemType.Parameter,
    label: "Fita da Estrutura",
    description: "Fita de borda das bordas das laterais e da viga suporte.",
  },
  "desk.param.edgeApplication": {
    type: TranslatedItemType.Parameter,
    label: "Aplicação de Borda",
    description: "Regra para quais bordas recebem fita de borda.",
    options: {
      AllSides: { label: "Aplicar em todas as bordas", description: "Todas as bordas de todas as peças." },
      Uncovered: {
        label: "Aplicar em bordas descobertas",
        description: "Todas as bordas que nenhuma outra peça cobre, inclusive as que tocam o chão.",
      },
      PotentiallyVisible: {
        label: "Aplicar em bordas potencialmente visíveis",
        description: "As bordas visíveis, mais as bordas do fundo e a borda inferior da viga.",
      },
      Visible: {
        label: "Aplicar em bordas visíveis",
        description: "As bordas da frente, e as pontas do tampo e as bordas superiores das laterais quando expostas.",
      },
      None: { label: "Não aplicar fita de borda", description: "Nenhuma borda recebe fita de borda." },
    },
  },
  "piece.desk-top": { type: TranslatedItemType.PartLabel, label: "Tampo" },
  "piece.desk-side": { type: TranslatedItemType.PartLabel, label: "Lateral" },
  "piece.desk-beam": { type: TranslatedItemType.PartLabel, label: "Viga Suporte" },
})

/** Mensagens de diagnóstico, pelo código. `{name}` lê `params.name` do diagnóstico. */
export const libraryPtMessages = {
  "desk.too_narrow":
    "Com {width} mm a escrivaninha não deixa espaço para a viga entre as laterais. Use pelo menos {min} mm.",
  "desk.too_low": "Com {height} mm a escrivaninha não deixa espaço sob o tampo. Use pelo menos {min} mm.",
  "desk.beam_too_tall":
    "Uma viga de {beamHeight} mm não cabe sob o tampo, que deixa {space} mm. Use no máximo {max} mm.",
  "desk.beam_setback_too_deep":
    "Com recuo de {beamSetback} mm a viga sairia pela frente de uma escrivaninha de {depth} mm de profundidade. Use no máximo {max} mm.",
  "desk.assembly_inconsistent": "Não foi possível posicionar as peças da escrivaninha de forma consistente.",
} satisfies Record<keyof typeof libraryEnMessages, string>
