# Molvis

Molvis is an interactive molecular visualization toolkit built on top of [Babylon.js](https://www.babylonjs.com/). This repository is organized as a monorepo containing multiple packages:

- **core/** – the TypeScript library that implements the rendering engine and main API.
- **standalone/** – a React based web application for exploring molecules in the browser.
- **widget/** – a Python package that provides a Jupyter widget.

## Getting started

Install all dependencies:

```bash
npm install
```

During development you can run each package individually:

```bash
npm run dev:core        # develop the core library
npm run dev:standalone  # start the standalone web app
npm run dev:widget      # build the Jupyter widget in watch mode
```

## Example

A minimal example using the core library looks like the following:

```ts
import { Molvis } from 'molvis';

const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const app = new Molvis(canvas);
app.render();
```

This renders and updates the molecular scene on the provided `<canvas>` element. The widget package exposes similar functionality inside Jupyter notebooks.

## License

This project is distributed under the BSD-3-Clause license. See the [LICENSE](LICENSE) file for details.
