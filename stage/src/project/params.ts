/**
 * Opt-in persistence for modifier parameters.
 *
 * Project save, backend state-sync, and RPC all rebuild modifiers from the
 * registry with **default** parameters, so anything a modifier does not
 * declare here comes back as new. That is survivable for a modifier whose
 * defaults are its normal state and unacceptable for one whose whole identity
 * is a choice — a `Molecular surface` set to SES must not reload as vdW.
 *
 * Declaring the pair here rather than adding another `instanceof` branch to
 * {@link ./serialize} keeps the serialiser ignorant of which modifiers happen
 * to care.
 */

export type ProjectParams = Record<string, unknown>;

export interface ProjectParamsCarrier {
  /** Values to persist. Must round-trip through {@link fromProjectParams}. */
  toProjectParams(): ProjectParams;
  /**
   * Restore from a persisted record. The input is untrusted — it comes off
   * disk and may have been written by an older version — so every field must
   * be validated, and anything unrecognised left at its default.
   */
  fromProjectParams(params: ProjectParams): void;
}

export function carriesProjectParams(
  entry: unknown,
): entry is ProjectParamsCarrier {
  const candidate = entry as Partial<ProjectParamsCarrier> | null;
  return (
    typeof candidate?.toProjectParams === "function" &&
    typeof candidate?.fromProjectParams === "function"
  );
}

/** Read a finite number, or fall back. Guards against `null` and strings. */
export function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Read one of a fixed set of strings, or fall back. */
export function readEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" &&
    (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}
