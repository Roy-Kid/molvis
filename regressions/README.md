# regressions/ — public-API hard-coded goldens

| File | Scenario |
|------|----------|
| `writer-gro-roundtrip.test.ts` | GRO write→read coords |
| `format-infer-and-load.test.ts` | format infer + GRO/MOL2/POSCAR load |
| `cube-load.test.ts` | cube load + CHGCAR dispatch |

Multi-module façade suites that need the **core package** rstest root
(`worker.js` resolution) live under `core/tests/integration/`.

```bash
npm run test:regressions
```
