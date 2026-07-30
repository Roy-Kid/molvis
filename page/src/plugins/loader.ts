import { pluginHostModules } from "./host_shared";
import type { MolvisPluginModule, PluginManifest } from "./types";

const blobUrls: string[] = [];
let importMapReady = false;
const moduleBlobUrls = new Map<string, string>();
/** Absolute source URL → rewritten blob URL (supports multi-chunk graphs). */
const rewrittenModuleBlobs = new Map<string, string>();
/** In-flight rewrite promises for cycle-safe parallel loads. */
const rewriteInFlight = new Map<string, Promise<string>>();

function buildModuleBlob(
  spec: string,
  exports: Record<string, unknown>,
): string {
  const existing = moduleBlobUrls.get(spec);
  if (existing) return existing;

  const hostKey = `__MOLVIS_PLUGIN_HOST_MODULES__`;
  const g = globalThis as typeof globalThis & {
    [key: string]: Record<string, Record<string, unknown>>;
  };
  if (!g[hostKey]) g[hostKey] = {};
  g[hostKey][spec] = exports as Record<string, unknown>;

  const lines: string[] = [
    `const mod = globalThis[${JSON.stringify(hostKey)}][${JSON.stringify(spec)}];`,
  ];

  const keys = Object.keys(exports).filter(
    (k) => k !== "default" && k !== "__esModule",
  );
  if ("default" in exports) {
    lines.push(`export default mod.default ?? mod;`);
  } else {
    lines.push(`export default mod;`);
  }
  for (const key of keys) {
    if (!/^[A-Za-z_$][\w$]*$/.test(key)) continue;
    lines.push(`export const ${key} = mod[${JSON.stringify(key)}];`);
  }

  const blob = new Blob([lines.join("\n")], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  moduleBlobUrls.set(spec, url);
  blobUrls.push(url);
  return url;
}

export function ensurePluginHostModules(): void {
  if (importMapReady) return;
  for (const [spec, mod] of Object.entries(pluginHostModules)) {
    buildModuleBlob(spec, mod as unknown as Record<string, unknown>);
  }
  importMapReady = true;
}

function rewriteBareImports(source: string): string {
  ensurePluginHostModules();
  const specs = Object.keys(pluginHostModules);
  let out = source;
  for (const spec of specs) {
    const blobUrl = moduleBlobUrls.get(spec);
    if (!blobUrl) continue;
    const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    out = out.replace(
      new RegExp(`(from\\s+|import\\s*\\()(['"])${escaped}\\2`, "g"),
      `$1$2${blobUrl}$2`,
    );
  }
  return out;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  return res.text();
}

export async function fetchPluginManifest(
  manifestUrl: string,
): Promise<PluginManifest> {
  const text = await fetchText(manifestUrl);
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Invalid plugin manifest JSON at ${manifestUrl}`);
  }
  const m = json as PluginManifest;
  if (!m || typeof m !== "object") {
    throw new Error("Plugin manifest must be an object");
  }
  if (typeof m.id !== "string" || !m.id) {
    throw new Error("Plugin manifest missing string 'id'");
  }
  if (typeof m.entry !== "string" || !m.entry) {
    throw new Error("Plugin manifest missing string 'entry'");
  }
  if (typeof m.name !== "string") m.name = m.id;
  if (typeof m.version !== "string") m.version = "0.0.0";
  return m;
}

const REL_IMPORT_RE = /(from\s+|import\s*\()(['"])(\.[^'"]+)\2/g;

/**
 * Fetch a module graph starting at `url`, rewrite bare host imports to
 * shared blobs, and rewrite relative imports to recursively rewritten
 * chunk blobs. Returns a blob: URL ready for `import()`.
 */
export async function rewriteModuleGraph(url: string): Promise<string> {
  const absolute = new URL(url).href;
  const cached = rewrittenModuleBlobs.get(absolute);
  if (cached) return cached;

  const inflight = rewriteInFlight.get(absolute);
  if (inflight) return inflight;

  const promise = (async () => {
    // Reserve the key early so mutual imports don't loop forever.
    // Temporary empty string is replaced before return.
    rewrittenModuleBlobs.set(absolute, "");

    const source = await fetchText(absolute);
    let rewritten = rewriteBareImports(source);

    const relSpecs = new Set<string>();
    for (const match of source.matchAll(REL_IMPORT_RE)) {
      relSpecs.add(match[3]);
    }

    const relToBlob = new Map<string, string>();
    await Promise.all(
      [...relSpecs].map(async (rel) => {
        const childAbs = new URL(rel, absolute).href;
        const childBlob = await rewriteModuleGraph(childAbs);
        relToBlob.set(rel, childBlob);
      }),
    );

    rewritten = rewritten.replace(
      REL_IMPORT_RE,
      (full, prefix: string, quote: string, rel: string) => {
        const blob = relToBlob.get(rel);
        if (!blob) return full;
        return `${prefix}${quote}${blob}${quote}`;
      },
    );

    const blob = new Blob([rewritten], { type: "text/javascript" });
    const blobUrl = URL.createObjectURL(blob);
    blobUrls.push(blobUrl);
    rewrittenModuleBlobs.set(absolute, blobUrl);
    return blobUrl;
  })();

  rewriteInFlight.set(absolute, promise);
  try {
    return await promise;
  } finally {
    rewriteInFlight.delete(absolute);
  }
}

function coercePluginModule(
  mod: {
    default?: MolvisPluginModule | (new () => MolvisPluginModule);
  } & Partial<MolvisPluginModule>,
): MolvisPluginModule {
  const exported = mod.default ?? mod;
  if (typeof exported === "function") {
    const Ctor = exported as new () => MolvisPluginModule;
    return new Ctor();
  }
  if (
    exported &&
    typeof exported === "object" &&
    typeof (exported as MolvisPluginModule).activate === "function" &&
    typeof (exported as MolvisPluginModule).id === "string"
  ) {
    return exported as MolvisPluginModule;
  }
  throw new Error(
    "Plugin module must default-export an object/class with id + activate()",
  );
}

/**
 * Load a plugin ESM entry (and any relative chunk graph it imports).
 * Bare imports of react / molvis-stage / molvis-core/molrs resolve to host singletons.
 */
export async function loadPluginModule(
  entryUrl: string,
): Promise<MolvisPluginModule> {
  ensurePluginHostModules();
  const blobUrl = await rewriteModuleGraph(entryUrl);
  try {
    const mod = (await import(
      /* webpackIgnore: true */
      /* @vite-ignore */
      blobUrl
    )) as {
      default?: MolvisPluginModule | (new () => MolvisPluginModule);
    } & Partial<MolvisPluginModule>;
    return coercePluginModule(mod);
  } catch (err) {
    throw err instanceof Error
      ? err
      : new Error(`Failed to import plugin: ${String(err)}`);
  }
}
