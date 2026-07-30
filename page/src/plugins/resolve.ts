import type { ResolvedPluginSource } from "./types";

export interface ResolvePluginSourceOptions {
  /** Injectable fetch (tests). Defaults to global `fetch`. */
  fetchImpl?: typeof fetch;
}

/**
 * Parse a user-supplied plugin location into fetchable URLs.
 *
 * Accepted forms:
 * - `owner/repo` — **no tag → latest GitHub release** (else default-branch tip)
 * - `owner/repo@ref`
 * - `https://github.com/owner/repo`
 * - `https://github.com/owner/repo/tree/ref`
 * - absolute HTTPS URL to package root, manifest, or entry
 */
export async function resolvePluginSource(
  input: string,
  options?: ResolvePluginSourceOptions,
): Promise<ResolvedPluginSource> {
  const raw = input.trim();
  if (!raw) {
    throw new Error("Plugin source is empty");
  }

  // Direct manifest URL
  if (/^https?:\/\//i.test(raw) && raw.endsWith("molvis.plugin.json")) {
    const manifestUrl = raw;
    const baseUrl = manifestUrl.slice(
      0,
      manifestUrl.length - "molvis.plugin.json".length,
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
      manifestUrl: new URL("molvis.plugin.json", baseUrl).href,
    };
  }

  // Absolute package base URL
  if (/^https?:\/\//i.test(raw) && !raw.includes("github.com")) {
    const baseUrl = raw.endsWith("/") ? raw : `${raw}/`;
    return {
      sourceKey: raw,
      baseUrl,
      manifestUrl: new URL("molvis.plugin.json", baseUrl).href,
    };
  }

  const gh = parseGitHub(raw);
  if (gh) {
    let ref = gh.ref;
    if (!ref) {
      // No tag: pin to latest GitHub release when one exists; otherwise
      // leave unpinned so jsDelivr serves the default-branch tip.
      ref =
        (await fetchLatestGithubReleaseTag(
          gh.owner,
          gh.repo,
          options?.fetchImpl,
        )) ?? undefined;
    }
    const refPart = ref ? `@${ref}` : "";
    const baseUrl = `https://cdn.jsdelivr.net/gh/${gh.owner}/${gh.repo}${refPart}/`;
    return {
      sourceKey: raw,
      baseUrl,
      manifestUrl: `${baseUrl}molvis.plugin.json`,
      resolvedRef: ref,
    };
  }

  throw new Error(
    `Unrecognized plugin source: ${raw}. Use owner/repo[@ref] or an HTTPS URL.`,
  );
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
  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/releases/latest`;
    const res = await fetchImpl(url, {
      headers: {
        Accept: "application/vnd.github+json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { tag_name?: unknown };
    if (typeof data.tag_name === "string" && data.tag_name.trim()) {
      return data.tag_name.trim();
    }
    return null;
  } catch {
    return null;
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
