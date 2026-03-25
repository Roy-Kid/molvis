# Molvis Page

React web application for MolVis.

Current app capabilities include:

- Full MolVis canvas integration through `MolvisWrapper`
- Left and right sidebars for mode-specific controls
- Timeline controls for trajectory playback
- Analysis panels such as histogram, scatter, and data inspection
- Export, settings, and keyboard shortcuts dialogs

## Development

```bash
npm install
npm run dev
```

## Test

```bash
npm run test
```

## Build

```bash
npm run build
```

## Structure

- `src/App.tsx` application shell and panel layout
- `src/MolvisWrapper.tsx` mounts and manages the MolVis runtime
- `src/ui/` mode panels, pipeline controls, dialogs, and analysis views
- `test/` lightweight frontend smoke tests

This package is the primary web UI surface for MolVis, not a minimal canvas demo.
