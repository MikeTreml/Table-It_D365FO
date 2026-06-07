# Public Repository File Catalog

Purpose: document what should be included when preparing a cleaned public/open-source copy of this repository.

## Include

These files and folders are part of the source project and should be included in a public source repo.

| Path | Purpose |
| --- | --- |
| `.babelrc` | Babel config for React, TypeScript, and Chrome 120 build targets. |
| `.eslintrc.json` | ESLint configuration used by `npm run lint`. |
| `.gitignore` | Keeps generated, local, and private working files out of Git. |
| `.prettierrc.json` | Prettier formatting configuration. |
| `docs/chrome-web-store-listing-copy.md` | Paste-ready Chrome Web Store listing text. |
| `docs/chrome-web-store-submission.md` | Chrome Web Store release checklist and permission justifications. |
| `docs/privacy-policy.md` | Privacy policy content for the Chrome Web Store listing. |
| `LICENSE` | MIT license for the open-source repo. |
| `package-lock.json` | Locked npm dependency graph for reproducible installs. |
| `package.json` | npm scripts, dependencies, metadata, and browserslist target. |
| `postcss.config.js` | Tailwind CSS 4 PostCSS config. |
| `public/icon16.png` | Extension toolbar/store icon asset. |
| `public/icon32.png` | Extension toolbar/store icon asset. |
| `public/icon48.png` | Extension extension-management icon asset. |
| `public/icon128.png` | Chrome Web Store/package icon asset. |
| `public/manifest.json` | Chrome extension manifest. |
| `src/` | Main React/TypeScript extension source. |
| `src/assets/data/` | Bundled D365FO metadata payload used by the Tables and Relations pages. Large, but intentional. |
| `tsconfig.json` | TypeScript strict compiler configuration and path aliases. |
| `webpack/` | Webpack build configuration for all extension entry points. |

## Include After Cleanup

These are useful for a public repo, but the current versions should be cleaned before publishing.

| Path | Current Issue | Recommendation |
| --- | --- | --- |
| `README.md` | Stale. Mentions Fluent UI, nonexistent test scripts, and old `chromeExtD365FO` structure. | Rewrite before public release. |
| `package.json` | Contains `"private": true`. | Remove or set to `false` in the public copy if you want normal open-source npm-style metadata. |
| `package.json` repository URL | Points to `MikeTreml/Table-It_D365FO`. | Keep for the public repo. |
| `docs/*` GitHub URLs | Point to `MikeTreml/Table-It_D365FO`. | Keep for the public repo or update if GitHub Pages is later used. |
| `src/popup/tabs/AboutTab.tsx` | Links to `MikeTreml/Table-It_D365FO`. | Keep for the public repo. |

## Exclude

These files and folders should not be included in the cleaned public source repo.

| Path | Reason |
| --- | --- |
| `.git/` | Private repository history/config; start a fresh public repo instead. |
| `.vs/` | Visual Studio local workspace state. |
| `.claude/` | Local agent/tooling notes. |
| `.codex/` | Local Codex skills/tooling notes. |
| `AGENTS.md` | Internal agent guidance; includes local/sibling repo context. |
| `CLAUDE.md` | Internal agent guidance; duplicates `AGENTS.md`. |
| `dist/` | Generated build output. Build it locally instead. |
| `node_modules/` | Installed dependencies; use `npm install`. |
| `table-it-d365fo-upload.zip` | Chrome Web Store upload artifact, not source. |
| `*.map` | Generated source maps. |
| `*.zip` | Generated package/archive artifacts. |
| `public/img/` | Unused legacy assets. Current source and Webpack build do not reference this folder; it also includes old third-party/branded images. |
| `scripts/convert-table-list.js` | Legacy one-off converter. It depends on missing `BuiltInTableList.min.js` and is not used by the build or app runtime. |
| `scripts/gen_icons.py` | Legacy/local icon generator. It writes to a hard-coded path outside this repo and does not appear to be part of the current build. |
| `src/shared/components/index.ts` | Unused barrel file. Current code imports components directly. |
| `src/shared/constants/endpoints.ts` | Unused endpoint helper. Current API/url code builds endpoints directly through `D365ApiClient`, `url.ts`, and `odata.ts`. |
| `src/shared/constants/languages.ts` | Duplicate/unused language list. Current UI imports `LANGUAGES` from `src/shared/constants/index.ts`. |
| `src/shared/constants/shortcuts.ts` | Unused shortcut config. Manifest commands and page buttons currently define navigation behavior. |
| `src/shared/hooks/index.ts` | Unused barrel file. Current code imports hooks directly. |
| `src/shared/hooks/useKeyboardShortcuts.ts` | Unused hook. Chrome extension shortcuts are handled through `public/manifest.json` and the service worker. |
| `src/shared/types/entity.ts` | Duplicate/unused entity type definitions. Current code imports from `src/shared/types/index.ts`. |
| `src/shared/types/odata.ts` | Duplicate/unused OData type definitions. Current code imports from `src/shared/types/index.ts` and `src/shared/types/storage.ts`. |
| `src/shared/types/table.ts` | Duplicate/unused table type definitions. Current code imports from `src/shared/types/index.ts`. |
| `src/shared/utils/fuzzySearch.ts` | Unused Fuse.js wrapper. Current table search uses `tableSearch.ts`. |
| `src/shared/utils/index.ts` | Unused barrel file. Current code imports utils directly. |
| `src/shared/utils/validation.ts` | Unused validation helpers. Current profile/config UI does not import them. |
| `.env`, `.env.*` | Environment-specific local secrets/config if added later. |
| `*.log` | Generated logs. |

## Optional

| Path | Purpose | Recommendation |
| --- | --- | --- |
| `generate-icons.html` | Browser-based legacy icon generator. | Exclude unless you want to preserve the manual icon workflow. |

## Notes

- `public/img/` appears unused by the current extension. The only references found were SVG self-metadata such as `sodipodi:docname`.
- `src/assets/data/` is large, but it is not secret; it contains bundled D365FO metadata used by the extension.
- A dependency walk was run against `src/`, Webpack entries, HTML templates, copied assets, and the relations worker runtime-loaded JSON files. The source files listed in the exclude section had zero inbound references.
- Before the first public commit, inspect staged files and confirm excluded folders are absent.
