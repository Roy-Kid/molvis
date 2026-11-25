# Frame-addressable presentation in MolVis Stage

**Proposed API specification · English · Stage and host integrations**

A host can hold a molecular sample fixed while moving a camera, restyle a selection while keeping the same geometry, and send a chosen view to a canvas or an image. Given the same scene, overrides, viewport, assets and rendering backend, direct access to a frame must give the same visual result as sequential playback. A Remotion integration is one consumer of this contract. A still renderer and an interactive scrubber exercise it independently.

## Ownership and units

| Concern | Input → result | Owner and reuse decision |
|---|---|---|
| Molecular sample | Composed trajectory index → molecular frame with identity, topology and cell | Stage uses its existing DataSource composition, wrapping and frame classification. V1 accepts one zero-based integer on the existing composed timeline. The host maps physical or editorial time onto that index. |
| Selection | Source identity and selection rule → membership on this sample | The existing pipeline evaluates selection producers and binds consumers by scope. Stable atom IDs and per-sample row masks have different lifetimes. Resolve identities on the current sample. Preserve the existing selector's missing-ID policy. |
| Geometry | Sample, membership, representation parameters → drawable geometry | Pipeline transforms and geometry producers own dependencies. Reuse the paired producer and draw steps. Preserve existing periodic bond and cell rules. |
| Appearance | Draw layer or scoped modifier and its parameters → visible treatment | Each owner defines the meaning of its fields, overlap order and invalidation. One selection may feed several consumers. V1 exposes a scoped opacity value on an existing Transparent node, including its current bond behavior. |
| View | Camera pose → projection at a given viewport | Stage accepts an absolute pose. A host can sample the existing CameraTrack independently of molecular time. Output size belongs to the target. For a fixed aspect ratio, changing resolution preserves normalized framing. |
| Timing and output | Output frame → overrides; presented canvas → optional pixels or encoding | The host owns FPS, easing, cuts, overlays and encoding. Stage owns scene evaluation and drawing. The existing snapshot and Python encoder remain independently callable. |

These are independently variable inputs to one evaluation. They do not require six new packages or independently flushed setters.

## Public contract under proposal

The API sketch specifies semantics. The proposed binding owns no clock. Stage types and effect-specific validation supply the value domains. On acceptance, copy caller-owned arrays and pose tuples before the first await.

```ts
// Proposed public shapes. A NodeRef belongs to a single binding.
type NodeOverride =
  | {kind: 'mask.ids'; node: NodeRef<'Select from mask'>; ids: readonly number[]}
  | {kind: 'transparent.opacity'; node: NodeRef<'Transparent'>; value: number};

type FrameOverrides = {
  sampleIndex?: number;
  camera?: CameraPose;
  geometry?: Pick<RepresentationStyle, 'atomRadiusScale'>;
  nodes?: readonly NodeOverride[];
};

const binding = await renderer.app.bindPresentation({project});
try {
  const focus = binding.node(savedMaskId, 'Select from mask');
  const shown = await binding.present({
    sampleIndex: 12, camera: path.sample(0.4),
    nodes: [{kind: 'mask.ids', node: focus, ids: [7, 19]}],
  });
  try {
    const image = await shown.snapshot({width: 1920, height: 1080});
  } finally {
    shown.release();
  }
} finally {
  await binding.close();
}
```

### Bind a stable baseline

Two entry forms have distinct input provenance. Call `await app.bindPresentation({project})` with the original document on a fresh, GUI-less app. The operation preflights that document, then hydrates it and retains the ID mapping before returning a binding. On failure discard provisional state and leave the fresh app reusable. Call `await app.bindPresentation()` on an exclusively owned app populated directly with a known Frame or Trajectory through the existing renderer. Refuse this second form for projects loaded by ordinary hydration or with unknown provenance; the caller supplies the original document on a fresh app instead. `renderer.app` is the app in both forms. Direct-load nodes are addressed by their local pipeline entry IDs. For a saved project resolve its saved IDs through the binding's hydration map. The proposed `binding.node(id, expectedType)` validates identity and type once and returns a binding-local reference. The binding records sample zero, the effective camera including up and field of view, representation, node parameters and enabled states. A raw input with defaults is sufficient for sample and camera control.

Preflight the saved document **before** ordinary hydration can skip unknown entries or discard information. Check unique IDs, valid references and semantics for all admitted entries; allocate old-to-new IDs before wiring dependencies. Preserve source enabled state or reject that document. The saved v2 view lacks FOV; use a documented fixed default (0.8 radians) for that input. A direct live baseline retains its effective FOV. Project references are portable across loads of the **same document**; reserialization can generate new node IDs. A new load requires closing and rebinding. Handles from old or other bindings fail validation.

