import { test, expect } from '@playwright/test';

const DEMO_LOGIN_ENABLED = process.env.EXPO_PUBLIC_ENABLE_DEMO_LOGIN === '1';

test.describe('Authentication Flows', () => {

    test('should navigate to login page', async ({ page }) => {
        await page.goto('/');
        // Check for logo or heading to confirm we're on the landing/onboarding/login page
        await expect(page.getByText('GREYADZ', { exact: false })).toBeVisible();
    });

    test('should show admin login restricted access message', async ({ page }) => {
        await page.goto('/login');
        await page.waitForTimeout(500);
        await page.getByTestId('role-tab-admin').click();
        await expect(page.getByText('Restricted Access')).toBeVisible();
        await expect(page.getByText('ADMIN Login')).toBeVisible();
    });

    test('admin quick demo fill - admin', async ({ page }) => {
        test.skip(!DEMO_LOGIN_ENABLED, 'Demo login is disabled in production mode.');
        await page.goto('/login');
        await page.waitForTimeout(500);
        await page.getByTestId('role-tab-admin').click();
        // Wait for the Demo Box to be rendered
        await expect(page.getByText('QUICK DEMO')).toBeVisible();

        // Try clicking via text or testId
        const adminFillBtn = page.getByTestId('demo-admin-fill').or(page.getByText('Fill Admin Credits', { exact: false }));
        await adminFillBtn.first().click();

        // Use placeholders or testId for inputs
        const emailInput = page.getByPlaceholder('yours@example.com');
        const passwordInput = page.getByPlaceholder('••••••••');

        await expect(emailInput).toHaveValue('admin@greyads.com');
        await expect(passwordInput).toHaveValue('Admin@123');
    });

    test('admin quick demo fill - staff', async ({ page }) => {
        test.skip(!DEMO_LOGIN_ENABLED, 'Demo login is disabled in production mode.');
        await page.goto('/login');
        await page.waitForTimeout(500);
        await page.getByTestId('role-tab-staff').click();
        await expect(page.getByText('QUICK DEMO')).toBeVisible();

        const staffFillBtn = page.getByTestId('demo-staff-fill').or(page.getByText('Fill Staff Credits', { exact: false }));
        await staffFillBtn.first().click();

        const emailInput = page.getByPlaceholder('yours@example.com');
        await expect(emailInput).toHaveValue('staff@greyads.com');
    });

    test('navigating back to user login from admin login', async ({ page }) => {
        await page.goto('/login');
        await page.waitForTimeout(500);
        await page.getByTestId('role-tab-admin').click();

        // Go back to USER
        await page.getByTestId('role-tab-user').click();

        // Should be back at the user login page - check for USER tab active state
        await expect(page.getByTestId('role-tab-user')).toBeVisible();
        // Check for phone number input which is unique to user login
        await expect(page.getByPlaceholder('9876543210')).toBeVisible();
    });
});
