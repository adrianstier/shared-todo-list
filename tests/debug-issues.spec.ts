import { test, expect, Page } from '@playwright/test';

// Helper to register and login a new user
async function registerAndLogin(page: Page, userName: string, pin: string = '1234') {
  await page.goto('/');

  // Wait for login screen
  await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 10000 });

  // Click "Add New User"
  await page.locator('button:has-text("Add New User")').click();

  // Wait for register screen
  await expect(page.locator('input[placeholder="Enter your name"]')).toBeVisible({ timeout: 5000 });

  // Fill name
  await page.locator('input[placeholder="Enter your name"]').fill(userName);

  // Enter PIN
  const pinInputs = page.locator('input[type="password"]');
  for (let i = 0; i < 4; i++) {
    await pinInputs.nth(i).fill(pin[i]);
  }

  // Confirm PIN
  for (let i = 4; i < 8; i++) {
    await pinInputs.nth(i).fill(pin[i - 4]);
  }

  // Create account
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Wait for main app
  await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 10000 });
}

function uniqueUserName() {
  return `Test_${Date.now()}`;
}

test.describe('Debug: User Switcher Modal', () => {
  test('should show PIN modal with proper styling when switching users', async ({ page }) => {
    // First create two users
    const user1 = uniqueUserName();
    await registerAndLogin(page, user1);

    // Verify we're logged in
    await expect(page.locator(`text=${user1}`)).toBeVisible();

    // Log out
    await page.locator('button:has-text("' + user1.substring(0, 2) + '")').click();
    await page.waitForTimeout(500);
    await page.locator('text=Sign Out').click();

    // Create second user
    await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 10000 });
    const user2 = uniqueUserName();
    await registerAndLogin(page, user2);

    // Now try to switch to user1
    // Click on user dropdown
    const userButton = page.locator(`button:has-text("${user2.substring(0, 2)}")`).first();
    await userButton.click();
    await page.waitForTimeout(500);

    // Click on user1 to switch
    await page.locator(`text=${user1}`).click();

    // Take screenshot of the modal
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/user-switcher-modal.png', fullPage: true });

    // Check if modal is visible with proper z-index
    const modal = page.locator('text=Enter PIN to switch');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Check that PIN inputs are visible
    const pinInputs = page.locator('input[type="password"]');
    await expect(pinInputs.first()).toBeVisible();

    // Verify the modal backdrop is covering the page
    const backdrop = page.locator('.fixed.inset-0.bg-slate-900\\/70');
    const backdropBox = await backdrop.boundingBox();
    console.log('Backdrop bounding box:', backdropBox);
  });
});

test.describe('Debug: Task Creation', () => {
  test('should create task and show it in the list', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    // Verify app is loaded
    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible();

    // Take screenshot before adding task
    await page.screenshot({ path: 'test-results/before-add-task.png', fullPage: true });

    // Create a task
    const taskName = `Task_${Date.now()}`;
    const input = page.locator('input[placeholder="What needs to be done?"]');

    // Click to focus
    await input.click();
    await page.waitForTimeout(300);

    // Type the task name
    await input.fill(taskName);
    await page.waitForTimeout(300);

    // Verify the input has the text
    const inputValue = await input.inputValue();
    console.log('Input value after fill:', inputValue);
    expect(inputValue).toBe(taskName);

    // Take screenshot with text entered
    await page.screenshot({ path: 'test-results/task-entered.png', fullPage: true });

    // Submit with Enter
    await page.keyboard.press('Enter');

    // Wait for the task to appear
    await page.waitForTimeout(2000);

    // Take screenshot after submission
    await page.screenshot({ path: 'test-results/after-add-task.png', fullPage: true });

    // Check if task appears
    const taskLocator = page.locator(`text=${taskName}`);
    const isVisible = await taskLocator.isVisible();
    console.log('Task visible:', isVisible);

    // Check stats
    const totalTasks = await page.locator('text=Total Tasks').locator('..').locator('p').first().textContent();
    console.log('Total tasks count:', totalTasks);

    // Verify task is in the list
    await expect(taskLocator).toBeVisible({ timeout: 10000 });
  });

  test('should persist task after page reload', async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    // Create a task
    const taskName = `Persist_${Date.now()}`;
    const input = page.locator('input[placeholder="What needs to be done?"]');
    await input.click();
    await input.fill(taskName);
    await page.keyboard.press('Enter');

    // Wait for task to appear
    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });

    // Wait for Supabase to persist
    await page.waitForTimeout(2000);

    // Reload page
    await page.reload();

    // Wait for app to load
    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 10000 });

    // Check if task persisted
    await page.waitForTimeout(1000);
    await page.screenshot({ path: 'test-results/after-reload.png', fullPage: true });

    const taskVisible = await page.locator(`text=${taskName}`).isVisible();
    console.log('Task visible after reload:', taskVisible);

    await expect(page.locator(`text=${taskName}`)).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Debug: Console Errors', () => {
  test('should capture console errors during task creation', async ({ page }) => {
    const errors: string[] = [];
    const logs: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
      logs.push(`[${msg.type()}] ${msg.text()}`);
    });

    page.on('pageerror', err => {
      errors.push(err.message);
    });

    const userName = uniqueUserName();
    await registerAndLogin(page, userName);

    // Create a task
    const taskName = `Console_${Date.now()}`;
    const input = page.locator('input[placeholder="What needs to be done?"]');
    await input.click();
    await input.fill(taskName);
    await page.keyboard.press('Enter');

    // Wait and capture any async errors
    await page.waitForTimeout(3000);

    console.log('=== Console Logs ===');
    logs.forEach(log => console.log(log));

    console.log('=== Errors ===');
    errors.forEach(err => console.log('ERROR:', err));

    // Check for Supabase errors
    const supabaseErrors = errors.filter(e => e.toLowerCase().includes('supabase') || e.toLowerCase().includes('database'));
    expect(supabaseErrors).toHaveLength(0);
  });
});
