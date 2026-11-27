# skymob-library-sample

A sample module library for the SkyMob designer, built with `@skymobdev/sdk`. Fork it to start a
library of your own. Its id is `library-sample` and it depends on `standard-catalog`. It holds two
modules:

- **`desk`**, a base module that builds its own pieces: a top, two sides and a support beam under
  the top, with the top resting on the sides or fitting between them.
- **`drawer-door-cabinet`**, a composite of standard-catalog modules: a cabinet box with no top
  panel and with back stretchers, split by a horizontal divider into a 150 mm drawer section at the
  bottom and a pivot door with a 100 mm top stile above.

To make it yours, change `name` and `skymob.id` in `package.json`, `LIBRARY_ID` in `src/info.ts`,
and the library's name in `src/main.ts` and `src/i18n/`.

## Setup

Node 22.12 or newer, with pnpm through corepack: `package.json` pins the pnpm version, so
`corepack enable` once is all it takes.

```
corepack enable
pnpm install
```

- **`@skymobdev/sdk`, `@skymobdev/standard-catalog-types` and `@skymobdev/cad-mock`** come from
  https://npm.skymob.app, which `.npmrc` maps the `@skymobdev` scope to. No token or account is
  needed.
- `pnpm-workspace.yaml` holds third-party versions back for 5 days (`minimumReleaseAge`). The
  `@skymobdev/*` packages are exempt, so a new SDK release installs right away.

```
pnpm test          # vitest
pnpm run typecheck
pnpm run build     # dist/library-sample.js and dist/loadable.json
pnpm run check     # loads the bundle in the SES sandbox, materializes and fuzzes every module
pnpm run dev       # the module workbench, hot-reloading on save
```

## Tests

`test/desk.spec.ts` builds the desk and fuzzes it.

`test/drawer-door-cabinet.spec.ts` checks that the cabinet builds the same pieces as the standard
catalog builds for the same cabinet. It covers four parameter sets, recorded in
`test/fixtures/stdlib-drawer-door-cabinet.json`, and compares each piece's id, role, size,
material, edges and placement, plus the diagnostics.

Material presets are the one difference. The cabinet passes on only the group materials the user
picked (`skipUnset`), so under a board preset every part with an unset group takes the preset's
board. That includes the top stile, a standard-catalog `mask`, which fills from the mask and front
materials.

## Agent skills

`pnpm run skills` copies the SDK's skills into `.claude/skills/` and writes `AGENTS.md`.
