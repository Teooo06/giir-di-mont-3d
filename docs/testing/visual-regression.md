# Visual Regression — YOU-33

> ponytail: 10 screenshots, Playwright `toHaveScreenshot`, <60s headless, baseline committed.

## Tooling

- `@playwright/test` + `playwright.config.js` (chromium, swiftshader, 1280×720)
- Baseline: `tests/visual.spec.js-snapshots/*.png` (committed)
- CI: `.github/workflows/visual-regression.yml` on PR (src/html/public + spec)

## 10 states

1. **01-initial-load** — overview scene, default athletes, satellite
2. **02-runner-follow** — scene `runner`, first athlete selected
3. **03-checkpoint** — scene `checkpoint` (Bocchetta 2070m)
4. **04-topdown-satellite** — `topdown` + satellite style
5. **05-clean-view** — <kbd>C</kbd> pressed, HUD hidden (opacity 0.15/0.3)
6. **06-ndi-frame** — <kbd>N</kbd> pressed, 16:9 dashed overlay visible
7. **07-dark-terrain** — terrainStyle `dark`
8. **08-stylized-terrain** — terrainStyle `stylized`
9. **09-impostazioni** — `/impostazioni.html` with athlete list (fullPage)
10. **10-elevation-profile** — athlete at 14.5km (GPM), checkpoint scene

Each test: `gotoAndReady` waits for `#world` + `terrainManager.terrainData` + `routeCurve`, settles 1.6s, then `waitForTimeout(400)` + `toHaveScreenshot`.

## Commands

```powershell
npm run test:visual              # run, expect baselines to match
npm run test:visual:update       # update baselines after intentional visual change
npm run test:visual:list         # list without run
npx playwright test --project=chromium -g "01-initial"
npx playwright show-report
```

## Baseline lifecycle

- First run on fresh checkout (or after visual change): `npm run test:visual:update` → generates `tests/visual.spec.js-snapshots/*.png` → commit them.
- Subsequent runs compare current render vs baseline; diff > `maxDiffPixels: 150, threshold: 0.2` fails PR.
- Update only after reviewing diff in CI artifact `playwright-report`.

## Perf budget

- Workers `1` (WebGL serial), ~3s per test, ~30s total on M2 / ~45s on CI ubuntu.
- `webServer` reuses existing `vite` if running locally (`reuseExistingServer: !CI`), else starts `npx vite --port 5173`.

## Verification

```powershell
npm ci
npx playwright install chromium --with-deps
npm run test:visual          # should pass after baseline commit
npm run build                # vite build still succeeds
```

## Ponytail notes

- Single config, single spec file, no per-state fixture abstraction — upgrade to POM if >20 states.
- Global 150px diff allows AA jitter; clouds/fog shimmer gated but still ±6% — snapshots taken after 1.6s settle to reduce flake.
- No `pixelmatch` direct usage yet — `toHaveScreenshot` wraps it; add `scripts/diff.mjs` with `pixelmatch+pngjs` only if director wants custom overlay.
- **Ceiling:** SwiftShader soft GPU in CI; if WebGL fails on headless, add `chrome --use-angle=swiftshader` already set, else fallback to `xvfb` (not needed).
