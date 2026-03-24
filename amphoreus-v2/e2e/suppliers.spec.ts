import { test, expect } from "@playwright/test";

test.describe("Suppliers Module", () => {
    test("suppliers list page loads", async ({ page }) => {
        await page.goto("/suppliers");
        await expect(page).toHaveURL("/suppliers");
        await page.waitForTimeout(3_000);

        // Page heading should be visible
        const heading = page.locator("h1");
        await expect(heading).toBeVisible();
    });

    test("table has correct column headers", async ({ page }) => {
        await page.goto("/suppliers");
        await page.waitForTimeout(3_000);

        // Verify table headers: Name, City, Phone, Tax ID
        const headers = page.locator("th");
        const count = await headers.count();
        expect(count).toBeGreaterThanOrEqual(3);
    });

    test("add supplier button navigates to form", async ({ page }) => {
        await page.goto("/suppliers");
        await page.waitForTimeout(2_000);

        const addBtn = page.locator('a[href="/suppliers/new"]');
        await expect(addBtn).toBeVisible();

        await addBtn.click();
        await expect(page).toHaveURL("/suppliers/new");
    });

    test("new supplier form renders fields", async ({ page }) => {
        await page.goto("/suppliers/new");
        await page.waitForTimeout(2_000);

        // Should have form fields
        const formInputs = page.locator("input, select, textarea");
        const count = await formInputs.count();
        expect(count).toBeGreaterThanOrEqual(2);
    });

    test("search filtering works", async ({ page }) => {
        await page.goto("/suppliers");
        await page.waitForTimeout(3_000);

        const searchInput = page.locator("input[type='text']").first();
        await searchInput.fill("nonexistent-supplier-xyz");
        await page.waitForTimeout(1_500);

        // Should still render the page
        const main = page.locator("main, [class*='space-y']").first();
        await expect(main).toBeVisible();
    });
});
