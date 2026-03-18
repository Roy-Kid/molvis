# MolVis Feature Matrix

> **Purpose**: Lead agent reads this file to identify gaps and propose iterations.
> **Update rule**: After each completed iteration, update the relevant rows.
> Status: ✅ done | 🔨 partial | ❌ missing | ⊘ out-of-scope (intentionally deferred)
> Priority: P0 (next) | P1 (soon) | P2 (later) | P3 (much later)

---

## Design Principles

- **MolVis = display + edit.** All heavy computation (analysis, topology, force fields) lives in **molrs** (WASM). MolVis calls molrs APIs and renders results.
- **molrs provides**: file parsing, frame/block data, RDF/MSD/analysis, topology, neighbor lists, coordinate transforms, PBC operations
- **MolVis provides**: GPU rendering, interaction modes, modifier pipeline, command undo/redo, UI panels, trajectory playback
- **Data flow**: molrs produces Block columns (positions, colors, properties) → MolVis reads columns → Artist renders to GPU

---

## 1. Rendering & Representations

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| Ball-and-stick | ✅ | ✅ | ✅ | — | Sphere + cylinder, thin instances |
| Spacefill / VdW | ✅ | ✅ | ✅ | — | SPACEFILL representation preset (atomRadiusScale=1.0) |
| Stick only | ✅ | ✅ | ❌ | — | STICK representation preset |
| Wireframe | ✅ | ✅ | ✅ | — | WIREFRAME representation preset |
| Licorice | ❌ | ❌ | ✅ | P2 | Minimized spheres, emphasis on bonds |
| Cartoon / Ribbon | ✅ | ✅ | ✅ | — | Catmull-Rom spline, secondary structure-aware cross-sections |
| Surface (SES/SAS/VdW) | ❌ | ✅ | ✅ | P2 | Mesh generation in molrs, render in MolVis |
| Coordination polyhedra | ❌ | ✅ | ❌ | P3 | Polyhedra around selected atoms |
| Vector arrows | ❌ | ✅ | ✅ | P1 | Force, displacement vectors; needs arrow glyph instance |
| Isosurface | ❌ | ✅ | ✅ | P3 | Scalar field visualization, marching cubes in molrs |
| Trajectory lines | ❌ | ✅ | ❌ | P2 | Particle path over time |
| Non-spherical particles | ❌ | ✅ | ❌ | P3 | Ellipsoid, cube; custom glyph instances |
| Bond order display | ✅ | ❌ | ✅ | — | Double/triple bonds as parallel offset cylinders |
| Non-covalent interactions | ❌ | ❌ | ✅ | P2 | H-bonds, halogen bonds; dashed lines |
| Close contact display | ❌ | ❌ | ✅ | P3 | Salt bridges, repulsive contacts |
| Per-atom labels | ✅ | ✅ | ✅ | — | LabelRenderer: element/index/custom templates, 3 modes, auto-cull |
| Hydrogen visibility toggle | ✅ | ✅ | ✅ | — | HideHydrogensModifier pipeline filter + RenderTab toggle |

## 2. Coloring & Appearance

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| Color by element (CPK) | ✅ | ✅ | ✅ | — | Default coloring |
| Color by type | ✅ | ✅ | ❌ | — | Via ColorByPropertyModifier on "type" column |
| Color by property (colormap) | ✅ | ✅ | ❌ | — | ColorByPropertyModifier: viridis/plasma/coolwarm/rainbow/grayscale |
| Color by chain/residue | ❌ | ❌ | ✅ | P2 | Protein chain coloring, needs residue data from molrs |
| Assign uniform color | ✅ | ✅ | ✅ | — | AssignColorModifier + color picker in SelectPanel |
| Transparency / opacity | ❌ | ✅ | ✅ | P1 | Per-atom/group alpha, shader support needed |
| Ambient occlusion | ❌ | ✅ | ❌ | P2 | BabylonJS SSAO post-process |
| Dark / light theme | ✅ | ✅ | ❌ | — | StyleManager |
| Background color | ✅ | ✅ | ✅ | — | RenderTab color picker with presets (black/gray/white/custom) |

