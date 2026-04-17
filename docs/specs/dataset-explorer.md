# Spec: dataset-explorer

## Summary
A chemiscope-like dataset inspection feature: project **per-frame properties extracted from the trajectory file** (e.g., ExtXYZ comment-line `energy=… temp=…`) to 2D via PCA, optionally cluster with k-means, render as a Plotly scatter that **controls the 3D canvas** (click → seek). Implemented as a new `"pca"` entry in the LeftSidebar analysis dropdown. All compute-heavy math in molrs (Rust/WASM).

The core philosophy — molvis visualizes what the file provides, it is not a feature-engineering tool. If the dataset has no per-frame properties, the PCA tool shows an empty state pointing at the loader.

## Motivation
Today a multi-frame dataset can only be browsed linearly via the timeline slider. That fails for conformer sets, MD sweeps, or any dataset where *similarity in property space* matters more than *time order*. chemiscope's answer — project properties to 2D, click to seek — is what this spec brings to molvis.

The primary principle: the map is a **navigation surface**. The scatter is the user's map of property space; pointing at it moves the 3D viewer.

## Scope

### In scope (MVP)
- New method entry `"pca"` in LeftSidebar's `ANALYSIS_OPTIONS` dropdown (alongside existing `"rdf"`, `"cluster"`). Future methods (`"tsne"`, `"umap"`, standalone `"kmeans"`) get their own entries later.
- **Frame-label descriptors only**: each per-frame numeric property surfaced by the loader is one candidate descriptor. For ExtXYZ, the existing `molrs-io/src/xyz.rs::parse_comment_line` already yields `key=value` pairs; this spec surfaces them through new WASM bindings and aggregates them into `system.frameLabels`.
- PCA in molrs (Rust + WASM binding); k-means in molrs (color-only role inside the PCA tool for MVP).
- New WASM binding to expose `frame.meta` as a numeric scalar map (`getMetaScalar`, `metaNames`).
- `system.frameLabels` state slot populated at trajectory load from each frame's `meta`.
- Plotly scatter (`plotly.js-dist-min`, lazy-loaded via dynamic `import()`) as the map.
- **Bidirectional wiring** (the key interaction):
  - `plotly_click` on a point → `app.system.seekFrame(frameIndex)`
  - `frame-change` event → `Plotly.restyle()` moves the "current frame" highlight marker
  - Hover shows Plotly tooltip (no seek, no side-effects)
- `DatasetExploration` invalidated on `trajectory-change`; `frameLabels` invalidated with it.
- Timeline control untouched; linear scrub works alongside map navigation.
- Default descriptor selection on first entry: **all numeric labels from `frameLabels` pre-ticked**. One-click Compute gives a result when the file provides labels.

### Out of scope (deferred — only add on explicit user request)
- **Computed geometry descriptors** (Rg, COM magnitude, RMSD, end-to-end distance)
- **Atom-column reducers** (mean/min/max/sum of a per-atom numeric column over a frame)
- Descriptor source beyond `frame.meta` — no CSV/JSON upload path in MVP
- Frame-label extraction for non-XYZ formats (LAMMPS, PDB, …). Their `frame.meta` stays empty; PcaTool shows empty state.
- Categorical / string frame labels (MVP is numeric-only; strings are filtered out at loader time)
- t-SNE, UMAP kernels (dropdown entries reserved; shape ready)
- Standalone `"kmeans"` entry (MVP has k-means only as PCA color overlay)
- Lasso / box-select for multi-frame selection and ensemble stats
- 3D map; DBSCAN / hierarchical clustering; linked multi-view; atom-environment mode
- Dataset persistence across sessions
- molrs-python bindings for the new analyzers (follow-up)

---

## Architecture Mapping

