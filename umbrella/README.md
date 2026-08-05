# `@molcrafts/molvis`

Umbrella package for MolVis. Install once when you need both engines:

```bash
npm install @molcrafts/molvis
```

Re-exports:

| Import path | Package |
|-------------|---------|
| `@molcrafts/molvis` | stage + sketch public surfaces |
| Prefer explicit installs when you only need one engine | `@molcrafts/molvis-stage` (3D) or `@molcrafts/molvis-sketch` (2D) |

Shared molrs and element data live in the monorepo package
`@molcrafts/molvis-core` (pulled in transitively; not a separate product install).

## License

BSD-3-Clause
