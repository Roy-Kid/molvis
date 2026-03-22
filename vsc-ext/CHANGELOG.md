# Changelog

## [0.0.2]

### Core
- Migrate WASM API to molrs-wasm bundler target (`viewColF32`/`setColF32`/`copyColStr`)
- Zero-copy column access via `viewCol*` for all rendering hot paths
- Bond order column upgraded from U8 to U32
- Replace `F32View` with `WasmArray` for PBC wrapping
- Reader class renames: `PDBReader`, `XYZReader`, `LAMMPSReader`
- `dtype()` for column type introspection, replaces try/catch probing
- Fix: loading new file now fully clears previous scene (box, ribbon, history)
- Fix: `HideSelectionModifier` preserves simulation box in output frame
- Fix: `ColorByPropertyModifier.inspect()` handles u32/i32 columns correctly
- Remove non-functional representations (Wireframe, Ribbon, Ribbon + Stick)
- Remove non-functional graphics toggles (Shadows, SSAO, Bloom, Depth of Field)

### VSCode Extension
- Custom editor for `.pdb`, `.xyz`, `.data` files
- Quick View side-by-side preview
- Full editor workspace with React UI
- Zarr directory support for trajectory data
- Drag-and-drop file loading
- Configurable via `molvis.config` and `molvis.settings`

### UI
- Atom/Bond diameter controls moved from right-click menu to Render panel
- Simulation box controls (show/hide, color, line thickness) in Render panel
- All Render panel controls are now immediate (no Apply button)
- Number inputs replace sliders for precise value entry
- Remove non-functional Label and Opacity controls

### Infrastructure
- Pre-commit hook with Husky + lint-staged (Biome)
- GitHub Actions CI on push/PR (lint, build, test)
- Automated vsc-ext publish on tag push (VS Marketplace + Open VSX)
- rstest browser mode for web-native testing
- molrs-wasm bundler target (single pkg, no node/web split)