### Layer Impact
| Layer | Impact | Files |
|-------|--------|-------|
| molrs (Rust) | New modules | `molrs-compute/src/pca/mod.rs`, `molrs-compute/src/kmeans/mod.rs`; `molrs-compute/src/lib.rs` re-exports |
| molrs-wasm | New bindings | `molrs-wasm/src/compute.rs` — `WasmPca2`, `WasmKMeans`, `WasmPcaResult`; `molrs-wasm/src/core/frame.rs` — `getMetaScalar`, `metaNames` |
| System (trajectory/frames) | Extend | `core/src/system.ts` — `exploration` slot, `frameLabels` slot; invalidation on trajectory swap |
| Artist / SceneIndex / Pipeline / Mode | **None** | Canvas unchanged |
| Analysis (TS orchestrator) | New | `core/src/analysis/exploration.ts` |
| Loader | Extend | `core/src/io/` (wherever the trajectory load path assembles frames) — iterate loaded frames, aggregate `frame.meta` into `system.frameLabels` |
| Events | Extend | `core/src/events.ts` — `exploration-change`, `frame-labels-change` |
| Page UI (React) | Extend | `page/src/ui/layout/LeftSidebar.tsx` + new `PcaTool.tsx`; `page/src/hooks/useMolvisUiState.ts`; `page/package.json` (Plotly) |
| VSCode extension | Verify CSP | confirm `script-src 'self' blob:` allows Plotly's dynamic chunk; no code change expected |

### Commands
**No new commands.** Point clicks call `system.seekFrame(i)` — same path as TimelineControl.

### Modifiers
**No new modifiers.** Embedding is dataset-level; it lives in `core/src/analysis/`.

### Mode Changes
**None.** PcaTool is a LeftSidebar analysis panel, not a canvas interaction context.

### Events
| Event | Emitter | Listeners | Payload type |
|-------|---------|-----------|--------------|
| `exploration-change` | `System.setExploration()` | `PcaTool` via `useMolvisUiState` | `DatasetExploration \| null` |
| `frame-labels-change` | `System.setFrameLabels()` | `PcaTool` (re-renders descriptor picker) | `Map<string, Float64Array> \| null` |

### WASM Integration
- **New molrs bindings**: **Yes**
  - `WasmPca2` — PCA (2 components + explained variance)
  - `WasmKMeans` — k-means labels with fixed `seed`
  - `frame.getMetaScalar(name: string) -> f64 | undefined` — numeric scalar read from `frame.meta`
  - `frame.metaNames() -> string[]` — enumerate `frame.meta` keys
- **Box objects created**: No
- **WASM memory ownership**:
  - `WasmPca2` / `WasmKMeans` instances → created in `exploration.ts`, `.free()`d in a `try/finally` after each call. Results are copied `Float64Array` / `Int32Array` so the wrapper frees immediately.
  - Frame meta readers → no wrappers escape (they return primitives or owned strings).

### ImpostorState Impact
**None.** PcaTool is a sibling React component; canvas buffers unchanged.

---

## Design

### Rust / WASM (molrs)

**`molrs-compute/src/pca/mod.rs`** — new module, mirrors the `rdf/`, `cluster/`, `msd/` folder layout:

```rust
pub struct Pca2;

pub struct PcaResult {
    pub coords: Vec<f64>,    // row-major [n_rows * 2]
    pub variance: [f64; 2],  // explained variance per component
}

impl Pca2 {
    /// Standardizes columns (z-score), computes top-2 eigenvectors of the covariance
    /// matrix via power iteration with deflation.
    /// Err(Invalid) for n_rows<3, n_cols<2, or non-finite inputs.
    pub fn fit_transform(
        matrix: &[f64],
        n_rows: usize,
        n_cols: usize,
    ) -> Result<PcaResult, ComputeError>;
}
```

**`molrs-compute/src/kmeans/mod.rs`** — new module:

```rust
pub struct KMeans { k: usize, max_iter: usize, seed: u64 }

impl KMeans {
    pub fn new(k: usize, max_iter: usize, seed: u64) -> Result<Self, ComputeError>;

    /// k-means++ init, Lloyd's iterations. Deterministic with fixed seed.
    pub fn fit(&self, coords: &[f64], n_rows: usize, n_dims: usize)
        -> Result<Vec<i32>, ComputeError>;
}
```

