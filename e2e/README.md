# e2e — `@rstest/playwright`

Real end-to-end tests: a **Node** Rstest worker drives Chromium via Playwright
against a built page, preview server, or URL (`page.goto`).

| | Unit (`*/tests`) | E2E (`e2e/`) |
|--|------------------|--------------|
| Package | `@rstest/core` + `@rstest/browser` | `@rstest/playwright` |
| Where code runs | Inside the browser bundle | Outside; controls the page |
| Import | `from "@rstest/core"` | `from "@rstest/playwright"` |
| Use for | Single modules, WASM, components | Full app / visual smoke |

## Run

```bash
# after a page (or other host) build exists for the cases you write
npm run test:e2e
```

Debug:

```bash
PWDEBUG=1 npm run test:e2e
```

## Writing a case

```ts
import { expect, test } from "@rstest/playwright";

test("viewer shell", async ({ page, serve }) => {
  const { url } = await serve("../page/dist/index.html");
  await page.goto(url);
  await expect(page.locator("molvis-viewer, canvas")).toBeAttached();
});
```

Keep this tree **thin**. Prefer unit tests under package `tests/` and public
goldens under `regressions/`. Do not dump multi-module NullEngine façades here
that belong as unit tests with fakes.
