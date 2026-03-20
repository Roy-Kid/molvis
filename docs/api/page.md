# Page Runtime Reference

## Package

`page/` is the React application shell for MolVis. It is not a published library with a stable import API; its public surface is the runnable app, its file-loading UX, and its build/test scripts.

## Runtime Surface

- App entry: `page/src/main.tsx`
- Main shell: `page/src/App.tsx`
- Mount target: `page/index.html`

The page app embeds `@molvis/core` and provides:

- file open and drag-and-drop loading for supported molecular files
- side panels for trajectory, pipeline, selection, and inspector workflows
- responsive desktop and mobile layout

## Engineering Commands

```bash
npm run dev -w page
npm run build -w page
npm run test -w page
```

- `dev` starts the Rsbuild development server
- `build` produces the production bundle
- `test` runs the Node-based smoke tests under `page/test/`

## Current Test Coverage

The pre-release smoke suite currently validates the synthetic RDF adapter in `page/test/rdfAdapter.test.ts`. Additional UI-level coverage should be added alongside new panels or file-loading flows.