V1 admits committed, fully indexed materialized sources with deterministic composition, built-in Particles, Bonds, simulation cell, Select from mask and Transparent. An enabled node outside this list rejects binding with its ID and type; reject unknown entries even when disabled if their references cannot be validated. A volatile source, uncommitted edits, enabled camera observer or history-dependent modifier also rejects. In particular, Unwrap trajectories depends on visited samples and Freeze property can depend on the first sample observed. Future support needs a defined reference state or deterministic replay. A declaration of the supported profile and preflight failures must be available before frame zero. New producers (e.g. surfaces) can join after passing the same conformance cases.

### Resolve independent overrides

Omission restores the baseline for every field, including optional camera up/FOV and individual nodes omitted from the next request. Stage evaluates the sample first, then runs the established pipeline order, resolves view and draws once the necessary results are ready. Two distinct writes to the same (owner, field) in one request fail validation. Array order cannot change the result. Two different Transparent nodes that cover the same atom follow their existing pipeline order. A new mask on a shared scope supplies the same membership to all consumers; each consumer retains its own appearance. For example, two Transparent consumers of one mask can be enabled independently in the baseline, and a separately scoped selection can overlap them. Geometry can change independently via the representation's positive finite `atomRadiusScale` in a representation that uses that scale; a material-only parameter must not implicitly change the radius. Overrides never enable disabled nodes.

Reject out-of-range and fractional sample indices. Validate finite, nondegenerate camera poses, including a positive FOV below π. Validate typed targets and the mask owner's supported integer ID range, reject unresolved IDs on the sampled frame, and accept an empty selection. Scoped opacity accepts a finite value from 0 through 1 and preserves the current artist's 0.02 floor at draw time. An incident logical bond takes the selected alpha when either endpoint is selected, including all sticks and periodic placements. Visibility remains a separate capability. Reapply baseline alpha to atoms and bonds leaving a scope or losing an override. On equal-count row permutations, compare identity or rebuild. Use the full correctness path whenever an incremental update cannot prove equivalent results. Transient overrides must never enter scene serialization or undo history, including while a frame is held.

### Publish, consume, release

Stage owns an exact binding per canvas. Only that binding may mutate its scene while active. A second bind, ordinary setter, resize, seek, load or competing writer on that app must refuse before mutation, or be made unreachable via exclusive ownership. Existing interactive apps retain coalescing seeks. Exact presentation permits one pending or held request. A second request rejects busy. Validate inputs, resolve and draw, then publish a handle only when that request's required source, pipeline, shader, effects and draw work has completed. Errors from the requested work reject its own promise. Before success or after failure the host must keep the canvas ineligible for capture. A failed call yields no handle; invalidate provisional caches before retry. Release is idempotent and scoped to the exact handle; a stale release cannot unlock a later request. The proposed `binding.close(): Promise<void>` is idempotent. Await it before `app.destroy()`; attempts to destroy through the public app while a binding is active or draining must fail busy. Closing cancels pending work, invalidates all handles, drains pending device operations and restores the baseline before an app is reused. Remove temporary listeners and invalidate late completions on failure or close. V1 guarantees independent headless workers in separate JS realms. Only binding-owned resources are released on close; the host retains its canvas and controls app disposal. Same-realm concurrent app disposal needs independent worker ownership before it can be guaranteed.

**Two output paths.** The browser compositor can sample the visible canvas while the host holds the frame. A still capture with the existing renderer renders the same state into a separate target with its own dimensions, MSAA and optional alpha; it can differ at edges and excludes DOM overlays. Configure canvas viewport before binding. Explicit still dimensions can change projection with a different aspect ratio. Preserve normalized framing when the aspect ratio is fixed. Exact readback is initiated only through `shown.snapshot(options)` on the active handle and delegates to the existing capture backend. An expired handle rejects before touching the target, even if a later frame is held. On a bound app the unscoped public snapshot entry must refuse; it remains available on ordinary apps. Serialize still readbacks on a binding; an overlapping readback fails busy. A readback holds the frame internally through completion, including restoration of temporary clear alpha. A caller release during readback prevents new reads and defers the next presentation until the read drains. Closing rejects pending reads and drains work before resource reuse. A stale read cannot return another frame's image.

**Host choreography.** Each worker owns an independent canvas. A host gates each requested output frame before its asynchronous work begins; it holds that gate until the matching handle exists. Release the old handle after its host capture boundary or on replacement/unmount. A scrubber may retain only the newest waiting request. If a stale promise succeeds, release its handle without acknowledging the new frame. On error or unmount settle every gate and close resources; a failed current export fails that frame. An independent still caller can hold the same Stage contract through its own capture. Stage does not need a host clock to do this.

## Integration and source boundaries

