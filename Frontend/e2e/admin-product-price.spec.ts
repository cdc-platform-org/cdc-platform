import { test, expect, Page } from '@playwright/test';

async function setup(page: Page, failSave = false) {
  const user = { id: 'price-audit-admin', role: 'SuperAdmin', adminRole: 'SUPER_ADMIN', name: 'Admin', email: 'admin@example.test', status: 'APPROVED', termsAcceptedAt: '2026-01-01' };
  let product = { id: 'price-fixture', title: 'Price edit fixture', titleEn: 'Price edit fixture', description: 'Description', descriptionEn: 'Description', price: 100, currentPrice: 100, discountedPrice: null, saleActive: false, saleStartsAt: null, saleEndsAt: null, category: 'Templates', imageUrl: 'https://example.test/cover.png', fileUrl: 'https://example.test/file.zip', fileName: 'file.zip', additionalFiles: [], previewImages: [], previewVideoUrl: null, howItWorksSteps: null, toolRoute: null, status: 'PENDING', licenseType: 'PERSONAL_USE', submittedBy: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
  const writes: Record<string, unknown>[] = [];
  await page.addInitScript((user) => { localStorage.setItem('cdc_access_token', 'price-test'); localStorage.setItem('cdc_user', JSON.stringify(user)); }, user);
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = { data: {} };
    if (path.endsWith('/auth/me')) data = { user };
    if (path.endsWith('/admin/products')) data = { data: [product] };
    if (path.endsWith('/admin/products/price-fixture') && route.request().method() === 'PUT') {
      const patch = route.request().postDataJSON(); writes.push(patch);
      if (failSave) return route.fulfill({ status: 400, contentType: 'application/json', body: JSON.stringify({ message: 'Price update rejected' }) });
      product = { ...product, price: patch.priceMinor, currentPrice: patch.priceMinor };
      data = { data: product };
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.goto('/en/admin/products');
  return { card: page.locator('#product-price-fixture'), writes };
}

test('prefills GEL, saves integer tetri and updates the card immediately', async ({ page }) => {
  const { card, writes } = await setup(page);
  await expect(card.getByText(/1\.00 ₾/)).toBeVisible();
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  const price = card.getByLabel('Price (₾ / GEL)', { exact: true });
  await expect(price).toHaveValue('1.00');
  await expect(price).toHaveAttribute('step', '0.01');
  await expect(price).toHaveAttribute('min', '0');
  await price.fill('19.99');
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(card.getByText(/19\.99 ₾/)).toBeVisible();
  expect(writes[0].priceMinor).toBe(1999);
  expect(writes[0]).not.toHaveProperty('price');
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(price).toHaveValue('19.99');
  await price.fill('8.00');
  await card.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(card.getByText(/19\.99 ₾/)).toBeVisible();
  expect(writes).toHaveLength(1);
});

test('rejects empty/negative input and accepts zero', async ({ page }) => {
  const { card, writes } = await setup(page);
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  const price = card.getByLabel('Price (₾ / GEL)', { exact: true });
  for (const value of ['', '-1']) {
    await price.fill(value);
    await expect(card.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
    await expect(card.getByRole('alert')).toHaveText('Enter a valid non-negative price in GEL.');
  }
  expect(writes).toHaveLength(0);
  await price.fill('0');
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Edit', exact: true })).toBeVisible();
  expect(writes[0].priceMinor).toBe(0);
});

test('a rejected update keeps the form open and the displayed price unchanged', async ({ page }) => {
  const { card } = await setup(page, true);
  await card.getByRole('button', { name: 'Edit', exact: true }).click();
  await card.getByLabel('Price (₾ / GEL)', { exact: true }).fill('2.50');
  await card.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Price update rejected', { exact: true })).toBeVisible();
  await expect(card.getByLabel('Price (₾ / GEL)', { exact: true })).toHaveValue('2.50');
  await expect(card.getByText(/1\.00 ₾/)).toBeVisible();
});
