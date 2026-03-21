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
        await page.goto('/');
        // Splash screen redirect
        await expect(page).toHaveURL(/.*onboarding/, { timeout: 10000 });
        await page.getByText('Skip Overview').click();
        await expect(page).toHaveURL(/.*login/);

        // Go to main user app tabs (bypassing full login for browsing test)
        await page.goto('/(tabs)');
        await expect(page.getByText('✨ Featured')).toBeVisible({ timeout: 15000 });

        // Click on first event card
        await page.locator('[data-testid^="event-card-"]').first().click();
        await expect(page).toHaveURL(/.*event\/.*/);
        await expect(page.getByTestId('event-detail-screen')).toBeVisible();
    });

    test('ticket booking interaction', async ({ page }) => {
        // Directly browse an event
        await page.goto('/(tabs)');
        await page.locator('[data-testid^="event-card-"]').first().click();

        await expect(page.getByTestId('book-ticket-btn')).toBeVisible({ timeout: 15000 });
        await page.getByTestId('book-ticket-btn').click();

        await expect(page).toHaveURL(/.*book\/.*/);
        await expect(page.getByText('Book Ticket')).toBeVisible();
        await expect(page.getByTestId('confirm-booking-btn')).toBeVisible();
    });
});
