import { test, expect } from '@playwright/test';
import { loginAsAdmin, loginWithCredentials } from './helpers/auth';

// ─── Authentication Tests ────────────────────────────────────────────────────

test.describe('Authentication', () => {
  test('unauthenticated users are redirected to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('unauthenticated users accessing /products are redirected to /login', async ({ page }) => {
    await page.goto('/products');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('unauthenticated users accessing /settings are redirected to /login', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('dev-login endpoint authenticates admin user in development mode', async ({ page }) => {
    const response = await page.request.get('/api/dev-login');
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.user).toHaveProperty('role', 'admin');
  });

  test('login page renders username and password fields', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[type="password"]')).toBeVisible();
    // Username field may be type="text" or have name="username"
    await expect(
      page.locator('input[name="username"], input[type="text"]').first()
    ).toBeVisible();
  });

  test('login with invalid credentials shows error message', async ({ page }) => {
    await page.goto('/login');
    await page.locator('input[name="username"], input[type="text"]').first().fill('wronguser');
    await page.locator('input[type="password"]').fill('wrongpassword');
    await page.locator('button[type="submit"]').click();

    // Should stay on login page and show an error
    await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
    // Look for a toast or error text
    const errorText = page.locator(
      '[role="alert"], .text-destructive, text=/invalid/i, text=/incorrect/i, text=/wrong/i'
    ).first();
    await expect(errorText).toBeVisible({ timeout: 5000 });
  });

  test('admin can log in and is redirected away from /login', async ({ page }) => {
    await loginAsAdmin(page);
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('GET /api/user returns user info when authenticated', async ({ page }) => {
    await loginAsAdmin(page);
    const response = await page.request.get('/api/user');
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty('username');
    expect(body).toHaveProperty('role');
  });

  test('GET /api/user returns 401 when unauthenticated', async ({ page }) => {
    const freshCtx = await page.context().browser()!.newContext();
    const freshPage = await freshCtx.newPage();
    const response = await freshPage.request.get('http://localhost:5000/api/user');
    expect(response.status()).toBe(401);
    await freshCtx.close();
  });

  test('POST /api/logout clears the session', async ({ page }) => {
    await loginAsAdmin(page);

    // Confirm authenticated
    const before = await page.request.get('/api/user');
    expect(before.status()).toBe(200);

    // Logout
    const logout = await page.request.post('/api/logout');
    expect(logout.status()).toBe(200);

    // Should now be unauthorized
    const after = await page.request.get('/api/user');
    expect(after.status()).toBe(401);
  });
});

// ─── Route Navigation Tests ──────────────────────────────────────────────────

test.describe('Application Routing', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('/dashboard loads the dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).not.toHaveURL(/\/login/);
    // Dashboard should have some recognizable element
    await expect(
      page.locator('h1, h2, [data-testid="dashboard"]').first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('/products loads a products page', async ({ page }) => {
    await page.goto('/products');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(
      page.locator('h1, h2').filter({ hasText: /product/i }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('/categories loads the categories page', async ({ page }) => {
    await page.goto('/categories');
    await expect(page).not.toHaveURL(/\/login/);
    // Categories page should have a heading
    await expect(
      page.locator('h1, h2').filter({ hasText: /categor/i }).first()
    ).toBeVisible({ timeout: 8000 });
  });

  test('/settings loads the settings page with tabs', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator('[role="tab"]').first()).toBeVisible({ timeout: 8000 });
  });

  test('/orders loads the orders page', async ({ page }) => {
    await page.goto('/orders');
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('unknown routes redirect to 404 or home', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-at-all');
    // Should either show a 404 page or redirect to home/dashboard
    const url = page.url();
    const isNotFound = url.includes('not-found') || url.includes('404');
    const isHome = url.endsWith('/') || url.includes('/dashboard');
    // Also acceptable: still at /this-route-does-not-exist-at-all with a 404 component rendered
    const notFoundEl = page.locator('text=/not found/i, text=/404/i').first();
    const notFoundVisible = await notFoundEl.isVisible({ timeout: 3000 }).catch(() => false);
    expect(isNotFound || isHome || notFoundVisible).toBe(true);
  });
});
