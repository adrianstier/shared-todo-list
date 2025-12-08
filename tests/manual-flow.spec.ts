import { test, expect, Page } from '@playwright/test';

// Use truly unique names with random suffix
function uniqueUserName() {
  return `U${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}

test.describe.serial('Manual Flow Tests', () => {
  let userName: string;

  test('1. Register new user', async ({ page }) => {
    userName = uniqueUserName();

    await page.goto('/');

    // Wait for login screen
    await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 15000 });
    console.log('Login screen visible');

    // Click Add New User
    await page.locator('button:has-text("Add New User")').click();

    // Wait for register form
    await expect(page.locator('text=Create Account')).toBeVisible({ timeout: 5000 });
    console.log('Register screen visible');

    // Fill name
    await page.locator('input[placeholder="Enter your name"]').fill(userName);
    console.log('Name filled:', userName);

    // Enter PIN digits
    const pinInputs = page.locator('input[type="password"]');
    const count = await pinInputs.count();
    console.log('PIN input count:', count);

    // First 4 are PIN, next 4 are confirm
    for (let i = 0; i < 4; i++) {
      await pinInputs.nth(i).fill(String(i + 1));
    }
    for (let i = 4; i < 8; i++) {
      await pinInputs.nth(i).fill(String(i - 3));
    }
    console.log('PIN entered');

    // Click Create Account
    await page.getByRole('button', { name: 'Create Account' }).click();
    console.log('Create Account clicked');

    // Wait for navigation - should see the main app
    await page.waitForTimeout(3000);
    await page.screenshot({ path: 'test-results/manual-1-after-register.png', fullPage: true });

    // Check if we're in the main app
    const todoInput = page.locator('input[placeholder="What needs to be done?"]');
    await expect(todoInput).toBeVisible({ timeout: 15000 });
    console.log('Main app visible!');
  });

  test('2. Add a task', async ({ page }) => {
    userName = uniqueUserName();

    // Register first
    await page.goto('/');
    await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 15000 });
    await page.locator('button:has-text("Add New User")').click();
    await expect(page.locator('text=Create Account')).toBeVisible({ timeout: 5000 });
    await page.locator('input[placeholder="Enter your name"]').fill(userName);
    const pinInputs = page.locator('input[type="password"]');
    for (let i = 0; i < 4; i++) await pinInputs.nth(i).fill(String(i + 1));
    for (let i = 4; i < 8; i++) await pinInputs.nth(i).fill(String(i - 3));
    await page.getByRole('button', { name: 'Create Account' }).click();

    // Wait for main app
    const todoInput = page.locator('input[placeholder="What needs to be done?"]');
    await expect(todoInput).toBeVisible({ timeout: 15000 });

    // Now add a task
    const taskName = `MyTask_${Date.now()}`;
    console.log('Adding task:', taskName);

    await todoInput.click();
    await todoInput.fill(taskName);

    // Verify input value
    const value = await todoInput.inputValue();
    console.log('Input value:', value);
    expect(value).toBe(taskName);

    // Submit
    await page.keyboard.press('Enter');
    console.log('Enter pressed');

    // Wait for task to appear
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/manual-2-after-add-task.png', fullPage: true });

    // Check if task is visible
    const taskElement = page.locator(`text=${taskName}`);
    const taskVisible = await taskElement.isVisible();
    console.log('Task visible:', taskVisible);

    // Check total tasks stat
    const statValue = await page.locator('p:has-text("Total Tasks")').locator('..').locator('p').first().textContent();
    console.log('Total tasks stat:', statValue);

    await expect(taskElement).toBeVisible({ timeout: 10000 });
  });

  test('3. User switcher modal appearance', async ({ page }) => {
    // Create first user
    const user1 = uniqueUserName();
    await page.goto('/');
    await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 15000 });
    await page.locator('button:has-text("Add New User")').click();
    await expect(page.locator('text=Create Account')).toBeVisible({ timeout: 5000 });
    await page.locator('input[placeholder="Enter your name"]').fill(user1);
    let pinInputs = page.locator('input[type="password"]');
    for (let i = 0; i < 4; i++) await pinInputs.nth(i).fill(String(i + 1));
    for (let i = 4; i < 8; i++) await pinInputs.nth(i).fill(String(i - 3));
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 15000 });
    console.log('User 1 registered:', user1);

    // Sign out
    await page.locator('button', { hasText: user1.substring(0, 2).toUpperCase() }).first().click();
    await page.waitForTimeout(500);
    await page.locator('text=Sign Out').click();
    await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 15000 });
    console.log('Signed out');

    // Create second user
    const user2 = uniqueUserName();
    await page.locator('button:has-text("Add New User")').click();
    await expect(page.locator('text=Create Account')).toBeVisible({ timeout: 5000 });
    await page.locator('input[placeholder="Enter your name"]').fill(user2);
    pinInputs = page.locator('input[type="password"]');
    for (let i = 0; i < 4; i++) await pinInputs.nth(i).fill(String(i + 1));
    for (let i = 4; i < 8; i++) await pinInputs.nth(i).fill(String(i - 3));
    await page.getByRole('button', { name: 'Create Account' }).click();
    await expect(page.locator('input[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 15000 });
    console.log('User 2 registered:', user2);

    // Click user dropdown
    await page.locator('button', { hasText: user2.substring(0, 2).toUpperCase() }).first().click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/manual-3-dropdown-open.png', fullPage: true });

    // Click on user1 to switch
    await page.locator(`button:has-text("${user1}")`).click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/manual-3-pin-modal.png', fullPage: true });

    // Verify PIN modal is visible
    await expect(page.locator('text=Enter PIN to switch')).toBeVisible({ timeout: 5000 });
    console.log('PIN modal visible!');

    // Check that PIN inputs are visible and usable
    const modalPinInputs = page.locator('input[type="password"]');
    const modalPinCount = await modalPinInputs.count();
    console.log('Modal PIN inputs count:', modalPinCount);
    expect(modalPinCount).toBe(4);

    // Enter correct PIN
    for (let i = 0; i < 4; i++) {
      await modalPinInputs.nth(i).fill(String(i + 1));
    }
    console.log('PIN entered in modal');

    // Wait for switch
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-results/manual-3-after-switch.png', fullPage: true });

    // Should now be logged in as user1
    await expect(page.locator(`text=Welcome, ${user1}`)).toBeVisible({ timeout: 10000 });
    console.log('Successfully switched to user1!');
  });
});
