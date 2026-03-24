import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const authFile = path.join(__dirname, ".auth/user.json");

setup("authenticate", async ({ page }) => {
    // Ensure .auth directory exists
    const authDir = path.dirname(authFile);
    if (!fs.existsSync(authDir)) {
        fs.mkdirSync(authDir, { recursive: true });
    }

    // Navigate to login page
    await page.goto("/login");

    // Fill in admin credentials
    await page.getByLabel(/username/i).fill("admin");
    await page.getByLabel(/password/i).fill("changeme-on-first-login");

    // Submit form
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for redirect to dashboard (authenticated area)
    await page.waitForURL("/", { timeout: 15_000 });

    // Verify we're on the dashboard (sidebar brand is visible)
    await expect(page.locator("text=Amphoreus").first()).toBeVisible({
        timeout: 10_000,
    });

    // Save signed-in state
    await page.context().storageState({ path: authFile });
});
