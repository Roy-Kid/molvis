/**
 * Lazy loader for Kekule.js via npm package.
 * Dynamic import for code splitting — loaded on first use.
 */

let cached: Promise<typeof Kekule> | null = null;

export function loadKekule(): Promise<typeof Kekule> {
  if (cached) return cached;

  cached = (async () => {
    const mod = await import("kekule");
    await import("kekule/theme");
    const K =
      mod.Kekule ?? (mod as unknown as { default: typeof Kekule }).default;
    if (!K) throw new Error("Kekule namespace not found");
    return K;
  })();

  cached.catch(() => {
    cached = null;
  });

  return cached;
}
