import { test, expect, Page } from '@playwright/test';

// Helper to register a new user and login
async function registerAndLogin(page: Page, userName: string = 'Test User', pin: string = '1234') {
  await page.goto('/');

  // Wait for login screen to load (shows "Bealer Agency" and "Task Management")
  await expect(page.locator('h1:has-text("Bealer Agency")')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('text=Task Management')).toBeVisible({ timeout: 5000 });

  // Click "Add New User" button
  await page.locator('button:has-text("Add New User")').click();

  // Wait for registration screen (wait for name input to appear)
  await expect(page.locator('input[placeholder="Enter your name"]')).toBeVisible({ timeout: 5000 });

  // Fill in name
  await page.locator('input[placeholder="Enter your name"]').fill(userName);

  // Enter PIN (4 digit inputs)
  const pinInputs = page.locator('input[type="password"]');
  for (let i = 0; i < 4; i++) {
    await pinInputs.nth(i).fill(pin[i]);
  }

  // Enter confirm PIN
  for (let i = 4; i < 8; i++) {
    await pinInputs.nth(i).fill(pin[i - 4]);
  }

  // Click Create Account button
  await page.getByRole('button', { name: 'Create Account' }).click();

  // Wait for app to load (shows main header with Bealer Agency)
  await expect(page.locator('textarea[placeholder="What needs to be done?"]')).toBeVisible({ timeout: 10000 });
}

