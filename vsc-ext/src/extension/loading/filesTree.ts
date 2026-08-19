/**
 * Folder grouping for the Activity Bar Files tree. Path strings only —
 * the VS Code provider maps them back to URIs.
 */

export type FolderGroup = {
  folder: string;
  paths: string[];
};

/** Group posix/Windows paths by parent directory (`"."` when there is none). */
export function groupPathsByParent(paths: string[]): FolderGroup[] {
  const map = new Map<string, string[]>();
  for (const raw of paths) {
    const norm = raw.replaceAll("\\", "/");
    const slash = norm.lastIndexOf("/");
    const folder = slash <= 0 ? "." : norm.slice(0, slash);
    const list = map.get(folder) ?? [];
    list.push(norm);
    map.set(folder, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([folder, grouped]) => ({
      folder,
      paths: grouped.sort((a, b) => a.localeCompare(b)),
    }));
}
