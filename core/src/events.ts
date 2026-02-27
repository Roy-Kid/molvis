import type { Box, Frame } from "@molcrafts/molrs";
import type { Trajectory } from "./system/trajectory";
import type { ModeType } from "./mode/base";

/**
 * Typed event map for MolvisApp.events.
 * Every event name and its payload type is defined here.
 */
export interface MolvisEventMap {
  "frame-change": number;
  "frame-rendered": { frame: Frame; box?: Box };
  "trajectory-change": Trajectory;
  "mode-change": ModeType;
  "info-text-change": string;
  "fps-change": number;
  "history-change": { canUndo: boolean; canRedo: boolean };
  "dirty-change": boolean;
  "status-message": { text: string; type: "info" | "error" };
}

export type Listener<T = unknown> = (data: T) => void;

/**
 * Type-safe event emitter.
 *
 * When instantiated as EventEmitter<MolvisEventMap>, all emit/on/off calls
 * are checked against the event map at compile time.
 */
// biome-ignore lint: generic event maps don't need index signatures
export class EventEmitter<TMap = Record<string, unknown>> {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  public on<K extends string & keyof TMap>(event: K, listener: Listener<TMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(listener as Listener<unknown>);

    return () => this.off(event, listener);
  }

  public off<K extends string & keyof TMap>(event: K, listener: Listener<TMap[K]>): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener as Listener<unknown>);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends string & keyof TMap>(event: K, data: TMap[K]): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of new Set(listeners)) {
        (listener as Listener<TMap[K]>)(data);
      }
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
