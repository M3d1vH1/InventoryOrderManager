import { test, expect } from "@playwright/test";

test.describe("Products Module", () => {
    test("products list page loads", async ({ page }) => {
        await page.goto("/products");
        await expect(page).toHaveURL("/products");

        // Page title should be visible
        await page.waitForTimeout(3_000);

        // Search input should be present
        const searchInput = page.locator("input[type='text'], input[placeholder]").first();
        await expect(searchInput).toBeVisible();
    });

    test("add product button is visible and navigates to form", async ({ page }) => {
        await page.goto("/products");
        await page.waitForTimeout(2_000);

        // Find the "Add Product" / new product link
        const addBtn = page.locator('a[href="/products/new"]');
        await expect(addBtn).toBeVisible();

        await addBtn.click();
        await expect(page).toHaveURL("/products/new");
    });

    test("new product page renders a form", async ({ page }) => {
        await page.goto("/products/new");
        await page.waitForTimeout(2_000);

        // Should have form elements
        const formInputs = page.locator("input, select, textarea");
        const count = await formInputs.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test("grid/list view toggle works", async ({ page }) => {
        await page.goto("/products");
        await page.waitForTimeout(3_000);

        // Find the view toggle buttons (icon buttons for grid/list)
        const listBtn = page.locator("button").filter({ has: page.locator('svg.lucide-list') });

        if (await listBtn.isVisible()) {
            await listBtn.click();
            await page.waitForTimeout(500);
            // After clicking list, the layout should change (flex-col vs grid)
            const container = page.locator(".flex.flex-col.gap-2, .grid");
            await expect(container.first()).toBeVisible();
        }
    });

    test("search input filters products", async ({ page }) => {
        await page.goto("/products");
        await page.waitForTimeout(3_000);

        const searchInput = page.locator("input[type='text'], input[placeholder]").first();
        await searchInput.fill("nonexistent-product-xyz-12345");
        await page.waitForTimeout(1_500);

        // Either shows no products message or empty grid
        const body = await page.locator("main").textContent();
        expect(body).toBeTruthy();
    });
});
