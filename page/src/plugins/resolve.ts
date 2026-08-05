import {
  GITHUB_API_BASE,
  GITHUB_HOST,
  githubReleaseDownloadBase,
  HOST_LOG_TAG,
  JSDELIVR_GH_BASE,
  MANIFEST_FILENAME,
} from "./constants";
import type { ResolvedPluginSource } from "./types";

/**
 * Resolve a manifest's `entry` against its package base.
 *
 * `new URL(entry, base)` ignores `base` entirely when `entry` is itself
 * absolute, so an unchecked manifest could point the loader at any origin —
 * defeating the ref pinning the user asked for. Entry must stay inside the
 * package the manifest was fetched from.
 */
export function resolvePluginEntryUrl(entry: string, baseUrl: string): string {
  const trimmed = entry.trim();
  if (!trimmed) {
    throw new Error("Plugin manifest 'entry' is empty");
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    throw new Error(
      `Plugin manifest 'entry' must be a relative path inside the package, got '${entry}'`,
    );
  }
  const resolved = new URL(trimmed, baseUrl);
  const base = new URL(baseUrl);
  if (
    resolved.origin !== base.origin ||
    !resolved.pathname.startsWith(base.pathname)
  ) {
    throw new Error(
      `Plugin manifest 'entry' escapes its package root: '${entry}' resolves outside ${baseUrl}`,
    );
  }
  return resolved.href;
}

export interface ResolvePluginSourceOptions {
  /** Injectable fetch (tests). Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Parse a user-supplied plugin location into fetchable URLs.
 *
 * Accepted forms:
 * - `owner/repo` — **no tag → latest GitHub release** (Release assets base)
 * - `owner/repo@ref` — **Release assets** when `ref` is a release tag;
 *   otherwise jsDelivr git tree (dev tip / non-release refs)
 * - `https://github.com/owner/repo`
 * - `https://github.com/owner/repo/tree/ref`
 * - absolute **http(s)** URL to package root, manifest, or entry
 *   (includes **local debug**: `http://127.0.0.1:4173/` after `npm run serve`)
 *
 * **Release layout** (CI): flat assets next to each other —
 * `molvis.plugin.json` + `plugin.js` (+ workers). Manifest `entry` is
 * `"plugin.js"`, not `"dist/plugin.js"`.
 *
 * Not accepted: bare filesystem paths / `file://`.
 */
export async function resolvePluginSource(
  input: string,
  options?: ResolvePluginSourceOptions,
): Promise<ResolvedPluginSource> {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Plugin source is empty");
  }

  if (
    /^file:\/\//i.test(raw) ||
    /^[A-Za-z]:[\\/]/.test(raw) ||
    raw.startsWith("/")
  ) {
    throw new Error(
      "Local filesystem paths are not loadable in the browser. " +
        "Serve the plugin over HTTP (e.g. `npm run serve` in the plugin repo) " +
        "and install `http://127.0.0.1:4173/` (or the dist/plugin.js URL).",
    );
  }

  // Direct manifest URL (http or https — localhost allowed for debug)
  if (/^https?:\/\//i.test(raw) && raw.endsWith(MANIFEST_FILENAME)) {
    const manifestUrl = raw;
    const baseUrl = manifestUrl.slice(
      0,
      manifestUrl.length - MANIFEST_FILENAME.length,
    );
    return { sourceKey: raw, baseUrl, manifestUrl };
  }

  // Direct entry .js URL — synthesize a sibling manifest next to entry
  if (/^https?:\/\//i.test(raw) && /\.m?js(\?.*)?$/i.test(raw)) {
    const url = new URL(raw);
    const baseUrl = url.href.replace(/[^/]+$/, "");
    return {
      sourceKey: raw,
      baseUrl,
      manifestUrl: new URL(MANIFEST_FILENAME, baseUrl).href,
    };
  }

  // Absolute package base URL. Compare hostnames — a substring test misroutes
  // any URL that merely contains "github.com" in its path.
  if (/^https?:\/\//i.test(raw) && !isGithubUrl(raw)) {
    const baseUrl = raw.endsWith("/") ? raw : `${raw}/`;
    return {
      sourceKey: raw,
      baseUrl,
      manifestUrl: new URL(MANIFEST_FILENAME, baseUrl).href,
    };
  }

