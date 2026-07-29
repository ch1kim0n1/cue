const { test, expect, _electron: electron } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const packed = process.env.CUE_PACKED_EXE;
const appRoot = path.join(__dirname, '..');

test.describe('Cue packaged asar UI', () => {
  test.skip(!packed || !fs.existsSync(packed), 'Set CUE_PACKED_EXE after npm run pack');

  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async () => {
    app = await electron.launch({
      executablePath: packed,
      args: [],
      cwd: path.dirname(packed),
      env: {
        ...process.env,
        CUE_NO_PROTECT: '1',
        CUE_LOG_LEVEL: 'error'
      }
    });
    page = await app.firstWindow({ timeout: 45000 });
    await page.waitForSelector('#toolbar', { timeout: 20000 });
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('packaged window loads with sandbox + preload', async () => {
    await expect(page.locator('#toolbar')).toBeVisible();
    const hasCue = await page.evaluate(() => typeof window.cue === 'object' && !!window.cue.settingsGet);
    expect(hasCue).toBe(true);
    const diag = await page.evaluate(async () => window.cue.diagnosticsGet());
    expect(diag.version).toBeTruthy();
    expect(diag.dataPath).toBeTruthy();
  });
});

// Keep a no-op reference so the module resolves when skipped without packed env.
void appRoot;
