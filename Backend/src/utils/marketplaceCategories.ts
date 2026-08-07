// Mirrors Frontend/src/data/marketplaceCategories.ts's Business Tools
// category value. `category` is free text on DigitalProduct (no DB enum),
// so this is a naming convention shared across the two codebases rather
// than a real schema constraint — keep both in sync if the taxonomy changes.
const BUSINESS_TOOLS_CATEGORY_KA = 'ბიზნეს ინსტრუმენტები';
const BUSINESS_TOOLS_CATEGORY_EN = 'Business Tools';

export function isBusinessToolsCategory(category: string): boolean {
  return category === BUSINESS_TOOLS_CATEGORY_KA || category === BUSINESS_TOOLS_CATEGORY_EN;
}

// The only accounts allowed to claim/purchase a Business Tools category
// product — mirrors the identical frontend check in
// Frontend/pages/store/[id].tsx. That frontend check is UX only; this is
// the real enforcement boundary, since a direct API call bypasses the UI
// entirely.
//
// SuperAdmin bypasses the verification requirement (testing/support access)
// — same convention as the Enterprise AI Tools gate on /tools and the
// homepage (see pages/tools.tsx's canUseAiAssistant). Role is the DB's
// actual PascalCase value ('SuperAdmin'/'Client' — see User.role in
// schema.prisma), not the lowercase/camelCase names sometimes used
// informally when describing this check.
export function canPurchaseBusinessTools(user: { role: string; isVerified: boolean } | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'SuperAdmin') return true;
  return user.role === 'Client' && user.isVerified === true;
}
