import { test, expect } from "@playwright/test";

test.describe("Settings Module", () => {
    test("settings index page loads", async ({ page }) => {
        await page.goto("/settings");
        await expect(page).toHaveURL("/settings");
        await page.waitForTimeout(3_000);

        const main = page.locator("main");
        await expect(main).toBeVisible();
    });

    test("company settings tab loads", async ({ page }) => {
        await page.goto("/settings/company");
        await page.waitForTimeout(3_000);

        // Should have form elements for company settings
        const formInputs = page.locator("input, select, textarea");
        const count = await formInputs.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test("users settings tab loads", async ({ page }) => {
        await page.goto("/settings/users");
        await page.waitForTimeout(3_000);

        const main = page.locator("main");
        await expect(main).toBeVisible();

        // Should have a user list or table
        const content = page.locator("table, [class*='grid'], [class*='space-y']").first();
        await expect(content).toBeVisible();
    });

    test("notifications settings tab loads", async ({ page }) => {
        await page.goto("/settings/notifications");
        await page.waitForTimeout(3_000);

        const main = page.locator("main");
        await expect(main).toBeVisible();
    });

    test("system settings tab loads", async ({ page }) => {
        await page.goto("/settings/system");
        await page.waitForTimeout(3_000);

        const main = page.locator("main");
        await expect(main).toBeVisible();
    });

    test("email settings tab loads", async ({ page }) => {
        await page.goto("/settings/email");
        await page.waitForTimeout(3_000);

        const main = page.locator("main");
        await expect(main).toBeVisible();
    });
});
