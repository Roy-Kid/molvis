# @molcrafts/molvis-sketch

Canvas-based 2D molecule sketch editor for MolVis. It provides an editable
molecular graph, undoable commands, hit testing, viewport controls, optional
icon toolbars (`SketchComposer` with a stage-like `gui` flag), and a state API
for custom host chrome.

## Install

```sh
npm install @molcrafts/molvis-sketch
```

## Basic usage

### With built-in chrome (`gui: true`, default)

```ts
import { SketchComposer } from "@molcrafts/molvis-sketch";

const host = document.querySelector<HTMLElement>("#host");
if (!host) throw new Error("missing host");

// Icon rails + fragment templates + canvas. Same idea as stage `gui`.
const composer = new SketchComposer({ gui: true });
composer.mount(host);

composer.board.setTool("bond");
// Host-only actions: append into composer.extraSlot (common rail, no overlay)
composer.unmount();
```

### Host theming (Tailwind / design tokens)

Chrome **and** canvas colors are driven by `--msk-*` tokens
(`SKETCH_TOKEN_DEFAULTS` / `SKETCH_CSS_VARS` in `style/tokens.ts`). A product
shell maps its design tokens without rewriting rails or hardcoding hex in
render code:

```html
<div class="molvis-sketch-host" style="
  --msk-rail-bg: var(--color-muted);
  --msk-stage-bg: var(--color-canvas);
  --msk-ink: var(--color-foreground);
  --msk-active-ink: var(--color-accent);
  --msk-active-fg: var(--color-accent-foreground);
">
  <!-- composer mounts here -->
</div>
```

| Canvas field | Token |
|---|---|
| paper (`background`) | `--msk-stage-bg` |
| bonds / skeleton (`bondStroke`, `labelFill`) | `--msk-ink` |
| selection / hover / marquee | `--msk-active-ink` |
| color-picker default | `--msk-custom-default` or derived from `--msk-active-ink` |

MolVis `page` maps the full set in `.molvis-sketch-host` (`styles/tailwind.css`).
Composer re-resolves on mount and on `molvis:theme-change`.

**Not** UI tokens: ChemDraw/ACS heteroatom label colors (`SKETCH_ELEMENT_COLORS`)
are scientific structure-formula conventions.

Bond angles, label size, stroke weight, and double-bond spacing are
depiction tokens in `style/depiction-tokens.ts` (`DEPICTION_TOKENS`). The
layout and both painters read that file. Do not hardcode those ratios in
the renderer or the exporter.


### Headless / host-owned chrome (`gui: false`)

```ts
import { SketchBoard } from "@molcrafts/molvis-sketch";

const canvas = document.querySelector<HTMLCanvasElement>("#sketch");
if (!canvas) throw new Error("missing sketch canvas");

const board = new SketchBoard();
board.mount(canvas);
board.resize(canvas.clientWidth, canvas.clientHeight);

board.setTool("bond");
board.setBondOrder(1);

const unsubscribe = board.subscribe((state) => {
  undoButton.disabled = !state.canUndo;
  redoButton.disabled = !state.canRedo;
});

// Call these when the host is torn down.
unsubscribe();
board.unmount();
```


The board accepts and returns immutable `MoleculeData` snapshots:

```ts
const data = board.getMoleculeData();
board.loadMoleculeData(data);
const frame = board.toFrame();
```

SVG and PNG exports are fitted to the molecule and omit editor-only selection,
hover, marquee, and gesture feedback:

```ts
const svg = board.toSvg({ width: 1200, height: 800 });
const png = await board.toPng({
  width: 1200,
  height: 800,
  pixelRatio: 2,
});
```

## Editor controls

- Drag with the bond or chain tool to place connected atoms; both tools can
  start on empty canvas. Chain creates at least two fixed-length single bonds
  in a carbon zig-zag with 120° internal angles; drag farther to add more
  segments, while shorter drags are ignored.
- Drag selected atoms or bonds with the select tool. Drag empty canvas for a
  marquee selection.
- Attach 3–8 membered rings to empty canvas, atoms, or bonds.
- Color is an independent override, not a drawing tool. Enable it while using
  Atom, Bond, Chain, Ring, Charge, or Stereo to color affected content; disable
  it to use element and theme defaults. A current selection can be recolored or
  reset as one undoable edit.
- Use the mouse wheel to zoom and hold Space while dragging to pan.
- Use Undo/Redo for every molecular edit. Loading a molecule starts a fresh
  history root.

The package is ESM-only and ships TypeScript declarations.

