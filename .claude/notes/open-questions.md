# Open Questions

Uncertainties to resolve over time; delete entries when settled.

## PBC / coordinate-frame (2026-03)

### Product model (settled)

- `matches` = **auto-attach default visual layers under the file loader**,
  default on; user unchecks. Particles / Cartoon / Simulation cell / Bonds
  (if present) / Isosurface (grid files).
- Analysis / opt-in viz: `matches() === false`, `isApplicable` for Add menu.
  Never auto-attach Steinhardt / Solid-liquid (they overwrite CPK) or
  density surfaces by default.

### Density vs atoms wrap (fixed for Gaussian density surface)

Root cause was **not** Wrap PBC being half-applied. freud-style
`GaussianDensity` always deposits on **simbox voxels** with **PBC
wrap_index**. mmCIF ASU atoms sit outside [0,L); contributions fold into
the primary cell; Particles still draw deposited Cartn → surface in box,
protein outside.

**Fix:** Gaussian density surface (and Construct surface mesh) use
**atom AABB + pad, pbc=false** as the density domain, same world coords
as Particles. Crystal `frame.box` remains Simulation cell only.

### Coordinate wrap (settled 2026-08-21 — single gate)

System boolean `wrapEnabled` on `modifierPipeline` after compose:
`false` (as-deposited, default) | `true` (`Box.wrap` atom columns once).
Control is a Switch on Simulation cell (Draw Box). **No** wrap-atoms /
wrap-molecules split; **no** Wrap PBC modifier. Unwrap trajectories remains
an Add-menu modifier only.

Edge bonds are not wrap objects: Draws use `Box.delta(..., MI)` on the
post-gate frame. Forbidden: any second column-fold algorithm for “pretty
bonds” (former `wrap-molecules`).

### Draw-time MI vs full wrap (settled 2026-08-11, restated 2026-08-21)

Full-frame `Box.wrap` lives only in `stage/src/coords/wrap.ts` via
`applyWrapIfEnabled`. Cartoon chain-split and bond `miDisplacements` use
**minimum-image delta** on the already post-gate frame — they do not
re-wrap atom columns. Guarded by `stage/tests/coords/wrap_locality.test.ts`
and the straddling-dimer MI length case in `apply_wrap.test.ts`.

### Remaining debt

1. Volumetric files (CHGCAR/CUBE) use the file box + periodic MC when
   the grid is natively cell-aligned. **Accepted** for 0.2.x — the wrap
   gate does not rewrite grids; isosurface places voxels with `hMatrix()`.
   Gaussian density stays atom-AABB + `pbc=false` so surfaces follow atoms
   (whether wrapped or deposited).
