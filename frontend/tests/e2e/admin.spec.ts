import { test, expect } from '@playwright/test';

const DEMO_LOGIN_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEMO_LOGIN === '1';

test.describe('Admin Dashboard', () => {
    test.skip(!DEMO_LOGIN_ENABLED, 'Demo login is disabled in production mode.');

    test.beforeEach(async ({ page }) => {
        // Log in as admin before each test
        await page.goto('/login');
        await page.getByTestId('role-tab-admin').click();
        await page.getByTestId('demo-admin-fill').click();
        await page.getByRole('button', { name: 'SIGN IN' }).click();
        // Wait for dashboard to load
        await expect(page.getByText('Dashboard', { exact: true })).toBeVisible({ timeout: 15000 });
    });

    test('should display dashboard stats', async ({ page }) => {
        await expect(page.getByText('Events', { exact: true })).toBeVisible();
        await expect(page.getByText('Recent Events')).toBeVisible();
    });

    test('navigating to event management', async ({ page }) => {
        // Click on Manage Events action card
        await page.getByText('Manage Events').click();
        await expect(page).toHaveURL(/.*events/);
    });

    test('admin profile access', async ({ page }) => {
        await page.getByTestId('admin-logout-btn').click();
        await expect(page.getByText('Sign Out')).toBeVisible();
    });
});
