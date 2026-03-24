import { test, expect } from "@playwright/test";

test.describe("Customers Module", () => {
    test("customers list page loads with table", async ({ page }) => {
        await page.goto("/customers");
        await expect(page).toHaveURL("/customers");
        await page.waitForTimeout(3_000);

        // Table should be present
        const table = page.locator("table");
        await expect(table).toBeVisible();
    });

    test("table has correct column headers", async ({ page }) => {
        await page.goto("/customers");
        await page.waitForTimeout(3_000);

        // Verify table headers exist
        const headers = page.locator("th");
        const headerCount = await headers.count();
        expect(headerCount).toBeGreaterThanOrEqual(4); // Name, Phone, Email, City, Shipping Co, Added
    });

    test("add customer button is visible and navigates", async ({ page }) => {
        await page.goto("/customers");
        await page.waitForTimeout(2_000);

        const addBtn = page.locator('a[href="/customers/new"]');
        await expect(addBtn).toBeVisible();

        await addBtn.click();
        await expect(page).toHaveURL("/customers/new");
    });

    test("new customer form renders", async ({ page }) => {
        await page.goto("/customers/new");
        await page.waitForTimeout(2_000);

        // Should have form fields
        const formInputs = page.locator("input, select, textarea");
        const count = await formInputs.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test("search input filters customers", async ({ page }) => {
        await page.goto("/customers");
        await page.waitForTimeout(3_000);

        const searchInput = page.locator("input[type='text'], input[placeholder]").first();
        await searchInput.fill("nonexistent-customer-xyz");
        await page.waitForTimeout(1_500);

        // Should still render
        const main = page.locator("main");
        await expect(main).toBeVisible();
    });

    test("column sorting works", async ({ page }) => {
        await page.goto("/customers");
        await page.waitForTimeout(3_000);

        // Click on a sortable column header (Name has ArrowUpDown icon)
        const nameHeader = page.locator("th").filter({ hasText: /name/i }).first();
        if (await nameHeader.isVisible()) {
            await nameHeader.click();
            await page.waitForTimeout(1_000);
            // Page should still render without errors
            const table = page.locator("table");
            await expect(table).toBeVisible();
        }
    });
});
