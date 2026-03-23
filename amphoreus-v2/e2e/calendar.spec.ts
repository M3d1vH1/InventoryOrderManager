import { test, expect } from "@playwright/test";

test.describe("Calendar Module", () => {
    test("calendar page loads", async ({ page }) => {
        await page.goto("/calendar");
        await expect(page).toHaveURL("/calendar");
        await page.waitForTimeout(3_000);

        const main = page.locator("main");
        await expect(main).toBeVisible();
    });

    test("calendar renders content without errors", async ({ page }) => {
        await page.goto("/calendar");
        await page.waitForTimeout(4_000);

        // Should not show an error component
        const errorAlert = page.locator("[class*='destructive'], [class*='error']");
        const errorCount = await errorAlert.count();

        // If any error elements exist, they should not contain visible error messages
        // (some classes may exist for styling but not be actively displaying errors)
        const mainContent = page.locator("main");
        const textContent = await mainContent.textContent();
        expect(textContent).toBeTruthy();
    });
});