Both reuse `ComputeError::Invalid(String)` added in the recent RDF refactor.

**`molrs-wasm/src/compute.rs`** — new bindings:

```rust
#[wasm_bindgen] pub struct WasmPca2;
#[wasm_bindgen] impl WasmPca2 {
    #[wasm_bindgen(constructor)] pub fn new() -> WasmPca2;
    pub fn fitTransform(&self, matrix: &[f64], n_rows: usize, n_cols: usize)
        -> Result<WasmPcaResult, JsValue>;
}

#[wasm_bindgen] pub struct WasmPcaResult;  // .coords() -> Float64Array, .variance() -> Float64Array[2]

#[wasm_bindgen] pub struct WasmKMeans;
#[wasm_bindgen] impl WasmKMeans {
    #[wasm_bindgen(constructor)]
    pub fn new(k: usize, max_iter: usize, seed: f64) -> Result<WasmKMeans, JsValue>;
    pub fn fit(&self, coords: &[f64], n_rows: usize, n_dims: usize)
        -> Result<Int32Array, JsValue>;
}
```

**`molrs-wasm/src/core/frame.rs`** — add to the existing `Frame` wrapper:

```rust
#[wasm_bindgen(js_name = getMetaScalar)]
pub fn get_meta_scalar(&self, name: &str) -> Option<f64>;  // Some iff the meta value is numeric

#[wasm_bindgen(js_name = metaNames)]
pub fn meta_names(&self) -> Vec<String>;  // all keys, regardless of value type
```

Rust tests cover: PCA reconstruction on well-separated Gaussian blobs, k-means determinism with fixed seed, ExtXYZ meta round-trip, error paths. Bump molrs workspace `0.0.9` → `0.0.10`.

### TypeScript orchestrator (molvis core)

**`core/src/analysis/exploration.ts`**:

```ts
export interface ExplorationConfig {
  /** Names of frame labels to use as descriptors. Each must exist in system.frameLabels. */
  descriptorNames: string[];
  reduction: { method: "pca" };          // v2 extends this union
  clustering: { method: "kmeans"; k: number; seed: number } | { method: "none" };
  colorBy:
    | { kind: "cluster" }                // disabled in UI when clustering = "none"
    | { kind: "label"; name: string }    // one of descriptorNames OR any other label
    | { kind: "frame-index" }
    | { kind: "solid" };
}

export interface DatasetExploration {
  config: ExplorationConfig;
  descriptors: {
    names: string[];         // = config.descriptorNames
    values: Float64Array;    // row-major [nFrames * nDescriptors]
    nFrames: number;
    nDescriptors: number;
  };
  embedding: {
    coords: Float64Array;    // row-major [nFrames * 2]
    variance: [number, number];
    axes: [string, string];  // e.g. ["PC1 (42.3%)", "PC2 (18.1%)"]
  };
  clusters: Int32Array | null;
  computedAt: number;        // performance.now()
}

export async function runExploration(
  frameLabels: Map<string, Float64Array>,
  config: ExplorationConfig,
): Promise<DatasetExploration>;
// Stacks the selected label vectors into a matrix, calls WasmPca2, then optional WasmKMeans.
// Throws on NaNs in selected label columns (caller must filter or impute beforehand).
```

Note the simplification: no per-frame iteration, no WASM analyzer creation per frame. Labels are already materialized as `Float64Array` at load time. The orchestrator is ~30 LOC.

No separate `descriptors.ts` module is needed — descriptor extraction is a single line (`frameLabels.get(name)!`) inside the orchestrator.

**`core/src/system.ts`** — two state slots:

```ts
private _exploration: DatasetExploration | null = null;
private _frameLabels: Map<string, Float64Array> | null = null;

get exploration(): DatasetExploration | null { return this._exploration; }
get frameLabels(): Map<string, Float64Array> | null { return this._frameLabels; }

setExploration(next): void { /* identity guard + emit("exploration-change", next) */ }
setFrameLabels(next): void { /* identity guard + emit("frame-labels-change", next) */ }
```