## 3. Rendering Output

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| Real-time WebGL | ✅ | ✅ | ✅ | — | BabylonJS thin instances |
| Image export (PNG) | ✅ | ✅ | ✅ | — | app.screenshot() + TopBar camera button, transparent bg support |
| Video export | ❌ | ✅ | ❌ | P2 | Trajectory → MP4/GIF, frame-by-frame capture |
| glTF export | ❌ | ✅ (Pro) | ❌ | P2 | 3D model for Blender/web, BabylonJS has built-in exporter |
| Multiple viewports | ❌ | ✅ | ✅ | P3 | Quad-view, split canvas |

## 4. File Formats

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| PDB read/write | ✅ | ✅ | ✅ | — | Via molrs Reader/Writer |
| XYZ read/write | ✅ | ✅ | ✅ | — | Via molrs |
| LAMMPS data read/write | ✅ | ✅ | ❌ | — | Via molrs |
| Zarr trajectories | ✅ | ❌ | ❌ | — | MolCrafts exclusive, via molrs |
| CIF / mmCIF | ❌ | ✅ | ✅ | P1 | Crystallography + proteins, add reader in molrs |
| GRO (GROMACS) | ❌ | ✅ | ❌ | P1 | Add reader in molrs |
| MOL / SDF | ❌ | ✅ | ✅ | P1 | Small molecule formats, add reader in molrs |
| XTC / TRR (trajectories) | ❌ | ✅ | ❌ | P2 | Binary trajectory, add reader in molrs |
| DCD (CHARMM/NAMD) | ❌ | ✅ | ❌ | P2 | Binary trajectory |
| POSCAR / VASP | ❌ | ✅ | ❌ | P2 | Materials science |
| LAMMPS dump | ❌ | ✅ | ❌ | P1 | Trajectory format |
| PNG image export | ✅ | ✅ | ✅ | — | See Rendering Output |
| Drag-drop file open | ✅ | ✅ | ✅ | — | MolvisWrapper dragover/drop + vsc-ext controller |

## 5. Interaction & Editing

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| Orbit / pan / zoom | ✅ | ✅ | ✅ | — | View mode |
| Click select atom/bond | ✅ | ✅ | ✅ | — | Select mode, ID-pass picking |
| Fence (lasso) select | ✅ | ✅ | ✅ | — | Freeform polygon selection with camera disable |
| Expression selection | ✅ | ✅ | ❌ | — | JME-like query language |
| Select by element/type | ✅ | ✅ | ✅ | — | Quick element buttons in SelectPanel, auto-discovered |
| Expand selection (neighbors) | ❌ | ✅ | ❌ | P2 | Select bonded neighbors |
| Named selections (save/recall) | ❌ | ❌ | ✅ | P2 | Bookmark selections |
| Add atom | ✅ | ❌ | ✅ | — | Edit mode |
| Delete atom/bond | ✅ | ✅ | ✅ | — | Edit mode |
| Add bond | ✅ | ❌ | ✅ | — | Edit mode |
| Bond order cycling | ❌ | ❌ | ✅ | P2 | Single/double/triple in edit mode |
| Auto-adjust hydrogens | ❌ | ❌ | ✅ | P3 | While drawing, needs valence from molrs |
| Transform selection | 🔨 | ✅ | ✅ | P1 | Manipulate mode, complete translate/rotate |
| Bond-centric manipulation | ❌ | ❌ | ✅ | P3 | Adjust bond length/angle/dihedral interactively |
| Copy / paste atoms | ❌ | ❌ | ✅ | P2 | |
| Align molecule to axis | ❌ | ❌ | ✅ | P2 | Align tool |
| Undo / redo | ✅ | ✅ | ✅ | — | Command pattern |
| Distance measurement | ✅ | ✅ | ✅ | — | Measure mode |
| Angle measurement | ✅ | ✅ | ✅ | — | |
| Dihedral measurement | ✅ | ✅ | ✅ | — | |

