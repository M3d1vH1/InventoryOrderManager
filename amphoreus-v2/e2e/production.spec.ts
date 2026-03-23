import { test, expect } from "@playwright/test";

test.describe("Production Module", () => {
    test("production dashboard loads", async ({ page }) => {
        await page.goto("/production");
        await expect(page).toHaveURL("/production");
        await page.waitForTimeout(3_000);

        // Main content area should be visible
        const main = page.locator("main");
        await expect(main).toBeVisible();
    });

    test("raw materials page loads", async ({ page }) => {
        await page.goto("/production/materials");
        await expect(page).toHaveURL("/production/materials");
        await page.waitForTimeout(3_000);

        // Page should render without errors
        const main = page.locator("main");
        await expect(main).toBeVisible();

        // Should have a table or list of materials
        const contentArea = page.locator("table, [class*='grid'], [class*='space-y']").first();
        await expect(contentArea).toBeVisible();
    });

    test("recipes list page loads", async ({ page }) => {
        await page.goto("/production/recipes");
        await expect(page).toHaveURL("/production/recipes");
        await page.waitForTimeout(3_000);

        const main = page.locator("main");
        await expect(main).toBeVisible();
    });

    test("new recipe page loads", async ({ page }) => {
        await page.goto("/production/recipes/new");
        await page.waitForTimeout(3_000);

        // Should have form elements
        const formInputs = page.locator("input, select, textarea");
        const count = await formInputs.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test("batches list page loads", async ({ page }) => {
        await page.goto("/production/batches");
        await expect(page).toHaveURL("/production/batches");
        await page.waitForTimeout(3_000);

        const main = page.locator("main");
        await expect(main).toBeVisible();
    });

    test("new batch page loads", async ({ page }) => {
        await page.goto("/production/batches/new");
        await page.waitForTimeout(3_000);

        // Should have form elements
        const formInputs = page.locator("input, select, textarea");
        const count = await formInputs.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });
});
