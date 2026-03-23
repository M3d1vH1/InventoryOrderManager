import { test, expect } from "@playwright/test";

// These tests do NOT use the saved auth state — they test login/logout directly
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Authentication", () => {
    test("login page renders correctly", async ({ page }) => {
        await page.goto("/login");

        // Title and subtitle visible
        await expect(page.locator("h1")).toBeVisible();

        // Username and password fields
        await expect(page.locator("#username")).toBeVisible();
        await expect(page.locator("#password")).toBeVisible();

        // Submit button
        await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    });

    test("successful login redirects to dashboard", async ({ page }) => {
        await page.goto("/login");

        await page.locator("#username").fill("admin");
        await page.locator("#password").fill("changeme-on-first-login");
        await page.getByRole("button", { name: /sign in/i }).click();

        // Should redirect to dashboard
        await page.waitForURL("/", { timeout: 15_000 });
        await expect(page.locator("text=Amphoreus").first()).toBeVisible({
            timeout: 10_000,
        });
    });

    test("invalid credentials show error", async ({ page }) => {
        await page.goto("/login");

        await page.locator("#username").fill("admin");
        await page.locator("#password").fill("wrong-password");
        await page.getByRole("button", { name: /sign in/i }).click();

        // Error message should appear
        await expect(page.locator(".bg-red-50, [class*='red']")).toBeVisible({
            timeout: 10_000,
        });
    });

    test("unauthenticated user is redirected to login", async ({ page }) => {
        await page.goto("/");

        // Should end up at the login page since we're not authenticated
        await page.waitForURL("**/login", { timeout: 15_000 });
    });
});