## 6. Molecular Building

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| Import by SMILES | ❌ | ❌ | ✅ | P1 | Parse in molrs (via molpy parser), render in MolVis |
| Fragment library | ❌ | ❌ | ✅ | P2 | Pre-built molecules, JSON/Zarr storage |
| Functional group templates | ❌ | ❌ | ✅ | P3 | Template tool |

## 7. Analysis & Visualization

> **Note**: All computation happens in **molrs**. MolVis provides the UI to configure, trigger, and display results.

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| RDF | ✅ | ✅ | ❌ | — | Select panel, compute in molrs |
| Bond angle distribution | ❌ | ✅ (Pro) | ❌ | P2 | Compute in molrs, plot in MolVis |
| Bond length distribution | ❌ | ✅ (Pro) | ❌ | P2 | Compute in molrs, plot in MolVis |
| Coordination number | ❌ | ✅ | ❌ | P2 | Via RDF integration in molrs |
| MSD | ❌ | ❌ | ❌ | P2 | molrs compute, MolVis time-series plot |
| RMSD | ❌ | ❌ | ❌ | P2 | molrs compute, MolVis time-series plot |
| Displacement vectors | ❌ | ✅ | ❌ | P1 | molrs computes delta, MolVis renders arrows |
| Histogram | ❌ | ✅ | ❌ | P1 | Property distribution, generic Plotly panel |
| Scatter plot | ❌ | ✅ | ❌ | P1 | Two-property scatter, generic Plotly panel |
| Property inspector | ✅ | ✅ | ✅ | — | DataInspectorPanel with virtual-scrolled atom/bond tables |
| Compute property (formula) | ❌ | ✅ | ❌ | P2 | Expression engine, runs in molrs |

## 8. Data Pipeline / Modifiers

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| Modifier pipeline | ✅ | ✅ | ❌ | — | Core paradigm |
| Drag-drop reorder | ✅ | ✅ | ❌ | — | View panel |
| Expression selection modifier | ✅ | ✅ | ❌ | — | |
| Hide selection modifier | ✅ | ✅ | ❌ | — | |
| Slice modifier | ✅ | ✅ | ❌ | — | |
| Wrap PBC modifier | 🔨 | ✅ | ❌ | P0 | Registered, needs filtering logic via molrs |
| Color coding modifier | ✅ | ✅ | ❌ | — | ColorByPropertyModifier with 5 colormaps |
| Assign color modifier | ❌ | ✅ | ❌ | P1 | Uniform color to selection |
| Compute property modifier | ❌ | ✅ | ❌ | P2 | Formula-based, compute in molrs |
| Delete selected modifier | ❌ | ✅ | ❌ | P1 | Remove selected from pipeline |
| Freeze property modifier | ❌ | ✅ | ❌ | P2 | Snapshot at frame N |
| Replicate modifier | ❌ | ✅ | ❌ | P1 | Periodic images, compute in molrs |
| Affine transformation modifier | ❌ | ✅ | ❌ | P2 | Translate/rotate/scale |
| Combine datasets modifier | ❌ | ✅ | ❌ | P2 | Merge multiple files |
| Unwrap trajectories modifier | ❌ | ✅ | ❌ | P2 | PBC unwrapping, compute in molrs |
| Create bonds modifier | ❌ | ✅ | ❌ | P1 | Dynamic bonds by distance/covalent radii, molrs |
| Construct surface mesh | ❌ | ✅ | ❌ | P3 | Alpha-shape / Gaussian, molrs compute |
| Coordination polyhedra modifier | ❌ | ✅ | ❌ | P3 | |
| DataSource modifier | 🔨 | ❌ | ❌ | P1 | Visibility state, complete filtering |

