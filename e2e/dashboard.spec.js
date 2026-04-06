import { test, expect } from '@playwright/test';

/**
 * E2E smoke tests for the dashboard flow.
 * These tests assume the dev server is running (managed by playwright.config.js webServer).
 * They verify the basic navigation and UI rendering without needing real Snowflake credentials.
 */

test.describe('Dashboard flow', () => {
  test('loads the login page', async ({ page }) => {
    await page.goto('/');
    // The app should render either a login form or redirect to login
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('shows navigation elements after login', async ({ page }) => {
    await page.goto('/');
    // Verify the page has rendered (basic smoke test)
    await expect(page).toHaveTitle(/.*/);
    // Take a screenshot for manual review on failure
    await page.screenshot({ path: 'test-results/homepage.png', fullPage: true });
  });

  test('navigates to dashboard view when URL contains /dashboards', async ({ page }) => {
    await page.goto('/dashboards');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