Inside `setTrajectory()`:
1. Build the new `frameLabels` map from the new trajectory (see loader section).
2. Call `setFrameLabels(newLabels)`.
3. Call `setExploration(null)` (invalidates stale PCA state).
4. Emit `trajectory-change`.

**`core/src/events.ts`** — two new entries:

```ts
"exploration-change": DatasetExploration | null;
"frame-labels-change": Map<string, Float64Array> | null;
```

### Loader integration

In `core/src/io/` (the TrajectoryReader wrapper that molvis uses to load files), once frames are materialized:

```ts
function aggregateFrameLabels(frames: Frame[]): Map<string, Float64Array> {
  const nFrames = frames.length;
  const allNames = new Set<string>();
  for (const f of frames) for (const n of f.metaNames()) allNames.add(n);

  const out = new Map<string, Float64Array>();
  for (const name of allNames) {
    const vec = new Float64Array(nFrames);
    let anyNumeric = false;
    for (let i = 0; i < nFrames; i++) {
      const v = frames[i].getMetaScalar(name);  // undefined if missing or non-numeric
      if (v !== undefined) { vec[i] = v; anyNumeric = true; }
      else vec[i] = Number.NaN;
    }
    if (anyNumeric) out.set(name, vec);  // filters out purely-categorical keys
  }
  return out;
}
```

The ExtXYZ reader in `molrs-io/src/xyz.rs` already parses comment-line `key=value` pairs (`parse_comment_line` → `XYZComment`); surfacing them through the new WASM bindings is all that's needed. **Non-XYZ formats (LAMMPS, PDB) stay out of scope**: their `frame.meta` remains empty; PcaTool shows empty state.

### UI (molvis page)

**`page/package.json`** — add dependency `plotly.js-dist-min`. Dynamically imported inside `PcaTool.tsx` to keep it out of the main bundle.

**`page/src/ui/layout/LeftSidebar.tsx`** — extend the existing switcher:

```ts
type AnalysisType = "rdf" | "cluster" | "pca";
const ANALYSIS_OPTIONS = [
  { value: "rdf", label: "Radial distribution g(r)" },
  { value: "cluster", label: "Cluster analysis" },
  { value: "pca", label: "PCA" },
];
```

Render `<PcaTool app={app} />` when `selectedAnalysis === "pca"`.

**`page/src/ui/layout/PcaTool.tsx`** — new component. Each `SidebarSection` follows the Edit-tab design language (`text-[10px]` headers, `h-7` inputs).

