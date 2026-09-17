/**
 * Per-target shader compile bookkeeping for the impostor materials.
 *
 * Babylon only starts compiling a `ShaderMaterial` once a render pass binds
 * it, so the first draw of a geometry kind has to kick one render. After a
 * target's shader is ready that extra render is pure cost — this tracker is
 * what lets the Artist skip it on every later draw.
 */
export class ShaderCompileTracker<T> {
  private readonly tasks = new Map<T, Promise<void>>();
  private readonly ready = new Set<T>();

  isReady(target: T): boolean {
    return this.ready.has(target);
  }

  /** True while any of `targets` still awaits its first successful compile. */
  needsWarmRender(targets: readonly T[]): boolean {
    return targets.some((target) => !this.ready.has(target));
  }

  /**
   * Run `compile` once per target and share the in-flight promise. A
   * rejected compile is forgotten so the next draw retries it.
   */
  ensure(target: T, compile: () => Promise<void>): Promise<void> {
    const existing = this.tasks.get(target);
    if (existing) return existing;
    const task = compile().then(
      () => {
        this.ready.add(target);
      },
      (error: unknown) => {
        this.tasks.delete(target);
        throw error;
      },
    );
    this.tasks.set(target, task);
    return task;
  }
}
