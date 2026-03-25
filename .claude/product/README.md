# MolVis Product Memory

This directory tracks MolVis product evolution across iterations.

## Structure

```
product/
├── README.md              ← this file
└── iterations/
    ├── 001-<title>.md     ← completed iteration records
    ├── 002-<title>.md
    └── ...
```

## Product Phase

Current: **Foundation** (v0.0.2)

Phase definitions:
- **Foundation**: Core experience, patterns, test coverage
- **Growth**: Capability breadth (formats, analysis, representations)
- **Polish**: UX refinement, performance, edge cases
- **Scale**: Large systems, plugin API, community

## Vision

Modern molecular visualization in the direction of OVITO + Avogadro, with stronger workflow integration, extensibility, and architectural coherence for the MolCrafts ecosystem.

## Differentiators

- Web-first, WASM-accelerated
- MolCrafts ecosystem integration (molpy, molrs, molnex, molexp)
- Modern architecture (command pattern, modifier pipeline)
- VSCode native integration
- Multi-platform from day one (web, VSCode, Jupyter, Electron)
