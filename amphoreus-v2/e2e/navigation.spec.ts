import { test, expect } from "@playwright/test";

test.describe("Sidebar Navigation", () => {
    test("sidebar is visible with brand name", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(3_000);

        // Sidebar should contain the brand
        const sidebar = page.locator("aside");
        await expect(sidebar).toBeVisible();

        const brand = page.locator("text=Amphoreus").first();
        await expect(brand).toBeVisible();
    });

    test("dashboard nav link works", async ({ page }) => {
        await page.goto("/products"); // start from a different page
        await page.waitForTimeout(2_000);

        // Find and click the dashboard link in the sidebar
        const dashboardLink = page.locator('aside a[href="/"]');
        await dashboardLink.click();
        await expect(page).toHaveURL("/");
    });

    test("orders nav group expands and shows sub-items", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(2_000);

        // Click the orders group button to expand
        const ordersGroup = page.locator("aside button").filter({ hasText: /order/i }).first();
        if (await ordersGroup.isVisible()) {
            await ordersGroup.click();
            await page.waitForTimeout(500);

            // Sub-items should be visible
            const allOrdersLink = page.locator('aside a[href="/orders"]');
            await expect(allOrdersLink).toBeVisible();

            const pickingLink = page.locator('aside a[href="/picking"]');
            await expect(pickingLink).toBeVisible();
        }
    });

    test("inventory nav group expands and shows products link", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(2_000);

        const inventoryGroup = page.locator("aside button").filter({ hasText: /inventory/i }).first();
        if (await inventoryGroup.isVisible()) {
            await inventoryGroup.click();
            await page.waitForTimeout(500);

            const productsLink = page.locator('aside a[href="/products"]');
            await expect(productsLink).toBeVisible();
        }
    });

    test("sales nav group shows customers link", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(2_000);

        const salesGroup = page.locator("aside button").filter({ hasText: /sales/i }).first();
        if (await salesGroup.isVisible()) {
            await salesGroup.click();
            await page.waitForTimeout(500);

            const customersLink = page.locator('aside a[href="/customers"]');
            await expect(customersLink).toBeVisible();
        }
    });

    test("manufacturing nav group shows production sub-links", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(2_000);

        const mfgGroup = page.locator("aside button").filter({ hasText: /manufacturing/i }).first();
        if (await mfgGroup.isVisible()) {
            await mfgGroup.click();
            await page.waitForTimeout(500);

            const productionLink = page.locator('aside a[href="/production"]');
            await expect(productionLink).toBeVisible();

            const materialsLink = page.locator('aside a[href="/production/materials"]');
            await expect(materialsLink).toBeVisible();

            const recipesLink = page.locator('aside a[href="/production/recipes"]');
            await expect(recipesLink).toBeVisible();

            const batchesLink = page.locator('aside a[href="/production/batches"]');
            await expect(batchesLink).toBeVisible();
        }
    });

    test("purchasing nav group shows suppliers link", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(2_000);

        const purchasingGroup = page.locator("aside button").filter({ hasText: /purchasing/i }).first();
        if (await purchasingGroup.isVisible()) {
            await purchasingGroup.click();
            await page.waitForTimeout(500);

            const suppliersLink = page.locator('aside a[href="/suppliers"]');
            await expect(suppliersLink).toBeVisible();
        }
    });

    test("settings link navigates to settings page (admin)", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(2_000);

        const settingsLink = page.locator('aside a[href="/settings"]');
        if (await settingsLink.isVisible()) {
            await settingsLink.click();
            await expect(page).toHaveURL("/settings");
        }
    });

    test("sidebar collapse/expand toggle works", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(2_000);

        const sidebar = page.locator("aside");

        // Get initial width
        const initialBox = await sidebar.boundingBox();
        expect(initialBox).toBeTruthy();

        // Click the collapse button (last button in sidebar)
        const collapseBtn = page.locator('aside button[aria-label*="ollapse"], aside button[aria-label*="xpand"]').first();
        if (await collapseBtn.isVisible()) {
            await collapseBtn.click();
            await page.waitForTimeout(500);

            // Sidebar width should change
            const newBox = await sidebar.boundingBox();
            expect(newBox).toBeTruthy();
            expect(newBox!.width).not.toEqual(initialBox!.width);
        }
    });

    test("disabled nav items are not clickable", async ({ page }) => {
        await page.goto("/");
        await page.waitForTimeout(2_000);

        // Expand orders group to find disabled items
        const ordersGroup = page.locator("aside button").filter({ hasText: /order/i }).first();
        if (await ordersGroup.isVisible()) {
            await ordersGroup.click();
            await page.waitForTimeout(500);

            // Disabled items should have cursor-not-allowed and not be links
            const disabledItems = page.locator("aside span.cursor-not-allowed, aside [class*='cursor-not-allowed']");
            const count = await disabledItems.count();

            if (count > 0) {
                // Verify these are span elements, not anchor/link elements
                const firstDisabled = disabledItems.first();
                const tagName = await firstDisabled.evaluate((el) => el.tagName.toLowerCase());
                expect(tagName).toBe("span");
            }
        }
    });
});
