# Changelog

All notable changes to MolVis are documented here. The whole repo is
version-locked to one tag, so this is the single changelog for the core
engine, the web page, the VSCode extension, and the Python package.

This file is the source of truth for the in-app "What's new" dialog — the
page reads it at build time (see `page/src/lib/changelog.ts`). Keep the
format below: `## [version] - date`, then `### Section` groups, then
`- bullet` items.

## [0.0.7] - 2026-05-30

### Core
- Bump @molcrafts/molrs to 0.0.14
- Model volumetric grids as blocks (Cube / CHGCAR readers)
- IO / overlay / runtime cleanup after core review

### UI
- Version badge in the top bar opens this changelog
- Translucent overlays no longer hide atoms underneath

## [0.0.6] - 2026-05-20

### Core
- Add repository / homepage / bugs metadata to package.json
- Core review remediation pass
