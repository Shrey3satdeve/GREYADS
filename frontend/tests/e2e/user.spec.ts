import { test, expect } from '@playwright/test';

test.describe('User Application', () => {
    test('onboarding flow', async ({ page }) => {
        await page.goto('/onboarding');
        await expect(page.getByText('Skip Overview')).toBeVisible({ timeout: 15000 });
        await page.getByText('NEXT').click();
        await page.getByText('NEXT').click();
        await page.getByText('BEGIN JOURNEY').click();
        await expect(page).toHaveURL(/.*login/);
    });

    test('event browsing', async ({ page }) => {
        // Test that the home feed renders with category filters
        await page.goto('/(tabs)');
        await expect(page.getByText('All')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('cat-Music')).toBeVisible();
        await expect(page.getByTestId('cat-Technology')).toBeVisible();
    });

    test('ticket booking interaction', async ({ page }) => {
        // Test booking flow UI components are accessible
        await page.goto('/book/test-event-id');

        // Should show book ticket screen elements
        await expect(page.getByText('Book Ticket')).toBeVisible({ timeout: 15000 });
        await expect(page.getByTestId('close-btn')).toBeVisible();
        await expect(page.getByTestId('qty-decrease-btn')).toBeVisible();
        await expect(page.getByTestId('qty-increase-btn')).toBeVisible();
    });
});
