# Sidebar UI Design Language

The Edit tab (`page/src/ui/modes/edit/`) sets the visual contract for all
sidebar panels. Reuse it everywhere — same heights, same type scale, same
voice.

## Typography scale

- `text-[10px]` — section headers (`uppercase tracking-wide font-semibold`), prefix labels, status/hint lines
- `text-[9px]` — subtitles, badges
- `text-xs` (12px) — inputs, buttons with visible text, `SelectItem`s
- `font-mono` on inputs that carry structural text (SMILES, identifiers, paths)

## Control sizing

- `h-7` — primary interactive controls (Input, SelectTrigger, Button)
- `h-6` — `TabsTrigger` inside `TabsList h-7 p-0.5` (nested, denser)
- `h-4` — status bar rows
- Icons: `h-3.5 w-3.5` inside buttons, `h-3 w-3` inline in status lines

## Spacing

- Section header: `px-2 py-1`, content wrapper: `px-2 pb-1.5 space-y-1.5`
- Control rows: `flex items-center gap-1.5` with `Input` / `Select` as `flex-1 min-w-0` and a right-aligned icon button (`h-7 px-2`)
- Status lines: `flex items-center gap-1 px-2 py-1` with a leading icon + short imperative text

## Color semantics

- `text-muted-foreground` — every non-active label, placeholder, hint
- `text-destructive` + `AlertCircle` — errors
- `text-emerald-500` + `MousePointerClick` — success/next-step prompts
- Active tab / pressed toggle: `variant="secondary"` + optional `ring-1 ring-ring`

## Patterns

- Wrap each logical group in `<SidebarSection>` (collapsible). Secondary sections start with `defaultOpen={false}`.
- For a section that fills remaining vertical space, pass `className="flex-1 min-h-0 flex flex-col"` **and** `contentClassName="flex-1 min-h-0 flex flex-col"`.
- Icon-only tabs/buttons: `aria-label` + `title`, never visible text. Use `grid grid-cols-N gap-0.5` for tab bars.
- Prefix labels: `w-10 shrink-0 text-[10px] text-muted-foreground`, so inputs align across rows.
- Disabled dropdown items: keep visible with `(soon)` suffix instead of hiding.

## Writing style

- Section titles: 1–3 words, uppercase via CSS. Prefer nouns. Never add "Settings"/"Options"/"Panel" suffixes.
- Placeholders: show a real value (`"CCO"`, `"aspirin or 2244"`), not instructions.
- Status copy: short imperative, ≤6 words. No trailing period.
- Error messages: ≤10 words and specific.
- Icon-only controls: matching `title` and `aria-label`; don't duplicate text in DOM.
