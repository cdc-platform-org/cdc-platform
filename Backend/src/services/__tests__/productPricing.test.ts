// Sale-window rules for DigitalProduct pricing (services/marketplace/productPricing.ts).
import { getCurrentProductPrice, isProductSaleActive } from '../marketplace/productPricing';

const hour = 3600_000;
const base = { price: 1000, discountedPrice: 700, saleEndsAt: null as Date | null };

describe('productPricing sale window', () => {
  it('is live immediately when no start date is set', () => {
    expect(isProductSaleActive(base)).toBe(true);
    expect(getCurrentProductPrice(base)).toBe(700);
  });

  it('charges the full price before a scheduled start', () => {
    const p = { ...base, saleStartsAt: new Date(Date.now() + hour) };
    expect(isProductSaleActive(p)).toBe(false);
    expect(getCurrentProductPrice(p)).toBe(1000);
  });

  it('is live between start and end', () => {
    const p = { ...base, saleStartsAt: new Date(Date.now() - hour), saleEndsAt: new Date(Date.now() + hour) };
    expect(getCurrentProductPrice(p)).toBe(700);
  });

  it('reverts to the full price after the end', () => {
    const p = { ...base, saleStartsAt: new Date(Date.now() - 2 * hour), saleEndsAt: new Date(Date.now() - hour) };
    expect(getCurrentProductPrice(p)).toBe(1000);
  });

  it('has no sale without a discounted price', () => {
    expect(isProductSaleActive({ ...base, discountedPrice: null })).toBe(false);
  });
});
