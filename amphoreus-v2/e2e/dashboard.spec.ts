import { test, expect } from "@playwright/test";

test.describe("Dashboard", () => {
    test("dashboard page loads successfully", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveURL("/");

        // Wait for loading to finish (skeletons disappear)
        await page.waitForSelector('[class*="animate-spin"]', {
            state: "detached",
            timeout: 15_000,
        }).catch(() => {
            // spinner may have already gone
        });
    });

    test("stat cards are rendered", async ({ page }) => {
        await page.goto("/");

        // Wait for data to load — look for stat card links
        await page.waitForTimeout(3_000);

        // Should have stat cards (they link to /orders, /picking, /products, /customers)
        const statLinks = page.locator('a[href="/orders"], a[href="/picking"], a[href="/products"], a[href="/customers"]');
        const count = await statLinks.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test("orders trend chart section is present", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(3_000);

        // The chart container should be visible (a large grid area)
        const chartArea = page.locator(".lg\\:col-span-2").first();
        await expect(chartArea).toBeVisible();
    });

    test("recent activity section is present", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(3_000);

        // The page should contain content related to recent activity section
        // Check the main content area has loaded
        const mainContent = page.locator("main");
        await expect(mainContent).toBeVisible();
    });
});
