# integration/

Multi-module suites that must run under **core's** rstest root (WASM +
`worker.js` resolution via `import.meta.url`).

| File | Why not unit |
|------|----------------|
| `headless_renderer.test.ts` | `MolvisApp` + `MolvisRenderer` façade composition |
| `world_reset_camera.test.ts` | full renderer framing through pipeline |

Everything else is unit-mirrored under `tests/<area>/` or goldens in
repo-root `regressions/`.
