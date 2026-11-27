import {
  defineI18NKeyFunc,
  defineLangCollection,
  type LanguageResources,
} from "@skymobdev/sdk/authoring"
import deskImage from "../images/desk.svg?raw"
import cabinetImage from "../images/drawer-door-cabinet.svg?raw"
import { libraryEn, libraryEnMessages } from "./en"
import { libraryPt, libraryPtMessages } from "./pt"

export const i18nKey = defineI18NKeyFunc(libraryEn)

/** A diagnostic code; a code missing from `libraryEnMessages` is a type error. */
export const diagCode = defineI18NKeyFunc(libraryEnMessages)

/** Each module's picture is the image under its module id. */
export const i18nResources: LanguageResources = {
  items: defineLangCollection({ en: libraryEn, pt: libraryPt }, "en"),
  text: defineLangCollection({ en: libraryEnMessages, pt: libraryPtMessages }, "en"),
  images: { "drawer-door-cabinet": cabinetImage, desk: deskImage },
}
