# Acceptance: scene-modifier-iron-law

| id | criterion | type | status | verified_by |
|----|-----------|------|--------|-------------|
| A1 | Documented iron law: scene-changing → modifier; charts → left Analysis | docs | done | agent-auto docs/tutorial/pipeline.md |
| A2 | Create isosurface is user-addable in Visualization menu | unit | done | agent-auto modifier_registry.test.ts |
| A3 | Selecting a usesLeftConfig modifier opens left mode `modifier-config` | unit | done | agent-auto LeftShellContext.test.tsx |
| A4 | Pipeline bottom pane does not duplicate full form for left-config mods | unit | done | agent-auto ModifierProperties stub path |
| A5 | Vector field is registered as Visualization user-addable | unit | done | agent-auto modifier_registry.test.ts |
| A6 | Pure molrs analyses (RDF/MSD/…) remain only in left Analysis catalog | manual | pending | |
| A7 | No Python-related modifiers added | manual | done | agent-auto no python mods registered |
| A8 | Gaussian density surface user-addable + matches atoms+box | unit | done | agent-auto gaussian_density_surface.test.ts |
| A9 | Structure-order → column → color (Steinhardt / solid-liquid) | unit | done | agent-auto structure_order.test.ts |
| A10 | Voronoi voids visual modifier | unit | cancelled | out of scope this pass |
| A11 | Bond-order θ/φ histogram remains analysis-only (not a pipeline modifier) | unit | done | agent-auto not in registry |
