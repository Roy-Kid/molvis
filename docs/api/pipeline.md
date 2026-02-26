# Pipeline API Reference

The modifier pipeline transforms raw frame data before rendering. Modifiers are executed sequentially, each receiving the output of the previous one.

## ModifierPipeline

```typescript
class ModifierPipeline {
  addModifier(modifier: Modifier): void;
  removeModifier(id: string): void;
  getModifier(id: string): Modifier | undefined;
  getModifiers(): Modifier[];
  moveModifier(id: string, newIndex: number): void;
  compute(source: FrameSource, frameIndex: number, app: MolvisApp): Promise<Frame>;
}
```

### Events

`ModifierPipeline` extends `EventEmitter` and fires:

| Event | Payload | Description |
|-------|---------|-------------|
| `PipelineEvents.COMPUTED` | `{ frame, context }` | Pipeline finished computing |

---

## Modifier Interface

```typescript
interface Modifier {
  id: string;
  name: string;
  enabled: boolean;
  modify(frame: Frame, context: PipelineContext, app: MolvisApp): Frame | Promise<Frame>;
}
```

Disabled modifiers (`enabled: false`) are skipped during computation.

---

## ModifierRegistry

Global registry for modifier factories. Allows UI and serialization to create modifiers by type name.

```typescript
class ModifierRegistry {
  static register(type: string, factory: () => Modifier): void;
  static create(type: string): Modifier;
  static getTypes(): string[];
}
```

---

## Built-in Modifiers

### DataSourceModifier

Fetches frames from a `FrameSource`. Usually the first modifier in the pipeline.

```typescript
class DataSourceModifier implements Modifier {
  source: FrameSource | null;
}
```

### SliceModifier

Filters atoms by index range.

```typescript
class SliceModifier implements Modifier {
  start: number;
  end: number;
  step: number;
}
```

### ExpressionSelectionModifier

Selects atoms using a text expression (e.g. `element == "C"`).

```typescript
class ExpressionSelectionModifier implements Modifier {
  expression: string;
}
```

### HideSelectionModifier

Hides atoms that are currently selected, removing them from the rendered frame.

### SelectModifier

Applies a selection mask to the frame context.

### WrapPBCModifier

Wraps atom positions into the periodic simulation box.

---

## FrameSource

Provides frames to the pipeline by index.

```typescript
interface FrameSource {
  getFrame(index: number): Frame | Promise<Frame>;
  readonly length: number;
}
```

### ArrayFrameSource

In-memory source backed by a `Frame[]` array.

### ZarrFrameSource

Lazy-loading source that reads frames from a Zarr store.
