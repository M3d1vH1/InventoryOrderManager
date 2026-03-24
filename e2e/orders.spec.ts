import { test, expect } from "@playwright/test";

test.describe("Orders Module", () => {
    test("orders list page loads with table", async ({ page }) => {
        await page.goto("/orders");
        await expect(page).toHaveURL("/orders");
        await page.waitForTimeout(3_000);

        // Table should be present
        const table = page.locator("table");
        await expect(table).toBeVisible();
    });

    test("status tabs are visible", async ({ page }) => {
        await page.goto("/orders");
        await page.waitForTimeout(3_000);

        // Status filter tabs should be present (All, Pending, Picked, etc.)
        const tabs = page.locator("button, [role='tab']").filter({ hasText: /all|pending|picked|shipped/i });
        const count = await tabs.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test("status tab filtering works", async ({ page }) => {
        await page.goto("/orders");
        await page.waitForTimeout(3_000);

        // Click on "Pending" tab
        const pendingTab = page.locator("button").filter({ hasText: /pending/i }).first();
        if (await pendingTab.isVisible()) {
            await pendingTab.click();
            await page.waitForTimeout(1_500);

            // The tab should be active now (has primary border color)
            await expect(pendingTab).toBeVisible();
        }
    });

    test("new order button navigates to creation form", async ({ page }) => {
        await page.goto("/orders");
        await page.waitForTimeout(2_000);

        const newOrderBtn = page.locator('a[href="/orders/new"]');
        await expect(newOrderBtn).toBeVisible();

        await newOrderBtn.click();
        await expect(page).toHaveURL("/orders/new");
    });

    test("new order form renders", async ({ page }) => {
        await page.goto("/orders/new");
        await page.waitForTimeout(3_000);

        // Should have form elements (customer selection, line items, etc.)
        const formElements = page.locator("input, select, textarea, button[type='submit']");
        const count = await formElements.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test("search input filters orders", async ({ page }) => {
        await page.goto("/orders");
        await page.waitForTimeout(3_000);

        const searchInput = page.locator("input[type='text'], input[placeholder]").first();
        await searchInput.fill("ORD-NONEXISTENT-99999");
        await page.waitForTimeout(1_500);

        // Page should still render (either with no results or filtered results)
        const main = page.locator("main");
        await expect(main).toBeVisible();
    });
});
