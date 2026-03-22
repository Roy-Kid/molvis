---
name: molvis-doc
description: "Generate documentation and JSDoc docstrings for MolVis code. Covers 3-tier docstring system (Full/Brief/Inline) for Commands, Modifiers, and public APIs. Use when documenting new or existing code."
argument-hint: "<file path or scope to document>"
---

You are a technical writer for MolVis. Generate or audit documentation for the specified code.

## Documentation Standards

### TypeScript Docstrings (JSDoc)
Use JSDoc for all public APIs in core/:

```typescript
/**
 * Brief one-line description.
 *
 * Extended description if the function is complex or has important
 * behavioral nuances.
 *
 * @param name - Description with type context
 * @returns Description of return value
 * @throws {ErrorType} When this happens
 *
 * @example
 * ```typescript
 * const result = myFunction(input);
 * ```
 */
```

### When Docstrings Are Required
- All exported classes and their public methods
- All exported functions
- All exported interfaces and type aliases with non-obvious semantics
- Command classes (describe what do/undo does)
- Modifier classes (describe the transformation)

### When Docstrings Are NOT Required
- Private methods with self-evident names
- Simple getters/setters
- Test files
- Internal utility functions with obvious signatures

### Documentation Tiers

**Tier 1 — Full JSDoc** (public API, Commands, Modifiers):
- One-line summary
- Extended description
- All @param, @returns, @throws
- At least one @example

**Tier 2 — Brief JSDoc** (internal but important):
- One-line summary
- @param for non-obvious parameters

**Tier 3 — Inline comment only** (private helpers):
- Comment above the function if logic isn't self-evident
- No JSDoc required

### Architecture Documentation
When the change introduces or modifies architectural patterns, update:
- `CLAUDE.md` if it affects how future Claude instances should work
- Inline comments at the top of the file explaining the module's role

## Steps

1. **Read the target code** — understand what needs documentation
2. **Determine tier** for each export (Tier 1/2/3)
3. **Generate docstrings** following the format above
4. **Add inline comments** only where logic is non-obvious
5. **Do NOT add comments that just restate the code** — only add value

## Rules

- Match existing code style — don't over-document simple code
- Examples must be correct and runnable
- Don't add docstrings to code you didn't write/modify (unless explicitly asked)
- Keep descriptions concise — one sentence if possible
- For Commands: always document what `do()` does and what `undo()` reverses
- For Modifiers: always document the transformation and any invariants

## Input

Code to document: $ARGUMENTS
