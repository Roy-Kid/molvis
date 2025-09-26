# Molvis Page

Minimal example keeping only the core rendering area.

- Removed original sidebar, buttons, placeholders, Chinese comments
- `MolvisWrapper` handles create/destroy of Molvis instance & resize
- Internal Molvis UI is hidden; only 3D canvas shown

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Structure

- `src/App.tsx` App entry, mounts `MolvisWrapper` + tiny optional panel
- `src/MolvisWrapper.tsx` Molvis wrapper component
- `src/index.tsx` React root mounting

For future interaction (load molecules, change representation, capture), add a lightweight control layer instead of a heavy sidebar.