  const gh = parseGitHub(raw);
  if (gh) {
    let ref = gh.ref;
    if (!ref) {
      ref =
        (await fetchLatestGithubReleaseTag(
          gh.owner,
          gh.repo,
          options?.fetchImpl,
        )) ?? undefined;
    }

    if (ref && looksLikeReleaseTag(ref)) {
      // Prefer GitHub Release assets (dist not in git).
      const baseUrl = githubReleaseDownloadBase(gh.owner, gh.repo, ref);
      return {
        sourceKey: raw,
        baseUrl,
        manifestUrl: `${baseUrl}${MANIFEST_FILENAME}`,
        resolvedRef: ref,
      };
    }

    // Non-release ref or no tag: jsDelivr git tree (source checkout / branch tip).
    // Without a published release this only works if the tree still contains
    // built assets (local forks); official packages publish Release packages.
    const refPart = ref ? `@${ref}` : "";
    const baseUrl = `${JSDELIVR_GH_BASE}/${gh.owner}/${gh.repo}${refPart}/`;
    if (!ref) {
      console.warn(
        `${HOST_LOG_TAG} ${gh.owner}/${gh.repo} has no GitHub release; ` +
          "installing from the default branch (may lack built plugin assets).",
      );
    }
    return {
      sourceKey: raw,
      baseUrl,
      manifestUrl: `${baseUrl}${MANIFEST_FILENAME}`,
      resolvedRef: ref,
    };
  }

  throw new Error(
    `Unrecognized plugin source: ${raw}. Use owner/repo[@ref] or an HTTPS URL.`,
  );
}

/** True for tags we treat as GitHub Release packages (v1.2.3, 1.2.3, …). */
export function looksLikeReleaseTag(ref: string): boolean {
  return /^v?\d+\.\d+(\.\d+)?([._-].*)?$/i.test(ref.trim());
}

/**
 * Resolve the latest published GitHub release tag, or `null` if none / offline.
 * Injected fetch is for tests.
 */
export async function fetchLatestGithubReleaseTag(
  owner: string,
  repo: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string | null> {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/releases/latest`;
  let res: Response;
  try {
    res = await fetchImpl(url, {
      headers: { Accept: "application/vnd.github+json" },
    });
  } catch (err) {
    console.warn(
      `${HOST_LOG_TAG} could not reach GitHub to pin ${owner}/${repo}; ` +
        "installing from the default branch instead",
      err,
    );
    return null;
  }
  if (res.status !== 404 && !res.ok) {
    console.warn(
      `${HOST_LOG_TAG} GitHub release lookup for ${owner}/${repo} failed ` +
        `(HTTP ${res.status}); installing from the default branch instead`,
    );
    return null;
  }
  if (!res.ok) return null;
  const data = (await res.json()) as { tag_name?: unknown };
  if (typeof data.tag_name === "string" && data.tag_name.trim()) {
    return data.tag_name.trim();
  }
  return null;
}

/** Hostname-based GitHub check (a substring test misroutes mirror URLs). */
function isGithubUrl(raw: string): boolean {
  try {
    const host = new URL(raw).hostname.toLowerCase();
    return host === GITHUB_HOST || host === `www.${GITHUB_HOST}`;
  } catch {
    return false;
  }
}

function parseGitHub(
  raw: string,
): { owner: string; repo: string; ref?: string } | null {
  // owner/repo or owner/repo@ref
  const short = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:@([^/\s]+))?$/.exec(
    raw,
  );
  if (short) {
    return {
      owner: short[1],
      repo: short[2],
      ref: short[3],
    };
  }

  try {
    if (!/^https?:\/\/(www\.)?github\.com\//i.test(raw)) return null;
    const url = new URL(raw);
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/, "");
    let ref: string | undefined;
    if (parts[2] === "tree" && parts[3]) {
      ref = parts.slice(3).join("/");
    } else if (parts[2] === "blob" && parts[3]) {
      ref = parts[3];
    }
    return { owner, repo, ref };
  } catch {
    return null;
  }
}
