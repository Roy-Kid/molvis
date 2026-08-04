# Molvis Page

React web application for MolVis. It is the shared human-review surface for
browser, Python/Jupyter, VS Code, and agent-driven RPC sessions.

Current app capabilities include:

- Full MolVis canvas integration through `MolvisWrapper`
- Left and right sidebars for mode-specific controls
- Timeline controls for trajectory playback
- Analysis panels such as histogram, scatter, and data inspection
- Export, settings, and keyboard shortcuts dialogs
- Bidirectional RPC state synchronization
- Visual review and atom/bond selection feedback for agent workflows

## Development

```bash
npm install
npm run dev
```

## Tests

```bash
npm run test:page          # from the repository root
# or
npm test -w page
```

Tests live under `tests/` and mirror `src/` where practical. Component and hook
tests use Chromium; pure helpers should remain browser-independent even though
they share the same Rstest runner. Generated browser artifacts and Python cache
files do not belong in test directories.

## Build

```bash
npm run build
```

## Structure

- `src/App.tsx` application shell and panel layout
- `src/MolvisWrapper.tsx` mounts and manages the MolVis runtime
- `src/ui/` mode panels, pipeline controls, dialogs, and analysis views
- `tests/` component, hook, plugin-contract, and layout regression tests

This package is the primary web UI surface for MolVis, not a minimal canvas demo.
