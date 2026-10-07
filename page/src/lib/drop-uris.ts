/**
 * Workspace URIs carried by a drag from a host's file explorer.
 *
 * A webview cannot read a workspace file itself, so a drag from the VS Code
 * Explorer arrives as `text/uri-list` with no `File` behind it — the host has
 * to read it. `dataTransfer.items` / `.files`, which the shell's own drop path
 * uses, are empty for that drag.
 */
export function readDropUris(data: DataTransfer | null | undefined): string[] {
  const raw = data?.getData("text/uri-list");
  if (!raw) return [];
  return (
    raw
      .split("\n")
      .map((line) => line.trim())
      // `text/uri-list` allows `#` comment lines (RFC 2483).
      .filter((line) => line.length > 0 && !line.startsWith("#"))
  );
}
