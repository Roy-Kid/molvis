export type Listener<T = unknown> = (data: T) => void;

export class EventEmitter {
  private listeners = new Map<string, Set<Listener>>();

  public on<T = unknown>(event: string, listener: Listener<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener);

    // Return unsubscribe function
    return () => this.off(event, listener);
  }

  public off<T = unknown>(event: string, listener: Listener<T>): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<T = unknown>(event: string, data: T): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      // Create a copy to avoid issues if listeners unsubscribe during emission
      for (const listener of new Set(listeners)) {
        listener(data);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