**Empty state** — when `system.frameLabels` is null or empty, the tool shows a single hint row (matching the sidebar's status-line pattern):

> This dataset has no frame labels.
> Load an ExtXYZ trajectory with `key=value` properties in the comment lines.

Sections visible only when labels exist:

1. **DESCRIPTORS** — chip list of `frameLabels.keys()`; all numeric labels pre-ticked on first mount; user can uncheck/re-check. Each chip shows the label name; hover reveals min/max/n-finite of the column.
2. **CLUSTERING** — Select `None` / `k-means`; number input for `k` (range 2–20); seed fixed (42) in MVP.
3. **COLOR BY** — Select:
   - `Cluster` (disabled when clustering = `None`)
   - `Label: <name>` (one option per key in `frameLabels`, whether ticked as a descriptor or not)
   - `Frame index`
   - `Solid`
4. **COMPUTE** — sticky button, disabled when `descriptorsTicked.length < 2` OR `trajectory.length < 3`; shows spinner during compute (synchronous WASM call on the main thread; typical <50ms for 10k frames × 20 descriptors).
5. **MAP** — Plotly scatter, `flex-1 min-h-0`. Renders when `system.exploration` is non-null.

**Plotly wiring (the bidirectional contract):**

```ts
const Plotly = await import("plotly.js-dist-min");

// Initial render on exploration-change:
Plotly.react(div, [
  {
    type: "scattergl",            // GL for ≥10k points
    mode: "markers",
    x: coordsX, y: coordsY,
    customdata: frameIndices,     // back-ref for handlers
    marker: { color: colorArray, size: 6 },
    hovertemplate: "frame #%{customdata}<br>%{x:.3f}, %{y:.3f}<extra></extra>",
  },
  {
    // Dedicated "current frame" highlight trace
    type: "scattergl", mode: "markers",
    x: [currentX], y: [currentY],
    marker: { size: 14, line: { width: 2, color: "white" }, color: "transparent" },
    hoverinfo: "skip",
  },
], layout, { displayModeBar: true, scrollZoom: true, responsive: true });

// Chart → canvas (primary interaction):
div.on("plotly_click", (e) => {
  const frameIdx = e.points[0].customdata as number;
  app.system.seekFrame(frameIdx);            // commits seek; emits frame-change
});

// Canvas → chart (feedback loop):
const unsub = app.events.on("frame-change", (i) => {
  scheduleRestyle(() => Plotly.restyle(div, {
    x: [[coords[2 * i]]], y: [[coords[2 * i + 1]]],
  }, [1 /* current-frame trace index */]));  // rAF-coalesced
});
```

No hover-triggered seek in MVP (click-to-commit is unambiguous; hover-preview is deferred).

**`page/src/hooks/useMolvisUiState.ts`** — add `exploration` and `frameLabels` to the returned state; subscribe to `exploration-change` and `frame-labels-change`.

### Navigation (user's explicit ask)

1. User loads an **ExtXYZ trajectory with per-frame properties** (e.g., `energy=-1.23 Lattice="..." …` in each comment line).
2. Loader aggregates the numeric properties into `system.frameLabels` automatically. No user action needed.
3. User expands LeftSidebar.
4. Analysis dropdown shows: `Radial distribution g(r)` / `Cluster analysis` / **`PCA`**.
5. User picks **PCA** → PcaTool renders with all numeric labels already ticked.
6. User clicks **Compute** (or first tweaks clustering/color). Synchronous WASM PCA + optional k-means finishes in <50ms for typical sizes; Plotly scatter appears.
7. From here:
   - **Click a point** → canvas jumps to that frame; TimelineControl slider moves; current-frame highlight follows.
   - **Hover** → Plotly tooltip with frame index and coordinates.
   - **Timeline scrub** → current-frame highlight on the map moves in lock-step (`frame-change` feedback loop).
8. Dropdown switches back to RDF / Cluster at any time; exploration is preserved until trajectory changes.
9. **If the user loads a plain XYZ (no comment-line properties) or a LAMMPS/PDB file**: PcaTool shows the empty-state hint; no descriptors to pick.

---

## Tasks

### molrs (Rust + WASM)
1. [ ] **Expose `frame.meta` via WASM** — `molrs-wasm/src/core/frame.rs` — `getMetaScalar`, `metaNames`; Rust test round-trips a parsed ExtXYZ comment with `energy=-1.23 config=trans` (verifies numeric/string filtering).
2. [ ] **PCA in molrs-compute** — `molrs-compute/src/pca/mod.rs` + re-export — `Pca2::fit_transform`; Rust tests on 2D Gaussian blobs and invalid inputs.
3. [ ] **k-means in molrs-compute** — `molrs-compute/src/kmeans/mod.rs` + re-export — `KMeans::fit` with k-means++ init, fixed seed determinism, `k > n_rows` error path.
4. [ ] **WASM PCA + k-means bindings** — `molrs-wasm/src/compute.rs` — `WasmPca2`, `WasmKMeans`, `WasmPcaResult`.
5. [ ] **Publish molrs 0.0.10** — bump Cargo workspace; PR against `MolCrafts/molrs`.

### molvis core (TS)
6. [ ] **Bump dep** — `core/package.json` + `package.json` — `@molcrafts/molrs` `^0.0.9` → `^0.0.10`.
7. [ ] **New events** — `core/src/events.ts` — `exploration-change`, `frame-labels-change`.
8. [ ] **System state slots** — `core/src/system.ts` — `exploration`, `frameLabels`, identity-guarded setters, invalidation inside `setTrajectory()` **before** `trajectory-change` fires.
9. [ ] **Frame-label aggregation in loader** — `core/src/io/` — `aggregateFrameLabels(frames)` helper; wired into the trajectory load path; purely-string keys are skipped; missing-per-frame values stored as `NaN`. Unit-tested with an ExtXYZ fixture and a plain-XYZ (no properties) fixture.
10. [ ] **Orchestrator** — `core/src/analysis/exploration.ts` — `runExploration(frameLabels, config)`; stacks selected label vectors into a matrix, WASM PCA, optional WASM k-means; rejects if any selected column contains NaNs. Unit-tested.

### molvis page (React)
11. [ ] **Add Plotly dep** — `page/package.json` — `plotly.js-dist-min`; verify main-bundle size with `rsbuild build --analyze` (or equivalent); verify it loads in the VSCode webview CSP (`script-src 'self' blob:` check).
12. [ ] **PcaTool component** — `page/src/ui/layout/PcaTool.tsx` — empty state + four sections (descriptors / clustering / color / compute) + Plotly map; auto-tick all numeric labels on first mount; `plotly_click` → `seekFrame`; `frame-change` → rAF-coalesced `Plotly.restyle` of the current-frame trace.
13. [ ] **Wire dropdown** — `page/src/ui/layout/LeftSidebar.tsx` — add `"pca"` to `AnalysisType`/`ANALYSIS_OPTIONS`; render `<PcaTool />`.
14. [ ] **UI state hook** — `page/src/hooks/useMolvisUiState.ts` — expose `exploration` and `frameLabels`.

### Tests
15. [ ] **Rust: PCA** — 2-component reconstruction on 2D Gaussian blobs; `variance[0] ≥ variance[1]`; error paths for `n_rows<3`, non-finite inputs.
16. [ ] **Rust: k-means** — 3 well-separated blobs → correct labels; same seed → identical labels; `k > n_rows` → error.
17. [ ] **Rust: frame.meta round-trip** — parse an ExtXYZ fixture with `energy=-1.23 config=trans`; assert `getMetaScalar("energy") === -1.23`, `getMetaScalar("config") === undefined`, `metaNames()` includes both.
18. [ ] **TS: loader aggregation** — ExtXYZ fixture with per-frame energies → `frameLabels.get("energy")?.length === nFrames`; plain-XYZ fixture → `frameLabels.size === 0`; mixed (some frames miss the key) → `NaN` at missing indices.
19. [ ] **TS: orchestrator** — synthetic `frameLabels` (2+ numeric columns) with k-means k=3 → `coords.length === 2 * nFrames`, 3 unique cluster labels, no NaNs, `variance[0] ≥ variance[1]`; throws when a selected column contains a NaN.
20. [ ] **TS: invalidation** — after `setExploration({...})` + `setTrajectory(other)`: `exploration === null`, `frameLabels` swapped; both setter events fire **before** `trajectory-change`.
21. [ ] **E2E (Playwright)** — `page/tests/e2e/pca-tool.spec.ts`:
   - Fixture: 10-frame ExtXYZ with `energy=...` and `temp=...` in every comment
   - Dropdown → "PCA"; descriptor chips `energy` and `temp` are pre-ticked
   - Click Compute; assert Plotly `<div>` mounted with 10 points
   - Click the point at index 3; assert TimelineControl reads "4 / 10" and canvas structure advances
   - Scrub timeline to frame 7; assert current-frame highlight moves on the map
   - Load a plain XYZ next (no properties); assert PcaTool shows the empty-state hint and no descriptor chips

### Docs
22. [ ] **User doc** — `docs/development/pca-tool.md` — workflow tutorial; note the ExtXYZ-only scope for MVP.
23. [ ] **TSDoc on public exports** — `runExploration`, `ExplorationConfig`, `DatasetExploration`.

---

## Test Criteria

### Rust unit (`cargo test`)
- [ ] `pca::fit_transform` on 3 well-separated 2D Gaussians: PC1 separates the clusters; `variance[0] + variance[1]` ≈ trace of input covariance within 1e-10.
- [ ] `pca::fit_transform` → `Err(Invalid)` for `n_rows<3`, `n_cols<2`, or any non-finite input.
- [ ] `kmeans::fit` with `k=3`, `seed=42`: cluster sizes ≈ `n/3`; same seed → identical label vector; `k > n_rows` → `Err(Invalid)`.
- [ ] `frame.getMetaScalar("energy") == Some(-1.23)` after parsing `energy=-1.23 config=trans`; `getMetaScalar("config") == None` (string-valued key filtered).

### TS unit (`rstest`)
- [ ] `aggregateFrameLabels` over an ExtXYZ fixture with energies → map has `"energy"` with length = nFrames; plain-XYZ fixture → empty map; frame missing the key → that index is `NaN`.
- [ ] `runExploration` on a synthetic `frameLabels` (2 columns, n=50) with k-means k=3 → no NaNs, 3 unique cluster values, ordered variance; throws if a selected column contains a NaN.
- [ ] `setTrajectory(b)` after `setExploration({...})`: `exploration === null`, `frameLabels` swapped, `frame-labels-change` and `exploration-change` emit before `trajectory-change`.

### Integration (Playwright)
- [ ] **Dropdown includes PCA** after loading any trajectory.
- [ ] **Auto-tick** — ExtXYZ-with-properties loads; entering PCA shows descriptor chips pre-ticked.
- [ ] **Compute → scatter** renders Plotly div with `n_points === trajectoryLength`.
- [ ] **Click → seek** advances canvas + timeline to the clicked frame index.
- [ ] **Scrub → highlight follows** — timeline scrub moves the current-frame marker on the map.
- [ ] **Empty state** — plain-XYZ load shows the hint; no scatter.
- [ ] **Trajectory swap** clears both `exploration` and `frameLabels`.

---

## Risks & Open Questions

- **Risk — Plotly bundle in VSCode webview**: ~3MB dist; dynamic `import()` splits it, but CSP must allow the chunk.
  - **Mitigation**: verify during task 11; if blocked, fall back to `plotly.js/lib/core` + register only `scattergl` (≈1MB saving).

- **Risk — `scattergl` in the webview**: Plotly's WebGL scatter needs a WebGL context; the molvis canvas already has one. Two WebGL contexts in one document can exhaust GPU resources on low-end machines.
  - **Mitigation**: start with `scattergl`; fall back to `scatter` (SVG) for ≤5k points if issues surface.

- **Risk — PCA instability on near-degenerate labels**: two correlated labels collapse PC2 onto noise.
  - **Mitigation**: z-score columns before PCA (already in the Rust spec); log a warning when an eigenvalue < 1e-10 × trace.

- **Risk — NaN in selected label columns**: ExtXYZ files with inconsistent per-frame property sets will produce NaN columns.
  - **Mitigation**: the orchestrator rejects columns with any NaN and surfaces a clear error in the Compute button state. Chips that have NaN values are marked with a warning icon in the descriptor picker. User can uncheck to proceed.

- **Decided — Plotly library**: raw `plotly.js-dist-min` (official dist, not a React wrapper), ref-mounted div + `Plotly.react` / `Plotly.restyle`. Lowest overhead; finest control over incremental updates.

- **Decided — Frame-label loader scope (MVP)**: ExtXYZ only. Plain XYZ and non-XYZ formats intentionally produce empty `frameLabels`; PcaTool shows the empty-state hint.

- **Decided — Default descriptor selection**: all numeric labels pre-ticked on first mount. Driven by what the data source provides. No fabricated fallbacks (no Rg / COM / column reducers).

- **Decided — `k` upper bound**: 20. Beyond that, colors on a 2D map are indistinguishable; the cap can be raised on feedback.
