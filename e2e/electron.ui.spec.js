const { test, expect, _electron: electron } = require('@playwright/test');
const path = require('path');

const appRoot = path.join(__dirname, '..');

test.describe('Cue Electron UI', () => {
  /** @type {import('@playwright/test').ElectronApplication} */
  let app;
  /** @type {import('@playwright/test').Page} */
  let page;

  test.beforeAll(async () => {
    app = await electron.launch({
      args: ['.'],
      cwd: appRoot,
      env: {
        ...process.env,
        CUE_NO_PROTECT: '1',
        CUE_LOG_LEVEL: 'error'
      }
    });
    page = await app.firstWindow({ timeout: 30000 });
    await page.waitForSelector('#toolbar', { timeout: 15000 });
  });

  test.afterAll(async () => {
    if (app) await app.close();
  });

  test('window loads without page errors', async () => {
    const errors = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    await expect(page.locator('#toolbar')).toBeVisible();
    await expect(page.locator('#panel')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('privacy notice can be acknowledged', async () => {
    const privacy = page.locator('#privacy-scrim');
    if (await privacy.isVisible()) {
      await page.locator('#privacy-ack').click();
      await expect(privacy).toBeHidden();
    }
  });

  test('settings opens and closes', async () => {
    // Dismiss onboard if present so Settings is reachable.
    const onboard = page.locator('#onboard-scrim');
    if (await onboard.isVisible()) {
      await page.locator('#ob-skip').click();
    }
    await page.locator('#more-btn').click();
    await expect(page.locator('#settings-scrim')).toBeVisible();
    await expect(page.locator('#diagnostics-box')).toBeVisible();
    await page.locator('#s-close').click();
    await expect(page.locator('#settings-scrim')).toBeHidden();
  });

  test('listen respects consent gate', async () => {
    const onboard = page.locator('#onboard-scrim');
    if (await onboard.isVisible()) await page.locator('#ob-skip').click();
    // Ensure consent off
    await page.locator('#more-btn').click();
    const consent = page.locator('#listen-consent');
    if (await consent.isChecked()) await consent.click();
    await page.locator('#s-close').click();

    await page.locator('#stop-btn').click();
    await expect(page.locator('#cue-status')).toContainText(/consent/i, { timeout: 4000 });
    await expect(page.locator('#stop-btn')).not.toHaveClass(/active/);
  });

  test('diagnostics IPC returns a payload', async () => {
    const diag = await page.evaluate(async () => window.cue.diagnosticsGet());
    expect(diag).toBeTruthy();
    expect(diag.platform).toBeTruthy();
    expect(typeof diag.hasKey).toBe('boolean');
    expect(diag.dataPath).toBeTruthy();
    expect(diag).toHaveProperty('cpu');
    expect(diag).toHaveProperty('sessionSpend');
    expect(diag).toHaveProperty('lifetimeSpend');
  });

  test('recent menu is present in the composer', async () => {
    const settings = page.locator('#settings-scrim');
    if (await settings.isVisible()) await page.locator('#s-close').click();
    const onboard = page.locator('#onboard-scrim');
    if (await onboard.isVisible()) await page.locator('#ob-skip').click();
    if (await settings.isVisible()) await page.locator('#s-close').click();
    await expect(page.locator('#recent-btn')).toBeVisible();
    await page.locator('#recent-btn').click({ force: true });
    await expect(page.locator('#recent-menu')).toBeVisible();
    await expect(page.locator('#recent-menu')).toContainText(/No recent requests|assist|ask|say|followup|recap|leetcode/i);
  });
});
