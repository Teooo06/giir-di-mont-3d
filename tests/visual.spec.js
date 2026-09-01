import { test, expect } from '@playwright/test';

// YOU-33: 10 key visual states — ponytail: 10 tests, single helper, ~3s each, <45s total
// Each test navigates, waits for terrain/GPX ready via DOM (module scope not global), then screenshots
const READY_JS = () => {
  // module scope not on window, so use DOM signals: #track-status disappears or shows punti, plus #world canvas
  const trackStatus = document.querySelector('#track-status');
  const canvas = document.querySelector('#world');
  if (!canvas) return false;
  // wait until initWorld finished: trackStatus shows "Giir di Mont" or "punti" and not "Caricamento"
  if (trackStatus) {
    const t = (trackStatus.textContent || '').toLowerCase();
    if (t.includes('caricamento')) return false;
    if (t.includes('errore')) return false;
    // after load it shows "<name> (NNNN punti)" or remains empty if no #track-status on index (check fallback)
    if (t.includes('punti') || t.includes('giir') || t.trim().length === 0) {
      // also ensure at least one scene button active — app JS did setScene
      return !!document.querySelector('[data-scene].active');
    }
  }
  // fallback: wait for at least main HUD rendered + WebGL canvas has size
  const hud = document.querySelector('#ndi-bar, .operator');
  return !!(hud && canvas.width > 0);
};

async function gotoAndReady(page, url = '/') {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#world', { timeout: 15000 });
  // wait for DOM ready signal (terrain + GPX loaded via initWorld)
  await page.waitForFunction(READY_JS, null, { timeout: 30000 });
  // let fog/shimmer + one orbit settle, and ensure HMR overlay removed
  await page.waitForTimeout(1800);
  await page.evaluate(() => document.querySelector('vite-error-overlay')?.remove());
}

async function stabilize(page) {
  // pause animation at deterministic point: stop autorun via Space simulation if needed
  // ensure transition indicator not visible before screenshot
  await page.waitForTimeout(400);
}

test.describe('YOU-33 visual regression — 10 states', () => {
  test('01-initial-load — overview scene, default athletes', async ({ page }) => {
    await gotoAndReady(page, '/');
    await stabilize(page);
    // overview is default; ensure terrainStyle satellite
    await page.evaluate(() => {
      try { localStorage.setItem('giir_settings', JSON.stringify({ ...JSON.parse(localStorage.getItem('giir_settings')||'{}'), terrainStyle:'satellite', showMiniMap:true })); } catch {}
    });
    await expect(page).toHaveScreenshot('01-initial-load.png', { maxDiffPixels: 300 });
  });

  test('02-runner-follow — scene runner, athlete selected', async ({ page }) => {
    await gotoAndReady(page, '/');
    await page.evaluate(async () => {
      // select first athlete and go runner
      if (window.raceManager) {
        const s = window.raceManager.getState();
        if (s.athletes[0]) window.raceManager.selectAthlete(s.athletes[0].id);
      }
      if (window.setScene) window.setScene('runner', { duration: 0.3 });
    });
    await page.waitForTimeout(900);
    await stabilize(page);
    await expect(page).toHaveScreenshot('02-runner-follow.png', { maxDiffPixels: 300 });
  });

  test('03-checkpoint — Bocchetta (2070m)', async ({ page }) => {
    await gotoAndReady(page, '/');
    await page.evaluate(() => window.setScene?.('checkpoint', { duration: 0.3 }));
    await page.waitForTimeout(900);
    await stabilize(page);
    await expect(page).toHaveScreenshot('03-checkpoint.png', { maxDiffPixels: 300 });
  });

  test('04-topdown-satellite — zenith satellite', async ({ page }) => {
    await gotoAndReady(page, '/');
    await page.evaluate(() => {
      window.settingsManager?.update?.({ terrainStyle: 'satellite' });
      window.setScene?.('topdown', { duration: 0.3 });
    });
    await page.waitForTimeout(1000);
    await stabilize(page);
    await expect(page).toHaveScreenshot('04-topdown-satellite.png', { maxDiffPixels: 300 });
  });

  test('05-clean-view — C pressed, HUD hidden', async ({ page }) => {
    await gotoAndReady(page, '/');
    await page.keyboard.press('c');
    await page.waitForTimeout(500);
    await stabilize(page);
    await expect(page).toHaveScreenshot('05-clean-view.png', { maxDiffPixels: 300 });
  });

  test('06-ndi-frame — N pressed, 16:9 overlay visible', async ({ page }) => {
    await gotoAndReady(page, '/');
    // ensure frame hidden then toggle to visible deterministically
    await page.evaluate(() => document.querySelector('#ndi-frame')?.classList.remove('hidden'));
    await page.keyboard.press('n');
    await page.waitForTimeout(200);
    await page.keyboard.press('n'); // toggle twice to ensure visible regardless of initial state
    await page.evaluate(() => document.querySelector('#ndi-frame')?.classList.remove('hidden'));
    await stabilize(page);
    await expect(page).toHaveScreenshot('06-ndi-frame.png', { maxDiffPixels: 300 });
  });

  test('07-dark-terrain — style dark', async ({ page }) => {
    await gotoAndReady(page, '/');
    await page.evaluate(() => window.settingsManager?.update?.({ terrainStyle: 'dark' }));
    await page.waitForTimeout(800);
    await stabilize(page);
    await expect(page).toHaveScreenshot('07-dark-terrain.png', { maxDiffPixels: 300 });
  });

  test('08-stylized-terrain — style stylized', async ({ page }) => {
    await gotoAndReady(page, '/');
    await page.evaluate(() => window.settingsManager?.update?.({ terrainStyle: 'stylized' }));
    await page.waitForTimeout(800);
    await stabilize(page);
    await expect(page).toHaveScreenshot('08-stylized-terrain.png', { maxDiffPixels: 300 });
  });

  test('09-impostazioni — /impostazioni with athlete list', async ({ page }) => {
    await page.goto('/impostazioni.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#athlete-tabs, #splits-tbody, .settings-app', { timeout: 15000 });
    await page.waitForTimeout(800);
    await expect(page).toHaveScreenshot('09-impostazioni.png', { fullPage: true, maxDiffPixels: 400 });
  });

  test('10-elevation-profile — athlete at 14.5km GPM', async ({ page }) => {
    await gotoAndReady(page, '/');
    await page.evaluate(() => {
      const ath = window.raceManager?.getSelectedAthlete?.();
      if (ath && window.raceManager) {
        window.raceManager.updateAthleteKm(ath.id, 14.5);
        if (window.simElapsedSec !== undefined && window.kmToElapsedSec) {
          try { window.simElapsedSec = window.kmToElapsedSec(14.5); } catch {}
        }
      }
      // ensure profile visible regardless of settings
      window.settingsManager?.update?.({ showElevationProfile: true });
      window.setScene?.('checkpoint', { duration: 0.2 });
    });
    await page.waitForTimeout(900);
    await stabilize(page);
    await expect(page).toHaveScreenshot('10-elevation-profile.png', { maxDiffPixels: 300 });
  });
});
