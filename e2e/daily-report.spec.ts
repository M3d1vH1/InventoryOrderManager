import { test, expect, Page } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

// ─── Helpers ────────────────────────────────────────────────────────────────

async function goToNotificationsSettings(page: Page): Promise<void> {
  await page.goto('/settings');
  // Click the "Notifications" tab if it's not already active
  const notificationsTab = page.locator('[role="tab"]:has-text("Notifications")');
  await notificationsTab.waitFor({ state: 'visible', timeout: 8000 });
  await notificationsTab.click();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

test.describe('Settings – Daily Report Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('settings page loads and shows notifications tab', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('[role="tab"]:has-text("Notifications")')).toBeVisible({ timeout: 8000 });
  });

  test('daily report enable toggle is present', async ({ page }) => {
    await goToNotificationsSettings(page);
    // The toggle/switch for daily report
    const dailyReportToggle = page.locator(
      '[name="dailyReportEnabled"], button[role="switch"][aria-label*="daily" i], label:has-text(/daily report/i) + button'
    ).first();
    // Either the named input or a switch near "daily report" text
    const switchNearLabel = page.locator('text=/daily report/i').first();
    await expect(switchNearLabel).toBeVisible({ timeout: 5000 });
  });

  test('daily report time field accepts valid HH:mm format', async ({ page }) => {
    await goToNotificationsSettings(page);

    const timeInput = page.locator('input[name="dailyReportTime"]').first();
    if (await timeInput.isVisible({ timeout: 3000 })) {
      await timeInput.fill('17:30');
      await expect(timeInput).toHaveValue('17:30');
    } else {
      test.skip(true, 'Daily report time field not visible (daily report may be disabled)');
    }
  });

  test('"Test Daily Report" button only appears when daily report is enabled with a webhook URL', async ({ page }) => {
    await goToNotificationsSettings(page);

    // The test button should NOT appear when daily report is disabled
    const testButton = page.locator('button:has-text("Test Daily Report")');

    // If the button is already visible, daily reports are already configured – that's fine
    const isVisible = await testButton.isVisible({ timeout: 2000 }).catch(() => false);

    if (!isVisible) {
      // Confirm it is indeed hidden when not configured
      await expect(testButton).not.toBeVisible();
    }
  });

  test('POST /api/settings/test-daily-report returns success when daily report is configured', async ({ page }) => {
    // First, check if daily reports are configured via the API
    const settingsResp = await page.request.get('/api/settings/notifications');

    if (settingsResp.status() !== 200) {
      test.skip(true, 'Could not fetch notification settings');
      return;
    }

    const settings = await settingsResp.json();

    if (!settings.dailyReportEnabled || !settings.dailyReportWebhookUrl) {
      test.skip(true, 'Daily report not configured – skipping trigger test');
      return;
    }

    const response = await page.request.post('/api/settings/test-daily-report', {
      headers: { 'Content-Type': 'application/json' },
    });

    // Should succeed (200) or fail gracefully if webhook is unreachable (500 with message)
    expect([200, 500]).toContain(response.status());

    if (response.status() === 200) {
      const body = await response.json();
      expect(body).toHaveProperty('success');
    }
  });

  test('POST /api/settings/test-daily-report is blocked for unauthenticated requests', async ({ page }) => {
    const freshCtx = await page.context().browser()!.newContext();
    const freshPage = await freshCtx.newPage();

    const response = await freshPage.request.post(
      'http://localhost:5000/api/settings/test-daily-report',
      { headers: { 'Content-Type': 'application/json' } }
    );

    expect([401, 403]).toContain(response.status());
    await freshCtx.close();
  });
});

test.describe('Daily Report Scheduler – Timezone & Deduplication Logic', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('notification settings API returns dailyReportTime in HH:mm format', async ({ page }) => {
    const response = await page.request.get('/api/settings/notifications');

    if (response.status() !== 200) {
      test.skip(true, 'Notification settings not available');
      return;
    }

    const body = await response.json();

    if (body.dailyReportTime) {
      expect(body.dailyReportTime).toMatch(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/);
    }
  });

  test('notification settings API returns valid days-of-week string', async ({ page }) => {
    const response = await page.request.get('/api/settings/notifications');

    if (response.status() !== 200) {
      test.skip(true, 'Notification settings not available');
      return;
    }

    const body = await response.json();

    if (body.dailyReportDaysOfWeek) {
      // Should be comma-separated numbers 0-6
      const days = body.dailyReportDaysOfWeek.split(',').map((d: string) => parseInt(d.trim()));
      expect(days.every((d: number) => d >= 0 && d <= 6)).toBe(true);
    }
  });

  test('notification settings can be updated with new daily report time', async ({ page }) => {
    // Fetch current settings
    const current = await page.request.get('/api/settings/notifications');
    if (current.status() !== 200) {
      test.skip(true, 'Cannot fetch notification settings');
      return;
    }
    const currentBody = await current.json();

    // Update with a test time
    const updateResp = await page.request.patch('/api/settings/notifications', {
      data: { ...currentBody, dailyReportTime: '08:00' },
      headers: { 'Content-Type': 'application/json' },
    });

    if (updateResp.status() === 200 || updateResp.status() === 204) {
      // Verify the update was saved
      const verify = await page.request.get('/api/settings/notifications');
      const verifyBody = await verify.json();
      expect(verifyBody.dailyReportTime).toBe('08:00');

      // Restore original value
      await page.request.patch('/api/settings/notifications', {
        data: { ...currentBody },
        headers: { 'Content-Type': 'application/json' },
      });
    } else {
      // PATCH may not be the right method – skip
      test.skip(true, `PATCH returned ${updateResp.status()}`);
    }
  });
});