- Stage should own exact scheduling alongside [MolvisApp.seekFrame](https://github.com/MolCrafts/molvis/blob/dev/stage/src/app.ts) and the [frame scheduler](https://github.com/MolCrafts/molvis/blob/dev/stage/src/frame_render_scheduler.ts). Current seek enqueues a repaint; the scheduler can coalesce requests and routes errors to a callback. Waiting for an idle queue cannot identify a particular successful presentation. Use the existing evaluation path and supply completion and failure for the specific request.
- Resolve project node IDs in [project hydration](https://github.com/MolCrafts/molvis/blob/dev/stage/src/project/hydrate.ts). Review the [project format](https://github.com/MolCrafts/molvis/blob/dev/stage/src/project/types.ts) for lossless round trips of admitted fields. Reuse [camera poses](https://github.com/MolCrafts/molvis/blob/dev/stage/src/camera/pose.ts), [camera sampling](https://github.com/MolCrafts/molvis/blob/dev/stage/src/camera/track.ts), [selection scoping and geometry production](https://github.com/MolCrafts/molvis/blob/dev/stage/src/pipeline/modifier.ts), and the [scoped opacity modifier](https://github.com/MolCrafts/molvis/blob/dev/stage/src/modifiers/TransparentSelectionModifier.ts).
- Keep capture in [MolvisRenderer](https://github.com/MolCrafts/molvis/blob/dev/stage/src/renderer.ts) and encoding in the [Python video module](https://github.com/MolCrafts/molvis/blob/dev/python/src/molvis/video.py) or the chosen host. Use the [existing capture backend](headless-rendering.md) for a still from the held state. Stage, core and the project format gain no React or Remotion dependencies.
- An optional React host adapter depends inward on public Stage exports. It loads the baseline once per instance, receives a pure mapping from local output frame to overrides, gates capture on the matching presentation, and cancels or ignores obsolete host requests safely. A held canvas allows browser composition without a PNG encode/decode per frame. Batch hosts can call the same public TypeScript contract. A future Python binding would need a JSON wire representation and RPC ownership rules; the present spec delivers Stage and specifies the optional Remotion adapter.

## Acceptance cases

1. **Random access.** Render output frames 80, 10, 80. Both occurrences of 80 match a fresh-instance render and a sequential traversal from frame 0 in a pinned browser/backend at the same viewport. Include sample-only, camera-only and opacity-only changes and removal of each override. Use exact resolved-state assertions and image comparison with a declared backend tolerance.
2. **Independent controls.** Hold the sample while the camera moves. Hold camera and sample while a scoped layer changes opacity. Check unrelated atoms, pose and selected identities. Changing the camera must not evaluate selection or rebuild molecular geometry; changing atom radius must leave membership intact. Change output resolution at fixed aspect ratio and verify normalized framing.
3. **Changing topology.** Reorder equal-element rows with noncontiguous IDs and equal atom/bond counts across two samples. Include a disjoint selection, an empty one, and two overlapping consumers; verify vacated atoms and bonds recover baseline alpha. A stable-ID selection still affects the intended atoms and bonds. Use a separate fixture with two consumers of the same mask. Inspect resolved membership for each and published alpha in pipeline order. Unwrap and Freeze fixtures reject at bind. Verify reference spatial continuity and cell drawing through the existing pipeline.
4. **Ownership and recovery.** Delay a source load, attempt an overlapping present, then hold the first frame through asynchronous capture. Assert correct rejection, image and release behavior. Inject a draw failure, retry at another sample, and compare with a clean instance. Close during load, a held frame and an active readback, then destroy. Release A, present B, issue a delayed snapshot and a second release through A: A must neither read B nor release it.
5. **Host parity.** Take a still and a Remotion frame from equivalent state and compare their molecular viewport. Render output frames out of order with independent workers. Scrub across mount/unmount during a delayed frame and verify every render gate settles exactly once for the matching request or reports failure.
6. **Persistence.** Serialize the baseline before, during a held frame, and after release, ignoring generated timestamps. Check that node parameters and undo state survive unchanged. Reload the same saved document and address its saved node with a fresh binding-local handle. For raw trajectory loads exercise sample and camera with no project document.

Use plain Node tests for state, scheduler and ownership contracts. Exercise actual canvas and offscreen capture through a manual pinned-browser fixture using the same viewport and target policy. For repeat captures on the same target, require exact resolved-state equality and no channel to differ by more than one 8-bit level on the pinned backend. For visible-canvas versus offscreen captures, use identical viewport, background and crop, compare three interior sample patches within two levels per channel, and verify projected landmark positions within one output pixel. Include the backend and sample patches in the fixture. Raster edge antialiasing is target-specific.

Implement the Stage completion contract and demonstrate still/interactive parity first. Add the Remotion adapter after the same state can survive a random seek, readback and retry. Long-trajectory streaming, physical-time interpolation and a general keyframe editor can evolve independently.

## Independent design review

**Decision:** ready for a Stage prototype. Freeze the public API after the prototype passes the acceptance cases above. This review assessed the specification against the local Stage implementation; runtime behavior remains to be demonstrated.

The first review identified hidden dependence on previously visited samples, stale membership and alpha after a selection changed, and differences between browser composition and offscreen still capture. The second review identified two ownership gaps: ordinary project hydration could discard information before validation, and a late caller could read a newer frame through an unscoped snapshot. The reviewer checked the revised strict project entry, frame-scoped snapshot and awaitable close on disk and cleared all three for prototyping.
