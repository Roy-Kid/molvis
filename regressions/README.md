# regressions/ — public-API hard-coded goldens

| File | Scenario |
|------|----------|
| `writer-gro-roundtrip.test.ts` | GRO write→read coords |
| `format-infer-and-load.test.ts` | format infer + GRO/MOL2/POSCAR load |
| `cube-load.test.ts` | cube load + CHGCAR dispatch |
| `ovito-modifier-align.test.ts` | Selection Clear/Invert/Select Type/Expand goldens |

Unit tests stay under each package’s `tests/` (browser mode). Full app E2E
(page.goto against a built host) lives in repo-root `e2e/` with
`@rstest/playwright` — not mixed into package unit trees.

```bash
npm run test:regressions
npm run test:e2e
```
