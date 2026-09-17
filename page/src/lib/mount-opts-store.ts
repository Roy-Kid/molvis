import type { MountOpts } from "@/lib/mount-opts";

/**
 * Live holder for the mount options of one mounted app.
 *
 * `MountOpts` used to reach the React tree as the literal handed to
 * `mountMolvisApp`, whose identity never changed — so the chrome layout it
 * describes was a computation, not a state, and a host could not change it
 * after mounting. This store is the mutable owner: the host writes through
 * `MountedApp.setOpts`, and `MountOptsRoot` subscribes.
 *
 * Members are bound arrow properties on purpose. `useSyncExternalStore` calls
 * `subscribe` and `get` detached from the instance, where a prototype method
 * would see `this === undefined` and throw on first render.
 */
export class MountOptsStore {
  private snapshot: MountOpts;
  private listeners = new Set<() => void>();
  private closed = false;

  constructor(initial: MountOpts) {
    this.snapshot = initial;
  }

  /**
   * The current options.
   *
   * The same reference is returned until {@link patch} produces a different
   * value — `useSyncExternalStore` re-renders whenever the snapshot identity
   * changes, so an always-fresh object would spin forever.
   */
  get = (): MountOpts => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Merge `next` over the current options, replacing the snapshot rather than
   * mutating it. A patch that changes nothing keeps the old reference, so
   * subscribers do not re-render. A no-op once {@link close} has run.
   */
  patch = (next: Partial<MountOpts>): void => {
    if (this.closed) return;
    const merged: MountOpts = { ...this.snapshot, ...next };
    if (shallowEqual(this.snapshot, merged)) return;
    this.snapshot = merged;
    for (const listener of [...this.listeners]) listener();
  };

  /**
   * Stop serving updates. `dispose()` calls this *after* unmounting the React
   * root, so a late `setOpts` cannot broadcast into a torn-down tree. The last
   * snapshot stays readable.
   */
  close = (): void => {
    this.closed = true;
    this.listeners.clear();
  };
}

function shallowEqual(a: MountOpts, b: MountOpts): boolean {
  const aKeys = Object.keys(a) as (keyof MountOpts)[];
  const bKeys = Object.keys(b) as (keyof MountOpts)[];
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => Object.is(a[key], b[key]));
}