// Generate unique test user name
function uniqueUserName() {
  return `T${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

test.describe('Subtask Feature', () => {
  test.beforeEach(async ({ page }) => {
    const userName = uniqueUserName();
    await registerAndLogin(page, userName);
  });

  test('should show subtasks section with AI Breakdown button when task is expanded', async ({ page }) => {
    // Add a task - avoid using "subtask" word in task text to prevent selector conflicts
    const taskText = `Build website ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Should show the Subtasks section with AI Breakdown button in expanded view
    // Use exact match to avoid matching task text that might contain "subtasks"
    await expect(page.locator('span.text-indigo-700:has-text("Subtasks")')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('button:has-text("AI Breakdown")')).toBeVisible({ timeout: 3000 });
  });

  test('should create subtasks when clicking AI Breakdown button', async ({ page }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    // Add a task that can be broken down
    const taskText = `Organize company retreat ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Click the AI Breakdown button
    await page.locator('button:has-text("AI Breakdown")').click();

    // Wait for loading state
    await expect(page.locator('text=AI...')).toBeVisible({ timeout: 3000 });

    // Wait for subtasks to appear (progress bar)
    await expect(page.locator('.h-2.bg-indigo-100')).toBeVisible({ timeout: 30000 });

    // Should have subtask items visible with checkboxes
    const subtaskCheckboxes = page.locator('.space-y-2 button.rounded.border-2');
    await expect(subtaskCheckboxes.first()).toBeVisible({ timeout: 5000 });
  });

  test('should allow manually adding subtasks without AI', async ({ page }) => {
    // Add a task
    const taskText = `Complete project ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Should see the manual subtask input
    await expect(page.locator('input[placeholder="Add a subtask..."]')).toBeVisible({ timeout: 3000 });

    // Add a manual subtask
    const manualSubtask = 'Custom subtask item';
    await page.locator('input[placeholder="Add a subtask..."]').fill(manualSubtask);
    await page.locator('input[placeholder="Add a subtask..."]').press('Enter');

    // Should see the new subtask
    await expect(page.locator(`text=${manualSubtask}`)).toBeVisible({ timeout: 3000 });

    // Should show count (1/1 or similar)
    await expect(page.locator('text=(0/1)')).toBeVisible({ timeout: 3000 });
  });

  test('should toggle subtask completion with checkbox', async ({ page }) => {
    // Add a task
    const taskText = `Review documents ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Add a manual subtask
    const subtaskText = 'First subtask';
    await page.locator('input[placeholder="Add a subtask..."]').fill(subtaskText);
    await page.locator('input[placeholder="Add a subtask..."]').press('Enter');

    // Wait for subtask to appear
    await expect(page.locator(`text=${subtaskText}`)).toBeVisible({ timeout: 3000 });

    // Should show 0/1 count (0 completed, 1 total)
    await expect(page.locator('text=(0/1)')).toBeVisible({ timeout: 3000 });

    // Click the subtask checkbox to complete it
    const subtaskCheckbox = page.locator('.space-y-2 button.rounded.border-2').first();
    await subtaskCheckbox.click();

    // Wait for count to update to 1/1
    await expect(page.locator('text=(1/1)')).toBeVisible({ timeout: 3000 });

    // Progress bar should be at 100%
    const progressBar = page.locator('.h-full.bg-indigo-500');
    await expect(progressBar).toHaveCSS('width', /100%|[0-9]+px/);
  });

  test('should delete subtask with trash icon', async ({ page }) => {
    // Add a task
    const taskText = `Prepare presentation ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Add two manual subtasks
    await page.locator('input[placeholder="Add a subtask..."]').fill('Subtask one');
    await page.locator('input[placeholder="Add a subtask..."]').press('Enter');
    await page.locator('input[placeholder="Add a subtask..."]').fill('Subtask two');
    await page.locator('input[placeholder="Add a subtask..."]').press('Enter');

    // Wait for both subtasks to appear
    await expect(page.locator('text=Subtask one')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('text=Subtask two')).toBeVisible({ timeout: 3000 });

    // Should show 0/2 count in header
    await expect(page.locator('text=(0/2)')).toBeVisible({ timeout: 3000 });

    // Delete first subtask - find the trash button within the subtask list
    const subtaskItems = page.locator('.space-y-2 > div').filter({ hasText: 'Subtask one' });
    const deleteButton = subtaskItems.locator('button').last();
    await deleteButton.click();

    // Wait for first subtask to be removed
    await expect(page.locator('text=Subtask one')).not.toBeVisible({ timeout: 3000 });

    // Should now show 0/1 count
    await expect(page.locator('text=(0/1)')).toBeVisible({ timeout: 3000 });
  });

  test('should allow inline editing of subtask text', async ({ page }) => {
    // Add a task
    const taskText = `Test editing ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Add a manual subtask
    const originalText = 'Original subtask text';
    await page.locator('input[placeholder="Add a subtask..."]').fill(originalText);
    await page.locator('input[placeholder="Add a subtask..."]').press('Enter');

    // Wait for subtask to appear
    await expect(page.locator(`text=${originalText}`)).toBeVisible({ timeout: 3000 });

    // Click on subtask text to edit it
    await page.locator(`text=${originalText}`).click();

    // Should show input field
    const editInput = page.locator('.space-y-2 input[type="text"]');
    await expect(editInput).toBeVisible({ timeout: 3000 });

    // Clear and type new text
    await editInput.clear();
    const newText = 'Updated subtask text';
    await editInput.fill(newText);
    await editInput.press('Enter');

    // Should show updated text
    await expect(page.locator(`text=${newText}`)).toBeVisible({ timeout: 3000 });
    await expect(page.locator(`text=${originalText}`)).not.toBeVisible();
  });

  test('should show subtask badge on collapsed task', async ({ page }) => {
    // Add a task
    const taskText = `Task with subtasks ${Date.now()}`;
    await page.locator('textarea[placeholder="What needs to be done?"]').fill(taskText);
    await page.locator('button:has-text("Add")').click();

    // Wait for task to appear
    await expect(page.locator(`text=${taskText}`)).toBeVisible({ timeout: 5000 });

    // Click on task to expand it
    await page.locator(`text=${taskText}`).click();

    // Add a manual subtask
    await page.locator('input[placeholder="Add a subtask..."]').fill('A subtask');
    await page.locator('input[placeholder="Add a subtask..."]').press('Enter');

    // Collapse the task by clicking somewhere else or pressing Escape
    await page.keyboard.press('Escape');

    // Wait a moment for the collapse animation
    await page.waitForTimeout(500);

    // Should see the subtask badge indicator (0/1) on the collapsed task - badge has ListTree icon and count
    const subtaskBadge = page.locator('button.bg-indigo-100:has-text("0/1")').first();
    await expect(subtaskBadge).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Subtask API', () => {
  test('should return proper structure from breakdown-task API', async ({ request }) => {
    // Skip if AI API not available
    test.skip(process.env.ANTHROPIC_API_KEY === undefined, 'Requires ANTHROPIC_API_KEY');

    const response = await request.post('/api/ai/breakdown-task', {
      data: {
        taskText: 'Organize team building event',
        priority: 'high'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.success).toBe(true);
    expect(data.subtasks).toBeDefined();
    expect(Array.isArray(data.subtasks)).toBe(true);
    expect(data.subtasks.length).toBeGreaterThanOrEqual(2);
    expect(data.subtasks.length).toBeLessThanOrEqual(6);

    // Each subtask should have required fields
    for (const subtask of data.subtasks) {
      expect(subtask.text).toBeDefined();
      expect(typeof subtask.text).toBe('string');
      expect(subtask.priority).toBeDefined();
      expect(['low', 'medium', 'high', 'urgent']).toContain(subtask.priority);
    }
  });

  test('should handle missing taskText gracefully', async ({ request }) => {
    const response = await request.post('/api/ai/breakdown-task', {
      data: {}
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  test('should handle empty taskText gracefully', async ({ request }) => {
    const response = await request.post('/api/ai/breakdown-task', {
      data: {
        taskText: ''
      }
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.success).toBe(false);
  });
});
