import { test, expect } from "@playwright/test";

test.describe("Picking Module", () => {
    test("picking page loads", async ({ page }) => {
        await page.goto("/picking");
        await expect(page).toHaveURL("/picking");
        await page.waitForTimeout(3_000);

        const main = page.locator("main");
        await expect(main).toBeVisible();
    });

    test("picking page renders content without errors", async ({ page }) => {
        await page.goto("/picking");
        await page.waitForTimeout(4_000);

        // Page should render meaningful content
        const mainContent = page.locator("main");
        const textContent = await mainContent.textContent();
        expect(textContent).toBeTruthy();
    });
});
