# Core Release Checklist

Manual release runbook for `@molvis/core`.

## 1. Pre-release sanity checks

```bash
npm ci
npm run release:check -w core
```

`release:check` runs:

- library build (`rslib build`)
- core tests (`rstest`)
- package dry-run (`npm pack --dry-run`)

## 2. Verify package content

From the dry-run output, confirm tarball only includes:

- `dist/**`
- `README.md`
- `LICENSE`
- `package.json`

Ensure no `src/**`, `examples/**`, or test files are shipped.

## 3. Smoke-test install

```bash
mkdir -p /tmp/molvis-core-smoke && cd /tmp/molvis-core-smoke
npm init -y
npm install @molvis/core@<version>
```

Validate a minimal `mountMolvis(...)` app starts without runtime errors.

## 4. Publish (manual)

```bash
cd /path/to/molvis/core
npm publish --access public --tag latest
```

## 5. Post-publish verification

- `npm view @molvis/core version` matches target version.
- Install from a clean project and run a basic frame render.
- Create GitHub release notes with:
  - version
  - key changes
  - known limitations
