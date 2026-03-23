import { Page, request as playwrightRequest } from '@playwright/test';

/**
 * Log in as admin using the dev-login endpoint (only works in development mode).
 * Then navigate to the app so the session cookie is set.
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  // Use dev-login to establish a session
  await page.goto('/api/dev-login');
  // Navigate to the app root so all subsequent page loads are authenticated
  await page.goto('/');
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10000 });
}

/**
 * Log in via the UI login form with explicit credentials.
 */
export async function loginWithCredentials(
  page: Page,
  username: string,
  password: string
): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name="username"], input[placeholder*="user" i], input[id*="user" i]').first().fill(username);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 10000 });
}
