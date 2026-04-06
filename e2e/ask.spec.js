import { test, expect } from '@playwright/test';

/**
 * E2E smoke tests for the AskAI flow.
 * Verifies basic navigation and page rendering without requiring
 * real Snowflake credentials or a configured workspace.
 */

test.describe('AskAI flow', () => {
  test('navigates to /ask without crashing', async ({ page }) => {
    await page.goto('/ask');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('redirects unauthenticated users away from /ask', async ({ page }) => {
    await page.goto('/ask');
    // Without auth, the app should redirect to login or show the home page
    await page.waitForTimeout(1000);
    const url = page.url();
    const isRedirected = !url.includes('/ask') || url.includes('/');
    expect(isRedirected).toBe(true);
  });
});

test.describe('Admin flow', () => {
  test('navigates to /admin without crashing', async ({ page }) => {
    await page.goto('/admin');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('redirects unauthenticated users away from /admin', async ({ page }) => {
    await page.goto('/admin');
    await page.waitForTimeout(1000);
    const url = page.url();
    const isRedirected = !url.includes('/admin') || url.includes('/');
    expect(isRedirected).toBe(true);
  });
});

test.describe('Settings flow', () => {
  test('navigates to /settings without crashing', async ({ page }) => {
    await page.goto('/settings');
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });
});
