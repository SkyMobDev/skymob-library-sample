/** An SVG imported with `?raw` is its markup. */
declare module "*.svg?raw" {
  const markup: string
  export default markup
}
