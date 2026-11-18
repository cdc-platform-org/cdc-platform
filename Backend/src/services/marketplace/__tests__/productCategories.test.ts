// Every category value found in the live store on 2026-11-18, plus the old
// seller-form and header values, must land in the intended fixed group.
import { normalizeProductCategory, highlightRank } from '../productCategories';

describe('normalizeProductCategory', () => {
  it.each([
    ['Digital Art / Prints & Illustrations', 'CDC Studio — ოქროს საათი კახეთში', 'wall-art'],
    ['Printable Wall Art', 'ტროპიკული გეომეტრია', 'wall-art'],
    ['Kids & Education / Worksheets & Coloring', 'საახალწლო აქტივობები', 'coloring'],
    ['Education', 'ფერთა ქალაქის დაკარგული ფერები - 10 გასაფერადებელი თავსატეხი', 'coloring'],
    ['E-Books', 'საბავშვო გასაფერადებელი 0 10 მარტივი ნახატი', 'coloring'],
    ['Planners & Organizers / Printable Planners', '2027 წლის კალენდარი', 'planners'],
    ['Career / CV & Cover Letter Templates', 'კრეატიული CV', 'cv-career'],
    ['Small Business / Templates', 'ბიზნეს პოსი', 'design-business'],
    ['Design & Graphics / Vector Logos', 'ლოგო', 'design-business'],
    ['Events / Invitations & Cards', 'მოსაწვევი', 'invitations'],
    ['Education / Exam Prep', 'გამოცდის დღისთვის მზადების სია', 'education'],
    ['ebooks_guides', '', 'education'],
    ['design_graphics', '', 'design-business'],
    ['uiux_kits_templates', '', 'design-business'],
    ['ai_prompts_tools', '', 'ai-prompts'],
    ['ციფრული AI ხელსაწყოები', '', 'ai-prompts'],
    ['code_scripts', '', 'other'],
    ['audio_presets', '', 'other'],
    ['coloring', '', 'coloring'],
    ['', '', 'other'],
  ])('%s → %s', (category, title, expected) => {
    expect(normalizeProductCategory(category, title)).toBe(expected);
  });
});

describe('highlightRank', () => {
  it('puts flagged products before unflagged ones', () => {
    expect(highlightRank('BESTSELLER')).toBeLessThan(highlightRank('POPULAR'));
    expect(highlightRank('NEW')).toBeLessThan(highlightRank(null));
  });
});