## 9. Trajectory & Animation

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| Frame playback (next/prev/seek) | ✅ | ✅ | ✅ | — | System class |
| FrameDiff (position vs full) | ✅ | ❌ | ❌ | — | **Differentiator** smart transition |
| Play/pause button | ✅ | ✅ | ✅ | — | TimelineControl component with 30fps rAF loop |
| Frame slider / timeline | ✅ | ✅ | ❌ | — | TimelineControl slider + frame counter |
| Playback speed control | ✅ | ✅ | ❌ | — | TimelineControl speed selector: 0.5x/1x/2x/5x/10x |
| Frame interpolation | ❌ | ✅ | ❌ | P3 | Smooth between frames |
| Camera animation | ❌ | ✅ | ❌ | P3 | Animated fly-through |

## 10. Platform & Integration

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| Web app | ✅ | ❌ | ❌ | — | **Differentiator** |
| VSCode extension | ✅ | ❌ | ❌ | — | **Differentiator** |
| WASM acceleration | ✅ | ❌ | ❌ | — | **Differentiator** via molrs |
| Jupyter widget | 🔨 | ❌ | ❌ | P1 | Package exists, needs real integration |
| Python scripting API | ❌ | ✅ (Pro) | ✅ | P2 | Via molpy/molrs Python bindings |
| Plugin / extension system | ❌ | ✅ | ✅ | P3 | Custom modifiers, renderers |

## 11. UI & UX

| Feature | MolVis | OVITO | Avogadro | Pri | Notes |
|---------|--------|-------|----------|-----|-------|
| 3-panel layout | ✅ | ✅ | ✅ | — | |
| Mode switching (hotkeys) | ✅ | ❌ | ✅ | — | 1-5 keys |
| Context menu | ✅ | ✅ | ✅ | — | |
| Settings dialog | ✅ | ✅ | ✅ | — | |
| Export dialog | ✅ | ✅ | ✅ | — | |
| Undo/redo UI buttons | ✅ | ✅ | ✅ | — | TopBar buttons + Ctrl+Z/Ctrl+Shift+Z shortcuts |
| Keyboard shortcut help | ✅ | ✅ | ✅ | — | ? key opens dialog with all shortcuts |
| Drag-drop file open | ✅ | ✅ | ✅ | — | See File Formats |
| Recent files | ❌ | ✅ | ✅ | P2 | Local storage |
| Animation timeline UI | ✅ | ✅ | ❌ | — | TimelineControl with play/pause/skip/slider |
| Data inspector table | ✅ | ✅ | ✅ | — | LeftSidebar Data tab with atom/bond tables |
| Grid ground | ✅ | ❌ | ❌ | — | Reference grid |
| Axis helper | ✅ | ❌ | ✅ | — | XYZ indicator |

---

## Priority Summary

### P0 — Next iterations (foundation gaps, blocking user experience)

| Feature | Category |
|---------|----------|
| Wrap PBC modifier (complete) | Pipeline (molrs) |

### P1 — Soon (competitive parity, common workflows)

| Feature | Category |
|---------|----------|
| Vector arrows | Rendering |
| Transparency | Coloring |
| CIF, GRO, MOL/SDF, LAMMPS dump formats | File (molrs) |
| Transform selection | Interaction |
| Import by SMILES | Building (molrs) |
| Displacement vectors, Scatter plot | Analysis |
| Replicate, Create bonds, DataSource modifiers | Pipeline |
| Jupyter widget | Integration |

### P2 — Later (breadth expansion)

Licorice, Surface, Trajectory lines, Non-covalent, AO, Video export, glTF, XTC/TRR/DCD/POSCAR formats, Expand selection, Copy/paste, Bond angle/length distribution, Coordination number, MSD, RMSD, Compute property, Freeze/Affine/Combine/Unwrap modifiers, Named selections, Recent files, Python API

### P3 — Much later (advanced / niche)

Coordination polyhedra, Isosurface, Non-spherical particles, Close contact, Multiple viewports, Auto-adjust hydrogens, Bond-centric manipulation, Functional group templates, Surface mesh, Frame interpolation, Camera animation, Plugin system
