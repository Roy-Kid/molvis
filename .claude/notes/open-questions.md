# Open Questions

Uncertainties to resolve over time; delete entries when settled.

## PBC / coordinate-frame (2026-03)

### Product model (settled)

- `matches` = **auto-attach default visual layers under the file loader**,
  default on; user unchecks. Particles / Ribbon / Simulation cell / Bonds
  (if present) / Create isosurface (grid files).
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

### Remaining debt

1. `WrapPBCModifier` is still the only place that moves atoms into cell
2. Ribbon MI chain-splits vs wrap
3. Bond MI at draw time
4. Volumetric files (CHGCAR/CUBE) still use file box + periodic MC when
   the grid is natively cell-aligned (correct for those formats)

Longer term: single coordinate policy
`AsDeposited | WrapMolecules | WrapAtoms | UnwrapTrajectory` after the
data source; all Draws consume post-policy frame only.
