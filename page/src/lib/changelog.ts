// The project CHANGELOG is the single source of truth for release notes.
// rsbuild/rspack inlines its raw text at build time via the `?raw` query,
// and we parse it here into the structured form the dialog renders. Editing
// the markdown is all that's needed to update the in-app "What's new".
import changelogRaw from "../../../CHANGELOG.md?raw";

export interface ChangelogSection {
  /** Group label from a `### Heading`, e.g. "Core", "UI". */
  title: string;
  /** One entry per `- bullet` line. */
  items: string[];
}

export interface ChangelogEntry {
  version: string;
  /** Date string after the version heading's ` - `, if present. */
  date?: string;
  sections: ChangelogSection[];
}

// `## [0.0.7] - 2026-05-30` or `## 0.0.7` — brackets and date are optional.
// The `\s+` after `##` rejects `###` section headings (next char is `#`).
const VERSION_HEADING = /^##\s+\[?([^\]\s]+)\]?(?:\s*[-–—]\s*(.+?))?\s*$/;
const SECTION_HEADING = /^###\s+(.+?)\s*$/;
const BULLET = /^[-*]\s+(.+?)\s*$/;

/**
 * Parse a Keep-a-Changelog style markdown document into release entries.
 *
 * Pure: builds and returns fresh objects, never mutates its input. Lines
 * before the first version heading (title, intro prose) are ignored, as is
 * any non-heading, non-bullet content.
 */
export function parseChangelog(raw: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = [];
  let entry: ChangelogEntry | null = null;
  let section: ChangelogSection | null = null;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const version = VERSION_HEADING.exec(trimmed);
    if (version) {
      entry = { version: version[1], date: version[2], sections: [] };
      section = null;
      entries.push(entry);
      continue;
    }
    // Skip preamble before the first release heading.
    if (!entry) continue;

    const heading = SECTION_HEADING.exec(trimmed);
    if (heading) {
      section = { title: heading[1], items: [] };
      entry.sections.push(section);
      continue;
    }

    const bullet = BULLET.exec(trimmed);
    if (bullet) {
      // Bullets before any `###` fall into an implicit group.
      if (!section) {
        section = { title: "Changes", items: [] };
        entry.sections.push(section);
      }
      section.items.push(bullet[1]);
    }
  }

  return entries;
}

/** Release notes, newest-first, parsed from the project CHANGELOG. */
export const CHANGELOG: ChangelogEntry[] = parseChangelog(changelogRaw);

/** Latest released version — single source of truth for the badge. */
export const APP_VERSION: string = CHANGELOG[0]?.version ?? "0.0.0";