Documentation and static pages that only need the `<molvis-sketch>` tag
should install `@molcrafts/molvis-sketch-viewer` and load `dist/main.js`.
Bundlers that already import this engine can call `defineMolvisSketch` from
`@molcrafts/molvis-sketch-viewer/element`.

## Scientific figures

The left toolbar groups **View** (Select, Pan, Fit and Zoom), **Molecule**,
and **Figure**. With enough height, every tool is visible. As the editor
becomes shorter, **Figure**, **View**, and then **Molecule** fold into separate
menus. The Figure section contains text, rounded rectangles, circles and
ellipses, repeat brackets, Erase, and a tool lock. Hover over a tool, menu
item, or property icon to see its name.

Click a figure tool to use its last style. Hold **Rectangle**, **Circle or
ellipse**, or **Repeat brackets** to show that tool’s variants. The small
chevron and Alt+Down open the same menu. Choose square brackets, parentheses,
curly braces, or **No brackets**. The same choices appear in the bottom bar
for a selected bracket. Select a bracket and click any of its four corner
labels or placeholder icons to edit the text in place. Empty corners show
their placeholder only while the bracket is selected. With **No brackets**,
only filled labels appear in the drawing and exported images.

Drag to draw a shape. Sketch selects it on release, so you can move it or
resize it by dragging a corner. Hold Shift while drawing for a square or
circle, or while resizing to keep its proportions. Use the lock or Q to
keep the same tool active for repeated placement. Set stroke, fill, and
text style in the bottom bar. **More figure properties** opens the full
properties form, including exact position and dimensions.

Drag the round handle on a selected shape to rotate it. Hold Shift to
snap to 15° increments. The bottom toolbar rotates the selection 90°
clockwise, and **More figure properties** accepts an exact angle in degrees.

Press T and click the canvas to type a new label. You can also double-click
empty canvas with **Select** to start a label. Double-click an existing
label or a circle, or select it and press Enter, to edit its text in place.
Enter inserts a line break. Escape, Ctrl/Cmd+Enter, or a click outside
finishes the edit. Shape labels move with their shapes. Ctrl/Cmd+D duplicates
selected figure objects. Drag a panel by its edge to leave the interior
available for marquee selection.

In **Select** or **Bond**, left-click a bond to select it. Click the selected
bond again to cycle single → double → triple → single. Shift+click adds or
removes a bond from the selection. Drag to move the selection. The bond order
in the tool options applies to bonds you draw.
Drag the end of a new bond toward an atom label to connect to that atom.
You can also drag an existing bond or its free carbon tip onto an atom label.
Near figure text, the free endpoint snaps to the text edge. Text is drawn
directly on the canvas and in exported images.

With **Select**, double-click an atom label to edit its display text in
place. Press Enter or click outside to save, or press Escape to cancel.
Clear the text to restore the element symbol. Custom labels are saved with
the drawing and appear in image exports. Use **Atom** to change the element.

In Select, Pan, or a figure tool, V selects, H pans, R draws rectangles, O
draws ellipses, and E erases. Chemical tools keep their element shortcuts.
Shift+1 fits the whole drawing. The Atom tool offers `*` for attachment points.

Open **Sketch files** to save or reopen a `.molvis-sketch.json` drawing.
**Export image** previews the complete drawing and starts with **Auto crop**
enabled. Clear the crop to keep the whole image, or drag on the preview to
set the crop yourself. Choose SVG, PNG, JPEG, or WebP before saving.
**Fit** and image export include all figure objects.
Opening a file in the editor is undoable. The same file can be loaded in
Python with `Sketch.load_document` and read back with `Sketch.document`.

```ts
const { board } = composer;
board.drawAnnotation({
  kind: "bracket",
  x: 0,
  y: 0,
  width: 3,
  height: 1.4,
  variant: "square",
  cornerLabels: {
    topLeft: { text: "*", size: 0.6 },
    bottomRight: { text: "n", size: 0.6, italic: true },
  },
});
const drawing = board.getSketchDocument();
board.loadSketchDocument(drawing);
board.fitToView();
```

`SketchDocument` contains `atoms`, `bonds`, and `annotations`. Annotation
positions and dimensions use the same document units as the atoms. Bracket
corner keys are `topLeft`, `topRight`, `bottomRight`, and
`bottomLeft`. Earlier documents with a single bracket `label` display it
at the bottom right. Chemical operations such as `getMoleculeData()` and
`toFrame()` read the molecular structure. `loadMoleculeData()` starts a
fresh drawing from molecular data.

Rectangles, ellipses, and brackets can include a `rotation` in clockwise
degrees around their centre. Corner labels follow the rotated bracket and
stay upright. The same rotation is used on the canvas and in SVG and PNG.
